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
}

interface GameState {
  id: string;
  players: Player[];
  currentTurn: number | null;
  isVotingPhase: boolean;
  currentVoter: number | null;
  votingResponses: string[];
  gamePhase: "waiting" | "chat" | "voting" | "ended";
  timeLeft: number;
  turnTimer: NodeJS.Timeout | null;
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
    if (!player || player.id !== game.currentTurn) {
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

    // Clear the message after 3 seconds
    setTimeout(() => {
      this.io.to(gameId).emit("message_cleared", { playerId: player.id });
    }, 3000);

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
    if (!player || player.id !== game.currentVoter) {
      socket.emit("error", { message: "Not your turn to vote" });
      return;
    }

    // Record the vote
    game.votingResponses.push(vote);

    // Broadcast vote to all players
    this.io.to(gameId).emit("vote_submitted", {
      playerId: player.id,
      playerName: player.name,
      vote,
      isHuman: player.isHuman,
    });

    // Clear the vote after 2 seconds
    setTimeout(() => {
      this.io.to(gameId).emit("vote_cleared", { playerId: player.id });
    }, 2000);

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

    // Create game state
    const players: Player[] = dbPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      isHuman: p.name === playerName,
      identity: p.identity || undefined,
    }));

    const gameState: GameState = {
      id: gameId,
      players,
      currentTurn: null,
      isVotingPhase: false,
      currentVoter: null,
      votingResponses: [],
      gamePhase: "waiting",
      timeLeft: 30,
      turnTimer: null,
    };

    this.games.set(gameId, gameState);

    // Start the game after a short delay
    setTimeout(() => {
      this.startChatPhase(gameId);
    }, 2000);

    return { gameId, players };
  }

  private startChatPhase(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gamePhase = "chat";
    game.currentTurn = game.players[0].id;
    game.timeLeft = 30;

    this.io.to(gameId).emit("chat_phase_started", {
      currentTurn: game.currentTurn,
      timeLeft: game.timeLeft,
    });

    this.startTurnTimer(gameId);

    // If first player is AI, trigger AI response
    if (!game.players[0].isHuman) {
      this.handleAITurn(gameId);
    }
  }

  private startVotingPhase(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gamePhase = "voting";
    game.isVotingPhase = true;
    game.currentVoter = game.players[0].id;
    game.votingResponses = [];

    this.io.to(gameId).emit("voting_phase_started", {
      currentVoter: game.currentVoter,
    });

    // If first voter is AI, trigger AI vote
    if (!game.players[0].isHuman) {
      this.handleAIVote(gameId);
    }
  }

  private advanceTurn(gameId: string) {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== "chat") return;

    const currentIndex = game.players.findIndex(
      (p) => p.id === game.currentTurn
    );
    const nextIndex = (currentIndex + 1) % game.players.length;
    const nextPlayer = game.players[nextIndex];

    game.currentTurn = nextPlayer.id;
    game.timeLeft = 30;

    this.io.to(gameId).emit("turn_advanced", {
      currentTurn: game.currentTurn,
      timeLeft: game.timeLeft,
    });

    this.startTurnTimer(gameId);

    // If next player is AI, trigger AI response
    if (!nextPlayer.isHuman) {
      this.handleAITurn(gameId);
    }
  }

  private advanceVoter(gameId: string) {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== "voting") return;

    const currentIndex = game.players.findIndex(
      (p) => p.id === game.currentVoter
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex < game.players.length) {
      // Move to next voter
      game.currentVoter = game.players[nextIndex].id;

      this.io.to(gameId).emit("voter_advanced", {
        currentVoter: game.currentVoter,
      });

      // If next voter is AI, trigger AI vote
      if (!game.players[nextIndex].isHuman) {
        this.handleAIVote(gameId);
      }
    } else {
      // All players have voted, end voting phase
      this.endVotingPhase(gameId);
    }
  }

  private async handleAITurn(gameId: string) {
    const game = this.games.get(gameId);
    if (!game || !game.currentTurn) return;

    const aiPlayer = game.players.find((p) => p.id === game.currentTurn);
    if (!aiPlayer || aiPlayer.isHuman) return;

    try {
      // Get other player names
      const otherPlayerNames = game.players
        .filter((p) => p.id !== aiPlayer.id)
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

        // Clear message after 3 seconds
        setTimeout(() => {
          this.io.to(gameId).emit("message_cleared", { playerId: aiPlayer.id });
        }, 3000);

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
    if (!aiPlayer || aiPlayer.isHuman) return;

    try {
      // Get other player names
      const otherPlayerNames = game.players
        .filter((p) => p.id !== aiPlayer.id)
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
          vote,
          isHuman: false,
        });

        // Clear vote after 2 seconds
        setTimeout(() => {
          this.io.to(gameId).emit("vote_cleared", { playerId: aiPlayer.id });
        }, 2000);

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
        if (game.gamePhase === "chat") {
          this.startVotingPhase(gameId);
        }
        // Clear timer
        if (game.turnTimer) {
          clearInterval(game.turnTimer);
          game.turnTimer = null;
        }
      }
    }, 1000);
  }

  private endVotingPhase(gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    game.gamePhase = "chat";
    game.isVotingPhase = false;
    game.currentVoter = null;

    this.io.to(gameId).emit("voting_phase_ended", {
      votes: game.votingResponses,
    });

    // Start new chat round
    setTimeout(() => {
      this.startChatPhase(gameId);
    }, 3000);
  }

  private getPublicGameState(game: GameState) {
    return {
      id: game.id,
      players: game.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHuman: p.isHuman,
      })),
      currentTurn: game.currentTurn,
      isVotingPhase: game.isVotingPhase,
      currentVoter: game.currentVoter,
      gamePhase: game.gamePhase,
      timeLeft: game.timeLeft,
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
