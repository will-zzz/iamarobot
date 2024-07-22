import OpenAI from "openai";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { prompts } from "./prompts";
import prisma from "./prisma/client";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(express.json());
const port = process.env.PORT;

// Start game. Godot calls this when player clicks "Start Game" button
app.post("/start-game", async (req, res) => {
  try {
    const game = await prisma.game.create({
      data: {},
    });
    res.status(201).json({ gameId: game.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to start game" });
  }
});

app.post("/discussion", async (req: Request, res: Response) => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompts.discussion("", "") },
        { role: "user", content: req.body.message },
      ],
      model: "gpt-4o-mini",
    });
    res.send(completion.choices[0].message.content);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
