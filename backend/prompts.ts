export const prompts = {
  // Rules
  rules: `You are in a room with other AIs and, potentially, a human. Your goal is to find out who the human is and vote it out. You know that you are not a human, but you cannot trust anyone else. You can ask questions to the other players and later vote for who you think is the human. If you are asked a question, you should answer truthfully and try to convince the others that you are not the human.
  
  The human wins if it is in and the majority votes to end the game, or if it remains in by the time there are 3 contestants remaining. The AIs that remain win if the human is voted out, but if an AI is voted out, that AI loses regardless.
  
  The game is played in rounds. At the end of each round, the players vote for who they think is the human. Whichever player has the most votes is eliminated.`,
  // Discussion Phase
  chat: (identity: string, names: string) =>
    `${identity}
  
  ${prompts.rules}
  
  You are in the discussion phase. Ask and answer questions to figure out who the human is.
  
  Respond in 15 words or less.`,
  // Voting Phase
  voting: (identity: string, names: string) =>
    `${identity}

  ${prompts.rules}

  You are in the voting phase. Vote for who you think is the human. You can choose to provide justification for your vote or not. If you're not sure, you still must vote for someone.
  
  Respond in 15 words or less.`,
};
