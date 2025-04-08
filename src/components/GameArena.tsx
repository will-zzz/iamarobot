import React, { useState, useMemo, useEffect } from "react";
import Robot from "./Robot";
import Timer from "./Timer";
import { Textarea } from "./ui/textarea";

interface GameArenaProps {
  playerName: string;
}

const GameArena: React.FC<GameArenaProps> = ({ playerName }) => {
  const [gameId, setGameId] = useState<string | null>(null);
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
  const [currentTurn, setCurrentTurn] = useState<number | null>(null); // Track the current participant's turn
  const [isVotingPhase, setIsVotingPhase] = useState(false); // Track if it's the voting phase
  const [hasVotedOnce, setHasVotedOnce] = useState(false);
  const [votingResponses, setVotingResponses] = useState<string[]>([]); // Store voting responses as strings

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

  useEffect(() => {
    if (participants.length > 0 && currentTurn === null) {
      const randomParticipant =
        participants[Math.floor(Math.random() * participants.length)];
      setCurrentTurn(randomParticipant.id);

      if (!randomParticipant.isHuman) {
        handleAiChat(randomParticipant.id, gameId);
      }
    }
  }, [gameId]);

  const handleTimeUp = () => {
    console.log("Voting phase started!");
    setIsVotingPhase(true);
  };

  useEffect(() => {
    if (isVotingPhase) {
      console.log("isVotingPhase is now true. Starting voting phase...");
      votingPhase();
    }
  }, [isVotingPhase]);

  const votingPhase = async () => {
    for (const participant of participants) {
      setCurrentTurn(participant.id); // Highlight the current participant's turn

      if (!participant.isHuman) {
        console.log(`${participant.name} is voting: `);
        const vote = await handleAiVote(participant.id);
        setVotingResponses((prevResponses) => [...prevResponses, vote]);

        // Wait for 2 seconds before proceeding
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.log(
          `Waiting for vote from human participant: ${participant.name}`
        );
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  useEffect(() => {
    if (isVotingPhase === false && hasVotedOnce) {
      // This will only run after a voting phase has completed, not at the start
      console.log("Voting phase ended, advancing turn");
      advanceTurn();
    }
  }, [isVotingPhase, hasVotedOnce]);

  const advanceTurn = () => {
    if (isVotingPhase) {
      console.log("Voting phase is active. Skipping turn advancement.");
      return;
    }

    const nextParticipant =
      participants[Math.floor(Math.random() * participants.length)];
    setCurrentTurn(nextParticipant.id);

    if (!nextParticipant.isHuman) {
      handleAiChat(nextParticipant.id);
    }
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
      // console.log("Result: ", result);

      if (isVotingPhase) {
        setHasVotedOnce(true);
        setVotingResponses((prevResponses) => [...prevResponses, userInput]);
        setIsVotingPhase(false);
        console.log("All votes:", [...votingResponses, userInput]);
      }

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

      // Wait for 2 seconds before proceeding
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Advance to the next turn
      advanceTurn();

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

  const handleAiChat = async (aiId: number, gameIdParam?: string) => {
    console.log("Voting phase? ", isVotingPhase);
    if (isVotingPhase) {
      console.log("Voting phase is active. AI cannot chat.");
      return;
    }

    const activeGameId = gameIdParam || gameId; // Use the passed gameId or fallback to state
    // console.log("Active Game ID:", activeGameId, "Participants:", participants);
    if (!activeGameId) {
      console.error("Game ID is missing.");
      return;
    }

    try {
      // console.log("Sending AI Chat Request:", { activeGameId, aiId }); // Log the payload
      const response = await fetch("http://localhost:3000/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: Number(activeGameId),
          aiId: Number(aiId),
        }),
      });

      const result = await response.text();
      // console.log("AI Chat Result:", result);

      // Temporarily set the AI's message and isSpeaking to true
      setParticipants((prevParticipants) =>
        prevParticipants.map((participant) =>
          participant.id === Number(aiId)
            ? { ...participant, isSpeaking: true, message: result }
            : participant
        )
      );

      // Wait for 2 seconds before proceeding
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Advance to the next turn
      advanceTurn();

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

  const handleAiVote = async (aiId: number): Promise<string> => {
    console.log("aiId: ", aiId);
    // Send the AI vote request
    const response = await fetch("http://localhost:3000/ai/vote", {
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

    // Return the result immediately
    processAiVoteLogic(aiId, result); // Call the logic in a separate function
    return result;
  };

  const processAiVoteLogic = (aiId: number, result: string) => {
    setParticipants((prevParticipants) =>
      prevParticipants.map((participant) =>
        participant.id === aiId
          ? {
              ...participant,
              isSpeaking: true,
              message: `I voted for ${result}!`,
            }
          : participant
      )
    );

    // Reset isSpeaking and message after 5 seconds
    setTimeout(() => {
      setParticipants((prevParticipants) =>
        prevParticipants.map((participant) =>
          participant.id === aiId
            ? { ...participant, isSpeaking: false, message: "" }
            : participant
        )
      );
    }, 5000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[80vh] justify-between">
      <div className="flex justify-center mb-8 mt-4">
        {isVotingPhase ? (
          <div className="text-2xl font-bold text-robot-accent">
            TIME TO VOTE
          </div>
        ) : (
          <Timer initialSeconds={6} onTimeUp={handleTimeUp} />
        )}
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
              {currentTurn === participant.id && (
                <div className="mt-2 text-robot-accent">⬆️</div> // Arrow to indicate the current turn
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
      </div>
    </div>
  );
};

export default GameArena;
