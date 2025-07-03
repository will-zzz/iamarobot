import React from "react";

interface RobotProps {
  name: string;
  isHuman: boolean;
  isCurrentTurn?: boolean;
  isCurrentVoter?: boolean;
  isEliminated?: boolean;
}

const Robot: React.FC<RobotProps> = ({
  name,
  isHuman,
  isCurrentTurn = false,
  isCurrentVoter = false,
  isEliminated = false,
}) => {
  const getBorderColor = () => {
    if (isEliminated) return "border-red-500 opacity-50";
    if (isCurrentVoter) return "border-yellow-400";
    if (isCurrentTurn) return "border-robot-accent";
    return "border-robot-accent/50";
  };

  const getBackgroundColor = () => {
    if (isEliminated) return "bg-red-900/20";
    if (isCurrentVoter) return "bg-yellow-900/20";
    if (isCurrentTurn) return "bg-robot-accent/20";
    return "bg-robot-darker";
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 ${getBorderColor()} ${getBackgroundColor()} transition-all duration-300 w-full h-full`}
    >
      <div className="w-1/4 h-1/4 bg-robot-accent rounded-full flex items-center justify-center mb-2">
        <span className="text-robot-dark text-3xl">
          {isHuman ? "👤" : "🤖"}
        </span>
      </div>

      <div className="text-center">
        <div
          className={`font-bold text-lg ${isHuman ? "text-robot-accent" : "text-robot-light"}`}
        >
          {name}
        </div>
        <div className="text-xs text-robot-light/70">
          {isHuman ? "Human" : "AI"}
        </div>

        {isEliminated && (
          <div className="text-red-400 text-xs mt-1">ELIMINATED</div>
        )}
      </div>
    </div>
  );
};

export default Robot;
