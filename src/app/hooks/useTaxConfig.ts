import { useState, useEffect } from 'react';

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
  TAX_YEAR: string;
  SL_PLAN: string;
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
  TAX_YEAR: '2024/25',
  SL_PLAN: 'Plan 2',
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
