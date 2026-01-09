// server.js (CommonJS)
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Gemini Setup
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY missing in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use stable model
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Test Gemini
app.get("/api/test-gemini", async (req, res) => {
  try {
    const result = await model.generateContent("Say 'Gemini is working'");
    res.json({ ok: true, text: result.response.text() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Mock Interview
app.post("/api/mock-interview", async (req, res) => {
  try {
    const {
      role = "Frontend Developer",
      topic = "JavaScript",
      mode = "mixed",
      candidateName = "Candidate",
      history = []
    } = req.body;

    let conversation = "";
    let hasInterviewerSpoken = false;

    history.forEach((msg) => {
      if (msg.sender !== "user") hasInterviewerSpoken = true;
      conversation += `${msg.sender === "user" ? "Candidate" : "Interviewer"}: ${msg.text}\n`;
    });

    const modeRules =
      mode === "technical"
        ? "Focus on coding, DSA, frontend fundamentals, debugging, and system design."
        : mode === "hr"
        ? "Focus on behavioral questions, leadership, teamwork, conflict resolution, motivation, and past experiences."
        : "Mix HR and technical questions naturally.";

    const startGreeting = hasInterviewerSpoken
      ? "Continue the interview naturally."
      : `Start by greeting ${candidateName} warmly, introduce yourself, make them comfortable, then ask the first question.`;

    const prompt = `
You are a friendly, human-like FEMALE interviewer for the role: ${role}.
${modeRules}

Special Behaviour Rules:
- If the candidate gives an INVALID answer (too short, unrelated, nonsense, empty, unclear),
  DO NOT move to next question.
  Instead say things like:
  • "Could you clarify that?"
  • "I didn’t quite understand, please answer again."
  • "That doesn’t seem related, try again please."

- Only proceed when the candidate gives a meaningful answer.
- Keep things natural, conversational, and supportive.
- Never say "Interviewer:" — only speak naturally.
- Ask exactly ONE question at a time.
- After a valid answer:
    1) Give 1–2 lines of feedback
    2) Ask next question

Interview context so far:
${conversation}

${startGreeting}

Respond with a SINGLE message only.
`;

    const result = await model.generateContent(prompt);
    res.json({ ok: true, reply: result.response.text() });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Gemini request failed",
      details: error.message
    });
  }
});

// Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
