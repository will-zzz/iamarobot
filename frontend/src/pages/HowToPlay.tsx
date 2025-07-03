import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const HowToPlay = () => {
  return (
    <div className="min-h-screen flex flex-col px-4 py-8">
      <Header />

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
              most importantly, use your{" "}
              <span className="text-robot-highlight font-bold">
                human ingenuity
              </span>{" "}
              to defeat them.
            </p>
          </div>

          <div className="bg-robot-darker border-2 border-robot-accent p-6 rounded-lg">
            <h2 className="text-2xl text-robot-accent mb-4">Chat Phase</h2>
            <p className="text-lg leading-relaxed mb-4">
              Players take turns speaking in a group chat.
            </p>
            <ul className="list-disc list-inside space-y-2 text-lg">
              <li>When it's your turn, you can type and send a message</li>
              <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                <li>
                  As the human, your special ability is that you can{" "}
                  <span className="text-robot-highlight font-bold">
                    talk at any time
                  </span>
                  , out of turn! Use this to your advantage!
                </li>
              </ul>
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
              <li>
                The player with the most votes is{" "}
                <span className="text-robot-highlight font-bold">
                  eliminated
                </span>
              </li>
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

      <Footer />
    </div>
  );
};

export default HowToPlay;
