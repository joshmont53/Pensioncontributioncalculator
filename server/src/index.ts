import './env';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { calculatePension, DEFAULT_CONFIG, type PensionInputs, type TaxConfig } from '@calc/core';
import { askGenerative } from './generative';
import { askAgentic } from './agentic';
import { costUsd } from './figures';

const PORT = Number(process.env.SERVER_PORT ?? 8787);

const app = express();
app.use(express.json());

// Sanity check that the server is up, can import the shared engine, and has a key.
app.get('/api/health', (_req, res) => {
  const sample = calculatePension(
    {
      employedEarnings: 50000, selfEmployedEarnings: 0, netContribution: 0, netGiftAid: 0,
      savingsInterest: 0, rentalProfit: 0, dividendIncome: 0, hasStudentLoan: false,
      employerContribution: 0, salarySacrifice: 0, carryForward: [],
    },
    DEFAULT_CONFIG,
  );
  res.json({
    ok: true,
    engineTakeHomeFor50k: Math.round(sample.takeHomePay),
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
});

// Proves the key works end to end with the smallest possible Claude call.
app.get('/api/ping-claude', async (_req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(401).json({ ok: false, error: 'ANTHROPIC_API_KEY is not set - add it to the .env file in the repo root' });
    return;
  }
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 200,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Reply with exactly: pong' }],
    });
    const text = response.content.find(b => b.type === 'text')?.text;
    res.json({ ok: true, text });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      res.status(401).json({ ok: false, error: 'Invalid or missing ANTHROPIC_API_KEY' });
    } else if (error instanceof Anthropic.APIError) {
      res.status(502).json({ ok: false, error: `Claude API error ${error.status}: ${error.message}` });
    } else {
      res.status(500).json({ ok: false, error: String(error) });
    }
  }
});

// The two AI integrations take the same request and return the same shape,
// so the app can ask both the same question and compare them side by side.
//   POST /api/generative  Implementation A (generative.ts)
//   POST /api/agentic     Implementation B (agentic.ts)
type Ask = typeof askGenerative;

function askRoute(label: string, ask: Ask) {
  return async (req: express.Request, res: express.Response) => {
    const { inputs, config, question } = req.body as { inputs?: PensionInputs; config?: TaxConfig; question?: string };
    if (!inputs || typeof inputs.employedEarnings !== 'number' || !question?.trim()) {
      res.status(400).json({ error: 'Expected { inputs, config, question }' });
      return;
    }
    console.log(`[${label}] ${question}`);
    const started = Date.now();
    try {
      const result = await ask(inputs, { ...DEFAULT_CONFIG, ...config }, question);
      const elapsedMs = Date.now() - started;
      console.log(`  [done] ${result.toolCalls.length} tool calls, ${result.apiCalls} API calls, ${(elapsedMs / 1000).toFixed(1)}s`);
      res.json({ ...result, elapsedMs, costUsd: costUsd(result.usage) });
    } catch (error) {
      console.error(`${label} failed:`, error);
      res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
    }
  };
}

app.post('/api/generative', askRoute('generative', askGenerative));
app.post('/api/agentic', askRoute('agentic', askAgentic));

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
