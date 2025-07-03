import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useGameSocket } from "../hooks/useGameSocket";
import Robot from "./Robot";
import Timer from "./Timer";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";

interface GameArenaProps {
  gameId: string;
  playerName: string;
}

const GameArena: React.FC<GameArenaProps> = ({ gameId, playerName }) => {
  const {
    gameState,
    messages,
    votes,
    isConnected,
    eliminatedPlayer,
    gameEnded,
    sendMessage,
    sendTypingEvent,
    submitVote,
  } = useGameSocket({ gameId, playerName });

  const { toast } = useToast();
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, votes]);

  // Show toast notification when someone is eliminated
  useEffect(() => {
    if (eliminatedPlayer) {
      toast({
        title: `${eliminatedPlayer.playerName} was eliminated!`,
        description: eliminatedPlayer.isHuman ? "Game over!" : null,
        variant: eliminatedPlayer.isHuman ? "destructive" : "default",
      });
    }
  }, [eliminatedPlayer, toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    if (gameState?.gamePhase === "voting") {
      submitVote(inputMessage);
    } else {
      sendMessage(inputMessage);
    }
    setInputMessage("");
  };

  const isMyTurn = () => {
    if (!gameState) return false;
    const currentPlayer = gameState.players.find((p) => p.name === playerName);
    if (!currentPlayer) return false;

    if (gameState.gamePhase === "voting") {
      return gameState.currentVoter === currentPlayer.id;
    } else {
      return gameState.currentTurn === currentPlayer.id;
    }
  };

  const currentPlayer = gameState?.players.find((p) => p.name === playerName);

  // Debug: Log when messages change
  useEffect(() => {
    console.log(
      "🎯 MESSAGES CHANGED - Length:",
      messages.length,
      "Messages:",
      messages
    );
  }, [messages]);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-robot-light text-xl">Connecting to game...</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-robot-light text-xl">Loading game...</div>
      </div>
    );
  }

  // Game ended
  if (gameEnded) {
    return (
      <div className="h-screen bg-robot-dark flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8 min-h-0">
          <div className="max-w-4xl w-full">
            <div className="bg-robot-darker border-2 border-robot-accent p-8 rounded-lg text-center">
              <h2 className="text-robot-light text-3xl mb-4">
                {gameEnded.winner === "human_win" ? "Human Wins!" : "AIs Win!"}
              </h2>
              <p className="text-robot-light text-xl mb-6">
                {gameEnded.winner === "human_win"
                  ? "The human successfully survived and won the game!"
                  : "The AIs successfully identified and eliminated the human!"}
              </p>
              <div className="text-robot-accent text-lg mb-8">
                Final survivors:{" "}
                {gameEnded.finalPlayers.map((p) => p.name).join(", ")}
              </div>
              <Button
                onClick={() => window.location.reload()}
                className="bg-robot-highlight text-robot-dark hover:bg-robot-highlight/80 text-lg px-8 py-4"
              >
                Play Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-robot-dark flex flex-col overflow-hidden">
      <Toaster />
      {/* Header */}
      <div className="h-16 bg-robot-darker border-b-2 border-robot-accent px-4 flex items-center flex-shrink-0">
        <div className="flex justify-between items-center w-full">
          <div className="text-robot-light text-xl">
            Round {gameState.roundNumber} -{" "}
            {gameState.gamePhase === "chat" ? "Chat Phase" : "Voting Phase"}
          </div>
          <Timer initialSeconds={gameState.timeLeft} />
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Robots Section */}
        <div className="flex-1 p-6 flex items-center justify-center min-w-0 ">
          <div className="grid grid-cols-3 auto-rows-fr gap-6 w-full h-full">
            {gameState.players.map((player) => (
              <Robot
                key={player.id}
                name={player.name}
                isHuman={player.isHuman}
                isCurrentTurn={gameState.currentTurn === player.id}
                isCurrentVoter={gameState.currentVoter === player.id}
                isEliminated={player.isEliminated}
              />
            ))}
          </div>
        </div>

        {/* Chat/Voting Section */}
        <div className="w-[28rem] bg-robot-darker border-l-2 border-robot-accent p-6 flex flex-col flex-shrink-0 min-h-0">
          <div className="flex-1 overflow-y-auto mb-4 min-h-0">
            <div className="space-y-3">
              {[...messages, ...votes]
                .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                .map((item, index) => (
                  <div
                    key={
                      item.timestamp || `${item.playerId || "vote"}-${index}`
                    }
                    className={`bg-robot-dark p-3 rounded ${
                      "vote" in item ? "border-l-4 border-robot-accent" : ""
                    }`}
                  >
                    <div className="text-robot-accent font-bold">
                      {item.playerName}
                    </div>
                    <div className="text-robot-light">
                      {"message" in item
                        ? item.message
                        : item.vote.split(": ")[1] || item.vote}
                    </div>
                  </div>
                ))}
            </div>
            <div ref={messagesEndRef} />
          </div>

          {/* Input Section */}
          {currentPlayer && !currentPlayer.isEliminated && (
            <form
              onSubmit={handleSubmit}
              className="flex gap-2 flex-shrink-0 overflow-hidden"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  // Emit typing event whenever human starts typing (first character) - only during chat phase
                  if (
                    e.target.value.length === 1 &&
                    gameState.gamePhase === "chat"
                  ) {
                    sendTypingEvent();
                  }
                }}
                placeholder={
                  gameState.gamePhase === "voting"
                    ? isMyTurn()
                      ? "Enter your vote..."
                      : "Waiting for your turn to vote..."
                    : "Type your message..."
                }
                disabled={
                  gameState.gamePhase === "voting" ? !isMyTurn() : false
                }
                className="flex-1 bg-robot-dark border border-robot-accent text-robot-light px-3 py-2 rounded disabled:opacity-50 min-w-0"
              />
              <button
                type="submit"
                disabled={
                  gameState.gamePhase === "voting"
                    ? !isMyTurn() || !inputMessage.trim()
                    : !inputMessage.trim()
                }
                className="bg-robot-accent text-robot-dark px-4 py-2 rounded disabled:opacity-50 hover:bg-robot-accent/80 whitespace-nowrap"
              >
                {gameState.gamePhase === "voting" ? "Vote" : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameArena;
