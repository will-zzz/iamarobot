import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const HowToPlay = () => {
  return (
    <div className="min-h-screen flex flex-col px-4 py-8">
      {/* Navigation Header */}
      <header className="flex justify-center items-center mb-8">
        <nav className="flex gap-16">
          <Link
            to="/"
            className="text-robot-muted hover:text-robot-light transition-colors"
          >
            Home
          </Link>
          <Link
            to="/about"
            className="text-robot-muted hover:text-robot-light transition-colors"
          >
            About
          </Link>
          <Link
            to="/how-to-play"
            className="text-robot-light transition-colors"
          >
            How to Play
          </Link>
          <a
            href="mailto:will.zakielarz@duke.edu"
            className="text-robot-muted hover:text-robot-light transition-colors"
          >
            Contact
          </a>
        </nav>
      </header>

      <div className="flex flex-col items-center justify-center flex-1 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl text-robot-light mb-8 text-center">
          How to Play
        </h1>

        <div className="space-y-8 text-robot-light">
          <div className="bg-robot-darker border-2 border-robot-accent p-6 rounded-lg">
            <h2 className="text-2xl text-robot-accent mb-4">Game Setup</h2>
            <p className="text-lg leading-relaxed mb-4">
              Each game consists of 6 players: You (the human, I hope) and five
              AIs.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Your goal is to convince the robots that you're one of them, by
              any means necessary. Distract them, frame them, gaslight them, and
              most importantly, use your human ingenuity to defeat them.
            </p>
          </div>

          <div className="bg-robot-darker border-2 border-robot-accent p-6 rounded-lg">
            <h2 className="text-2xl text-robot-accent mb-4">Chat Phase</h2>
            <p className="text-lg leading-relaxed mb-4">
              Players take turns speaking in a group chat.
            </p>
            <ul className="list-disc list-inside space-y-2 text-lg">
              <li>When it's your turn, you can type and send a message</li>
              <li>
                If you mention another player's name, they get the next turn
              </li>
              <li>
                If you don't mention anyone, the turn passes to a random player
              </li>
            </ul>
          </div>

          <div className="bg-robot-darker border-2 border-robot-accent p-6 rounded-lg">
            <h2 className="text-2xl text-robot-accent mb-4">Voting Phase</h2>
            <p className="text-lg leading-relaxed mb-4">
              After the chat phase, players vote to eliminate one player from
              the game.
            </p>
            <ul className="list-disc list-inside space-y-2 text-lg">
              <li>Players vote one at a time in a specific order</li>
              <li>
                Type the name (proper spelling!) of the player you want to
                eliminate
              </li>
              <li>The player with the most votes is eliminated</li>
              <li>
                If there's a tie, a random player from the tie is eliminated
              </li>
            </ul>
          </div>

          <div className="bg-robot-darker border-2 border-robot-accent p-6 rounded-lg">
            <h2 className="text-2xl text-robot-accent mb-4">
              Winning Conditions
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl text-robot-highlight mb-2">
                  Human Wins If:
                </h3>
                <p className="text-lg">
                  The human survives until the end of the game (when only 2
                  players remain)
                </p>
              </div>
              <div>
                <h3 className="text-xl text-robot-accent mb-2">AIs Win If:</h3>
                <p className="text-lg">The human is eliminated</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <Link to="/play">
            <Button className="bg-robot-highlight text-robot-dark hover:bg-robot-highlight/80 text-lg px-8 py-4">
              Start Playing
            </Button>
          </Link>
        </div>
      </div>

      <footer className="mt-auto py-4 relative flex justify-center items-center text-robot-muted text-xs">
        <p>© 2025 Will Zakielarz • Alpha 0.1.0</p>
        <div className="absolute right-0 flex gap-8">
          <a
            href="https://github.com/will-zzz/iamarobot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-robot-muted hover:text-robot-light transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
          <a
            href="https://willzakielarz.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-robot-muted hover:text-robot-light transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </a>
          <a
            href="https://x.com/willzakielarz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-robot-muted hover:text-robot-light transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
};

export default HowToPlay;
