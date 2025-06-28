import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  isSpeaking?: boolean;
  message?: string;
}

interface GameState {
  id: string;
  players: Player[];
  currentTurn: number | null;
  isVotingPhase: boolean;
  currentVoter: number | null;
  gamePhase: "waiting" | "chat" | "voting" | "ended";
  timeLeft: number;
}

interface UseGameSocketProps {
  playerName: string;
}

export const useGameSocket = ({ playerName }: UseGameSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io("http://localhost:3000");
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      setError(null);
      console.log("Connected to game server");
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from game server");
    });

    newSocket.on("error", (data) => {
      setError(data.message);
      console.error("Socket error:", data);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("game_state", (data: GameState) => {
      console.log("Game state received:", data);
      setGameState(data);
    });

    socket.on("chat_phase_started", (data) => {
      console.log("Chat phase started:", data);
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              gamePhase: "chat",
              currentTurn: data.currentTurn,
              timeLeft: data.timeLeft,
            }
          : null
      );
    });

    socket.on("voting_phase_started", (data) => {
      console.log("Voting phase started:", data);
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              gamePhase: "voting",
              isVotingPhase: true,
              currentVoter: data.currentVoter,
            }
          : null
      );
    });

    socket.on("turn_advanced", (data) => {
      console.log("Turn advanced:", data);
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              currentTurn: data.currentTurn,
              timeLeft: data.timeLeft,
            }
          : null
      );
    });

    socket.on("voter_advanced", (data) => {
      console.log("Voter advanced:", data);
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              currentVoter: data.currentVoter,
            }
          : null
      );
    });

    socket.on("message_sent", (data) => {
      console.log("Message sent:", data);
      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((player) =>
            player.id === data.playerId
              ? { ...player, isSpeaking: true, message: data.message }
              : player
          ),
        };
      });
    });

    socket.on("message_cleared", (data) => {
      console.log("Message cleared:", data);
      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((player) =>
            player.id === data.playerId
              ? { ...player, isSpeaking: false, message: "" }
              : player
          ),
        };
      });
    });

    socket.on("vote_submitted", (data) => {
      console.log("Vote submitted:", data);
      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((player) =>
            player.id === data.playerId
              ? {
                  ...player,
                  isSpeaking: true,
                  message: `I voted for ${data.vote}!`,
                }
              : player
          ),
        };
      });
    });

    socket.on("vote_cleared", (data) => {
      console.log("Vote cleared:", data);
      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((player) =>
            player.id === data.playerId
              ? { ...player, isSpeaking: false, message: "" }
              : player
          ),
        };
      });
    });

    socket.on("voting_phase_ended", (data) => {
      console.log("Voting phase ended:", data);
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              gamePhase: "chat",
              isVotingPhase: false,
              currentVoter: null,
            }
          : null
      );
    });

    socket.on("time_update", (data) => {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              timeLeft: data.timeLeft,
            }
          : null
      );
    });
  }, [socket]);

  // Start a new game
  const startGame = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:3000/start-game", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: playerName }),
      });

      if (!response.ok) {
        throw new Error("Failed to start game");
      }

      const result = await response.json();
      setGameId(result.gameId);

      // Join the game via WebSocket
      if (socket) {
        socket.emit("join_game", {
          gameId: result.gameId,
          playerName: playerName,
        });
      }

      return result;
    } catch (error) {
      console.error("Error starting game:", error);
      setError("Failed to start game");
      throw error;
    }
  }, [playerName, socket]);

  // Send a message (chat or vote)
  const sendMessage = useCallback(
    (message: string) => {
      if (!socket || !gameId) {
        console.error("Socket or gameId not available");
        return;
      }

      if (gameState?.gamePhase === "voting") {
        socket.emit("submit_vote", { gameId, vote: message });
      } else {
        socket.emit("send_message", { gameId, message });
      }
    },
    [socket, gameId, gameState?.gamePhase]
  );

  // Check if it's the current player's turn
  const isMyTurn = useCallback(() => {
    if (!gameState) return false;

    const currentPlayer = gameState.players.find((p) => p.isHuman);
    if (!currentPlayer) return false;

    if (gameState.gamePhase === "voting") {
      return gameState.currentVoter === currentPlayer.id;
    } else {
      return gameState.currentTurn === currentPlayer.id;
    }
  }, [gameState]);

  // Get current player info
  const currentPlayer = gameState?.players.find((p) => p.isHuman);

  return {
    // State
    gameState,
    gameId,
    isConnected,
    error,

    // Computed values
    participants: gameState?.players || [],
    currentTurn: gameState?.currentTurn || null,
    isVotingPhase: gameState?.isVotingPhase || false,
    currentVoter: gameState?.currentVoter || null,
    timeLeft: gameState?.timeLeft || 0,
    isMyTurn: isMyTurn(),

    // Actions
    startGame,
    sendMessage,

    // Legacy compatibility (for gradual migration)
    handleUserMessage: sendMessage,
    handleTimeUp: () => {}, // No longer needed - server handles timing
    userVoted: false, // No longer needed - server tracks this
  };
};
