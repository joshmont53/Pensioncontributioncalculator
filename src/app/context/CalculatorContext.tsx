import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface Scenario {
  id: number;
  name: string;
  netContribution: number;
  netGiftAid: number;
}

export interface CarryForwardYear {
  allowance: number;
  used: number;
}

function useCalculatorStateInternal() {
  const [employedEarnings, setEmployedEarnings] = useState(80000);
  const [selfEmployedEarnings, setSelfEmployedEarnings] = useState(0);
  const [netContribution, setNetContribution] = useState(0);
  const [netGiftAid, setNetGiftAid] = useState(0);
  const [savingsInterest, setSavingsInterest] = useState(0);
  const [rentalProfit, setRentalProfit] = useState(0);
  const [dividendIncome, setDividendIncome] = useState(0);
  const [showDetails, setShowDetails] = useState(true);

  // ─── Goal planner state ───────────────────────────────────────────────────
  const [goalMode, setGoalMode] = useState<'take-home' | 'student-loan' | 'max-pension' | 'tax-band' | 'savings-allowance'>('take-home');
  const [goalTargetMonthly, setGoalTargetMonthly] = useState(3000);
  const [goalFloorMonthly, setGoalFloorMonthly] = useState(2000);
  const [goalTaxBandIdx, setGoalTaxBandIdx] = useState(0);
  const [goalPsaIdx, setGoalPsaIdx] = useState(0);

  // ─── Panel collapse state ─────────────────────────────────────────────────
  const [plannerOpen, setPlannerOpen] = useState(true);
  const [scenariosOpen, setScenariosOpen] = useState(true);

  // ─── Scenario comparison state ────────────────────────────────────────────
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: 1, name: 'Option A', netContribution: 0, netGiftAid: 0 },
    { id: 2, name: 'Option B', netContribution: 0, netGiftAid: 0 },
  ]);
  const [nextScenarioId, setNextScenarioId] = useState(3);

  // ─── Employer / salary sacrifice ──────────────────────────────────────────
  const [employerContribution, setEmployerContribution] = useState(0);
  const [salarySacrifice, setSalarySacrifice] = useState(0);

  // ─── Carry forward state ──────────────────────────────────────────────────
  const [carryForwardOpen, setCarryForwardOpen] = useState(true);
  const [carryForward, setCarryForward] = useState<CarryForwardYear[]>([
    { allowance: 60000, used: 0 },
    { allowance: 60000, used: 0 },
    { allowance: 60000, used: 0 },
  ]);

  return {
    employedEarnings, setEmployedEarnings,
    selfEmployedEarnings, setSelfEmployedEarnings,
    netContribution, setNetContribution,
    netGiftAid, setNetGiftAid,
    savingsInterest, setSavingsInterest,
    rentalProfit, setRentalProfit,
    dividendIncome, setDividendIncome,
    showDetails, setShowDetails,
    goalMode, setGoalMode,
    goalTargetMonthly, setGoalTargetMonthly,
    goalFloorMonthly, setGoalFloorMonthly,
    goalTaxBandIdx, setGoalTaxBandIdx,
    goalPsaIdx, setGoalPsaIdx,
    plannerOpen, setPlannerOpen,
    scenariosOpen, setScenariosOpen,
    scenarios, setScenarios,
    nextScenarioId, setNextScenarioId,
    employerContribution, setEmployerContribution,
    salarySacrifice, setSalarySacrifice,
    carryForwardOpen, setCarryForwardOpen,
    carryForward, setCarryForward,
  };
}

type CalculatorState = ReturnType<typeof useCalculatorStateInternal>;

const CalculatorContext = createContext<CalculatorState | null>(null);

export function CalculatorProvider({ children }: { children: ReactNode }) {
  const state = useCalculatorStateInternal();
  return <CalculatorContext.Provider value={state}>{children}</CalculatorContext.Provider>;
}

export function useCalculatorState(): CalculatorState {
  const ctx = useContext(CalculatorContext);
  if (!ctx) throw new Error('useCalculatorState must be used within a CalculatorProvider');
  return ctx;
}
