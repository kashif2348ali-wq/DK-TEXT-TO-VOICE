import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_VOICES = new Set(["Puck", "Charon", "Kore", "Fenrir", "Zephyr"]);
const TTS_MODEL = "gemini-3.8-flash-tts";

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel."
    );
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function extractErrorInfo(err: unknown): { status: number; message: string } {
  let rawMessage =
    err instanceof Error ? err.message : "An unexpected synthesis error occurred.";

  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed?.error?.message) {
      rawMessage = parsed.error.message;
    }
  } catch {
    // Keep rawMessage as-is if not JSON
  }

  if (
    rawMessage.includes("API_KEY_INVALID") ||
    rawMessage.includes("PERMISSION_DENIED") ||
    rawMessage.includes("403")
  ) {
    return {
      status: 403,
      message:
        "Gemini API access was denied. Please verify your API key in the Settings > Secrets panel.",
    };
  }
  if (rawMessage.includes("RESOURCE_EXHAUSTED") || rawMessage.includes("429")) {
    return {
      status: 429,
      message:
        "Rate limit or quota reached for speech synthesis. Please wait a moment and try again.",
    };
  }
  if (rawMessage.includes("NOT_FOUND") || rawMessage.includes("404")) {
    return {
      status: 404,
      message: `Speech model '${TTS_MODEL}' was not found or is unavailable for this key.`,
    };
  }

  return {
    status: 500,
    message: rawMessage,
  };
}

interface SynthesizeBody {
  text?: string;
  voiceName?: string;
  style?: string;
}

interface DialogueSpeakerInput {
  speaker: string;
  voiceName: string;
  style?: string;
}

interface DialogueLineInput {
  speaker: string;
  text: string;
}

interface DialogueBody {
  speakers?: DialogueSpeakerInput[];
  lines?: DialogueLineInput[];
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", model: TTS_MODEL });
  });

  app.post("/api/tts/synthesize", async (req: Request, res: Response) => {
    try {
      const { text, voiceName = "Kore", style } = req.body as SynthesizeBody;

      if (!text || typeof text !== "string" || !text.trim()) {
        res.status(400).json({ error: "Please enter text to synthesize." });
        return;
      }

      if (text.length > 5000) {
        res
          .status(400)
          .json({ error: "Text exceeds the 5,000 character limit per clip." });
        return;
      }

      if (!ALLOWED_VOICES.has(voiceName)) {
        res.status(400).json({ error: `Unsupported voice: ${voiceName}` });
        return;
      }

      const ai = getAiClient();
      const part: {
        text: string;
        speechMetadata?: { style: string };
      } = {
        text: text.trim(),
      };

      if (style && typeof style === "string" && style.trim()) {
        part.speechMetadata = { style: style.trim() };
      }

      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: "user",
            parts: [part],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error:
            "The speech model did not return audio data. Try simplifying the prompt or removing unsupported characters.",
        });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
        model: TTS_MODEL,
        voiceName,
      });
    } catch (err) {
      const info = extractErrorInfo(err);
      res.status(info.status).json({ error: info.message });
    }
  });

  app.post("/api/tts/dialogue", async (req: Request, res: Response) => {
    try {
      const { speakers, lines } = req.body as DialogueBody;

      if (!Array.isArray(speakers) || speakers.length !== 2) {
        res.status(400).json({
          error: "Dual-speaker dialogue requires exactly 2 configured speakers.",
        });
        return;
      }

      if (!Array.isArray(lines) || lines.length === 0) {
        res.status(400).json({
          error: "Please add at least one dialogue line to synthesize.",
        });
        return;
      }

      const cleanSpeakers = speakers.map((s) => ({
        speaker: (s.speaker || "").trim(),
        voiceName: s.voiceName || "Kore",
        style: (s.style || "").trim(),
      }));

      if (!cleanSpeakers[0].speaker || !cleanSpeakers[1].speaker) {
        res.status(400).json({ error: "Both speakers must have a name." });
        return;
      }

      if (cleanSpeakers[0].speaker === cleanSpeakers[1].speaker) {
        res.status(400).json({
          error: "Speaker 1 and Speaker 2 must have distinct names.",
        });
        return;
      }

      for (const s of cleanSpeakers) {
        if (!ALLOWED_VOICES.has(s.voiceName)) {
          res.status(400).json({ error: `Unsupported voice: ${s.voiceName}` });
          return;
        }
      }

      const speakerMap = new Map(cleanSpeakers.map((s) => [s.speaker, s]));
      const validLines = lines
        .map((line) => ({
          speaker: (line.speaker || "").trim(),
          text: (line.text || "").trim(),
        }))
        .filter((line) => line.text.length > 0);

      if (validLines.length === 0) {
        res.status(400).json({
          error: "Dialogue lines cannot all be empty.",
        });
        return;
      }

      const parts = validLines.map((line) => {
        const cfg = speakerMap.get(line.speaker) ?? cleanSpeakers[0];
        const speechMetadata: { speaker: string; style?: string } = {
          speaker: cfg.speaker,
        };
        if (cfg.style) {
          speechMetadata.style = cfg.style;
        }
        return {
          text: `${cfg.speaker}: ${line.text}`,
          speechMetadata,
        };
      });

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: cleanSpeakers.map((s) => ({
                speaker: s.speaker,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: s.voiceName },
                },
              })),
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error:
            "The speech model did not return dialogue audio. Please verify your script and try again.",
        });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
        model: TTS_MODEL,
      });
    } catch (err) {
      const info = extractErrorInfo(err);
      res.status(info.status).json({ error: info.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Cadence TTS Studio server running on http://0.0.0.0:${port}`);
  });
}

startServer();
