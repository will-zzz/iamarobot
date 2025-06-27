
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NameInputProps {
  onNameSubmit: (name: string) => void;
}

const NameInput: React.FC<NameInputProps> = ({ onNameSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = () => {
    if (!name || name.trim().length < 2) {
      setError('Please enter a valid name (min 2 characters)');
      return;
    }
    
    onNameSubmit(name);
  };
  
  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      <h2 className="text-2xl text-robot-light">IDENTIFY YOURSELF</h2>
      
      <div className="relative w-full max-w-md">
        <div className="relative">
          <Input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            className="border-robot-accent bg-robot-dark text-robot-light px-4 py-3 focus-visible:ring-robot-highlight w-full"
            placeholder="ENTER NAME"
            maxLength={20}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-robot-accent animate-blink">_</span>
        </div>
        
        {error && <p className="text-robot-highlight text-xs mt-1">{error}</p>}
      </div>
      
      <Button 
        onClick={handleSubmit}
        className="bg-robot-accent text-robot-dark hover:bg-robot-accent/80 mt-4 px-8"
      >
        CONFIRM
      </Button>
    </div>
  );
};

export default NameInput;
