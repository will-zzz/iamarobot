import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
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
          <button className="text-robot-muted hover:text-robot-light transition-colors">
            About
          </button>
          <button className="text-robot-muted hover:text-robot-light transition-colors">
            How to Play
          </button>
          <button className="text-robot-muted hover:text-robot-light transition-colors">
            Contact
          </button>
        </nav>
      </header>

      <div className="flex flex-col items-center justify-center flex-1">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <h1 className="text-4xl md:text-6xl lg:text-7xl text-robot-light mb-2 animate-pulse cursor-pointer">
            iamarobot
          </h1>
        </Link>
        <p className="text-robot-muted text-sm md:text-base mb-12 max-w-md text-center">
          One human. Five AIs.
          <br />
          Blend in and survive.
        </p>

        <div className="relative">
          <span className="absolute -left-6 -top-6 text-robot-accent animate-blink">
            {">"}
          </span>
          <Link to="/play">
            <Button className="bg-robot-highlight text-robot-dark hover:bg-robot-highlight/80 text-lg md:text-xl px-8 py-6">
              PLAY
            </Button>
          </Link>
          <span className="absolute -right-6 -bottom-6 text-robot-accent animate-blink">
            {"<"}
          </span>
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
            href="https://x.com"
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

export default Index;
