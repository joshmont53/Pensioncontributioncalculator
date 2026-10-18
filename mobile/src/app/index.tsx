import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useTheme } from '@/theme';

const CALCULATORS: { label: string; description: string; href: Href; accent: string; available: boolean }[] = [
  {
    label: 'Pension Contribution Calculator',
    description: 'Work out the tax relief, National Insurance and student loan impact of pension contributions and gift aid.',
    href: '/pension',
    accent: '#1d4e3a',
    available: true,
  },
  {
    label: 'Student Loan Repayment Calculator',
    description: 'Compare overpaying a student loan against investing the difference.',
    href: '/student-loan',
    accent: '#4a90a4',
    available: true,
  },
];

export default function HomeScreen() {
  const t = useTheme();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: t.textSecondary }]}>
        Tools for UK financial advisers. Choose a calculator to get started.
      </Text>
      {CALCULATORS.map(c => (
        <Pressable
          key={c.label}
          disabled={!c.available}
          onPress={() => router.push(c.href)}
          accessibilityRole="button"
          accessibilityState={{ disabled: !c.available }}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: t.card, borderColor: t.border, borderLeftColor: c.accent, opacity: !c.available ? 0.55 : pressed ? 0.8 : 1 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: t.text }]}>{c.label}</Text>
            <Text style={[styles.description, { color: t.textMuted }]}>{c.description}</Text>
            {!c.available ? <Text style={[styles.soon, { color: t.textMuted }]}>Coming soon</Text> : null}
          </View>
          {c.available ? <Text style={[styles.chevron, { color: t.textMuted }]}>›</Text> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 15, lineHeight: 21, marginBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4, padding: 16, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  description: { fontSize: 13, lineHeight: 18 },
  soon: { fontSize: 11, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  chevron: { fontSize: 28, paddingLeft: 8 },
});
