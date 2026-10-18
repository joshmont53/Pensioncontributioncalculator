import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { CarryForwardYear, GoalMode, Scenario } from '@calc/core';

// Same state shape and defaults as the web app's CalculatorContext (minus the
// web-only panel open/closed flags — mobile cards manage their own).
function usePensionStateInternal() {
  const [employedEarnings, setEmployedEarnings] = useState(80000);
  const [selfEmployedEarnings, setSelfEmployedEarnings] = useState(0);
  const [netContribution, setNetContribution] = useState(0);
  const [netGiftAid, setNetGiftAid] = useState(0);
  const [savingsInterest, setSavingsInterest] = useState(0);
  const [rentalProfit, setRentalProfit] = useState(0);
  const [dividendIncome, setDividendIncome] = useState(0);
  const [hasStudentLoan, setHasStudentLoan] = useState(false);

  const [goalMode, setGoalMode] = useState<GoalMode>('take-home');
  const [goalTargetMonthly, setGoalTargetMonthly] = useState(3000);
  const [goalFloorMonthly, setGoalFloorMonthly] = useState(2000);
  const [goalTaxBandIdx, setGoalTaxBandIdx] = useState(0);
  const [goalPsaIdx, setGoalPsaIdx] = useState(0);

  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: 1, name: 'Option A', netContribution: 0, netGiftAid: 0 },
    { id: 2, name: 'Option B', netContribution: 0, netGiftAid: 0 },
  ]);
  const [nextScenarioId, setNextScenarioId] = useState(3);

  const [employerContribution, setEmployerContribution] = useState(0);
  const [salarySacrifice, setSalarySacrifice] = useState(0);

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
    hasStudentLoan, setHasStudentLoan,
    goalMode, setGoalMode,
    goalTargetMonthly, setGoalTargetMonthly,
    goalFloorMonthly, setGoalFloorMonthly,
    goalTaxBandIdx, setGoalTaxBandIdx,
    goalPsaIdx, setGoalPsaIdx,
    scenarios, setScenarios,
    nextScenarioId, setNextScenarioId,
    employerContribution, setEmployerContribution,
    salarySacrifice, setSalarySacrifice,
    carryForward, setCarryForward,
  };
}

type PensionState = ReturnType<typeof usePensionStateInternal>;

const PensionContext = createContext<PensionState | null>(null);

export function PensionProvider({ children }: { children: ReactNode }) {
  const state = usePensionStateInternal();
  return <PensionContext.Provider value={state}>{children}</PensionContext.Provider>;
}

export function usePensionState(): PensionState {
  const ctx = useContext(PensionContext);
  if (!ctx) throw new Error('usePensionState must be used within a PensionProvider');
  return ctx;
}
