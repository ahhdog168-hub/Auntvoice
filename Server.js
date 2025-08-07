import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import textToSpeech from "@google-cloud/text-to-speech";
import util from "util";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);

const ttsClient = new textToSpeech.TextToSpeechClient();

const conversations = {};

app.post("/api/chat", async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: "Missing userId or message" });
  }

  if (!conversations[userId]) {
    conversations[userId] = [
      { role: "system", content: "You are a helpful English and Chinese language tutor." },
    ];
  }
  conversations[userId].push({ role: "user", content: message });

  try {
    // Get AI text reply
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: conversations[userId],
      max_tokens: 500,
      temperature: 0.7,
    });
    const reply = completion.data.choices[0].message.content;
    conversations[userId].push({ role: "assistant", content: reply });

    // Choose voice language for TTS based on detected text language (simple)
    const isChinese = /[\u4e00-\u9fff]/.test(reply);

    // Prepare TTS request
    const ttsRequest = {
      input: { text: reply },
      // Select voice based on language
      voice: {
        languageCode: isChinese ? "zh-CN" : "en-US",
        ssmlGender: "FEMALE",
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    };

    // Call Google TTS
    const [response] = await ttsClient.synthesizeSpeech(ttsRequest);
    const audioBase64 = response.audioContent.toString("base64");

    res.json({
      reply,
      audio: "data:audio/mp3;base64," + audioBase64,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get response or generate audio" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
