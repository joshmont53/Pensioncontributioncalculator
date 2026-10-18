import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme';

// Basic building blocks shared by every calculator screen.

export function Card({ title, subtitle, accent, children, collapsible, initiallyOpen = true }: {
  title?: string;
  subtitle?: string;
  accent?: string;
  children: ReactNode;
  collapsible?: boolean;
  initiallyOpen?: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const showBody = !collapsible || open;
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null]}>
      {title ? (
        <Pressable
          disabled={!collapsible}
          onPress={() => setOpen(o => !o)}
          accessibilityRole={collapsible ? 'button' : 'header'}
          accessibilityState={collapsible ? { expanded: open } : undefined}
          style={styles.cardHeader}
        >
          <Text style={[styles.cardTitle, { color: t.text }]}>{title}</Text>
          {collapsible ? <Text style={[styles.chevron, { color: t.textMuted }]}>{open ? '⌃' : '⌄'}</Text> : null}
        </Pressable>
      ) : null}
      {subtitle && showBody ? <Text style={[styles.cardSubtitle, { color: t.textMuted }]}>{subtitle}</Text> : null}
      {showBody ? children : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.sectionLabel, { color: t.textMuted }]}>{children}</Text>;
}

export function Body({ children, muted, small }: { children: ReactNode; muted?: boolean; small?: boolean }) {
  const t = useTheme();
  return <Text style={[small ? styles.small : styles.body, { color: muted ? t.textMuted : t.textSecondary }]}>{children}</Text>;
}

