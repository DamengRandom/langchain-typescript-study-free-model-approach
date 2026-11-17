import "dotenv/config";
import { BaseMessage } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

// NVIDIA NIM (OpenAI-compatible) replaces the Anthropic/OpenAI models used in the lessons.
if (!process.env.NIM_API_KEY) throw new Error("NIM_API_KEY is not set");

export const model = new ChatOpenAI({
  model: process.env.NIM_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b",
  apiKey: process.env.NIM_API_KEY,
  configuration: { baseURL: process.env.NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1" },
});

// Issues running in the Deno kernel prevent tracing in some cases.
// Commented out 2026-04-04 — tracing appears to work with current packages.
// Deno.env.set("LANGSMITH_TRACING", "false");
// Deno.env.set("LANGCHAIN_TRACING", "false");
// console.log("Disabling LANGSMITH_TRACING in Deno kernel.")

// Shape displayMessage accepts: real messages, plus { type: "custom", content } from L3 stream events.
type Displayable = { type: string; content: unknown; tool_calls?: { name: string; args: unknown }[] };

declare global {
  var displayMessage: (message: Displayable) => void;
  var displayStream: (stream: AsyncIterable<[BaseMessage, never]>) => Promise<void>;
}

/**
 * Little setup file to provide helper functions for the notebooks.
 */

/**
 * Display a message in a nice format.
 * @param message The message to display.
 * @returns void
 */
globalThis.displayMessage = (message: Displayable) => {
  const icons: Record<string, string> = {
    human: "👤",
    ai: "🤖",
    tool: "🔧",
    custom: "💡",
  };

  const colors: Record<string, string> = {
    human: "\x1b[36m", // Cyan
    ai: "\x1b[35m", // Magenta
    tool: "\x1b[33m", // Yellow
    custom: "\x1b[31m", // Red
    reset: "\x1b[0m",
  };

  const icon = icons[message.type] || "💬";
  const color = colors[message.type] || "";
  const reset = colors.reset;

  // Header
  console.log(`\n${color}┌${"─".repeat(60)}┐${reset}`);
  console.log(`${color}│ ${icon} ${message.type.toUpperCase()} MESSAGE${" ".repeat(60 - message.type.length - 12)}│${reset}`);
  console.log(`${color}└${"─".repeat(60)}┘${reset}`);

  // Content
  if (message.content) {
    console.log(message.content);
  } else if (message.tool_calls && message.tool_calls.length > 0) {
    console.log("Tool Calls:");
    message.tool_calls.forEach((call, idx) => {
      console.log(`  ${idx + 1}. ${call.name}()`);
      console.log(`     ${JSON.stringify(call.args, null, 2).split("\n").join("\n     ")}`);
    });
  }
};

// Deno only exists in the notebook kernel, and this file is also loaded by Node (langgraph dev),
// so describe just the one API we use instead of pulling in Deno's global types.
type Jupyter = { broadcast(type: string, content: Record<string, unknown>): Promise<void> };
const jupyter = () => (globalThis as unknown as { Deno: { jupyter: Jupyter } }).Deno.jupyter;

/**
 * A helper function to stream a message.
 * @param message The message to stream.
 * @returns void
 */
globalThis.displayStream = async (stream: AsyncIterable<[BaseMessage, never]>) => {
  let content = "";
  for await (const [message] of stream) {
    content += message.content;
    await jupyter().broadcast("update_display_data", {
      data: { "text/html": `<b>${content}</b>` },
      metadata: {},
      transient: { display_id: "progress" },
    });
  }
};
