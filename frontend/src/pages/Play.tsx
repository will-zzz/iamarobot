import React, { useState } from "react";
import { Link } from "react-router-dom";
import NameInput from "@/components/NameInput";
import GameArena from "@/components/GameArena";

const Play = () => {
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameSubmit = async (name: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/start-game`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to start game");
      }

      const result = await response.json();
      setGameId(result.gameId);
      setPlayerName(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col p-4 overflow-hidden">
      <header className="text-center mb-4 flex-shrink-0">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <h1 className="text-2xl md:text-3xl text-robot-light cursor-pointer">
            iamarobot
          </h1>
        </Link>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {!gameId ? (
          <div className="flex-1 flex items-center justify-center">
            {error && (
              <div className="text-red-400 mb-4 text-center">
                Error: {error}
              </div>
            )}
            <NameInput onNameSubmit={handleNameSubmit} isLoading={isLoading} />
          </div>
        ) : (
          <GameArena gameId={gameId} playerName={playerName || "HUMAN"} />
        )}
      </main>
    </div>
  );
};

export default Play;
