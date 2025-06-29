import React from "react";

interface TimerProps {
  initialSeconds: number;
  onTimeUp?: () => void;
}

const Timer: React.FC<TimerProps> = ({ initialSeconds }) => {
  const formatTime = () => {
    const minutes = Math.floor(initialSeconds / 60);
    const remainingSeconds = initialSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-robot-dark border-2 border-robot-accent px-4 py-2 rounded-sm">
      <span className="text-robot-light text-xl">{formatTime()}</span>
    </div>
  );
};

export default Timer;
