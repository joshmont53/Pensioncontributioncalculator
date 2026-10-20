import { useEffect, useState } from 'react';
import type { PensionInputs, TaxConfig } from '@calc/core';

// Asks the API server the same question two ways, side by side:
//   A  /api/generative: our code pastes today's figures into one Claude call
//   B  /api/agentic:    Claude decides which calculator tools to run
// See server/src/generative.ts, server/src/agentic.ts and docs/AI-INTEGRATIONS.md.

interface AskResponse {
  text: string;
  apiCalls: number;
  usage: { inputTokens: number; outputTokens: number };
  toolCalls: { tool: string; input: unknown }[];
  elapsedMs: number;
  costUsd: number;
}
type Answer = { status: 'loading' } | { status: 'done'; data: AskResponse } | { status: 'error'; message: string };

const EXAMPLES = [
  'Explain my results in plain English.',
  'How much should I contribute to get out of the higher-rate band while keeping my take-home above £3,000 a month?',
  'What would an extra £2,000 a year into my pension actually cost me in take-home pay?',
];

// Both are asked for plain text; strip any stray markdown emphasis.
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1');

async function ask(path: string, body: object): Promise<AskResponse> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function AIComparison({ inputs, config }: { inputs: PensionInputs; config: TaxConfig }) {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [a, setA] = useState<Answer | null>(null);
  const [b, setB] = useState<Answer | null>(null);

  // Answers describe the inputs they were asked with, so clear them on change.
  const inputsKey = JSON.stringify([inputs, config]);
  useEffect(() => { setAsked(null); setA(null); setB(null); }, [inputsKey]);

  const loading = a?.status === 'loading' || b?.status === 'loading';

  function askBoth(q: string) {
    if (!q.trim() || loading) return;
    setAsked(q);
    setQuestion('');
    const body = { inputs, config, question: q };
    for (const [path, set] of [['/api/generative', setA], ['/api/agentic', setB]] as const) {
      set({ status: 'loading' });
      ask(path, body)
        .then(data => set({ status: 'done', data }))
        .catch(e => set({ status: 'error', message: e instanceof Error ? e.message : String(e) }));
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-[#1a1a18]">Ask AI about your results</h3>
        <span className="text-[10px] bg-[#1d4e3a] text-white rounded-full px-2.5 py-0.5 font-medium tracking-wide">Generative vs agentic</span>
      </div>
      <p className="text-[11px] text-[#8a8a84] mb-4 leading-relaxed">
        Your question goes to two AI integrations at once. A is given today's figures and answers in one go.
        B can run this calculator itself, as many times as it needs, before answering.
      </p>

      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); askBoth(question); }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="e.g. What if I paid £500 a month into my pension?"
          className="flex-1 min-w-0 text-sm border border-black/15 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1d4e3a]"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg bg-[#1d4e3a] text-white hover:bg-[#163d2d] disabled:opacity-60 transition-colors"
        >
          Ask both
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map(q => (
          <button
            key={q}
            onClick={() => askBoth(q)}
            disabled={loading}
            className="text-left text-[12px] text-[#1d4e3a] bg-[#f7faf8] border border-[#1d4e3a]/15 rounded-lg px-3 py-1.5 hover:bg-[#eef5f1] disabled:opacity-60"
          >
            {q}
          </button>
        ))}
      </div>

      {asked && (
        <>
          <p className="mt-4 text-[12px] text-[#4a4a46]"><span className="text-[#8a8a84]">Question:</span> {asked}</p>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <AnswerPanel
              title="A · Generative"
              subtitle="Our code sends today's figures in one call. No tools."
              answer={a}
            />
            <AnswerPanel
              title="B · Agentic"
              subtitle="Claude chooses which calculator tools to run."
              answer={b}
            />
          </div>
        </>
      )}
    </div>
  );
}

function AnswerPanel({ title, subtitle, answer }: { title: string; subtitle: string; answer: Answer | null }) {
  return (
    <div className="border border-black/8 rounded-xl p-4 bg-[#faf9f6]">
      <p className="text-sm font-semibold text-[#1a1a18]">{title}</p>
      <p className="text-[11px] text-[#8a8a84] mb-3">{subtitle}</p>
      {answer?.status === 'loading' && <p className="text-sm text-[#8a8a84]">Working…</p>}
      {answer?.status === 'error' && <p className="text-sm text-red-700">{answer.message}</p>}
      {answer?.status === 'done' && (
        <>
          <p className="text-sm text-[#1a1a18] leading-relaxed whitespace-pre-line">{plain(answer.data.text)}</p>
          <p className="mt-3 pt-3 border-t border-black/8 text-[11px] text-[#8a8a84] tabular-nums">
            {(answer.data.elapsedMs / 1000).toFixed(1)}s · {answer.data.apiCalls} API call{answer.data.apiCalls === 1 ? '' : 's'} ·{' '}
            {(answer.data.usage.inputTokens + answer.data.usage.outputTokens).toLocaleString('en-GB')} tokens · ~${answer.data.costUsd.toFixed(3)}
          </p>
          <p className="mt-1 text-[11px] text-[#8a8a84]">
            {answer.data.toolCalls.length === 0 ? 'No tools: worked only from the figures it was sent.' : 'Tools Claude chose to run:'}
          </p>
          {answer.data.toolCalls.length > 0 && (
            <ol className="mt-1 ml-4 list-decimal space-y-0.5 font-mono text-[11px] text-[#4a4a46]">
              {answer.data.toolCalls.map((c, i) => <li key={i}>{c.tool}({JSON.stringify(c.input)})</li>)}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
