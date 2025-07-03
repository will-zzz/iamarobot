import React from "react";
import { Link, useLocation } from "react-router-dom";

interface HeaderProps {
  currentPage?: string;
}

const Header: React.FC<HeaderProps> = ({ currentPage }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="flex justify-center items-center mb-8">
      <nav className="flex gap-16">
        <Link
          to="/"
          className={`transition-colors ${
            isActive("/")
              ? "text-robot-light"
              : "text-robot-muted hover:text-robot-light"
          }`}
        >
          Home
        </Link>
        <Link
          to="/about"
          className={`transition-colors ${
            isActive("/about")
              ? "text-robot-light"
              : "text-robot-muted hover:text-robot-light"
          }`}
        >
          About
        </Link>
        <Link
          to="/how-to-play"
          className={`transition-colors ${
            isActive("/how-to-play")
              ? "text-robot-light"
              : "text-robot-muted hover:text-robot-light"
          }`}
        >
          How to Play
        </Link>
        <a
          href="mailto:will.zakielarz@duke.edu"
          className="text-robot-muted hover:text-robot-light transition-colors"
        >
          Contact
        </a>
      </nav>
    </header>
  );
};

export default Header;
