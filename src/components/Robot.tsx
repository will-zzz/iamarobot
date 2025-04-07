
import React from 'react';

interface RobotProps {
  name: string;
  isHuman: boolean;
  isSpeaking: boolean;
  message?: string;
}

const Robot: React.FC<RobotProps> = ({ name, isHuman, isSpeaking, message }) => {
  return (
    <div className="flex flex-col items-center space-y-2 w-[120px]">
      {isSpeaking && message && (
        <div className="speech-bubble text-xs px-2 py-1 min-h-[60px] w-[120px]">
          {message}
        </div>
      )}
      
      <div className={`w-16 h-20 relative ${isHuman ? 'bg-robot-highlight' : 'bg-robot-accent'}`}>
        {/* Robot head */}
        <div className="absolute top-1 left-1 right-1 bottom-7 bg-robot-dark flex flex-col justify-center items-center">
          {/* Eyes */}
          <div className="flex justify-around w-full px-1">
            <div className={`w-3 h-3 ${isHuman ? 'bg-robot-highlight' : 'bg-robot-accent'}`}></div>
            <div className={`w-3 h-3 ${isHuman ? 'bg-robot-highlight' : 'bg-robot-accent'}`}></div>
          </div>
          {/* Mouth */}
          <div className={`w-7 h-2 mt-2 ${isHuman ? 'bg-robot-highlight' : 'bg-robot-accent'}`}></div>
        </div>
        {/* Antenna */}
        <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 w-2 h-3 ${isHuman ? 'bg-robot-highlight' : 'bg-robot-accent'}`}></div>
      </div>
      
      <p className="text-center text-xs truncate w-full">{name}</p>
    </div>
  );
};

export default Robot;
