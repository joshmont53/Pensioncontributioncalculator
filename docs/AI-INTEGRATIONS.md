# Generative AI vs Agentic AI in the pension calculator

**Same model. Same calculator. Different control over the workflow.**

This app answers a user's question about their pension results in two ways, side by side:

| | **A / Generative integration** | **B / Agentic integration** |
|---|---|---|
| In one line | *Your application chooses the steps.* | *The model chooses which tools to use.* |
| Code | [server/src/generative.ts](../server/src/generative.ts) | [server/src/agentic.ts](../server/src/agentic.ts) |
| Endpoint | `POST /api/generative` | `POST /api/agentic` |

On both web and iOS, the **"Ask AI about your results"** card at the top of the Pension results page sends one question to both and shows the answers next to each other.

Agentic AI is still generative AI. Both use the same Claude model (`claude-opus-5-5`). The difference is **orchestration**: who decides when the calculator runs.

---

## 1. The shared example

The SwimSquad guide used a database table and a `get_squad_sessions()` function. This app has no database. It doesn't need one, because **the data is what the user typed into the calculator** and **the functions are the calculation engine**:

| SwimSquad guide | This app |
|---|---|
| `swimming_sessions` table | The user's calculator inputs (salary, contributions, student loan…) |
| `get_squad_sessions(squad_id)` | `calculatePension(inputs, config)` in [packages/core/src/pensionEngine.ts](../packages/core/src/pensionEngine.ts) |
| Other tools (`get_competitions`…) | `compareScenarios(...)` from the same engine |
| `database.query` | The engine's UK tax maths, which the web app and the iOS app share |

**The user question we keep the same for both:**

> "How much should I contribute to get out of the higher-rate band while keeping my take-home above £3,000 a month?"

**The user:** £65,000 salary, £3,000 net personal pension contribution, £3,000 employer contribution, Plan 2 student loan.

---

## 2. How the pieces connect

```
Web page / iPhone app  ──POST /api/...──▶  server code  ──SDK──▶  Claude API
   (sends inputs + question)                imports the same engine
                                            holds the API key
```

- **Why server code?** The Claude API key must stay secret. Code in a browser or a phone app can be read by anyone, so the key only ever exists on the server side.
- **Why it's useful:** the server code imports the same calculation engine (`packages/core`) the app uses, so the AI's figures always match what's on screen.

**Where it runs:** the same AI logic runs in two places.

| | Locally (development) | Deployed (Vercel) |
|---|---|---|
| What answers `/api/...` | The Express server in `server/` (`pnpm dev:server`) | Vercel Functions: [api/generative.ts](../api/generative.ts) and [api/agentic.ts](../api/agentic.ts) |
| Where the key comes from | `.env` in the repo root (git-ignored, your dev key) | The Vercel project's Environment Variables (your production key) |
| Shared code | Both call `askGenerative` / `askAgentic` through [server/src/handleAsk.ts](../server/src/handleAsk.ts) | Same |

### Same starting data for both (fairness)

[server/src/figures.ts](../server/src/figures.ts) defines what either approach starts with: the user's inputs, the tax band thresholds and a summary of today's results. A gets all of this pasted into its prompt. B gets the same data back from its first two tool calls.

**The only difference between A and B is that B can run the calculator again with different numbers.**

```ts
// figures.ts: a small, clearly labelled summary of the engine's result
export function summarise(r: PensionResult) {
  return {
    netContribution: r.inputs.netContribution,
    grossContribution: Math.round(r.grossContribution),
    effectiveEarnings: Math.round(r.effectiveEarnings),
    topTaxBand: band,                                  // e.g. "higher rate"
    additionalReliefViaSelfAssessment: Math.round(r.totalAdditionalRelief),
    annualTakeHomeIncludingRefund: Math.round(r.takeHomePay),
    monthlyTakeHomeIncludingRefund: Math.round(r.takeHomePay / 12),
    monthlyTakeHomeBeforeRefund: Math.round((r.takeHomePay - r.totalAdditionalRelief) / 12),
    // ...
  };
}
```

