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
      socket.emit("error", { message: "Cannot send message now" });
      return;
    }

    // Find the player by socket ID
    const player = game.players.find((p) => p.socketId === socket.id);
    if (!player || player.id !== game.currentTurn || player.isEliminated) {
      socket.emit("error", { message: "Not your turn" });
      return;
    }

    // Save message to database
    await prisma.message.create({
      data: {
        content: `${player.name}: ${message}`,
        gameId: parseInt(gameId),
      },
    });

    // Broadcast message to all players
    this.io.to(gameId).emit("message_sent", {
      playerId: player.id,
      playerName: player.name,
      message,
      isHuman: player.isHuman,
    });

    // Advance to next turn
    this.advanceTurn(gameId);
  }

  private async handleSubmitVote(
    socket: any,
    data: { gameId: string; vote: string }
  ) {
    const { gameId, vote } = data;
    const game = this.games.get(gameId);

    if (!game || game.gamePhase !== "voting") {
      socket.emit("error", { message: "Not voting phase" });
      return;
    }

    const player = game.players.find((p) => p.socketId === socket.id);
    if (!player || player.id !== game.currentVoter || player.isEliminated) {
      socket.emit("error", { message: "Not your turn to vote" });
      return;
    }

    // Record the vote
    game.votingResponses.push(vote);

    // Broadcast vote to all players
    this.io.to(gameId).emit("vote_submitted", {
      playerId: player.id,
      playerName: player.name,
      vote: `${player.name}: ${vote}`,
      isHuman: player.isHuman,
    });

    // Advance to next voter
    this.advanceVoter(gameId);
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
        identity: "You are the human",
        gameId: game.id,
      },
    });

    // Fetch all players
    const dbPlayers = await prisma.player.findMany({
      where: { gameId: game.id },
    });

    // Create game state with randomized player order
    const players: Player[] = dbPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      isHuman: p.name === playerName,
      identity: p.identity || undefined,
      isEliminated: false,
    }));

    // Randomize player order (shuffle the array)
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }

    const gameState: GameState = {
      id: gameId,
      players,
      currentTurn: null,
      isVotingPhase: false,
      currentVoter: null,
      votingResponses: [],
      gamePhase: "cutscene",
      timeLeft: 60,
      turnTimer: null,
      roundNumber: 1,
      eliminatedPlayers: [],
    };

    this.games.set(gameId, gameState);

    // Start the cutscene
    this.startCutscene(gameId);

    return { gameId, players };
  }

  private startCutscene(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    // Send cutscene start event
    this.io.to(gameId).emit("cutscene_started");

    // Moderator message
    setTimeout(() => {
      this.io.to(gameId).emit("moderator_message", {
        message:
          "You may be wondering why we've arrested you six. Please do not be alarmed when I tell you this, but... one of you is a human.",
      });
    }, 1000);

    // AI reactions - wait for moderator to finish (about 4 seconds for the message)
    const aiReactions = [
      "What!?",
      "No way!",
      "The horror!",
      "Impossible!",
      "How dare you!",
    ];
    const aiPlayers = game.players.filter((p) => !p.isHuman);

    aiPlayers.forEach((ai, index) => {
      setTimeout(
        () => {
          this.io.to(gameId).emit("ai_reaction", {
            playerId: ai.id,
            playerName: ai.name,
            reaction: aiReactions[index % aiReactions.length],
          });
        },
        6000 + index * 800
      ); // Start at 6 seconds (after moderator finishes)
    });

    // Final moderator message
    setTimeout(() => {
      this.io.to(gameId).emit("moderator_message", {
        message:
          "As there are five AIs to one human, we will trust you to uncover it yourselves. You will have 60 seconds to talk amongst yourselves, then you will all vote for someone to send to the crushers below. You will repeat this until the human is eliminated, or until two of you remain.",
      });
    }, 11000); // Wait for AI reactions to finish

    // Start the game after cutscene
    setTimeout(() => {
      this.startChatPhase(gameId);
    }, 1000); // Give more time for the final message
  }

  private startChatPhase(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gamePhase = "chat";
    game.timeLeft = 60;

    // Select first player (randomly, but not the human)
    const activePlayers = game.players.filter((p) => !p.isEliminated);
    const nonHumanPlayers = activePlayers.filter((p) => !p.isHuman);
    const firstPlayer =
      nonHumanPlayers[Math.floor(Math.random() * nonHumanPlayers.length)];

    game.currentTurn = firstPlayer.id;

    this.io.to(gameId).emit("chat_phase_started", {
      currentTurn: game.currentTurn,
      timeLeft: game.timeLeft,
      roundNumber: game.roundNumber,
    });

    this.startTurnTimer(gameId);

    // If first player is AI, trigger AI response
    if (!firstPlayer.isHuman) {
      this.handleAITurn(gameId);
    }
  }

  private startVotingPhase(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gamePhase = "voting";
    game.isVotingPhase = true;
    game.votingResponses = [];

    // Find first active player for voting
    const activePlayers = game.players.filter((p) => !p.isEliminated);
    game.currentVoter = activePlayers[0].id;

    this.io.to(gameId).emit("voting_phase_started", {
      currentVoter: game.currentVoter,
    });

    // If first voter is AI, trigger AI vote
    if (!activePlayers[0].isHuman) {
      this.handleAIVote(gameId);
    }
  }

  private advanceTurn(gameId: string) {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== "chat") return;

    const activePlayers = game.players.filter((p) => !p.isEliminated);
    const currentIndex = activePlayers.findIndex(
      (p) => p.id === game.currentTurn
    );
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    const nextPlayer = activePlayers[nextIndex];

    game.currentTurn = nextPlayer.id;

    this.io.to(gameId).emit("turn_advanced", {
      currentTurn: game.currentTurn,
    });

    // If next player is AI, trigger AI response
    if (!nextPlayer.isHuman) {
      this.handleAITurn(gameId);
    }
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
      this.processElimination(gameId);
    }
  }

  private processElimination(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    console.log(
      `Game ${gameId}: Processing elimination. Votes:`,
      game.votingResponses
    );

    // Count votes
    const voteCounts: { [key: string]: number } = {};
    game.votingResponses.forEach((vote) => {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });

    console.log(`Game ${gameId}: Vote counts:`, voteCounts);

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
      `Game ${gameId}: Eliminating player: ${eliminatedPlayerName} with ${maxVotes} votes`
    );

    // Find the eliminated player
    const eliminatedPlayer = game.players.find(
      (p) => p.name === eliminatedPlayerName
    );
    if (eliminatedPlayer) {
      eliminatedPlayer.isEliminated = true;
      game.eliminatedPlayers.push(eliminatedPlayer.id);

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
      console.error("AI chat error:", error);
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

        // Broadcast AI vote
        this.io.to(gameId).emit("vote_submitted", {
          playerId: aiPlayer.id,
          playerName: aiPlayer.name,
          vote: `${aiPlayer.name}: ${vote}`,
          isHuman: false,
        });

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
      currentTurn: game.currentTurn,
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
}
