import React, { useState, useRef, useEffect } from "react";
import { useGameSocket } from "../hooks/useGameSocket";
import Robot from "./Robot";
import Timer from "./Timer";

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
    cutsceneMessages,
    aiReactions,
    eliminatedPlayer,
    gameEnded,
    sendMessage,
    submitVote,
  } = useGameSocket({ gameId, playerName });

  const [inputMessage, setInputMessage] = useState("");
  const [currentTypingMessage, setCurrentTypingMessage] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Typewriter effect for cutscene messages
  useEffect(() => {
    if (cutsceneMessages.length > 0 && typingIndex < cutsceneMessages.length) {
      const message = cutsceneMessages[typingIndex];
      let charIndex = 0;
      setCurrentTypingMessage("");

      const typeInterval = setInterval(() => {
        if (charIndex < message.length) {
          setCurrentTypingMessage((prev) => prev + message[charIndex]);
          charIndex++;
        } else {
          clearInterval(typeInterval);
          setTimeout(() => {
            setTypingIndex((prev) => prev + 1);
          }, 1000);
        }
      }, 50);

      return () => clearInterval(typeInterval);
    }
  }, [cutsceneMessages, typingIndex]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, votes]);

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

  // Cutscene phase
  if (gameState.gamePhase === "cutscene") {
    return (
      <div className="h-screen bg-robot-dark flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8 min-h-0">
          <div className="max-w-4xl w-full">
            <div className="bg-robot-darker border-2 border-robot-accent p-8 rounded-lg">
              <div className="text-robot-light text-xl leading-relaxed mb-6">
                {currentTypingMessage}
                <span className="animate-pulse">|</span>
              </div>

              {aiReactions.length > 0 && (
                <div className="space-y-2">
                  {aiReactions.map((reaction, index) => (
                    <div key={index} className="text-robot-accent text-lg">
                      {reaction.playerName}: "{reaction.reaction}"
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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
              <div className="text-robot-accent text-lg">
                Final survivors:{" "}
                {gameEnded.finalPlayers.map((p) => p.name).join(", ")}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-robot-dark flex flex-col overflow-hidden">
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
        <div className="flex-1 p-4 flex items-end justify-center min-w-0">
          <div className="flex justify-center items-end space-x-3 w-full max-w-full">
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
        <div className="w-80 bg-robot-darker border-l-2 border-robot-accent p-4 flex flex-col flex-shrink-0 min-h-0">
          <div className="flex-1 overflow-y-auto mb-4 min-h-0">
            <div className="space-y-2">
              {messages.map((msg, index) => (
                <div key={index} className="bg-robot-dark p-3 rounded">
                  <div className="text-robot-accent font-bold">
                    {msg.playerName}
                  </div>
                  <div className="text-robot-light">{msg.message}</div>
                </div>
              ))}
              {votes.map((vote, index) => (
                <div
                  key={index}
                  className="bg-robot-dark p-3 rounded border-l-4 border-robot-accent"
                >
                  <div className="text-robot-light">{vote.vote}</div>
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
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  gameState.gamePhase === "voting"
                    ? isMyTurn()
                      ? "Enter your vote..."
                      : "Waiting for your turn to vote..."
                    : isMyTurn()
                      ? "Type your message..."
                      : "Waiting for your turn..."
                }
                disabled={!isMyTurn()}
                className="flex-1 bg-robot-dark border border-robot-accent text-robot-light px-3 py-2 rounded disabled:opacity-50 min-w-0"
              />
              <button
                type="submit"
                disabled={!isMyTurn() || !inputMessage.trim()}
                className="bg-robot-accent text-robot-dark px-4 py-2 rounded disabled:opacity-50 hover:bg-robot-accent/80 whitespace-nowrap"
              >
                {gameState.gamePhase === "voting" ? "Vote" : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Elimination Overlay */}
      {eliminatedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-robot-darker border-2 border-robot-accent p-8 rounded-lg text-center">
            <h2 className="text-robot-light text-3xl mb-4">
              {eliminatedPlayer.playerName} has been eliminated!
            </h2>
            <p className="text-robot-light text-xl mb-4">
              {eliminatedPlayer.isHuman
                ? "The human has been caught!"
                : "An AI has been eliminated!"}
            </p>
            <div className="text-robot-accent text-lg">
              Vote counts:{" "}
              {Object.entries(eliminatedPlayer.voteCounts)
                .map(([name, count]) => `${name}: ${count}`)
                .join(", ")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameArena;
