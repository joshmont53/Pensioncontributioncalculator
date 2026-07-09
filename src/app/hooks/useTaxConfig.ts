import { useState } from 'react';

export interface TaxConfig {
  B0: number;
  B1: number;
  B2: number;
  B3: number;
  TR_B: number;
  TR_H: number;
  TR_60: number;
  TR_A: number;
  SL_T: number;
  SL_R: number;
  SL_UNEARNED_THRESHOLD: number;
  TAX_YEAR: string;
  SL_PLAN: string;
  NI_L: number;
  NI_U: number;
  C1_Main: number;
  C1_Upper: number;
  C4_Main: number;
  C4_Upper: number;
  STANDARD_AA: number;
  TAPER_THRESHOLD: number;
  TAPER_ADJUSTED: number;
  TAPER_MIN_AA: number;
  PSA_BASIC: number;
  PSA_HIGHER: number;
}

export const DEFAULT_CONFIG: TaxConfig = {
  B0: 12570,
  B1: 50270,
  B2: 100000,
  B3: 125140,
  TR_B: 20,
  TR_H: 20,
  TR_60: 40,
  TR_A: 25,
  SL_T: 29385,
  SL_R: 9,
  SL_UNEARNED_THRESHOLD: 2000,
  TAX_YEAR: '2026/27',
  SL_PLAN: 'Plan 2',
  NI_L: 12570,
  NI_U: 50270,
  C1_Main: 8,
  C1_Upper: 2,
  C4_Main: 6,
  C4_Upper: 2,
  STANDARD_AA: 60000,
  TAPER_THRESHOLD: 200000,
  TAPER_ADJUSTED: 260000,
  TAPER_MIN_AA: 10000,
  PSA_BASIC: 1000,
  PSA_HIGHER: 500,
};

const STORAGE_KEY = 'pension-calc-tax-config';

export function useTaxConfig() {
  const [config, setConfig] = useState<TaxConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch {}
    return DEFAULT_CONFIG;
  });

  const saveConfig = (newConfig: TaxConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch {}
  };

  const resetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return { config, saveConfig, resetConfig };
}
