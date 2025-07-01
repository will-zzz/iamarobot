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
  const [cutsceneMessages, setCutsceneMessages] = useState<string[]>([]);
  const [aiReactions, setAiReactions] = useState<
    { playerId: number; playerName: string; reaction: string }[]
  >([]);
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

  // Use ref to track connection state in closures
  const connectionRef = useRef(false);

  const connect = useCallback(() => {
    const newSocket = io("http://localhost:3000");

    newSocket.on("connect", () => {
      console.log("🔌 CONNECTED to server");
      connectionRef.current = true;
      setIsConnected(true);
      newSocket.emit("join_game", { gameId, playerName });
    });

    newSocket.on("disconnect", () => {
      console.log("🔌 DISCONNECTED from server");
      connectionRef.current = false;
      setIsConnected(false);
    });

    newSocket.on("game_state", (state: GameState) => {
      console.log("Received game state:", state);
      setGameState(state);
    });

    newSocket.on("cutscene_started", () => {
      console.log("Cutscene started");
      setCutsceneMessages([]);
      setAiReactions([]);
    });

    newSocket.on("moderator_message", (data: { message: string }) => {
      console.log("Moderator message:", data.message);
      setCutsceneMessages((prev) => [...prev, data.message]);
    });

    newSocket.on(
      "ai_reaction",
      (data: { playerId: number; playerName: string; reaction: string }) => {
        console.log("AI reaction:", data);
        setAiReactions((prev) => [...prev, data]);
      }
    );

    newSocket.on(
      "chat_phase_started",
      (data: {
        currentTurn: number;
        timeLeft: number;
        roundNumber: number;
      }) => {
        console.log("Chat phase started:", data);
        setGameState((prev) => {
          const newState = prev
            ? {
                ...prev,
                gamePhase: "chat" as const,
                isVotingPhase: false,
                currentTurn: data.currentTurn,
                timeLeft: data.timeLeft,
                roundNumber: data.roundNumber,
              }
            : null;
          return newState;
        });
      }
    );

    newSocket.on("voting_phase_started", (data: { currentVoter: number }) => {
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

    newSocket.on("message_sent", (data: Message) => {
      console.log(
        "📨 NEW MESSAGE:",
        data.playerName,
        ":",
        data.message,
        "(connected:",
        connectionRef.current,
        ")"
      );
      setMessages((prev) => {
        const newMessages = [...prev, { ...data, timestamp: Date.now() }];
        console.log("📊 Messages count:", prev.length, "→", newMessages.length);
        return newMessages;
      });
    });

    newSocket.on("vote_submitted", (data: Vote) => {
      console.log("Vote submitted:", data);
      setVotes((prev) => [...prev, { ...data, timestamp: Date.now() }]);
    });

    newSocket.on("turn_advanced", (data: { currentTurn: number }) => {
      console.log("Turn advanced:", data);
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              currentTurn: data.currentTurn,
            }
          : null
      );
    });

    newSocket.on("voter_advanced", (data: { currentVoter: number }) => {
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
        console.log("Player eliminated:", data);
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
        console.log("Game ended:", data);
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
      if (socket && isConnected) {
        socket.emit("send_message", { gameId, message });
      }
    },
    [socket, isConnected, gameId]
  );

  const submitVote = useCallback(
    (vote: string) => {
      if (socket && isConnected) {
        socket.emit("submit_vote", { gameId, vote });
      }
    },
    [socket, isConnected, gameId]
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
    cutsceneMessages,
    aiReactions,
    eliminatedPlayer,
    gameEnded,
    sendMessage,
    submitVote,
  };
};
