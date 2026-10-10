import "server-only";
/**
 * Grok (xAI API): the studio's writing and conversation engine.
 *
 * Disabled until ALL of these server-only env vars are set (no defaults, no guessing):
 *   XAI_API_KEY                  key from console.x.ai (never sent to the browser or logged)
 *   STUDIO_GROK_ENABLED=true     explicit switch, so a key alone doesn't start spending
 *   XAI_MODEL                    model id, checked against GET /v1/models by verifyGrok()
 *   XAI_MONTHLY_BUDGET_USD       hard cap enforced here, in addition to xAI's own limit
 *   XAI_PRICE_INPUT_PER_MTOK     USD per million input tokens, from xAI's pricing page
 *   XAI_PRICE_OUTPUT_PER_MTOK    USD per million output tokens
 *
 * When Grok is unavailable the studio says so. It never substitutes another model.
 */
import { gt, insert, select } from "@/lib/server/store";

const API = "https://api.x.ai/v1";

const env = (k: string) => process.env[k]?.trim().replace(/^["']|["']$/g, "") || undefined;
const num = (k: string) => {
  const v = Number(env(k));
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

export interface GrokConfig {
  apiKey: string;
  model: string;
  budgetUsd: number;
  priceIn: number;
  priceOut: number;
}

export type GrokStatus =
  | { enabled: true; model: string; budgetUsd: number }
  | { enabled: false; missing: string[]; keyPresent: boolean };

function readConfig(): { config: GrokConfig | null; missing: string[] } {
  const missing: string[] = [];
  const apiKey = env("XAI_API_KEY");
  const model = env("XAI_MODEL");
  const budgetUsd = num("XAI_MONTHLY_BUDGET_USD");
  const priceIn = num("XAI_PRICE_INPUT_PER_MTOK");
  const priceOut = num("XAI_PRICE_OUTPUT_PER_MTOK");
  if (!apiKey) missing.push("XAI_API_KEY");
  if (env("STUDIO_GROK_ENABLED") !== "true") missing.push("STUDIO_GROK_ENABLED=true");
  if (!model) missing.push("XAI_MODEL");
  if (!budgetUsd) missing.push("XAI_MONTHLY_BUDGET_USD");
  if (!priceIn) missing.push("XAI_PRICE_INPUT_PER_MTOK");
  if (!priceOut) missing.push("XAI_PRICE_OUTPUT_PER_MTOK");
  return missing.length
    ? { config: null, missing }
    : { config: { apiKey: apiKey!, model: model!, budgetUsd: budgetUsd!, priceIn: priceIn!, priceOut: priceOut! }, missing };
}

export function grokStatus(): GrokStatus {
  const { config, missing } = readConfig();
  return config
    ? { enabled: true, model: config.model, budgetUsd: config.budgetUsd }
    : { enabled: false, missing, keyPresent: !!env("XAI_API_KEY") };
}

export class GrokUnavailableError extends Error {}

const costOf = (c: GrokConfig, inTok: number, outTok: number) => (inTok * c.priceIn + outTok * c.priceOut) / 1_000_000;

export async function spentThisMonthUsd(at = new Date()): Promise<number> {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)).toISOString();
  const rows = await select<{ cost_usd: number | string }>("li_llm_usage", [gt("created_at", start)], { columns: "cost_usd" });
  return rows.reduce((s, r) => s + Number(r.cost_usd), 0);
}

export interface GenerateInput {
  system: string;
  prompt: string;
  purpose: string;
  maxOutputTokens: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Strips anything key-like from upstream error text before it is stored or shown. */
const sanitize = (s: string) => s.replace(/xai-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 300);

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const { config, missing } = readConfig();
  if (!config) throw new GrokUnavailableError(`Grok is not enabled. Missing: ${missing.join(", ")}.`);

  // Refuse before calling if the worst case could cross the monthly cap (~3 chars per token, rounded up).
  const worstCase = costOf(config, Math.ceil((input.system.length + input.prompt.length) / 3), input.maxOutputTokens);
  const spent = await spentThisMonthUsd();
  if (spent + worstCase > config.budgetUsd) {
    throw new GrokUnavailableError(
      `Monthly Grok budget reached: $${spent.toFixed(2)} of $${config.budgetUsd.toFixed(2)} used. Raise XAI_MONTHLY_BUDGET_USD to continue.`,
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        max_tokens: input.maxOutputTokens,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    throw new GrokUnavailableError(`Grok could not be reached: ${sanitize(String(err))}`);
  }
  if (!res.ok) {
    throw new GrokUnavailableError(`Grok returned ${res.status}: ${sanitize(await res.text().catch(() => ""))}`);
  }
  const body = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  const inputTokens = body.usage?.prompt_tokens ?? 0;
  const outputTokens = body.usage?.completion_tokens ?? 0;
  const costUsd = costOf(config, inputTokens, outputTokens);
  await insert("li_llm_usage", {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    provider: "xai",
    model: body.model ?? config.model,
    purpose: input.purpose,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
  });
  if (!text) throw new GrokUnavailableError("Grok returned no text.");
  return { text, model: body.model ?? config.model, inputTokens, outputTokens, costUsd };
}

/**
 * Checks the key and model against the live API (GET /v1/models, which costs nothing).
 * Works with only XAI_API_KEY set, so the key can be checked before enabling spend.
 */
export async function verifyGrok(): Promise<{ ok: boolean; message: string; models?: string[] }> {
  const apiKey = env("XAI_API_KEY");
  if (!apiKey) return { ok: false, message: "XAI_API_KEY is not set." };
  try {
    const res = await fetch(`${API}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ok: false, message: `xAI API returned ${res.status}: ${sanitize(await res.text().catch(() => ""))}` };
    const body = (await res.json()) as { data?: { id: string }[] };
    const models = (body.data ?? []).map((m) => m.id);
    const model = env("XAI_MODEL");
    if (model && !models.includes(model)) {
      return { ok: false, message: `Key works, but model "${model}" is not available to it.`, models };
    }
    return { ok: true, message: model ? `Key works and "${model}" is available.` : "Key works. Set XAI_MODEL to one of the listed models.", models };
  } catch (err) {
    return { ok: false, message: `xAI API could not be reached: ${sanitize(String(err))}` };
  }
}
