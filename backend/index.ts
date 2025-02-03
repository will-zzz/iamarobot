import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { prompts } from "./prompts";
import prisma from "./prisma/client";
import fs from "fs";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(express.json());
const port = process.env.PORT;

// Start game. Godot calls this when player clicks "Start Game" button.
// Pass user name
app.post("/start-game", async (req, res) => {
  try {
    const game = await prisma.game.create({
      data: {},
    });
    await generateAIs(game.id);
    // Add user to the game
    await prisma.player.create({
      data: {
        name: req.body.name,
        identity: "You are the human",
        gameId: game.id,
      },
    });
    // Fetch every player in game
    const players = await prisma.player.findMany({
      where: {
        gameId: game.id,
      },
    });
    res.status(201).json({ gameId: game.id, players: players });
  } catch (error) {
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
    const identity = player.identity;
    // Fetch conversation for AI
    const formattedMessages = await fetchConversation(gameId);
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompts.chat(identity, "") },
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
    const identity = player.identity;
    // Fetch conversation for AI
    const formattedMessages = await fetchConversation(req.body.gameId);
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompts.voting(identity, "") },
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

// Generates identities for AIs.
const generateAIs = async (gameId: number) => {
  const namesList = fs.readFileSync("./names.txt", "utf-8").split("\n");
  const filteredNames = namesList.filter((name) => name.trim() !== "");
  let names: String[] = [];
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * filteredNames.length);
    if (!names.includes(filteredNames[randomIndex])) {
      let name = filteredNames[randomIndex].trim();
      names.push(name);
      // Generate AI identity from identities.txt
      // It will have 3 identities from the file
      let fullIdentity = "";
      let identities: String[] = [];
      const identitiesList = fs
        .readFileSync("./identities.txt", "utf-8")
        .split("\n");
      const filteredIdentites = identitiesList.filter(
        (identity) => identity.trim() !== ""
      );
      for (let j = 0; j < 3; j++) {
        const randomIndex = Math.floor(
          Math.random() * filteredIdentites.length
        );
        if (!identities.includes(filteredIdentites[randomIndex].trim())) {
          let identity = filteredIdentites[randomIndex].trim();
          identities.push(identity);
          fullIdentity += `You ${identity} `;
        } else {
          j--;
        }
      }
      // Remove last space
      fullIdentity = fullIdentity.slice(0, -1);
      // Save AI to database
      await prisma.player.create({
        data: {
          name: name,
          identity: fullIdentity,
          gameId: gameId,
        },
      });
    } else {
      i--;
    }
  }
  return;
};

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
