import { DEFAULT_CONFIG, type PensionInputs, type TaxConfig } from './core.js';
import { costUsd, type AskResult } from './figures.js';

// Request checks shared by the local Express server (index.ts) and the Vercel
// functions (api/generative.ts, api/agentic.ts), so both behave the same.

type Ask = (inputs: PensionInputs, config: TaxConfig, question: string) => Promise<AskResult>;

const MAX_QUESTION_LENGTH = 500;
const INPUT_FIELDS = [
  'employedEarnings', 'selfEmployedEarnings', 'netContribution', 'netGiftAid', 'savingsInterest',
  'rentalProfit', 'dividendIncome', 'employerContribution', 'salarySacrifice',
] as const;

// Guardrail against someone running up the Anthropic bill: each visitor gets
// RATE_LIMIT_PER_HOUR questions per endpoint. Only applied when deployed.
// Best effort: Vercel can run several copies of a function, each with its own
// count, so the Claude console spend limit is the real backstop.
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);
const recent = new Map<string, number[]>();

function rateLimited(key: string) {
  if (!process.env.VERCEL) return false;
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const times = (recent.get(key) ?? []).filter(t => t > hourAgo);
  if (times.length >= RATE_LIMIT_PER_HOUR) return true;
  times.push(Date.now());
  recent.set(key, times);
  return false;
}

export async function handleAsk(label: string, ask: Ask, body: unknown, visitor: string) {
  const { inputs, config, question } = (body ?? {}) as { inputs?: PensionInputs; config?: Partial<TaxConfig>; question?: unknown };
  if (!inputs || INPUT_FIELDS.some(f => typeof inputs[f] !== 'number' || !Number.isFinite(inputs[f]))
      || typeof question !== 'string' || !question.trim()) {
    return { status: 400, json: { error: 'Expected { inputs, config, question } with the pension calculator inputs' } };
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return { status: 400, json: { error: `Please keep questions under ${MAX_QUESTION_LENGTH} characters.` } };
  }
  if (rateLimited(`${label}:${visitor}`)) {
    return { status: 429, json: { error: `You've reached the limit of ${RATE_LIMIT_PER_HOUR} questions an hour. Please try again later.` } };
  }

  console.log(`[${label}] ${question}`);
  const started = Date.now();
  try {
    const result = await ask(inputs, { ...DEFAULT_CONFIG, ...config }, question);
    const elapsedMs = Date.now() - started;
    console.log(`  [done] ${result.toolCalls.length} tool calls, ${result.apiCalls} API calls, ${(elapsedMs / 1000).toFixed(1)}s`);
    return { status: 200, json: { ...result, elapsedMs, costUsd: costUsd(result.usage) } };
  } catch (error) {
    console.error(`${label} failed:`, error);
    return { status: 502, json: { error: error instanceof Error ? error.message : String(error) } };
  }
}
