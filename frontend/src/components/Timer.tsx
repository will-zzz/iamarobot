import React from "react";

interface TimerProps {
  initialSeconds: number;
  onTimeUp?: () => void;
  isPaused?: boolean;
}

const Timer: React.FC<TimerProps> = ({ initialSeconds, isPaused = false }) => {
  const formatTime = () => {
    const minutes = Math.floor(initialSeconds / 60);
    const remainingSeconds = initialSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`bg-robot-dark border-2 px-4 py-2 rounded-sm transition-all duration-300 ${
        isPaused ? "border-yellow-400 opacity-75" : "border-robot-accent"
      }`}
    >
      <span
        className={`text-xl ${isPaused ? "text-yellow-400" : "text-robot-light"}`}
      >
        {formatTime()}
      </span>
    </div>
  );
};

export default Timer;
