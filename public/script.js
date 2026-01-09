// public/script.js

const chatEl = document.getElementById("chat");
const voiceBtn = document.getElementById("voiceBtn");
const statusEl = document.getElementById("status");
const roleSelect = document.getElementById("roleSelect");
const topicInput = document.getElementById("topicInput");
const modeSelect = document.getElementById("modeSelect");
const nameInput = document.getElementById("nameInput");
const startBtn = document.getElementById("startBtn");

let history = [];
let recognition;
let isRecording = false;
let lastTranscript = "";
let autoFlowEnabled = true; // for continuous 1:1 conversation

// ---- UI HELPERS ----
function appendMessage(sender, text) {
  const div = document.createElement("div");
  div.classList.add("msg", sender);
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setStatus(text) {
  statusEl.textContent = text || "";
}

// ---- INTERVIEW CONTROL ----
function resetInterview() {
  history = [];
  chatEl.innerHTML = "";
  setStatus("");

  const greeting =
    "Hi, I’m your AI interviewer. I’ll be talking to you. " +
    "When you hear me finish, just speak your answer and I’ll listen.";

  appendMessage("ai", greeting);
  speakText(greeting, () => {
    // After greeting finishes, start listening
    if (autoFlowEnabled) startListening();
  });
}

startBtn.addEventListener("click", () => {
  resetInterview();
});

// ---- BACKEND COMMUNICATION ----
async function sendAnswerToAI(text) {
  if (!text || !text.trim()) return;

  const cleaned = text.trim();

  // Show user message and add to history
  appendMessage("user", cleaned);
  history.push({ sender: "user", text: cleaned });

  const role = roleSelect.value;
  const candidateName = nameInput.value || "Candidate";
  const topic = topicInput.value || "JavaScript, React, DSA";
  const mode = modeSelect.value;

  setStatus("Interviewer is thinking…");
  voiceBtn.disabled = true;

  try {
    const res = await fetch("/api/mock-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, topic, mode, candidateName, history }),
    });

    const data = await res.json();

    if (!res.ok || data.ok === false) {
      const msg =
        data?.error ||
        data?.details ||
        `Server error (status ${res.status})`;
      throw new Error(msg);
    }

    const reply = data.reply || "Sorry, I had trouble responding.";
    appendMessage("ai", reply);
    history.push({ sender: "ai", text: reply });

    // AI speaks and, after finishing, we go back to listening
    speakText(reply, () => {
      if (autoFlowEnabled) startListening();
    });
  } catch (err) {
    console.error("sendAnswerToAI error:", err);
    appendMessage("ai", "⚠️ " + err.message);
    setStatus("Error talking to interviewer.");
  } finally {
    voiceBtn.disabled = false;
  }
}

// ---- SPEECH-TO-TEXT (LISTENING) ----
function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setStatus("Voice recognition not supported in this browser.");
    voiceBtn.disabled = true;
    return;
  }

  recognition = new SR();
  recognition.lang = "en-IN"; // Indian English
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    isRecording = true;
    lastTranscript = "";
    voiceBtn.classList.add("listening");
    setStatus("Listening… please speak your answer.");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    lastTranscript = transcript;
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    setStatus("Voice error: " + event.error);
  };

  recognition.onend = () => {
    isRecording = false;
    voiceBtn.classList.remove("listening");

    // If we captured speech, send it
    if (lastTranscript && lastTranscript.trim()) {
      const toSend = lastTranscript;
      lastTranscript = "";
      setStatus("Sending your answer…");
      sendAnswerToAI(toSend);
    } else {
      // No speech recognized; resume listening if in auto flow
      if (autoFlowEnabled) {
        setStatus("Didn’t catch that. Listening again…");
        setTimeout(() => {
          startListening();
        }, 600);
      } else {
        setStatus("");
      }
    }
  };
}

function startListening() {
  if (!recognition) return;
  if (isRecording) return;

  try {
    recognition.start();
  } catch (e) {
    console.error("Error starting recognition:", e);
  }
}

// Mic button: manual control (toggle listening)
voiceBtn.addEventListener("click", () => {
  if (!recognition) return;

  // If currently speaking (TTS), stop it and go to listening
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    startListening();
    return;
  }

  if (!isRecording) {
    autoFlowEnabled = true;
    startListening();
  } else {
    recognition.stop();
    autoFlowEnabled = false;
  }
});

// ---- TEXT-TO-SPEECH (INDIAN FEMALE VOICE) ----
function speakText(text, onEnd) {
  if (!("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();

  // Prefer Indian English female voice
  const indianFemale =
    voices.find(
      (v) =>
        v.lang.toLowerCase() === "en-in" &&
        (v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("heera") ||
          v.name.toLowerCase().includes("priya") ||
          v.name.toLowerCase().includes("veena"))
    ) ||
    voices.find((v) => v.lang.toLowerCase() === "en-in") ||
    voices.find(
      (v) =>
        v.lang.toLowerCase().includes("hi") &&
        v.name.toLowerCase().includes("google")
    ) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en"));

  if (indianFemale) {
    utterance.voice = indianFemale;
  }

  utterance.pitch = 1.05;
  utterance.rate = 1.00;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    setStatus("Interviewer's speaking…");
  };

  utterance.onend = () => {
    setStatus("");
    if (typeof onEnd === "function") onEnd();
  };

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

// Voices load async
window.speechSynthesis.onvoiceschanged = () => {
  console.log("TTS voices loaded.");
};

// ---- INIT ----
setupSpeechRecognition();
resetInterview();
