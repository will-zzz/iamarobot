import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col px-4 py-8">
      <Header />

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

      <Footer />
    </div>
  );
};

export default Index;
