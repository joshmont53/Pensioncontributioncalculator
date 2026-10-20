import { calculatePension, type PensionInputs, type PensionResult, type TaxConfig } from '@calc/core';

// The data both approaches start from. A (generative) gets this pasted into its
// prompt; B (agentic) gets the same thing back from its first tool calls. That
// keeps the comparison fair: the only difference is that B can re-run the
// calculator with different figures.

// Rules shared by both approaches' system prompts.
export const ANSWER_RULES = `You are a UK pension and tax assistant inside a pension contribution calculator.
Answer in plain text with short paragraphs: no markdown at all (no asterisks, bullet points, tables or headings). Keep it under 200 words.
Income tax figures are before the additional relief. Take-home figures already include that relief, which arrives as a self-assessment refund rather than in monthly pay.
This is general information, not regulated financial advice.`;

export function describeInputs(inputs: PensionInputs, config: TaxConfig) {
  return {
    taxYear: config.TAX_YEAR,
    inputs,
    thresholds: {
      personalAllowance: config.B0, higherRateStartsAt: config.B1,
      personalAllowanceTaperStartsAt: config.B2, additionalRateStartsAt: config.B3,
    },
  };
}

// A small, clearly labelled subset of the engine's result. The full
// PensionResult echoes the config and dozens of intermediate values, and
// vague labels mislead the model (see docs/AI-INTEGRATIONS.md).
export function summarise(r: PensionResult) {
  const { config } = r;
  const band = r.effectiveEarnings <= config.B1 ? 'basic rate'
    : r.effectiveEarnings <= config.B2 ? 'higher rate'
    : r.effectiveEarnings <= config.B3 ? 'personal allowance taper zone (60% effective rate)'
    : 'additional rate';
  return {
    netContribution: r.inputs.netContribution,
    grossContribution: Math.round(r.grossContribution),
    effectiveEarnings: Math.round(r.effectiveEarnings),
    topTaxBand: band,
    incomeTaxBeforeAdditionalRelief: Math.round(r.grossIncomeTax + r.grossDividendTax),
    nationalInsurance: Math.round(r.totalNI),
    studentLoanRepayment: Math.round(r.studentLoan),
    additionalReliefViaSelfAssessment: Math.round(r.totalAdditionalRelief),
    annualTakeHomeIncludingRefund: Math.round(r.takeHomePay),
    monthlyTakeHomeIncludingRefund: Math.round(r.takeHomePay / 12),
    monthlyTakeHomeBeforeRefund: Math.round((r.takeHomePay - r.totalAdditionalRelief) / 12),
    totalGoingIntoPension: Math.round(r.grossContribution + r.inputs.employerContribution),
  };
}

export function currentResults(inputs: PensionInputs, config: TaxConfig) {
  return summarise(calculatePension(inputs, config));
}

export interface Usage { inputTokens: number; outputTokens: number }

export interface ToolCallRecord {
  tool: string;
  input: unknown;
  output: unknown;
}

// What both approaches return, so the app can show them side by side.
export interface AskResult {
  text: string;
  apiCalls: number;
  usage: Usage;
  toolCalls: ToolCallRecord[];
}

// Claude Opus 5.5 list prices: US$4 per million input tokens, $20 per million output.
export const costUsd = (u: Usage) => (u.inputTokens * 4 + u.outputTokens * 20) / 1e6;
