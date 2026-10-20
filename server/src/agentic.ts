import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { calculatePension, compareScenarios, type PensionInputs, type TaxConfig } from '@calc/core';
import { ANSWER_RULES, describeInputs, summarise, type AskResult, type ToolCallRecord, type Usage } from './figures';

// ─── Implementation B: agentic integration ─────────────────────────────────
// We define tools (thin wrappers around the engine) and hand them to Claude.
// Claude decides which tools to call, in what order and how many times; the
// SDK's tool runner executes each requested call and feeds the result back.
// Compare generative.ts, where our code makes every decision.

const client = new Anthropic();

const SYSTEM_PROMPT = `${ANSWER_RULES}
Never calculate tax, relief, National Insurance or take-home pay yourself: always use the tools, and quote only figures they return.
Start by checking the user's current inputs. Use what-if calculations to test options before recommending one.`;

export async function askAgentic(userInputs: PensionInputs, config: TaxConfig, question: string): Promise<AskResult> {
  const toolCalls: ToolCallRecord[] = [];
  const record = (tool: string, input: unknown, output: unknown) => {
    toolCalls.push({ tool, input, output });
    console.log(`  [tool] ${tool}(${JSON.stringify(input)})`);
    return JSON.stringify(output);
  };
  const totalEarnings = userInputs.employedEarnings + userInputs.selfEmployedEarnings;
  // Guardrail: keep what-if contributions within a sensible range.
  const clamp = (n: number) => Math.min(Math.max(0, Math.round(n)), totalEarnings);

  // STEP 1: Define tools (≈ @function_tool in the PDF). Claude sees each
  // tool's name, description and input schema, never this code.
  const getCurrentInputs = betaZodTool({
    name: 'get_current_inputs',
    description: 'Get the income, pension and gift aid figures the user has entered, plus the tax band thresholds for the tax year.',
    inputSchema: z.object({}),
    run: async (input) => record('get_current_inputs', input, describeInputs(userInputs, config)),
  });

  const calculatePensionTool = betaZodTool({
    name: 'calculate_pension',
    description: "Run the calculator's UK tax and pension engine on the user's inputs. Optionally override the net personal pension contribution (the amount the user pays, before 20% basic-rate relief is added) to test a what-if. Returns take-home pay, tax, relief and the top tax band reached.",
    inputSchema: z.object({
      netContribution: z.number().optional().describe('Net annual personal contribution in pounds. Omit to use the current value.'),
    }),
    run: async (input) => {
      const inputs = input.netContribution === undefined
        ? userInputs
        : { ...userInputs, netContribution: clamp(input.netContribution) };
      return record('calculate_pension', input, summarise(calculatePension(inputs, config)));
    },
  });

  const compareScenariosTool = betaZodTool({
    name: 'compare_scenarios',
    description: 'Compare several net annual pension contribution amounts side by side: take-home pay, total wealth (take-home plus pension) and government top-up for each.',
    inputSchema: z.object({
      contributions: z.array(z.number()).min(1).max(8).describe('Net annual contribution amounts in pounds'),
    }),
    run: async (input) => {
      const base = calculatePension(userInputs, config);
      const scenarios = input.contributions.map((c, i) => ({
        id: i, name: `£${clamp(c)}`, netContribution: clamp(c), netGiftAid: userInputs.netGiftAid,
      }));
      const results = compareScenarios(base, scenarios).map(s => ({
        netContribution: s.netContribution,
        grossContribution: Math.round(s.gc),
        annualTakeHomeIncludingRefund: Math.round(s.takeHome),
        monthlyTakeHomeIncludingRefund: Math.round(s.takeHome / 12),
        monthlyTakeHomeBeforeRefund: Math.round((s.takeHome - s.tar) / 12),
        additionalRelief: Math.round(s.tar),
        governmentTopUp: Math.round(s.govTopUp),
        totalWealth: Math.round(s.totalWealth),
      }));
      return record('compare_scenarios', input, results);
    },
  });

  // STEP 2 + 3: Give Claude the tools and the request (≈ Agent(...) +
  // Runner.run_sync). The runner loops: Claude answers or requests a tool,
  // the runner executes it and sends the result back, until Claude is done.
  const runner = client.beta.messages.toolRunner({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    max_iterations: 10,
    system: SYSTEM_PROMPT,
    tools: [getCurrentInputs, calculatePensionTool, compareScenariosTool],
    messages: [{ role: 'user', content: question }],
  });

  let finalMessage: Anthropic.Beta.BetaMessage | undefined;
  let apiCalls = 0;
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  for await (const message of runner) {
    apiCalls++;
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    finalMessage = message;
  }

  // STEP 4: Return the result, plus the tool calls Claude chose to make.
  if (finalMessage?.stop_reason === 'refusal') {
    throw new Error('Claude declined to answer this question.');
  }
  const text = finalMessage?.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no answer.');
  return { text, apiCalls, usage, toolCalls };
}
