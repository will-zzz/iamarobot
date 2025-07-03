import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { prompts } from "./prompts";
import prisma from "./prisma/client";
import fs from "fs";
import cors from "cors";
import { createServer } from "http";
import { GameEngine } from "./GameEngine";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const server = createServer(app);

app.use(express.json());

// Allow requests from localhost:3000
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:5500",
      "http://localhost:5500",
    ],
    credentials: true,
  })
);

const port = process.env.PORT;

// Initialize GameEngine with Socket.IO
const gameEngine = new GameEngine(server, openai);

// Start game. Godot calls this when player clicks "Start Game" button.
// Pass user name
app.post("/start-game", async (req, res) => {
  try {
    const result = await gameEngine.startGame(req.body.name);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error starting game:", error);
    res.status(500).json({ error: "Failed to start game" });
  }
});

// User chat. Godot calls this when user sends a message.
// Passes gameId, user name, and message
app.post("/chat", async (req: Request, res: Response) => {
  try {
    await prisma.message.create({
      data: {
        content: `${req.body.name}: ${req.body.message}`,
        gameId: req.body.gameId,
      },
    });
    res.status(201).send("Message sent");
  } catch (e) {
    res.status(500).send(e);
  }
});

// AI chat. Godot calls this when AI's turn to chat.
// Passes gameId and aiId (for name + identity)
app.post("/ai/chat", async (req: Request, res: Response) => {
  try {
    const aiId: number = req.body.aiId;
    const gameId: number = req.body.gameId;
    const player = await prisma.player.findUnique({
      where: {
        id: aiId,
      },
    });
    if (!player) {
      res.status(404).send("AI not found");
      return;
    }
    // Add check if ai id is not game id
    if (player.gameId !== gameId) {
      res.status(400).send("AI does not belong to this game");
      return;
    }
    const name = player.name;

    // Fetch all players in the game
    const allPlayers = await prisma.player.findMany({
      where: {
        gameId: gameId,
      },
    });
    // Get names of all other players (excluding this AI)
    const otherPlayerNames = allPlayers
      .filter((p) => p.id !== aiId)
      .map((p) => p.name)
      .join(", ");

    // Fetch conversation for AI
    const formattedMessages = await fetchConversation(gameId);
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompts.chat(name, otherPlayerNames) },
        ...formattedMessages,
      ],
      model: "gpt-4o-mini",
    });
    if (!completion.choices[0].message.content) {
      res.status(500).send("AI failed to respond");
      return;
    }
    // First, check if sentence begins with "Word: ", and if so, remove it
    let response = completion.choices[0].message.content;
    // Remove "Name: " from the beginning of the sentence
    response = response.replace(/^[^:]+:\s*/, "");
    // Append AI's response to the chat log
    await prisma.message.create({
      data: {
        content: `${name}: ${response}`,
        gameId: req.body.gameId,
      },
    });
    // Send the AI's response
    res.send(response);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Vote. Godot calls this when player/AI's turn to vote.
// Passes gameId and aiId
app.post("/ai/vote", async (req: Request, res: Response) => {
  try {
    const aiId: number = req.body.aiId;
    console.log("AI ID:", aiId);
    const player = await prisma.player.findUnique({
      where: {
        id: aiId,
      },
    });
    if (!player) {
      res.status(404).send("AI not found");
      return;
    }
    const name = player.name;

    // Fetch all players in the game
    const allPlayers = await prisma.player.findMany({
      where: {
        gameId: req.body.gameId,
      },
    });
    // Get names of all other players (excluding this AI)
    const otherPlayerNames = allPlayers
      .filter((p) => p.id !== aiId)
      .map((p) => p.name)
      .join(", ");

    // Fetch conversation for AI
    const formattedMessages = await fetchConversation(req.body.gameId);
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompts.voting(name, otherPlayerNames) },
        ...formattedMessages,
      ],
      model: "gpt-4o-mini",
    });
    if (!completion.choices[0].message.content) {
      res.status(500).send("AI failed to respond");
      return;
    }
    // First, check if sentence begins with "Word: ", and if so, remove it
    let response = completion.choices[0].message.content;
    // Remove "Name: " from the beginning of the sentence
    response = response.replace(/^[^:]+:\s*/, "");
    // Append AI's response to the chat log
    await prisma.message.create({
      data: {
        content: `${name}: ${response}`,
        gameId: req.body.gameId,
      },
    });
    // Send the AI's response
    res.send(response);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Calculate votes. Godot calls this to calculate votes.
