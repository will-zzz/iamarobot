import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col px-4 py-8">
      <Header />

      <div className="flex flex-col items-center justify-center flex-1 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl text-robot-light mb-8 text-center">
          About iamarobot
        </h1>

        <div className="space-y-8 text-robot-light">
          <div className="bg-robot-darker border-2 border-robot-accent p-6 rounded-lg">
            <h2 className="text-2xl text-robot-accent mb-4">The Game</h2>
            <p className="text-lg leading-relaxed">
              iamarobot is a{" "}
              <a
                href="https://en.wikipedia.org/wiki/Reverse_Turing_test"
                className="text-robot-accent hover:underline"
                target="_blank"
              >
                reverse Turing test
              </a>{" "}
              where the human player tries to blend in among five AIs. As
              opposed to a traditional{" "}
              <a
                href="https://en.wikipedia.org/wiki/Turing_test"
                className="text-robot-accent hover:underline"
                target="_blank"
              >
                Turing test,
              </a>{" "}
              the human is the one trying to imitate an AI and "passes" if they
              go undetected.
            </p>
          </div>

          <div className="bg-robot-darker border-2 border-robot-accent p-6 rounded-lg">
            <h2 className="text-2xl text-robot-accent mb-4">Inspiration</h2>
            <p className="text-lg leading-relaxed">
              When I saw{" "}
              <a
                href="https://www.youtube.com/watch?v=MxTWLm9vT_o"
                className="text-robot-accent hover:underline"
                target="_blank"
              >
                this video
              </a>{" "}
              by Tamulur, I thought it was a great idea and wanted to try it
              myself. But as the simulation was not made public and I couldn't
              find any others, I decided to build iamarobot.
            </p>
          </div>

          <div className="bg-robot-darker border-2 border-robot-accent p-6 rounded-lg">
            <h2 className="text-2xl text-robot-accent mb-4">Development</h2>
            <p className="text-lg leading-relaxed">
              This is an experimental project. I'm open to further iterating on
              the idea, as I believe this only scratches the surface of the
              concept.
            </p>
          </div>
        </div>

        <div className="mt-12">
          <Link to="/play">
            <Button className="bg-robot-highlight text-robot-dark hover:bg-robot-highlight/80 text-lg px-8 py-4">
              Play Now
            </Button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;
