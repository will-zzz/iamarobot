import React, { useState, useEffect } from "react";
import Robot from "./Robot";
import Timer from "./Timer";
import { Textarea } from "./ui/textarea";
import { useGameSocket } from "@/hooks/useGameSocket";

interface GameArenaProps {
  playerName: string;
}

const GameArena: React.FC<GameArenaProps> = ({ playerName }) => {
  const [userInput, setUserInput] = useState("");
  const {
    participants,
    currentTurn,
    isVotingPhase,
    currentVoter,
    timeLeft,
    isMyTurn,
    isConnected,
    error,
    startGame,
    sendMessage,
  } = useGameSocket({ playerName });

  // Start the game when component mounts
  useEffect(() => {
    startGame().catch(console.error);
  }, [startGame]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const handleSubmit = () => {
    if (!userInput.trim()) return;

    sendMessage(userInput);
    setUserInput("");
  };

  // Show loading state while connecting
  if (!isConnected) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[80vh] justify-center items-center">
        <div className="text-2xl text-robot-accent">
          Connecting to game server...
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[80vh] justify-center items-center">
        <div className="text-2xl text-red-500">Error: {error}</div>
      </div>
    );
  }

  // Show loading state while waiting for game state
  if (participants.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[80vh] justify-center items-center">
        <div className="text-2xl text-robot-accent">Starting game...</div>
      </div>
    );
  }

  // In voting phase, highlight current voter, otherwise highlight current speaker
  const getHighlightedId = () => {
    return isVotingPhase ? currentVoter : currentTurn;
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[80vh] justify-between">
      <div className="flex justify-center mb-8 mt-4">
        {isVotingPhase ? (
          <div className="text-2xl font-bold text-robot-accent">
            TIME TO VOTE
          </div>
        ) : (
          <Timer initialSeconds={timeLeft} onTimeUp={() => {}} />
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex flex-wrap justify-center gap-8">
          {participants.map((participant, index) => (
            <div key={index} className="flex flex-col h-[220px] justify-end">
              <Robot
                name={participant.name}
                isHuman={participant.isHuman}
                isSpeaking={participant.isSpeaking || false}
                message={participant.message || ""}
              />
              {getHighlightedId() === participant.id && (
                <div className="mt-2 text-robot-accent">⬆️</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 mb-4 px-4 md:px-8">
        <Textarea
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault(); // Prevent adding a new line
              handleSubmit(); // Call the submit function
            }
          }}
          placeholder={
            isVotingPhase
              ? "Type your vote here..."
              : "Type your message here..."
          }
          disabled={!isMyTurn}
          className="resize-none min-h-[60px] font-pixel text-xs bg-robot-dark border-2 border-robot-accent text-robot-light"
          style={{ minWidth: "100%" }}
        />
        <button
          onClick={handleSubmit}
          disabled={!isMyTurn}
          className="mt-4 px-4 py-2 bg-robot-accent text-robot-dark font-bold rounded disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default GameArena;
