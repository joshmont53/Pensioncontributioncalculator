import { useColorScheme } from 'react-native';

// Same palette as the web app, with dark-mode equivalents.
const light = {
  background: '#faf9f6',
  card: '#ffffff',
  text: '#1a1a18',
  textSecondary: '#4a4a46',
  textMuted: '#8a8a84',
  border: 'rgba(0,0,0,0.08)',
  brand: '#1d4e3a',
  brandSoft: '#e8f2ed',
  brandSoftBorder: '#b8d4c4',
  brandSoftText: '#4a7d68',
  invest: '#4a90a4',
  income: '#9b7fd4',
  warning: '#e8a87c',
  warningText: '#b8693a',
  negative: '#c0392b',
  inputBackground: '#f4f3ef',
  onBrand: '#ffffff',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#121211',
  card: '#1e1e1c',
  text: '#f2f1ec',
  textSecondary: '#c8c7c0',
  textMuted: '#8f8e88',
  border: 'rgba(255,255,255,0.1)',
  brand: '#5fae8a',
  brandSoft: '#1b2c24',
  brandSoftBorder: '#2f5443',
  brandSoftText: '#8cc4a8',
  invest: '#6fb3c7',
  income: '#b49ce6',
  warning: '#eab08a',
  warningText: '#eab08a',
  negative: '#ef7d6f',
  inputBackground: '#2a2a27',
  onBrand: '#ffffff',
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
