window.MODELS = [
  { id: "gpt-4.1", name: "GPT-4.1", provider: "OpenAI", costPer1k: 0.030, latencyMs: 900, strengths: ["math", "coding"] },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", costPer1k: 0.018, latencyMs: 850, strengths: ["coding", "analysis"] },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", costPer1k: 0.015, latencyMs: 780, strengths: ["extraction", "analysis", "charting"] },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", provider: "Meta (hosted)", costPer1k: 0.006, latencyMs: 650, strengths: ["math"] },
  { id: "mistral-large", name: "Mistral Large", provider: "Mistral", costPer1k: 0.010, latencyMs: 700, strengths: ["extraction"] }
];
