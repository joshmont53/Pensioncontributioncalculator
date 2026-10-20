import './env';
import { DEFAULT_CONFIG, type PensionInputs } from '@calc/core';
import { askGenerative } from './generative';
import { askAgentic } from './agentic';
import { costUsd } from './figures';

// Ask the SAME question both ways, from the same starting figures, using the
// exact functions behind the app's "Ask both" button.
// Run with: pnpm --dir server compare ["your question"]

const QUESTION = process.argv[2]
  ?? 'How much should I contribute to get out of the higher-rate band while keeping my take-home above £3,000 a month?';
const INPUTS: PensionInputs = {
  employedEarnings: 65000, selfEmployedEarnings: 0, netContribution: 3000, netGiftAid: 0,
  savingsInterest: 0, rentalProfit: 0, dividendIncome: 0, hasStudentLoan: true,
  employerContribution: 3000, salarySacrifice: 0, carryForward: [],
};

console.log(`Question: ${QUESTION}`);
for (const [label, ask] of [['A: generative (figures pasted in, no tools)', askGenerative], ['B: agentic (calculator tools)', askAgentic]] as const) {
  const started = Date.now();
  const r = await ask(INPUTS, DEFAULT_CONFIG, QUESTION);
  console.log(`\n=== ${label} ===`);
  console.log(`${((Date.now() - started) / 1000).toFixed(1)}s · ${r.apiCalls} API call(s) · ${r.usage.inputTokens} in / ${r.usage.outputTokens} out tokens · ~$${costUsd(r.usage).toFixed(4)}`);
  if (r.toolCalls.length) {
    console.log(`Tool calls: ${r.toolCalls.map(c => `${c.tool}(${JSON.stringify(c.input)})`).join(' → ')}`);
  }
  console.log(`\n${r.text}`);
}
