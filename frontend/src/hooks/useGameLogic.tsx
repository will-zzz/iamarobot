import { useState, useEffect } from "react";

interface Participant {
  id: number;
  name: string;
  isHuman: boolean;
  isSpeaking: boolean;
  message: string;
}

interface UseGameLogicProps {
  playerName: string;
}

export const useGameLogic = ({ playerName }: UseGameLogicProps) => {
  const [gameId, setGameId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);
  const [isVotingPhase, setIsVotingPhase] = useState(false);
  const [votingResponses, setVotingResponses] = useState<string[]>([]);
  const [currentVoter, setCurrentVoter] = useState<number | null>(null);
  const [userVoted, setUserVoted] = useState(false);

  // Function to start a new game
  const startGame = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/start-game`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: playerName }),
        }
      );

      const result = await response.json();

      setGameId(result.gameId);
      setParticipants(
        result.players.map((player: any) => ({
          id: player.id,
          name: player.name,
          isHuman: player.name === playerName,
          isSpeaking: false,
          message: "",
        }))
      );
    } catch (error) {
      console.error("Error starting game:", error);
      // Create mock participants for development
      const mockParticipants = [
        {
          id: 1,
          name: playerName,
          isHuman: true,
          isSpeaking: false,
          message: "",
        },
        {
          id: 2,
          name: "Robot1",
          isHuman: false,
          isSpeaking: false,
          message: "",
        },
        {
          id: 3,
          name: "Robot2",
          isHuman: false,
          isSpeaking: false,
          message: "",
        },
        {
          id: 4,
          name: "Robot3",
          isHuman: false,
          isSpeaking: false,
          message: "",
        },
        {
          id: 5,
          name: "Robot4",
          isHuman: false,
          isSpeaking: false,
          message: "",
        },
        {
          id: 6,
          name: "Robot5",
          isHuman: false,
          isSpeaking: false,
          message: "",
        },
      ];
      setParticipants(mockParticipants);
      setGameId("mock-game-id");
    }
  };

  // Start the game when the hook is initialized
  useEffect(() => {
    startGame();
  }, []);

  // Set up the initial turn after participants are loaded
  useEffect(() => {
    if (participants.length > 0 && currentTurn === null) {
      const randomParticipant = participants[0]; // Start with the first participant
      setCurrentTurn(randomParticipant.id);

      if (!randomParticipant.isHuman) {
        handleAiChat(randomParticipant.id);
      }
    }
  }, [participants]);

  // Handle time up for chat phase
  const handleTimeUp = () => {
    setIsVotingPhase(true);
    startVotingPhase();
  };

  const startVotingPhase = () => {
    // Start with the first participant
    setCurrentVoter(participants[0].id);
    setVotingResponses([]);

    if (!participants[0].isHuman) {
      handleAiVote(participants[0].id);
    }
  };

  const handleUserMessage = async (message: string) => {
    if (!gameId) {
      console.error("Game ID is missing.");
      return;
    }

    if (isVotingPhase) {
      handleUserVote(message);
      return;
    }

    try {
      // Send the message to the server
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
          name: playerName,
          message,
        }),
      });

      await response.text();

      // Update participant state to show the message
      setParticipants((prevParticipants) =>
        prevParticipants.map((participant) =>
          participant.isHuman
            ? { ...participant, isSpeaking: true, message }
            : participant
        )
      );

      // Clear the message after a delay
      setTimeout(() => {
        setParticipants((prevParticipants) =>
          prevParticipants.map((participant) =>
            participant.isHuman
              ? { ...participant, isSpeaking: false, message: "" }
              : participant
          )
        );

        // Advance to the next turn
        advanceTurn();
      }, 3000);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleUserVote = (vote: string) => {
    // Record the user's vote
    setVotingResponses((prev) => [...prev, vote]);
    setUserVoted(true);

    // Update UI to show the vote
    const humanParticipant = participants.find((p) => p.isHuman);
    if (humanParticipant) {
      setParticipants((prev) =>
        prev.map((p) =>
          p.isHuman
            ? { ...p, isSpeaking: true, message: `I voted for ${vote}!` }
            : p
        )
      );

      setTimeout(() => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.isHuman ? { ...p, isSpeaking: false, message: "" } : p
          )
        );

        // Move to the next voter or end voting phase
        advanceVoter();
      }, 2000);
    }
  };

  const advanceVoter = () => {
    const currentIndex = participants.findIndex((p) => p.id === currentVoter);
    const nextIndex = currentIndex + 1;

    if (nextIndex < participants.length) {
      // Move to the next voter
      setCurrentVoter(participants[nextIndex].id);

      // If next voter is AI, trigger their vote
      if (!participants[nextIndex].isHuman) {
        handleAiVote(participants[nextIndex].id);
      }
    } else {
      // All participants have voted, end the voting phase
      setIsVotingPhase(false);
      setUserVoted(false);
      setCurrentVoter(null);

      // Start a new chat round
      const firstParticipant = participants[0];
      setCurrentTurn(firstParticipant.id);

      if (!firstParticipant.isHuman) {
        handleAiChat(firstParticipant.id);
      }
    }
  };

  const advanceTurn = () => {
    if (isVotingPhase) {
      return;
    }

    const currentIndex = participants.findIndex((p) => p.id === currentTurn);
    const nextIndex = (currentIndex + 1) % participants.length;
    const nextParticipant = participants[nextIndex];

    setCurrentTurn(nextParticipant.id);

    if (!nextParticipant.isHuman) {
      handleAiChat(nextParticipant.id);
    }
  };

  const handleAiChat = async (aiId: number) => {
    if (isVotingPhase) {
      return;
    }

    if (!gameId) {
      console.error("Game ID is missing.");
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat`, {
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

      // Update the AI's message
      setParticipants((prevParticipants) =>
        prevParticipants.map((participant) =>
          participant.id === Number(aiId)
            ? { ...participant, isSpeaking: true, message: result }
            : participant
        )
      );

      // Clear the message after a delay
      setTimeout(() => {
        setParticipants((prevParticipants) =>
          prevParticipants.map((participant) =>
            participant.id === Number(aiId)
              ? { ...participant, isSpeaking: false, message: "" }
              : participant
          )
        );

        // Advance to the next turn
        advanceTurn();
      }, 3000);
    } catch (error) {
      console.error("Error during AI chat:", error);

      // For development, simulate AI response
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === aiId
            ? {
                ...p,
                isSpeaking: true,
                message: "This is a simulated AI response.",
              }
            : p
        )
      );

      setTimeout(() => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === aiId ? { ...p, isSpeaking: false, message: "" } : p
          )
        );
        advanceTurn();
      }, 3000);
    }
  };

  const handleAiVote = async (aiId: number): Promise<string> => {
    if (!gameId) {
      console.error("Game ID is missing.");
      return "Unknown";
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/vote`, {
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
      processAiVote(aiId, result);
      return result;
    } catch (error) {
      console.error("Error during AI vote:", error);

      // For development, simulate AI vote
      const mockVote = participants.find((p) => p.isHuman)?.name || "Unknown";
      processAiVote(aiId, mockVote);
      return mockVote;
    }
  };

  const processAiVote = (aiId: number, vote: string) => {
    // Record the AI's vote
    setVotingResponses((prev) => [...prev, vote]);

    // Update the AI's message to show the vote
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === aiId
          ? { ...p, isSpeaking: true, message: `I voted for ${vote}!` }
          : p
      )
    );

    // Clear the message after a delay
    setTimeout(() => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === aiId ? { ...p, isSpeaking: false, message: "" } : p
        )
      );

      // Move to the next voter
      advanceVoter();
    }, 2000);
  };

  return {
    participants,
    currentTurn,
    isVotingPhase,
    currentVoter,
    handleUserMessage,
    handleTimeUp,
    userVoted,
    gameId,
  };
};
