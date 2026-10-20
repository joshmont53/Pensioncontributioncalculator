import Anthropic from '@anthropic-ai/sdk';
import type { PensionInputs, TaxConfig } from './core.js';
import { ANSWER_RULES, currentResults, describeInputs, type AskResult, type Usage } from './figures.js';

// ─── Implementation A: generative integration ──────────────────────────────
// Our code decides every step: run the engine, pick the figures, paste them
// into the prompt with the user's question, make ONE Claude call. Claude only
// sees today's figures. It cannot run the calculator itself, so any what-if
// it answers is its own arithmetic.

// Connect to Claude (reads ANTHROPIC_API_KEY from the environment)
const client = new Anthropic();

const SYSTEM_PROMPT = `${ANSWER_RULES}
You are given the user's current calculator figures. Answer their question using them.
If answering needs a figure you were not given, you may work it out yourself, but say clearly that it is your own estimate.`;

export async function askGenerative(inputs: PensionInputs, config: TaxConfig, question: string): Promise<AskResult> {
  // STEP 1: Our own function already exists: calculatePension in
  // packages/core, wrapped by currentResults in figures.ts.

  // STEP 2: Retrieve the data. Our code runs the engine *before* calling Claude.
  const userData = describeInputs(inputs, config);
  const results = currentResults(inputs, config);

  // STEP 3: Send the data and the question to Claude
  const response = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'medium' },
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Here are the user's inputs and tax thresholds:
${JSON.stringify(userData)}

Here are their current results from the calculator:
${JSON.stringify(results)}

Question: ${question}`,
    }],
  });

  // STEP 4: Return the AI response
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to answer this question.');
  }
  const text = response.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no answer.');
  const usage: Usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  return { text, apiCalls: 1, usage, toolCalls: [] };
}
