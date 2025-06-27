
import React, { useState } from 'react';
import NameInput from '@/components/NameInput';
import GameArena from '@/components/GameArena';

const Play = () => {
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  
  const handleNameSubmit = (name: string) => {
    setPlayerName(name);
    setGameStarted(true);
  };
  
  return (
    <div className="min-h-screen flex flex-col p-4">
      <header className="text-center mb-4">
        <h1 className="text-2xl md:text-3xl text-robot-light">iamarobot</h1>
      </header>
      
      <main className="flex-1 flex flex-col">
        {!gameStarted ? (
          <div className="flex-1 flex items-center justify-center">
            <NameInput onNameSubmit={handleNameSubmit} />
          </div>
        ) : (
          <GameArena playerName={playerName || 'HUMAN'} />
        )}
      </main>
      
      <footer className="mt-auto py-4 text-center text-robot-muted text-xs">
        <p>FIND THE HUMAN • TRUST NO ONE</p>
      </footer>
    </div>
  );
};

export default Play;