The long field names are deliberate. Section 7 shows what went wrong when they were vague.

---

## 3. Implementation A: generative, step by step

### Step 1: our function (already exists)

As in the guide, where `get_squad_sessions()` was our own function, here our function is the engine. `figures.ts` wraps it:

```ts
// figures.ts
export function currentResults(inputs: PensionInputs, config: TaxConfig) {
  return summarise(calculatePension(inputs, config));
}
```

### Step 2: our code retrieves the data

```ts
// generative.ts
const client = new Anthropic();            // connect to Claude (reads ANTHROPIC_API_KEY)

export async function askGenerative(inputs, config, question) {
  const userData = describeInputs(inputs, config);   // inputs + tax thresholds
  const results  = currentResults(inputs, config);   // runs the engine ONCE
```

**This is the decisive line** (guide slide 5): the engine runs **before** Claude is involved, and our code decides what data Claude gets.

### Step 3: send the raw data and the question to Claude

```ts
  const response = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
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
```

**What Claude sees:** the figures as text, inserted into the template string. It doesn't see our function, the engine or the code. The system prompt tells it: *"If answering needs a figure you were not given, you may work it out yourself, but say clearly that it is your own estimate."*

### Step 4: return the AI response

```ts
  const text = response.content.find(b => b.type === 'text')?.text;
  return { text, apiCalls: 1, usage, toolCalls: [] };
}
```

### Unpacking the code (guide slide 6)

