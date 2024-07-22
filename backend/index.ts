import OpenAI from "openai";
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
app.post("/start-game", async (req, res) => {
  try {
    const game = await prisma.game.create({
      data: {},
    });
    const names = await generateAIs(game.id);
    res.status(201).json({ gameId: game.id, names: names });
  } catch (error) {
    res.status(500).json({ error: "Failed to start game" });
  }
});

// AI chat. Godot calls this when AI's turn to chat.
app.post("/chat", async (req: Request, res: Response) => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompts.chat("", "") },
        { role: "user", content: req.body.message },
      ],
      model: "gpt-4o-mini",
    });
    res.send(completion.choices[0].message.content);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Vote. Godot calls this when player/AI's turn to vote.
app.post("/vote", async (req: Request, res: Response) => {
  res.status(500).send("Not implemented");
});

// Returns AI names. Generates identities for AIs.
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
  return names;
};

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