export function Strong({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={{ fontWeight: '700', color: color ?? t.text }}>{children}</Text>;
}

type NumberKind = 'currency' | 'percent' | 'year' | 'decimal';

const groupFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/**
 * Numeric field with an iPhone number keypad. Mirrors the web inputs:
 * currency shows grouped £ values, percent edits a decimal (0.04) as "4",
 * decimal is a plain number (e.g. a tax rate stored as 20), and the value is
 * only committed when editing finishes.
 */
export function NumberField({ label, value, onChange, kind = 'currency', hint, suffix, compact }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  kind?: NumberKind;
  hint?: string;
  suffix?: string;
  compact?: boolean;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState<string | null>(null);

  const formatted =
    kind === 'currency' ? groupFormat.format(Math.round(value)) :
    kind === 'percent' ? (value === 0 ? '0' : String(Math.round(value * 10000) / 100)) :
    String(value);

  const commit = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.\-]/g, '');
    const n = kind === 'year' ? parseInt(cleaned, 10) : parseFloat(cleaned);
    if (kind === 'year') {
      if (Number.isFinite(n)) onChange(n);
      return;
    }
    const safe = Number.isFinite(n) ? n : 0;
    onChange(kind === 'percent' ? safe / 100 : Math.max(0, safe));
  };

  const unit = suffix ?? (kind === 'percent' ? '%' : undefined);

  return (
    <View style={compact ? styles.fieldCompact : styles.field}>
      {label ? <Text style={[styles.fieldLabel, { color: t.textMuted }]}>{label}</Text> : null}
      <View style={[styles.inputRow, { backgroundColor: t.inputBackground }]}>
        {kind === 'currency' ? <Text style={[styles.affix, { color: t.textMuted }]}>£</Text> : null}
        <TextInput
          style={[styles.input, compact && styles.inputCompact, { color: t.text }]}
          value={draft ?? formatted}
          onFocus={() => setDraft(kind === 'currency' ? String(Math.round(value)) : formatted)}
          onChangeText={setDraft}
          onEndEditing={e => { commit(e.nativeEvent.text); setDraft(null); }}
          keyboardType={kind === 'percent' || kind === 'decimal' ? 'decimal-pad' : 'number-pad'}
          returnKeyType="done"
          selectTextOnFocus
          accessibilityLabel={label}
          accessibilityHint={hint}
        />
        {unit ? <Text style={[styles.affix, { color: t.textMuted }]}>{unit}</Text> : null}
      </View>
      {hint ? <Text style={[styles.hint, { color: t.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({ label, value, onChange, hint, compact }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={compact ? styles.fieldCompact : styles.field}>
      {label ? <Text style={[styles.fieldLabel, { color: t.textMuted }]}>{label}</Text> : null}
      <View style={[styles.inputRow, { backgroundColor: t.inputBackground }]}>
        <TextInput
          style={[styles.input, compact && styles.inputCompact, { color: t.text }]}
          value={value}
          onChangeText={onChange}
          returnKeyType="done"
          accessibilityLabel={label}
          accessibilityHint={hint}
        />
      </View>
      {hint ? <Text style={[styles.hint, { color: t.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

/** Wrapping single-choice chips, for option lists too long for a segmented control. */
export function ChoiceChips<T extends string | number>({ options, value, onChange }: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.chips}>
      {options.map(o => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, { borderColor: selected ? t.brand : t.border, backgroundColor: selected ? t.brand : t.card }]}
          >
            <Text style={[styles.chipText, { color: selected ? t.onBrand : t.textSecondary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

export function Callout({ tone = 'info', children }: { tone?: CalloutTone; children: ReactNode }) {
  const t = useTheme();
  const dark = t.background !== '#faf9f6';
  const palette: Record<CalloutTone, { bg: string; border: string; text: string }> = dark ? {
    info: { bg: t.inputBackground, border: t.border, text: t.textSecondary },
    success: { bg: t.brandSoft, border: t.brandSoftBorder, text: t.brandSoftText },
    warning: { bg: '#2e2614', border: '#5c4a1c', text: '#f0d88a' },
    danger: { bg: '#2e1715', border: '#6b2a24', text: '#f3a59b' },
  } : {
    info: { bg: '#f7f6f2', border: 'rgba(0,0,0,0.06)', text: '#4a4a46' },
    success: { bg: '#e8f2ed', border: '#b8d4c4', text: '#1d4e3a' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    danger: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  };
  const c = palette[tone];
  return (
    <View style={[styles.callout, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.calloutText, { color: c.text }]}>{children}</Text>
    </View>
  );
}

export function SecondaryButton({ title, onPress, destructive }: { title: string; onPress: () => void; destructive?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.secondary, { borderColor: t.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.secondaryText, { color: destructive ? t.negative : t.brand }]}>{title}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label?: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.fieldLabel, { color: t.textMuted }]}>{label}</Text> : null}
      <View style={[styles.segmented, { backgroundColor: t.inputBackground }]} accessibilityRole="tablist">
        {options.map(o => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.segment, selected && { backgroundColor: t.brand }]}
            >
              <Text style={[styles.segmentText, { color: selected ? t.onBrand : t.textSecondary }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange }: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.toggleLabel, { color: t.text }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: t.textMuted }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.brand }} accessibilityLabel={label} />
    </View>
  );
}

/** A label/value row. `stacked` puts the value under the label, for values too long to sit beside it. */
export function StatRow({ label, value, valueColor, last, stacked }: {
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
  stacked?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[stacked ? styles.statStacked : styles.statRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
      <Text style={[styles.statLabel, { color: t.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, stacked && styles.statValueStacked, { color: valueColor ?? t.text }]}>{value}</Text>
    </View>
  );
}

export function PrimaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { backgroundColor: t.brand, opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: t.onBrand }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  chevron: { fontSize: 18, paddingLeft: 8 },
  cardSubtitle: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 17 },
  field: { marginBottom: 14 },
  fieldCompact: { marginBottom: 8, flex: 1 },
  fieldLabel: { fontSize: 12, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12 },
  affix: { fontSize: 17, fontWeight: '600' },
  input: { flex: 1, fontSize: 17, fontWeight: '600', paddingVertical: 11, paddingHorizontal: 4, fontVariant: ['tabular-nums'] },
  inputCompact: { fontSize: 15, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '600' },
  callout: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  calloutText: { fontSize: 13, lineHeight: 19 },
  secondary: { borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 11, lineHeight: 15, marginTop: 4 },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginBottom: 6 },
  toggleLabel: { fontSize: 15 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, gap: 12 },
  statLabel: { fontSize: 14, flex: 1 },
  statValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'right', flexShrink: 1, maxWidth: '55%' },
  statStacked: { paddingVertical: 10, gap: 3 },
  statValueStacked: { textAlign: 'left', maxWidth: '100%' },
  button: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