| Code | What it is |
|---|---|
| `new Anthropic()` | A client from Anthropic's official TypeScript SDK (the guide's `OpenAI()`) |
| `client.messages.create(...)` | Sends one request and gets one response (the guide's `responses.create()`) |
| `` content: `...${JSON.stringify(results)}...` `` | A template string: the figures are pasted in as text (the guide's f-string) |
| `response.content.find(b => b.type === 'text')` | Pulls the written answer out of the response (the guide's `output_text`) |

**Key limitation (guide slide 7):** Claude only sees today's figures. It can't run the calculator for "what if I paid £11,784?", so for any what-if it has to do the maths itself.

---

## 4. Implementation B: agentic, step by step

### Step 1: define the tools

Each tool is a thin wrapper around an engine function. `betaZodTool` plays the role of the guide's `@function_tool`:

```ts
// agentic.ts
const calculatePensionTool = betaZodTool({
  name: 'calculate_pension',
  description: "Run the calculator's UK tax and pension engine on the user's inputs. " +
               'Optionally override the net personal pension contribution to test a what-if...',
  inputSchema: z.object({
    netContribution: z.number().optional()
      .describe('Net annual personal contribution in pounds. Omit to use the current value.'),
  }),
  run: async (input) => {
    const inputs = input.netContribution === undefined
      ? userInputs
      : { ...userInputs, netContribution: clamp(input.netContribution) };   // guardrail
    return record('calculate_pension', input, summarise(calculatePension(inputs, config)));
  },
});
```

The other two tools follow the same pattern:

| Tool | Wraps | What Claude uses it for |
|---|---|---|
| `get_current_inputs` | `describeInputs(...)` | "What am I working with?" (inputs and tax thresholds) |
| `calculate_pension` | `calculatePension(...)` | The baseline, or a what-if at any contribution |
| `compare_scenarios` | `compareScenarios(...)` | Several contribution amounts side by side |

**What `betaZodTool` exposes to Claude** (guide slide 10):

| | Visible to Claude |
|---|---|
| Name | `calculate_pension` |
| Description | "Run the calculator's UK tax and pension engine… test a what-if…" |
| Parameter | `netContribution`: number, optional, "Net annual personal contribution in pounds" |
| The `run` code | **Not visible.** Claude only ever sees the result it returns |

`z.object({...})` (Zod) is the TypeScript version of the guide's Python type hints. It describes the input, and the SDK also uses it to check every tool call before running it.

**Who runs it?** Claude only *requests* a tool call. Our server runs the TypeScript function and sends the result back.

### Steps 2–3: give Claude the tools and the request

The guide uses `Agent(...)` then `Runner.run_sync(...)`. Anthropic's SDK combines them into one call, the **tool runner**:

```ts
  const runner = client.beta.messages.toolRunner({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    max_iterations: 10,                          // guardrail: stop after 10 rounds
    system: SYSTEM_PROMPT,                       // ≈ Agent(instructions=...)
    tools: [getCurrentInputs, calculatePensionTool, compareScenariosTool],   // ≈ tools=[...]
    messages: [{ role: 'user', content: question }],
  });

  for await (const message of runner) {          // one loop pass per API call
    apiCalls++;
    finalMessage = message;
  }
```

The system prompt says: *"Never calculate tax, relief, National Insurance or take-home pay yourself: always use the tools… Use what-if calculations to test options before recommending one."*

**What the runner does** (guide slide 11):

1. Sends the question and the three tool definitions to Claude.
2. **Claude chooses:** answer now, or request one or more tool calls.
3. The runner runs the requested TypeScript functions.
4. **Claude gets the results and can decide again.**
5. When Claude stops asking for tools, the final answer comes back.

Steps 2–4 repeat as many times as Claude needs, up to our limit of 10.

### Step 4: return the result

```ts
  const text = finalMessage?.content.find(b => b.type === 'text')?.text;
  return { text, apiCalls, usage, toolCalls };   // toolCalls = what Claude chose to run
```

---

## 5. A vs B: the decisive code difference (guide slide 13)

```ts
// A: OUR code runs the engine, then calls Claude once
const results = currentResults(inputs, config);
const response = await client.messages.create({
  model: 'claude-opus-5-5',
  messages: [{ role: 'user', content: `...${JSON.stringify(results)}... Question: ${question}` }],
});
```

```ts
// B: we DEFINE tools, and Claude decides when to run the engine
const calculatePensionTool = betaZodTool({ name: 'calculate_pension', ..., run: ... });
const runner = client.beta.messages.toolRunner({
  model: 'claude-opus-5-5',
  tools: [getCurrentInputs, calculatePensionTool, compareScenariosTool],
  messages: [{ role: 'user', content: question }],
});
```

**Same function (`calculatePension`). Different decision-maker.**

---

## 6. Worked example: the same question, both ways

These results come from `pnpm --dir server compare`, which runs [server/src/compare.ts](../server/src/compare.ts) using the exact functions behind the app's "Ask both" button.

### The headline numbers

| | **A: Generative** | **B: Agentic** |
|---|---|---|
| Who chose the steps | Our code: calculate once, then one Claude call | Claude: 4 tool calls, chosen by itself |
| API calls | 1 | 3 |
| Tokens (in / out) | 674 / 996 | 5,448 / 689 |
| Cost | ~$0.023 | ~$0.036 |
| Time | 11.1s | 10.0s |
| Where the figures came from | **Claude's own arithmetic**, labelled "my own estimates" | **The engine**, every figure |

### The order of B's tool calls, which Claude chose

```
get_current_inputs({})                         → £65k salary, £3k contribution, higher rate starts at £50,270
calculate_pension({})                          → baseline: effective earnings £61,250 (higher rate)
compare_scenarios([3000, 8000, 11784, 11800, 12000])
                                               → where take-home crosses £3,000 a month
calculate_pension({"netContribution": 11784})  → confirm the exact edge case
```

Nobody told Claude to try £11,784. It took the £50,270 threshold from the first tool, worked out that £11,784 net (£14,730 gross) brings £65,000 down to exactly £50,270, and then **checked that with the engine** instead of trusting its own maths. A different question gives a different path. *"What would an extra £2,000 a year cost me?"* made just two tool calls: inputs, then a comparison of £3,000 and £5,000.

### The answers, shortened

**A (generative):**
> To bring your adjusted income down to £50,270, you'd need a gross contribution of about £14,730, which means paying in about £11,784 net (around £982 a month). *These are my own estimates, not calculator outputs.* Including the refund, your take-home would be roughly £36,214 a year, about £3,018 a month… Your actual monthly pay would be about £2,772, below £3,000, because the £2,946 refund comes as a lump sum after your tax return… *You could try £11,784 in the calculator to confirm these figures.*

**B (agentic):**
> You can do both, but only just: contribute £11,784 a year net (about £982 a month)… Your take-home would be £36,214 a year, or £3,018 a month including the refund… The catch is that £2,946 of that comes as a self-assessment refund, not in your pay. Your actual monthly pay would be about £2,772. If you need £3,000 in your pay packet every month, you can't do both. For example, £8,000 net still leaves you in the higher-rate band and gives you £3,088 a month before the refund… Paying more than £11,784 doesn't get you any more higher-rate relief… At £12,000… take-home drops to exactly £3,000 a month.

### Checking both against the engine

| Figure | Engine | A | B |
|---|---|---|---|
| Net contribution needed | £11,784 | £11,784 ✅ | £11,784 ✅ |
| Take-home including refund | £36,214 (£3,018/month) | £36,214 ✅ | £36,214 ✅ |
| Higher-rate refund | £2,946 | £2,946 ✅ | £2,946 ✅ |
| Monthly pay before the refund | £2,772 | £2,772 ✅ | £2,772 ✅ |
| Other options tested | n/a | None. A can't test any | £8,000, £11,800, £12,000 |

### What this shows

- **On this run A was right, but nothing checked it.** The maths here is fairly simple (subtract the threshold, gross up by 20%), so Claude managed it, and it honestly called its figures estimates and suggested confirming them. On an **earlier run with less clearly labelled data, A got the monthly figure wrong** (£2,835 instead of £2,772), and nothing in A could have caught that. A's accuracy depends on the model getting the maths right every time.
- **B's figures are exact by design.** Every number came from the engine. It also *explored*: it found that you can't keep £3,000 in each payslip and leave higher rate, and it backed that up with a tested alternative (£8,000). A has no way to test anything.
- **Cost and speed:** B used about 60% more money (more input tokens, because each loop re-sends the conversation), with similar time here. Both cost a few pence at most.
- **Variability:** both approaches can word answers differently each time. B's *figures* stay the same, because the engine is deterministic. A's figures depend on the model's arithmetic on that run.

---

## 7. Lessons from building it

All three bugs we found while building were about **context**, not code:

1. **A mislabelled figure misled A.** The first version labelled the engine's `totalTaxLiability` as "Total tax liability". That figure also includes National Insurance and the student loan, so Claude said £19,948 "seems high". Relabelled as "Total deductions (income tax + NI + student loan)", the explanation became correct.
2. **A vague tool output misled B.** The tools originally returned `annualTakeHome`. Claude assumed that *excluded* the tax refund and told the user their real cash was *better* than shown, which was backwards. Renaming the fields `...IncludingRefund` and adding `monthlyTakeHomeBeforeRefund` fixed it.
3. **A did its own maths and got one figure wrong**, before it had the clearer figures. It has no way to check itself.

**The takeaway:** tool names, descriptions and output field names are the only things Claude knows about your tools. They deserve as much care as the code.

---

## 8. Guardrails (guide slide 20)

| Guardrail | Where |
|---|---|
| API key only on the server, never in the app | `.env` + [server/src/env.ts](../server/src/env.ts) |
| Tools are read-only: they calculate, they never change anything | [agentic.ts](../server/src/agentic.ts) |
| Tool inputs checked against their schema, and what-if amounts clamped to £0–earnings | `inputSchema` + `clamp()` in agentic.ts |
| Requests checked: numeric inputs, questions under 500 characters | [handleAsk.ts](../server/src/handleAsk.ts) |
| When deployed: 10 questions per hour per visitor, per endpoint (best effort, because each copy of a Vercel function keeps its own count) | `RATE_LIMIT_PER_HOUR` in handleAsk.ts |
| Monthly spend limit (the real backstop) | Claude console → Limits |
| Agent stops after 10 rounds | `max_iterations: 10` |
| Claude gets a small labelled summary, not the full engine output | `summarise()` in figures.ts |
| "Use the tools, never calculate yourself" for B; "label your own estimates" for A | System prompts |
| Every tool call logged and shown to the user | `record()`, the server console and the app's "Tools Claude chose to run" list |
| "General information, not regulated financial advice" | `ANSWER_RULES` in figures.ts |

---

## 9. When to use which

| Use **A: generative** when… | Use **B: agentic** when… |
|---|---|
| The steps are known in advance (a button: "Explain my results") | The steps depend on the question ("how much should I…?") |
| The data needed fits in one prompt | The answer needs new calculations (what-ifs) |
| You want one cheap, predictable call | Exact figures matter more than a few pence |

**Agentic isn't automatically better.** Use it when adaptive, multi-step decisions add value. For the plain "Explain my results" question, A is cheaper and good enough.

---

## 10. Where everything lives

| File | What it does |
|---|---|
| [api/generative.ts](../api/generative.ts), [api/agentic.ts](../api/agentic.ts) | The deployed endpoints (Vercel Functions) |
| [server/src/index.ts](../server/src/index.ts) | Local Express server: `/api/generative`, `/api/agentic`, `/api/health`, `/api/ping-claude` |
| [server/src/handleAsk.ts](../server/src/handleAsk.ts) | Request checks, rate limit, timing and cost, shared by both |
| [server/src/figures.ts](../server/src/figures.ts) | Shared starting data, answer rules, result type, cost |
| [server/src/core.ts](../server/src/core.ts) | Imports the shared engine by file path, so Vercel can load it |
| [server/src/generative.ts](../server/src/generative.ts) | **Implementation A** |
| [server/src/agentic.ts](../server/src/agentic.ts) | **Implementation B** |
| [server/src/compare.ts](../server/src/compare.ts) | Asks both the same question from the command line |
| [src/app/components/AIComparison.tsx](../src/app/components/AIComparison.tsx) | Web "Ask AI about your results" card (top of the Pension results page) |
| [mobile/src/components/ai.tsx](../mobile/src/components/ai.tsx) | Same card on iOS (top of the Pension results screen) |

### Running it

```bash
pnpm dev:server                    # API server on http://localhost:8787 (needs ANTHROPIC_API_KEY in .env)
pnpm dev                           # web app (http://localhost:5001 if AirPlay is using port 5000)
pnpm dev:ios                       # iOS simulator; reaches the server via your Mac's network address
pnpm --dir server compare          # A vs B from the command line
pnpm --dir server compare "What if I paid £500 a month?"
```

### Deploying (Vercel)

- Vercel turns each file in the top-level `api/` folder into an endpoint on the same domain as the site, so the web app's `/api/...` calls work unchanged.
- The production key goes **only** in Vercel: Project → Settings → Environment Variables → `ANTHROPIC_API_KEY`. Never put it in a file in this repo.
- Environment variable changes only apply to **new** deployments, so redeploy after adding or changing it.
- **Why the engine's imports end in `.js`** (e.g. `from './taxConfig.js'`): Vercel compiles each TypeScript file separately, and Node needs the full filename to find it. Vite and tsx map `.js` to the `.ts` source automatically. For iOS, [mobile/metro.config.js](../mobile/metro.config.js) teaches Metro to do the same.
- To check a deploy will work before pushing, run `npx vercel build`. It builds exactly what Vercel would into `.vercel/output` (git-ignored).

### Known limits and next steps

- **iOS in production:** the app finds the API through your Mac's network address, which only works in development. A published app would need to point at the Vercel URL.
- **Refusal fallback not enabled.** For production, Claude can automatically retry on another model if it declines a request. That was left out to keep the code close to the guide.
- **Stretch idea (guide slides 15–18):** a "triage" agent that routes questions to a Pension specialist or a Student Loan specialist, each with its own tools.
