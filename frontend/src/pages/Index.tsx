
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="absolute top-4 right-4 flex gap-2">
        <Button variant="outline" className="border-robot-accent text-robot-accent hover:bg-robot-accent/10">
          Log In
        </Button>
        <Button className="bg-robot-accent text-robot-dark hover:bg-robot-accent/80">
          Sign Up
        </Button>
      </div>
      
      <div className="flex flex-col items-center justify-center flex-1">
        <h1 className="text-4xl md:text-6xl lg:text-7xl text-robot-light mb-2 animate-pulse">
          iamarobot
        </h1>
        <p className="text-robot-muted text-sm md:text-base mb-12 max-w-md text-center">
          Can you identify the human among the machines?
        </p>
        
        <div className="relative">
          <span className="absolute -left-6 -top-6 text-robot-accent animate-blink">{'>'}</span>
          <Link to="/play">
            <Button className="bg-robot-highlight text-robot-dark hover:bg-robot-highlight/80 text-lg md:text-xl px-8 py-6">
              PLAY
            </Button>
          </Link>
          <span className="absolute -right-6 -bottom-6 text-robot-accent animate-blink">{'<'}</span>
        </div>
      </div>
      
      <footer className="mt-auto py-4 text-robot-muted text-xs">
        <p>© 2025 iamarobot • Ver 0.1.0</p>
      </footer>
    </div>
  );
};

export default Index;
