/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Set initial message
chatWindow.textContent = "👋 Hello! How can I help you today?";

/* Replace with your deployed Cloudflare Worker URL (example: https://my-worker.workers.dev) */
const WORKER_URL = "https://loreal-chatbot.aocampo2533.workers.dev/"; // <-- change this

// Helper to append messages to the chat window
function appendMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = userInput.value.trim();
  if (!userText) return;

  // Show user's message in the UI
  appendMessage(userText, "user");
  userInput.value = "";

  // Temporary indicator while we wait for the API
  appendMessage("…thinking", "ai");

  try {
    // Build messages array as required by the OpenAI chat API
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful L'Oréal product assistant who recommends products and routines.",
      },
      { role: "user", content: userText },
    ];

    // Send messages to the Cloudflare Worker which forwards to OpenAI
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const data = await res.json();

    // Extract assistant reply per Cloudflare / OpenAI response format
    const aiContent =
      data?.choices?.[0]?.message?.content || "Sorry, no response.";

    // Remove the temporary "thinking" message then append the actual reply
    const last = chatWindow.querySelector(".msg.ai:last-child");
    if (last && last.textContent === "…thinking") last.remove();
    appendMessage(aiContent, "ai");
  } catch (err) {
    const last = chatWindow.querySelector(".msg.ai:last-child");
    if (last && last.textContent === "…thinking") last.remove();
    appendMessage("Error: could not get a response.", "ai");
    console.error(err);
  }
});
