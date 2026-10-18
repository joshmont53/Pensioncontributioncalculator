import { useState } from 'react';
import { DEFAULT_CONFIG } from '@calc/core';
import type { TaxConfig } from '@calc/core';

// The config shape and defaults live in packages/core so the mobile app uses
// the same values; re-exported here so existing imports keep working.
export { DEFAULT_CONFIG };
export type { TaxConfig };

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
