import React, { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  isEliminated?: boolean;
}

interface GameState {
  id: string;
  players: Player[];
  currentTurn: number | null;
  isVotingPhase: boolean;
  currentVoter: number | null;
  gamePhase:
    | "cutscene"
    | "waiting"
    | "chat"
    | "voting"
    | "elimination"
    | "ended";
  timeLeft: number;
  roundNumber: number;
}

interface Message {
  playerId: number;
  playerName: string;
  message: string;
  isHuman: boolean;
  timestamp?: number;
}

interface Vote {
  playerId: number;
  playerName: string;
  vote: string;
  isHuman: boolean;
  timestamp?: number;
}

interface UseGameSocketProps {
  gameId: string;
  playerName: string;
}

export const useGameSocket = ({ gameId, playerName }: UseGameSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [eliminatedPlayer, setEliminatedPlayer] = useState<{
    playerId: number;
    playerName: string;
    isHuman: boolean;
    voteCounts: any;
  } | null>(null);
  const [gameEnded, setGameEnded] = useState<{
    winner: string;
    finalPlayers: Player[];
  } | null>(null);
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);
  const [gamePhase, setGamePhase] = useState<string>("waiting");
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const connect = useCallback(() => {
    const newSocket = io(import.meta.env.VITE_API_URL);

    newSocket.on("connect", () => {
      setIsConnected(true);
      newSocket.emit("join_game", { gameId, playerName });
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    newSocket.on("game_state", (state: GameState) => {
      setGameState(state);
    });

    newSocket.on("voting_phase_started", (data: { currentVoter: number }) => {
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

    newSocket.on("voter_advanced", (data: { currentVoter: number }) => {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              currentVoter: data.currentVoter,
            }
          : null
      );
    });

    newSocket.on("message_sent", (data: Message) => {
      setMessages((prev) => [...prev, { ...data, timestamp: Date.now() }]);
    });

    newSocket.on("vote_submitted", (data: Vote) => {
      setVotes((prev) => [...prev, { ...data, timestamp: Date.now() }]);
    });

    newSocket.on("turn_advanced", (data: { currentTurn: number }) => {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              currentTurn: data.currentTurn,
            }
          : null
      );
    });

    newSocket.on("time_update", (data: { timeLeft: number }) => {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              timeLeft: data.timeLeft,
            }
          : null
      );
    });

    newSocket.on(
      "player_eliminated",
      (data: {
        playerId: number;
        playerName: string;
        isHuman: boolean;
        voteCounts: any;
      }) => {
        setEliminatedPlayer(data);
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                players: prev.players.map((p) =>
                  p.id === data.playerId ? { ...p, isEliminated: true } : p
                ),
              }
            : null
        );
      }
    );

    newSocket.on(
      "game_ended",
      (data: { winner: string; finalPlayers: Player[] }) => {
        setGameEnded(data);
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                gamePhase: "ended",
              }
            : null
        );
      }
    );

    newSocket.on("error", (data: { message: string }) => {
      console.error("Socket error:", data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [gameId, playerName]);

  const sendMessage = useCallback(
    (message: string) => {
      if (socket && message.trim()) {
        socket.emit("send_message", { gameId, message });
      }
    },
    [socket, gameId]
  );

  const sendTypingEvent = useCallback(() => {
    if (socket && gameState?.currentTurn) {
      // Find the human player
      const humanPlayer = gameState.players.find((p) => p.isHuman);
      if (humanPlayer) {
        socket.emit("typing_started", {
          gameId,
          playerId: humanPlayer.id,
        });
      }
    }
  }, [socket, gameId, gameState]);

  const submitVote = useCallback(
    (vote: string) => {
      if (socket && vote.trim()) {
        socket.emit("submit_vote", { gameId, vote });
      }
    },
    [socket, gameId]
  );

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  // Clear eliminated player after 3 seconds
  useEffect(() => {
    if (eliminatedPlayer) {
      const timer = setTimeout(() => {
        setEliminatedPlayer(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [eliminatedPlayer]);

  return {
    gameState,
    messages,
    votes,
    isConnected,
    eliminatedPlayer,
    gameEnded,
    sendMessage,
    sendTypingEvent,
    submitVote,
  };
};
