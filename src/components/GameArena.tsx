
import React, { useState } from 'react';
import Robot from './Robot';
import Timer from './Timer';
import { Textarea } from './ui/textarea';

interface GameArenaProps {
  playerName: string;
}

// Sample AI names
const aiNames = ['SYNTH-01', 'BYTE-42', 'NEXUS-7', 'ROBO-3000', 'CIRCUIT-X'];

// Sample messages
const sampleMessages = [
  "Hello fellow humans! I am enjoying this activity.",
  "I process... I mean, I feel emotions like happiness.",
  "My favorite food is pizza because of its taste qualities.",
  "I sleep 8 hours every night as humans should.",
  "I enjoy watching sports competitions on weekends.",
  "I am definitely not executing a program right now."
];

const GameArena: React.FC<GameArenaProps> = ({ playerName }) => {
  // Randomly assign the player position (0-5)
  const playerPosition = Math.floor(Math.random() * 6);
  
  // Initial state with a sample message
  const [currentSpeaker, setCurrentSpeaker] = useState(Math.floor(Math.random() * 6));
  const [currentMessage, setCurrentMessage] = useState(sampleMessages[0]);
  const [userInput, setUserInput] = useState("");
  
  // Create the array of 6 participants (5 AI + 1 human)
  const participants = Array(6).fill(null).map((_, index) => {
    if (index === playerPosition) {
      return { name: playerName, isHuman: true };
    }
    return { name: aiNames[index > playerPosition ? index - 1 : index], isHuman: false };
  });
  
  const handleTimeUp = () => {
    console.log("Time's up!");
    // Future game logic here
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[80vh] justify-between">
      <div className="flex justify-center mb-8 mt-4">
        <Timer initialSeconds={60} onTimeUp={handleTimeUp} />
      </div>
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex flex-wrap justify-center gap-8">
          {participants.map((participant, index) => (
            <div key={index} className="flex flex-col h-[220px] justify-end">
              <Robot 
                name={participant.name}
                isHuman={participant.isHuman}
                isSpeaking={currentSpeaker === index}
                message={currentSpeaker === index ? currentMessage : undefined}
              />
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-8 mb-4 px-4 md:px-8">
        <Textarea
          value={userInput}
          onChange={handleInputChange}
          placeholder="Type your message here..."
          className="resize-none min-h-[60px] font-pixel text-xs bg-robot-dark border-2 border-robot-accent text-robot-light"
          style={{ minWidth: '100%' }}
        />
      </div>
    </div>
  );
};

export default GameArena;
