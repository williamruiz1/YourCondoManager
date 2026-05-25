/**
 * Anthropic LLM client (founder-os#1256, Phase 1).
 *
 * Thin wrapper around Anthropic's Messages API. We POST directly rather
 * than pulling in @anthropic-ai/sdk because the bundle already runs lean
 * and the surface area we need is small (a single streaming endpoint).
 *
 * Model: claude-3-5-sonnet-latest. The Phase 1 spec locks Sonnet for the
 * chat path; embedding-only paths use Voyage/OpenAI.
 *
 * Streaming: emits parsed events as an async iterable so the SSE route
 * layer can forward them without buffering.
 */

export type AnthropicStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "message_complete"; inputTokens: number; outputTokens: number; stopReason: string | null };

export interface AnthropicTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicCallOpts {
  systemPrompt: string;
  messages: AnthropicTurn[];
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = "claude-3-5-sonnet-latest";
const DEFAULT_MAX_TOKENS = 1024;

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function* streamMessages(opts: AnthropicCallOpts): AsyncIterable<AnthropicStreamEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Phase 1 AI chat requires it; add to Fly secrets.",
    );
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: opts.systemPrompt,
      messages: opts.messages,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${errBody}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice("data:".length).trim();
      if (payload === "[DONE]") continue;
      let event: any;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }

      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        yield { type: "text_delta", text: String(event.delta.text ?? "") };
      } else if (event.type === "message_start" && event.message?.usage) {
        inputTokens = Number(event.message.usage.input_tokens ?? 0);
      } else if (event.type === "message_delta") {
        if (event.usage?.output_tokens) {
          outputTokens = Number(event.usage.output_tokens);
        }
        if (event.delta?.stop_reason) {
          stopReason = String(event.delta.stop_reason);
        }
      }
    }
  }

  yield { type: "message_complete", inputTokens, outputTokens, stopReason };
}

/**
 * Convenience non-streaming wrapper. Used by the chat-opener path where
 * we want a single greeting blob, not token-by-token streaming.
 */
export async function completeMessage(opts: AnthropicCallOpts): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
}> {
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of streamMessages(opts)) {
    if (event.type === "text_delta") text += event.text;
    else if (event.type === "message_complete") {
      inputTokens = event.inputTokens;
      outputTokens = event.outputTokens;
    }
  }

  return { text, inputTokens, outputTokens };
}

/**
 * Rough cost estimate (USD) per Anthropic public pricing for Sonnet 3.5
 * at time of Phase 1 build. Input $3/MTok, output $15/MTok. Stored in the
 * ai_assistant_interactions audit row.
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const lower = (model || "").toLowerCase();
  // Default to Sonnet 3.5 pricing if unrecognized — gives an upper-bound
  // estimate so the cost dashboard never under-reports.
  let inPerM = 3;
  let outPerM = 15;
  if (lower.includes("haiku")) {
    inPerM = 0.25;
    outPerM = 1.25;
  } else if (lower.includes("opus")) {
    inPerM = 15;
    outPerM = 75;
  }
  return (inputTokens / 1_000_000) * inPerM + (outputTokens / 1_000_000) * outPerM;
}
