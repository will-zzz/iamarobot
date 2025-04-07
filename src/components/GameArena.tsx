import React, { useState, useMemo, useEffect } from "react";
import Robot from "./Robot";
import Timer from "./Timer";
import { Textarea } from "./ui/textarea";

interface GameArenaProps {
  playerName: string;
}

// Sample messages
const sampleMessages = [
  "Hello fellow humans! I am enjoying this activity.",
  "I process... I mean, I feel emotions like happiness.",
  "My favorite food is pizza because of its taste qualities.",
  "I sleep 8 hours every night as humans should.",
  "I enjoy watching sports competitions on weekends.",
  "I am definitely not executing a program right now.",
];

const GameArena: React.FC<GameArenaProps> = ({ playerName }) => {
  const [gameId, setGameId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<
    { name: string; isHuman: boolean }[]
  >([]);

  // Initial state with a sample message
  const [currentSpeaker, setCurrentSpeaker] = useState(
    Math.floor(Math.random() * 6)
  );
  const [currentMessage, setCurrentMessage] = useState(sampleMessages[0]);
  const [userInput, setUserInput] = useState("");

  // Function to start a new game
  const startGame = async () => {
    try {
      const response = await fetch("http://localhost:3000/start-game", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: playerName }),
      });

      const result = await response.json();
      console.log("Game started:", result);

      // Store the gameId and participants from the response
      setGameId(result.gameId);
      setParticipants(
        result.players.map(
          (player: {
            gameId: string;
            id: string;
            name: string;
            identity: string;
          }) => ({
            name: player.name, // Extract the name property
            isHuman: player.name === playerName, // Check if the player is the human player
          })
        )
      );
    } catch (error) {
      console.error("Error starting game:", error);
    }
  };

  // Start the game when the component mounts
  useEffect(() => {
    startGame();
  }, []);

  const handleTimeUp = () => {
    console.log("Time's up!");
    // Future game logic here
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[80vh] justify-between">
      <div className="flex justify-center mb-8 mt-4">
        <Timer initialSeconds={60} onTimeUp={handleTimeUp} />
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex flex-wrap justify-center gap-8">
          {participants.map((participant, index) => (
            <div key={index} className="flex flex-col h-[220px] justify-end">
              <Robot
                name={participant.name}
                isHuman={participant.isHuman}
                isSpeaking={currentSpeaker === index}
                message={currentSpeaker === index ? currentMessage : undefined}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 mb-4 px-4 md:px-8">
        <Textarea
          value={userInput}
          onChange={handleInputChange}
          placeholder="Type your message here..."
          className="resize-none min-h-[60px] font-pixel text-xs bg-robot-dark border-2 border-robot-accent text-robot-light"
          style={{ minWidth: "100%" }}
        />
      </div>
    </div>
  );
};

export default GameArena;
