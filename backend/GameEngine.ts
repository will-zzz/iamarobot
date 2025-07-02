import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import OpenAI from "openai";
import { prompts } from "./prompts";
import prisma from "./prisma/client";
import fs from "fs";

interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  identity?: string;
  socketId?: string;
  isEliminated?: boolean;
}

interface GameState {
  id: string;
  players: Player[];
  currentTurn: number | null;
  isVotingPhase: boolean;
  currentVoter: number | null;
  votingResponses: string[];
  gamePhase:
    | "cutscene"
    | "waiting"
    | "chat"
    | "voting"
    | "elimination"
    | "ended";
  timeLeft: number;
  turnTimer: NodeJS.Timeout | null;
  roundNumber: number;
  eliminatedPlayers: number[];
  lastMessage: string | null;
  speakingHistory: { [playerId: number]: number }; // playerId -> last turn number
  humanTimeoutId: NodeJS.Timeout | null;
  humanIsTyping: boolean;
}

export class GameEngine {
  private games: Map<string, GameState> = new Map();
  private io: SocketIOServer;
  private openai: OpenAI;

  constructor(server: HTTPServer, openai: OpenAI) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: [
          "http://localhost:8080",
          "http://127.0.0.1:5500",
          "http://localhost:5500",
        ],
        methods: ["GET", "POST"],
        credentials: true,
      },
    });
    this.openai = openai;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);

      socket.on("join_game", (data: { gameId: string; playerName: string }) => {
        this.handleJoinGame(socket, data);
      });

      socket.on("send_message", (data: { gameId: string; message: string }) => {
        this.handleSendMessage(socket, data);
      });

      socket.on(
        "typing_started",
        (data: { gameId: string; playerId: number }) => {
          this.handleHumanTyping(data.gameId, data.playerId);
        }
      );

      socket.on("submit_vote", (data: { gameId: string; vote: string }) => {
        this.handleSubmitVote(socket, data);
      });

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleJoinGame(
    socket: any,
    data: { gameId: string; playerName: string }
  ) {
    const { gameId, playerName } = data;
    const game = this.games.get(gameId);

    if (!game) {
      socket.emit("error", { message: "Game not found" });
      return;
    }

    // Find the player and associate with socket
    const player = game.players.find((p) => p.name === playerName);
    if (player) {
      player.socketId = socket.id;
      socket.join(gameId);

      // Send current game state to the player
      socket.emit("game_state", this.getPublicGameState(game));

      // Notify other players
      socket.to(gameId).emit("player_joined", { playerName });
    } else {
      socket.emit("error", { message: "Player not found in game" });
    }
  }

  private async handleSendMessage(
    socket: any,
    data: { gameId: string; message: string }
  ) {
    const { gameId, message } = data;
    const game = this.games.get(gameId);

    if (!game || game.gamePhase !== "chat") {
      console.error("Cannot send message now - not in chat phase");
      return;
    }

    // Find the player by socket ID
    const player = game.players.find((p) => p.socketId === socket.id);
    if (!player || player.isEliminated) {
      console.error("Player not found or eliminated");
      return;
    }

    // For humans, allow sending messages anytime during chat phase (they can interrupt)
    // For AIs, only allow during their turn
    if (!player.isHuman && player.id !== game.currentTurn) {
      console.error("Not AI's turn");
      return;
    }

    // If human is sending a message, make sure they have the turn
    if (player.isHuman && game.currentTurn !== player.id) {
      game.currentTurn = player.id;
      game.speakingHistory[player.id] = game.roundNumber;

      this.io.to(gameId).emit("turn_advanced", {
        currentTurn: game.currentTurn,
      });
    }

    // Clear any existing timeout since human is actively participating
    if (player.isHuman && game.humanTimeoutId) {
      clearTimeout(game.humanTimeoutId);
      game.humanTimeoutId = null;
    }

    // Clear typing flag when human sends message
    if (player.isHuman) {
      if (game.humanIsTyping) {
        console.log(
          `⌨️ Game ${gameId}: Human finished typing, clearing typing flag`
        );
      }
      game.humanIsTyping = false;
    }

    // Save message to database
    await prisma.message.create({
      data: {
        content: `${player.name}: ${message}`,
        gameId: parseInt(gameId),
      },
    });

    // Update last message for turn selection
    game.lastMessage = message;

    // Broadcast message to all players
    this.io.to(gameId).emit("message_sent", {
      playerId: player.id,
      playerName: player.name,
      message,
      isHuman: player.isHuman,
    });

    // Advance turn after message is sent
    this.advanceTurn(gameId);
  }

  private async handleSubmitVote(
    socket: any,
    data: { gameId: string; vote: string }
  ) {
    const { gameId, vote } = data;
    const game = this.games.get(gameId);

    if (!game || game.gamePhase !== "voting") {
      console.error("Not voting phase");
      return;
    }

    const player = game.players.find((p) => p.socketId === socket.id);
    if (!player || player.id !== game.currentVoter || player.isEliminated) {
      console.error("Not your turn to vote");
      return;
    }

    // Record the vote
    game.votingResponses.push(vote);

    // Save vote to database
    await prisma.message.create({
      data: {
        content: `${player.name}: ${vote}`,
        gameId: parseInt(gameId),
      },
    });

    // Broadcast vote to all players
    this.io.to(gameId).emit("vote_submitted", {
      playerId: player.id,
      playerName: player.name,
      vote: `${player.name}: ${vote}`,
      isHuman: player.isHuman,
    });

    // Immediately disable chatbox to prevent extra messages
    this.io.to(gameId).emit("disable_chat");

    // Advance to next voter
    setTimeout(() => {
      this.advanceVoter(gameId);
    }, 1000);
  }

  private handleDisconnect(socket: any) {
    console.log("Client disconnected:", socket.id);

    // Find and remove socket association
    for (const [gameId, game] of this.games) {
      const player = game.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.socketId = undefined;
        this.io
          .to(gameId)
          .emit("player_disconnected", { playerName: player.name });
        break;
      }
    }
  }

  public async startGame(
    playerName: string
  ): Promise<{ gameId: string; players: Player[] }> {
    // Create game in database
    const game = await prisma.game.create({ data: {} });
    const gameId = game.id.toString();

    // Generate AIs
    await this.generateAIs(game.id);

    // Add human player
    await prisma.player.create({
      data: {
        name: playerName,
        identity: "You are a human player trying to blend in with AI players.",
        gameId: game.id,
      },
    });

    // Fetch all players
    const allPlayers = await prisma.player.findMany({
      where: { gameId: game.id },
    });

    // Create game state with all players
    const players: Player[] = allPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      isHuman: p.name === playerName,
      identity: p.identity || "",
      isEliminated: false,
    }));

    // Shuffle players to randomize positions
    this.shuffleArray(players);

    const gameState: GameState = {
      id: gameId,
      players,
      currentTurn: null,
      isVotingPhase: false,
      currentVoter: null,
      votingResponses: [],
      gamePhase: "waiting",
      timeLeft: 0,
      turnTimer: null,
      roundNumber: 1,
      eliminatedPlayers: [],
      lastMessage: null,
      speakingHistory: {},
      humanTimeoutId: null,
      humanIsTyping: false,
    };

    this.games.set(gameId, gameState);

    // Start chat phase immediately
    this.startChatPhase(gameId);

    return { gameId, players };
  }

  private startChatPhase(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gamePhase = "chat";
    game.isVotingPhase = false;
    game.currentVoter = null; // Clear voting state
    game.timeLeft = 20; // 60 seconds for chat phase

    // Emit voting phase ended event and updated game state to clear voting UI
    this.io.to(gameId).emit("voting_phase_ended");
    this.io.to(gameId).emit("enable_chat"); // Re-enable chatbox for new chat phase
    this.io.to(gameId).emit("game_state", this.getPublicGameState(game));

    // Start turn timer
    this.startTurnTimer(gameId);

    // Advance to first turn
    this.advanceTurn(gameId);
  }

  private startVotingPhase(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gamePhase = "voting";
    game.isVotingPhase = true;
    game.votingResponses = [];

    // Clear the current turn to remove "SPEAKING" tag from chat phase
    game.currentTurn = null;

    // Find first active player for voting
    const activePlayers = game.players.filter((p) => !p.isEliminated);
    game.currentVoter = activePlayers[0].id;

    this.io.to(gameId).emit("voting_phase_started", {
      currentVoter: game.currentVoter,
    });

    // Also emit updated game state to ensure frontend gets currentTurn = null
    this.io.to(gameId).emit("game_state", this.getPublicGameState(game));

    // If first voter is AI, trigger AI vote
    if (!activePlayers[0].isHuman) {
      this.handleAIVote(gameId);
    }
  }

  private advanceTurn(gameId: string) {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== "chat") return;

    // CRITICAL FIX: If human is actively typing, don't advance turn
    if (game.humanIsTyping) {
      console.log(`⏳ Game ${gameId}: Human is typing, not advancing turn`);
      return;
    }

    const activePlayers = game.players.filter((p) => !p.isEliminated);
    const nextPlayer = this.determineNextSpeaker(gameId, activePlayers);

    // If no next player determined (no name mentioned), wait for human input or timeout
    if (!nextPlayer) {
      console.log(
        `⏳ Game ${gameId}: No name mentioned, waiting for human input or 3-second timeout`
      );

      // Clear any existing timeout
      if (game.humanTimeoutId) {
        clearTimeout(game.humanTimeoutId);
      }

      // Set 3-second timeout to give turn to random AI
      game.humanTimeoutId = setTimeout(() => {
        const currentGame = this.games.get(gameId);
        if (currentGame && currentGame.gamePhase === "chat") {
          console.log(
            `⏰ Game ${gameId}: 3 seconds passed, giving turn to random AI`
          );
          this.assignTurnToRandomAI(gameId, activePlayers);
        }
      }, 3000);

      console.log(
        `⏳ Game ${gameId}: Set 3-second timeout for random AI selection`
      );

      return;
    }

    game.currentTurn = nextPlayer.id;

    // Update speaking history
    game.speakingHistory[nextPlayer.id] = game.roundNumber;

    this.io.to(gameId).emit("turn_advanced", {
      currentTurn: game.currentTurn,
    });

    // If next player is AI, trigger AI response
    if (!nextPlayer.isHuman) {
      this.handleAITurn(gameId);
    }
  }

  private determineNextSpeaker(
    gameId: string,
    activePlayers: Player[]
  ): Player | null {
    const game = this.games.get(gameId);
    if (!game) return activePlayers[0];

    // Get the last message to check for name mentions
    const lastMessage = this.getLastMessage(gameId);

    console.log(`🎯 TURN SELECTION DEBUG - Game ${gameId}:`);
    console.log(`   Last message: "${lastMessage}"`);
    console.log(
      `   Active players:`,
      activePlayers.map((p) => `${p.name} (${p.isHuman ? "human" : "ai"})`)
    );

    // 1. Check for name mentions first
    if (lastMessage) {
      const mentionedPlayer = this.findMentionedPlayer(
        lastMessage,
        activePlayers
      );
      if (mentionedPlayer) {
        console.log(`   ✅ Name mentioned, ${mentionedPlayer.name} gets turn`);
        return mentionedPlayer;
      }
    }

    // 2. If no name mentioned, don't assign a turn immediately
    // The turn will be assigned after 3 seconds or when human starts typing
    console.log(`   ⏳ No name mentioned, waiting for human input or timeout`);
    return null;
  }

  private getLastMessage(gameId: string): string | null {
    // This would need to be implemented to get the last message from the database
    // For now, we'll need to track this in the game state
    const game = this.games.get(gameId);
    return game?.lastMessage || null;
  }

  private findMentionedPlayer(
    message: string,
    players: Player[]
  ): Player | null {
    const messageLower = message.toLowerCase();

    for (const player of players) {
      const nameLower = player.name.toLowerCase();

      // Check if message contains the full name
      if (messageLower.includes(nameLower)) {
        return player;
      }

      // Check if message contains a word that matches the beginning of the player's name
      const nameWords = nameLower.split(" ");
      for (const word of nameWords) {
        if (word.length > 0 && messageLower.includes(word)) {
          return player;
        }
      }
    }

    return null;
  }

  private findLongestSilentPlayer(
    gameId: string,
    activePlayers: Player[]
  ): Player {
    const game = this.games.get(gameId);
    if (!game) return activePlayers[0];

    let longestSilentPlayer = activePlayers[0];
    let longestSilentTurns = game.roundNumber;

    for (const player of activePlayers) {
      const lastSpoken = game.speakingHistory[player.id] || 0;
      const turnsSilent = game.roundNumber - lastSpoken;

      if (turnsSilent > longestSilentTurns) {
        longestSilentTurns = turnsSilent;
        longestSilentPlayer = player;
      }
    }

    return longestSilentPlayer;
  }

  private advanceVoter(gameId: string) {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== "voting") return;

    const activePlayers = game.players.filter((p) => !p.isEliminated);
    const currentIndex = activePlayers.findIndex(
      (p) => p.id === game.currentVoter
    );
    const nextIndex = currentIndex + 1;

    console.log(
      `Game ${gameId}: Voter advanced. Current: ${currentIndex}, Next: ${nextIndex}, Total active: ${activePlayers.length}`
    );

    if (nextIndex < activePlayers.length) {
      // Move to next voter
      game.currentVoter = activePlayers[nextIndex].id;

      this.io.to(gameId).emit("voter_advanced", {
        currentVoter: game.currentVoter,
      });

      // If next voter is AI, trigger AI vote
      if (!activePlayers[nextIndex].isHuman) {
        this.handleAIVote(gameId);
      }
    } else {
      // All players have voted, process elimination
      console.log(`Game ${gameId}: All players voted, processing elimination`);
      this.processElimination(gameId).catch(console.error);
    }
  }

  private async processElimination(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    // Set game phase to elimination to prevent further input
    game.gamePhase = "elimination";
    this.io.to(gameId).emit("game_state", this.getPublicGameState(game));

    console.log(
      `Game ${gameId}: Processing elimination. Votes:`,
      game.votingResponses
    );

    try {
      // Use the /calculate-votes endpoint to process votes
      const response = await fetch(`http://localhost:3000/calculate-votes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ votes: game.votingResponses }),
      });

      if (!response.ok) {
        throw new Error("Failed to calculate votes");
      }

      const voteCounts = await response.json();
      console.log(`Game ${gameId}: Vote counts:`, voteCounts);

      // Find player with most votes
      let eliminatedPlayerName = "";
      let maxVotes = 0;

      Object.entries(voteCounts as { [key: string]: number }).forEach(
        ([name, count]) => {
          if (count > maxVotes) {
            maxVotes = count;
            eliminatedPlayerName = name;
          }
        }
      );

      console.log(
        `Game ${gameId}: Eliminating player: ${eliminatedPlayerName} with ${maxVotes} votes`
      );

      // Find the eliminated player
      const eliminatedPlayer = game.players.find(
        (p) => p.name === eliminatedPlayerName
      );
      if (eliminatedPlayer) {
        eliminatedPlayer.isEliminated = true;
        game.eliminatedPlayers.push(eliminatedPlayer.id);

        // Add moderator message to chat
        await prisma.message.create({
          data: {
            content: `Moderator: ${eliminatedPlayer.name} has been eliminated. Continue to search for the human.`,
            gameId: parseInt(gameId),
          },
        });

        // Broadcast moderator message to chat
        this.io.to(gameId).emit("message_sent", {
          playerId: 0,
          playerName: "Moderator",
          message: `${eliminatedPlayer.name} has been eliminated. Continue to search for the human.`,
          isHuman: false,
        });

        // Broadcast elimination event
        this.io.to(gameId).emit("player_eliminated", {
          playerId: eliminatedPlayer.id,
          playerName: eliminatedPlayer.name,
          isHuman: eliminatedPlayer.isHuman,
          voteCounts,
        });

        // Check game end conditions
        const activePlayers = game.players.filter((p) => !p.isEliminated);
        const humanPlayer = activePlayers.find((p) => p.isHuman);

        console.log(
          `Game ${gameId}: After elimination. Active players: ${activePlayers.length}, Human alive: ${!!humanPlayer}`
        );

        if (!humanPlayer) {
          // Human eliminated - AIs win
          console.log(`Game ${gameId}: Human eliminated - AIs win`);
          this.endGame(gameId, "ai_win");
        } else if (activePlayers.length <= 2) {
          // Only 2 players remain - Human wins
          console.log(`Game ${gameId}: Only 2 players remain - Human wins`);
          this.endGame(gameId, "human_win");
        } else {
          // Continue to next round
          console.log(`Game ${gameId}: Continuing to next round`);
          setTimeout(() => {
            game.roundNumber++;
            this.startChatPhase(gameId);
          }, 3000);
        }
      } else {
        console.error(
          `Game ${gameId}: Could not find player to eliminate: ${eliminatedPlayerName}`
        );
      }
    } catch (error) {
      console.error(`Game ${gameId}: Error processing elimination:`, error);
      // Fallback to simple vote counting if API fails
      this.processEliminationFallback(gameId);
    }
  }

  private processEliminationFallback(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    // Set game phase to elimination to prevent further input
    game.gamePhase = "elimination";
    this.io.to(gameId).emit("game_state", this.getPublicGameState(game));

    console.log(`Game ${gameId}: Using fallback elimination processing`);

    // Count votes manually as fallback
    const voteCounts: { [key: string]: number } = {};
    game.votingResponses.forEach((vote) => {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });

    console.log(`Game ${gameId}: Fallback vote counts:`, voteCounts);

    // Find player with most votes
    let eliminatedPlayerName = "";
    let maxVotes = 0;

    Object.entries(voteCounts).forEach(([name, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedPlayerName = name;
      }
    });

    console.log(
      `Game ${gameId}: Fallback eliminating player: ${eliminatedPlayerName} with ${maxVotes} votes`
    );

    // Find the eliminated player
    const eliminatedPlayer = game.players.find(
      (p) => p.name === eliminatedPlayerName
    );
    if (eliminatedPlayer) {
      eliminatedPlayer.isEliminated = true;
      game.eliminatedPlayers.push(eliminatedPlayer.id);

      // Add moderator message to chat
      prisma.message
        .create({
          data: {
            content: `Moderator: ${eliminatedPlayer.name} has been eliminated. Continue to search for the human.`,
            gameId: parseInt(gameId),
          },
        })
        .catch(console.error);

      // Broadcast moderator message to chat
      this.io.to(gameId).emit("message_sent", {
        playerId: 0,
        playerName: "Moderator",
        message: `${eliminatedPlayer.name} has been eliminated. Continue to search for the human.`,
        isHuman: false,
      });

      // Broadcast elimination event
      this.io.to(gameId).emit("player_eliminated", {
        playerId: eliminatedPlayer.id,
        playerName: eliminatedPlayer.name,
        isHuman: eliminatedPlayer.isHuman,
        voteCounts,
      });

      // Check game end conditions
      const activePlayers = game.players.filter((p) => !p.isEliminated);
      const humanPlayer = activePlayers.find((p) => p.isHuman);

      if (!humanPlayer) {
        this.endGame(gameId, "ai_win");
      } else if (activePlayers.length <= 2) {
        this.endGame(gameId, "human_win");
      } else {
        setTimeout(() => {
          game.roundNumber++;
          this.startChatPhase(gameId);
        }, 3000);
      }
    }
  }

  private endGame(gameId: string, winner: "human_win" | "ai_win") {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gamePhase = "ended";

    this.io.to(gameId).emit("game_ended", {
      winner,
      finalPlayers: game.players.filter((p) => !p.isEliminated),
    });
  }

  private async handleAITurn(gameId: string) {
    const game = this.games.get(gameId);
    if (!game || !game.currentTurn) return;

    const aiPlayer = game.players.find((p) => p.id === game.currentTurn);
    if (!aiPlayer || aiPlayer.isHuman || aiPlayer.isEliminated) return;

    try {
      // Get other player names
      const otherPlayerNames = game.players
        .filter((p) => p.id !== aiPlayer.id && !p.isEliminated)
        .map((p) => p.name)
        .join(", ");

      // Fetch conversation
      const formattedMessages = await this.fetchConversation(parseInt(gameId));

      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: prompts.chat(aiPlayer.name, otherPlayerNames),
          },
          ...formattedMessages,
        ],
        model: "gpt-4o-mini",
      });

      if (completion.choices[0].message.content) {
        const response = completion.choices[0].message.content.replace(
          /^[^:]+:\s*/,
          ""
        );

        // Save to database
        await prisma.message.create({
          data: {
            content: `${aiPlayer.name}: ${response}`,
            gameId: parseInt(gameId),
          },
        });

        // Update last message for turn selection
        game.lastMessage = response;

        // Broadcast AI message
        this.io.to(gameId).emit("message_sent", {
          playerId: aiPlayer.id,
          playerName: aiPlayer.name,
          message: response,
          isHuman: false,
        });

        // Advance turn
        setTimeout(() => {
          this.advanceTurn(gameId);
        }, 3500);
      }
    } catch (error) {
      console.error(`Game ${gameId}: AI chat error:`, error);
      // Fallback: advance turn anyway
      setTimeout(() => {
        this.advanceTurn(gameId);
      }, 2000);
    }
  }

  private async handleAIVote(gameId: string) {
    const game = this.games.get(gameId);
    if (!game || !game.currentVoter) return;

    const aiPlayer = game.players.find((p) => p.id === game.currentVoter);
    if (!aiPlayer || aiPlayer.isHuman || aiPlayer.isEliminated) return;

    try {
      // Get other player names
      const otherPlayerNames = game.players
        .filter((p) => p.id !== aiPlayer.id && !p.isEliminated)
        .map((p) => p.name)
        .join(", ");

      // Fetch conversation
      const formattedMessages = await this.fetchConversation(parseInt(gameId));

      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: prompts.voting(aiPlayer.name, otherPlayerNames),
          },
          ...formattedMessages,
        ],
        model: "gpt-4o-mini",
      });

      if (completion.choices[0].message.content) {
        const vote = completion.choices[0].message.content.replace(
          /^[^:]+:\s*/,
          ""
        );

        // Record the vote
        game.votingResponses.push(vote);

        // Save AI vote to database
        await prisma.message.create({
          data: {
            content: `${aiPlayer.name}: ${vote}`,
            gameId: parseInt(gameId),
          },
        });

        // Broadcast AI vote
        this.io.to(gameId).emit("vote_submitted", {
          playerId: aiPlayer.id,
          playerName: aiPlayer.name,
          vote: `${aiPlayer.name}: ${vote}`,
          isHuman: false,
        });

        // Immediately disable chatbox to prevent extra messages
        this.io.to(gameId).emit("disable_chat");

        // Advance voter
        setTimeout(() => {
          this.advanceVoter(gameId);
        }, 2500);
      }
    } catch (error) {
      console.error("AI vote error:", error);
      // Fallback: advance voter anyway
      setTimeout(() => {
        this.advanceVoter(gameId);
      }, 2000);
    }
  }

  private startTurnTimer(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    // Clear existing timer
    if (game.turnTimer) {
      clearInterval(game.turnTimer);
    }

    game.turnTimer = setInterval(() => {
      game.timeLeft--;

      this.io.to(gameId).emit("time_update", { timeLeft: game.timeLeft });

      if (game.timeLeft <= 0) {
        // Clear timer
        if (game.turnTimer) {
          clearInterval(game.turnTimer);
          game.turnTimer = null;
        }

        if (game.gamePhase === "chat") {
          console.log(
            `Game ${gameId}: Chat phase ended, starting voting phase`
          );
          this.startVotingPhase(gameId);
        }
      }
    }, 1000);
  }

  private getPublicGameState(game: GameState) {
    return {
      id: game.id,
      players: game.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHuman: p.isHuman,
        isEliminated: p.isEliminated || false,
      })),
      // During voting or elimination phase, don't send currentTurn to prevent "SPEAKING" styling
      currentTurn:
        game.isVotingPhase || game.gamePhase === "elimination"
          ? null
          : game.currentTurn,
      isVotingPhase: game.isVotingPhase,
      currentVoter: game.currentVoter,
      gamePhase: game.gamePhase,
      timeLeft: game.timeLeft,
      roundNumber: game.roundNumber,
    };
  }

  private async fetchConversation(gameId: number) {
    const messages = await prisma.message.findMany({
      where: { gameId },
      orderBy: { createdAt: "asc" },
    });

    return messages.map((msg) => ({
      role: "user" as const,
      content: msg.content,
    }));
  }

  private async generateAIs(gameId: number) {
    const namesList = fs.readFileSync("./names.txt", "utf-8").split("\n");
    const filteredNames = namesList.filter((name) => name.trim() !== "");
    let names: String[] = [];

    for (let i = 0; i < 5; i++) {
      const randomIndex = Math.floor(Math.random() * filteredNames.length);
      if (!names.includes(filteredNames[randomIndex])) {
        let name = filteredNames[randomIndex].trim();
        names.push(name);

        // Generate AI identity
        let fullIdentity = "";
        let identities: String[] = [];
        const identitiesList = fs
          .readFileSync("./identities.txt", "utf-8")
          .split("\n");
        const filteredIdentites = identitiesList.filter(
          (identity) => identity.trim() !== ""
        );

        for (let j = 0; j < 3; j++) {
          const randomIndex = Math.floor(
            Math.random() * filteredIdentites.length
          );
          if (!identities.includes(filteredIdentites[randomIndex].trim())) {
            let identity = filteredIdentites[randomIndex].trim();
            identities.push(identity);
            fullIdentity += `You ${identity} `;
          } else {
            j--;
          }
        }

        fullIdentity = fullIdentity.slice(0, -1);

        // Save AI to database
        await prisma.player.create({
          data: {
            name: name,
            identity: fullIdentity,
            gameId: gameId,
          },
        });
      } else {
        i--;
      }
    }
  }

  handleHumanTyping(gameId: string, playerId: number) {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== "chat") return;

    // Find the human player
    const humanPlayer = game.players.find((p) => p.isHuman);
    if (!humanPlayer) return;

    console.log(
      `⌨️ Game ${gameId}: Human started typing, giving them the turn immediately`
    );
    console.log(`   Current timeout exists: ${!!game.humanTimeoutId}`);

    // Clear any existing timeout (this is the key fix)
    if (game.humanTimeoutId) {
      clearTimeout(game.humanTimeoutId);
      game.humanTimeoutId = null;
      console.log(`   ✅ Cleared existing timeout`);
    }

    // Set flag that human is actively typing
    game.humanIsTyping = true;

    // Assign turn to human immediately
    game.currentTurn = humanPlayer.id;
    game.speakingHistory[humanPlayer.id] = game.roundNumber;

    this.io.to(gameId).emit("turn_advanced", {
      currentTurn: game.currentTurn,
    });
  }

  private assignTurnToRandomAI(gameId: string, activePlayers: Player[]) {
    const game = this.games.get(gameId);
    if (!game) return;

    // Filter to only AI players
    const aiPlayers = activePlayers.filter((p) => !p.isHuman);
    if (aiPlayers.length === 0) return;

    // Pick a random AI player
    const randomAI = aiPlayers[Math.floor(Math.random() * aiPlayers.length)];

    console.log(
      `🤖 Game ${gameId}: Assigning turn to random AI: ${randomAI.name}`
    );

    game.currentTurn = randomAI.id;
    game.speakingHistory[randomAI.id] = game.roundNumber;

    this.io.to(gameId).emit("turn_advanced", {
      currentTurn: game.currentTurn,
    });

    // Trigger AI response
    this.handleAITurn(gameId);
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
