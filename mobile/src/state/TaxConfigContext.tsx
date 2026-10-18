import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONFIG } from '@calc/core';
import type { TaxConfig } from '@calc/core';

// Mobile equivalent of the web useTaxConfig hook: the same defaults from
// packages/core, saved on the device with AsyncStorage instead of
// localStorage. Mobile and web settings are independent.

const STORAGE_KEY = 'pension-calc-tax-config';

function useTaxConfigInternal() {
  const [config, setConfig] = useState<TaxConfig>(DEFAULT_CONFIG);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (stored) {
          setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
          setIsCustom(true);
        }
      })
      .catch(() => {});
  }, []);

  const saveConfig = async (newConfig: TaxConfig) => {
    setConfig(newConfig);
    setIsCustom(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch {}
  };

  const resetConfig = async () => {
    setConfig(DEFAULT_CONFIG);
    setIsCustom(false);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return { config, isCustom, saveConfig, resetConfig };
}

type TaxConfigState = ReturnType<typeof useTaxConfigInternal>;

const TaxConfigContext = createContext<TaxConfigState | null>(null);

export function TaxConfigProvider({ children }: { children: ReactNode }) {
  const state = useTaxConfigInternal();
  return <TaxConfigContext.Provider value={state}>{children}</TaxConfigContext.Provider>;
}

export function useTaxConfig(): TaxConfigState {
  const ctx = useContext(TaxConfigContext);
  if (!ctx) throw new Error('useTaxConfig must be used within a TaxConfigProvider');
  return ctx;
}
