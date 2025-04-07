import React, { useState, useMemo, useEffect } from "react";
import Robot from "./Robot";
import Timer from "./Timer";
import { Textarea } from "./ui/textarea";

interface GameArenaProps {
  playerName: string;
}

const GameArena: React.FC<GameArenaProps> = ({ playerName }) => {
  const [gameId, setGameId] = useState<string | null>(null);
  const [aiId, setAiId] = useState<string>("");
  const [participants, setParticipants] = useState<
    {
      id: number;
      name: string;
      isHuman: boolean;
      isSpeaking: boolean;
      message: string;
    }[]
  >([]);
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
            id: number;
            name: string;
            identity: string;
          }) => ({
            id: player.id,
            name: player.name, // Extract the name property
            isHuman: player.name === playerName, // Check if the player is the human player
            isSpeaking: false, // Initialize isSpeaking as false
            message: "", // Initialize message as an empty string
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

  const handleSubmit = async () => {
    if (!gameId || !userInput.trim()) {
      console.error("Game ID or message is missing.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
          name: playerName,
          message: userInput,
        }),
      });

      const result = await response.text();
      console.log("Result: ", result);

      // Temporarily set the user's message and isSpeaking to true
      setParticipants((prevParticipants) =>
        prevParticipants.map((participant) =>
          participant.isHuman
            ? { ...participant, isSpeaking: true, message: userInput }
            : participant
        )
      );

      // Clear the input field after submission
      setUserInput("");

      // Reset isSpeaking and message after 5 seconds
      setTimeout(() => {
        setParticipants((prevParticipants) =>
          prevParticipants.map((participant) =>
            participant.isHuman
              ? { ...participant, isSpeaking: false, message: "" }
              : participant
          )
        );
      }, 5000);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleAiChat = async () => {
    if (!gameId || !aiId.trim()) {
      console.error("Game ID or AI ID is missing.");
      return;
    }

    try {
      console.log("Sending AI Chat Request:", { gameId, aiId }); // Log the payload
      const response = await fetch("http://localhost:3000/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: Number(gameId),
          aiId: Number(aiId),
        }),
      });

      const result = await response.text();
      console.log("AI Chat Result:", result);

      // Temporarily set the AI's message and isSpeaking to true
      setParticipants((prevParticipants) =>
        prevParticipants.map((participant) =>
          participant.id === Number(aiId)
            ? { ...participant, isSpeaking: true, message: result }
            : participant
        )
      );

      // Reset isSpeaking and message after 5 seconds
      setTimeout(() => {
        setParticipants((prevParticipants) =>
          prevParticipants.map((participant) => {
            return participant.id === Number(aiId)
              ? { ...participant, isSpeaking: false, message: "" }
              : participant;
          })
        );
      }, 5000);
    } catch (error) {
      console.error("Error during AI chat:", error);
    }
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
                isSpeaking={participant.isSpeaking} // Use participant's isSpeaking
                message={participant.message} // Use participant's message
              />
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
          placeholder="Type your message here..."
          className="resize-none min-h-[60px] font-pixel text-xs bg-robot-dark border-2 border-robot-accent text-robot-light"
          style={{ minWidth: "100%" }}
        />
        <button
          onClick={handleSubmit}
          className="mt-4 px-4 py-2 bg-robot-accent text-robot-dark font-bold rounded"
        >
          Submit
        </button>

        {/* AI Chat Section */}
        <div className="mt-8 flex items-center gap-4">
          <input
            type="text"
            value={aiId}
            onChange={(e) => setAiId(e.target.value)}
            placeholder="Enter AI ID"
            className="px-4 py-2 border-2 border-robot-accent rounded bg-robot-dark text-robot-light"
          />
          <button
            onClick={handleAiChat}
            className="px-4 py-2 bg-robot-accent text-robot-dark font-bold rounded"
          >
            AI Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameArena;