// Passes vote strings (between 4 and 7)
app.post("/calculate-votes", async (req: Request, res: Response) => {
  try {
    const rawVotes = req.body.votes;
    const formattedVotes: ChatCompletionMessageParam[] = rawVotes.map(
      (vote: string) => {
        return { role: "user", content: vote };
      }
    );
    // Call OpenAI API for every vote. Use Promise.all to wait for all responses.
    const completions = await Promise.all(
      formattedVotes.map((vote) =>
        openai.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant designed to output JSON. You should return an object with one key, 'name', which equals the name of the player being voted for.",
            },
            vote,
          ],
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
        })
      )
    ).then((completions) => {
      return completions.map((completion) => {
        return completion.choices[0].message.content
          ? JSON.parse(completion.choices[0].message.content)
          : { name: "" };
      });
    });
    // Count votes
    const votes: { [key: string]: number } = {};
    completions.forEach((vote) => {
      if (votes[vote.name]) {
        votes[vote.name]++;
      } else {
        votes[vote.name] = 1;
      }
    });
    res.send(votes);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Get next speaker. Godot calls this to determine whose turn it is to speak.
app.post("/next-speaker", async (req: Request, res: Response) => {
  try {
    const gameId: number = req.body.gameId;

    // Fetch all players in the game
    const allPlayers = await prisma.player.findMany({
      where: {
        gameId: gameId,
      },
    });

    // Determine next speaker
    const nextSpeaker = await determineNextSpeaker(gameId, allPlayers);

    // Find the player object for the next speaker
    const nextPlayer = allPlayers.find((p) => p.name === nextSpeaker);
    if (!nextPlayer) {
      res.status(404).send("Next speaker not found");
      return;
    }

    res.json({
      nextSpeaker: nextPlayer.name,
      nextSpeakerId: nextPlayer.id,
    });
  } catch (e) {
    res.status(500).send(e);
  }
});

// Fetches conversation and formats it for OpenAI API
const fetchConversation = async (gameId: number) => {
  // Fetch all messages for the game
  const messages = await prisma.message.findMany({
    where: {
      gameId: gameId,
    },
  });
  // Format messages for AI
  const formattedMessages: ChatCompletionMessageParam[] = messages.map(
    (message) => {
      return { role: "user", content: message.content };
    }
  );
  return formattedMessages;
};

// Determine whose turn it is to talk based on chat history
async function determineNextSpeaker(
  gameId: number,
  allPlayers: any[]
): Promise<string> {
  try {
    // Fetch conversation history
    const messages = await prisma.message.findMany({
      where: {
        gameId: gameId,
      },
      orderBy: {
        createdAt: "asc", // Get messages in chronological order
      },
      take: 10, // Get last 10 messages
    });

    // Format messages for AI
    const formattedMessages: ChatCompletionMessageParam[] = messages.map(
      (msg) => {
        return { role: "user", content: msg.content };
      }
    );
    const playerNames = allPlayers.map((p) => p.name).join(", ");

    // Add a final message to explicitly ask about the next speaker
    formattedMessages.push({
      role: "user",
      content:
        "Based on this conversation, who should speak next? Consider who was asked questions and who hasn't spoken recently.",
    });

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompts.nextSpeaker(playerNames) },
        ...formattedMessages,
      ],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
    });

    if (!completion.choices[0].message.content) {
      throw new Error("AI failed to determine next speaker");
    }

    const response = JSON.parse(completion.choices[0].message.content);
    return response.name;
  } catch (error) {
    console.error("Error determining next speaker:", error);
    // If there's an error, pick a random player
    const randomIndex = Math.floor(Math.random() * allPlayers.length);
    return allPlayers[randomIndex].name;
  }
}

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
