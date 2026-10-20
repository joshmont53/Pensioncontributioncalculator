import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import type { PensionInputs, TaxConfig } from '@calc/core';
import { Card } from '@/components/ui';
import { useTheme } from '@/theme';

// Same "Ask both" comparison as the web app's AIComparison: one question sent
// to the generative (A) and agentic (B) integrations on the API server.

// The API server runs on the same Mac as Metro. Expo knows that machine's
// address (hostUri, e.g. "192.168.1.20:8081"), which works from the simulator
// and from a phone on the same Wi-Fi.
const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
const API_BASE = `http://${host}:8787`;

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

const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1');

async function ask(path: string, body: object): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function AIComparison({ inputs, config }: { inputs: PensionInputs; config: TaxConfig }) {
  const t = useTheme();
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [a, setA] = useState<Answer | null>(null);
  const [b, setB] = useState<Answer | null>(null);

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
    <Card title="Ask AI about your results"
      subtitle="Your question goes to two AI integrations at once. A is given today's figures and answers in one go. B can run this calculator itself before answering.">
      <View style={[styles.inputRow, { backgroundColor: t.inputBackground }]}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="e.g. What if I paid £500 a month in?"
          placeholderTextColor={t.textMuted}
          style={[styles.input, { color: t.text }]}
          returnKeyType="send"
          onSubmitEditing={() => askBoth(question)}
          accessibilityLabel="Question for the AI"
        />
      </View>
      <Pressable
        onPress={() => askBoth(question)}
        disabled={loading || !question.trim()}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, { backgroundColor: t.brand, opacity: loading || !question.trim() ? 0.5 : pressed ? 0.85 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: t.onBrand }]}>Ask both</Text>
      </Pressable>

      <View style={styles.examples}>
        {EXAMPLES.map(q => (
          <Pressable key={q} onPress={() => askBoth(q)} disabled={loading} accessibilityRole="button"
            style={[styles.example, { borderColor: t.brandSoftBorder, backgroundColor: t.brandSoft, opacity: loading ? 0.5 : 1 }]}>
            <Text style={[styles.exampleText, { color: t.brand }]}>{q}</Text>
          </Pressable>
        ))}
      </View>

      {asked ? (
        <>
          <Text style={[styles.asked, { color: t.textSecondary }]}><Text style={{ color: t.textMuted }}>Question: </Text>{asked}</Text>
          <AnswerPanel title="A · Generative" subtitle="Our code sends today's figures in one call. No tools." answer={a} />
          <AnswerPanel title="B · Agentic" subtitle="Claude chooses which calculator tools to run." answer={b} />
        </>
      ) : null}
    </Card>
  );
}

function AnswerPanel({ title, subtitle, answer }: { title: string; subtitle: string; answer: Answer | null }) {
  const t = useTheme();
  return (
    <View style={[styles.panel, { borderColor: t.border, backgroundColor: t.background }]}>
      <Text style={[styles.panelTitle, { color: t.text }]}>{title}</Text>
      <Text style={[styles.meta, { color: t.textMuted, marginBottom: 8 }]}>{subtitle}</Text>
      {answer?.status === 'loading' ? <ActivityIndicator color={t.brand} style={{ alignSelf: 'flex-start' }} /> : null}
      {answer?.status === 'error' ? <Text style={[styles.body, { color: t.negative }]}>{answer.message}</Text> : null}
      {answer?.status === 'done' ? (
        <>
          <Text style={[styles.body, { color: t.text }]}>{plain(answer.data.text)}</Text>
          <Text style={[styles.meta, styles.stats, { color: t.textMuted, borderTopColor: t.border }]}>
            {(answer.data.elapsedMs / 1000).toFixed(1)}s · {answer.data.apiCalls} API call{answer.data.apiCalls === 1 ? '' : 's'} ·{' '}
            {(answer.data.usage.inputTokens + answer.data.usage.outputTokens).toLocaleString('en-GB')} tokens · ~${answer.data.costUsd.toFixed(3)}
          </Text>
          <Text style={[styles.meta, { color: t.textMuted }]}>
            {answer.data.toolCalls.length === 0 ? 'No tools: worked only from the figures it was sent.' : 'Tools Claude chose to run:'}
          </Text>
          {answer.data.toolCalls.map((c, i) => (
            <Text key={i} style={[styles.tool, { color: t.textSecondary }]}>{i + 1}. {c.tool}({JSON.stringify(c.input)})</Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  input: { fontSize: 15, paddingVertical: 11 },
  button: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  examples: { gap: 8, marginTop: 12 },
  example: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  exampleText: { fontSize: 13, lineHeight: 18 },
  asked: { fontSize: 13, lineHeight: 18, marginTop: 14 },
  panel: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  panelTitle: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 11, lineHeight: 16 },
  stats: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 10, fontVariant: ['tabular-nums'] },
  tool: { fontSize: 11, lineHeight: 16, fontFamily: 'Menlo' },
});
