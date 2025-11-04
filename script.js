/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Set initial message
chatWindow.textContent = "👋 Hello! How can I help you today?";

/* Replace with your deployed Cloudflare Worker URL (example: https://my-worker.workers.dev) */
const WORKER_URL = "https://loreal-chatbot.aocampo2533.workers.dev/"; // <-- change this

// If you include `secrets.js` in `index.html` it creates a global `apiKey` variable.
// Using the API key directly in the browser is UNSAFE for production — it will expose
// your key to anyone who opens the page. Keep `secrets.js` only for local demos.

// Helper to append messages to the chat window
function appendMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Quick client-side filter: return true if the user's question appears to be
// about beauty, skincare, makeup, haircare, or L'Oréal products.
// This is a best-effort heuristic to avoid calling the API for unrelated questions.
function isBeautyQuestion(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  const keywords = [
    "skin",
    "skincare",
    "moistur",
    "cleanser",
    "serum",
    "cream",
    "makeup",
    "foundation",
    "mascara",
    "lipstick",
    "concealer",
    "hair",
    "shampoo",
    "conditioner",
    "haircare",
    "haircut",
    "sunscreen",
    "spf",
    "anti-aging",
    "routine",
    "product",
    "l'oréal",
    "loreal",
    "fragrance",
    "perfume",
    "nail",
    "manicure",
    "beauty",
    "cosmetic",
  ];
  return keywords.some((k) => t.includes(k));
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = userInput.value.trim();
  if (!userText) return;

  // Show user's message in the UI
  appendMessage(userText, "user");
  userInput.value = "";

  // Client-side pre-check: if the question is clearly unrelated to beauty,
  // return a polite refusal without calling the API (saves quota and avoids bad responses).
  if (!isBeautyQuestion(userText)) {
    appendMessage(
      "Sorry — I can only help with beauty-related questions about L'Oréal products, routines, and recommendations. For other topics please use a general search engine or support channel.",
      "ai"
    );
    return;
  }

  // Temporary indicator while we wait for the API
  appendMessage("…thinking", "ai");

  try {
    // Build messages array as required by the OpenAI chat API
    // Strong system prompt: limit the agent to beauty/product expertise and
    // instruct it to politely refuse unrelated requests.
    // Optional prompt identifier supplied by the product team. This is included
    // in the system message and sent as a small `prompt` object on the API
    // call so downstream services (for example your Cloudflare Worker) can
    // pick up the canonical prompt id/version for telemetry or enforcement.
    const PROMPT_ID = "pmpt_690976383f348190abecf87d25fbcc940175e1a8b594aaa8";
    const PROMPT_VERSION = "1";

    const messages = [
      {
        role: "system",
        content: `Prompt ID: ${PROMPT_ID}\nYou are a L'Oréal product assistant. You only answer questions about beauty, skincare, haircare, makeup, fragrances, nails, and L'Oréal products, routines, and recommendations. If a user asks about topics outside of beauty (for example politics, medical diagnosis beyond general skincare tips, legal advice, or other unrelated subjects), politely refuse and say you can only help with beauty-related questions. When refusing, offer a short, helpful alternative such as suggesting official support channels or recommending a general web search. Keep answers friendly, concise, and focused on practical product advice or routine steps. Never invent medical diagnoses; for health concerns recommend seeing a healthcare professional.`,
      },
      { role: "user", content: userText },
    ];

    // Send messages to the Cloudflare Worker which forwards to OpenAI
    let res;

    // If an API key is available in `secrets.js`, call OpenAI directly from the browser.
    // NOTE: This is only for local demos. For any public deployment use a server or
    // worker so the key stays secret.
    const promptMeta = { prompt: { id: PROMPT_ID, version: PROMPT_VERSION } };

    if (typeof apiKey === "string" && apiKey.startsWith("sk-")) {
      // Direct call to OpenAI (local demo). We include the prompt object in
      // the POST body as metadata. OpenAI may ignore unknown top-level fields,
      // but the system message also contains the prompt id for model-level
      // instruction.
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(
          Object.assign({ model: "gpt-4o", messages }, promptMeta)
        ),
      });
    } else {
      // Fallback: send to your Cloudflare Worker which should forward to OpenAI
      // and can pick up the `prompt` metadata for logging/metrics.
      res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ messages }, promptMeta)),
      });
    }

    // If the response is not OK, read any returned body for debugging and throw an error
    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch (e) {
        // ignore
      }
      throw new Error(`HTTP ${res.status} ${res.statusText} - ${bodyText}`);
    }

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

    // Surface the actual error message in the UI for debugging (safe: does not expose the API key)
    appendMessage(`Error: ${err.message}`, "ai");
    console.error("Worker / fetch error:", err);
  }
});
