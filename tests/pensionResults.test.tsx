// @vitest-environment jsdom
import { useLayoutEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../src/app/App';
import { CalculatorProvider, useCalculatorState } from '../src/app/context/CalculatorContext';
import { DEFAULT_CONFIG } from '../src/app/hooks/useTaxConfig';
import { visibleText } from './helpers';

// Renders the real pension results page with a range of inputs and snapshots
// every figure and sentence it shows. Recorded against the original App.tsx,
// so it proves the calculations behave identically after they move into
// packages/core.

type CalculatorState = ReturnType<typeof useCalculatorState>;
type Inputs = (s: CalculatorState) => void;

function Apply({ inputs }: { inputs: Inputs }) {
  const state = useCalculatorState();
  useLayoutEffect(() => inputs(state), []);
  return null;
}

function renderResults(inputs: Inputs) {
  const { container } = render(
    <MemoryRouter>
      <CalculatorProvider>
        <Apply inputs={inputs} />
        <App />
      </CalculatorProvider>
    </MemoryRouter>,
  );
  return visibleText(container);
}

const PROFILES: Record<string, Inputs> = {
  defaults: () => {},
  'higher rate with contributions and student loan': s => {
    s.setEmployedEarnings(72000);
    s.setNetContribution(4000);
    s.setNetGiftAid(800);
    s.setHasStudentLoan(true);
  },
  'taper zone with mixed income': s => {
    s.setEmployedEarnings(95000);
    s.setSelfEmployedEarnings(15000);
    s.setSavingsInterest(3000);
    s.setRentalProfit(5000);
    s.setDividendIncome(8000);
    s.setNetContribution(6000);
    s.setHasStudentLoan(true);
    s.setEmployerContribution(5000);
    s.setSalarySacrifice(3000);
  },
  'additional rate with annual allowance taper and carry forward': s => {
    s.setEmployedEarnings(280000);
    s.setDividendIncome(40000);
    s.setNetContribution(30000);
    s.setEmployerContribution(20000);
    s.setCarryForward([
      { allowance: 40000, used: 10000 },
      { allowance: 60000, used: 60000 },
      { allowance: 60000, used: 25000 },
    ]);
  },
  'basic rate self-employed with dividends': s => {
    s.setEmployedEarnings(0);
    s.setSelfEmployedEarnings(32000);
    s.setDividendIncome(20000);
    s.setNetContribution(2000);
    s.setHasStudentLoan(true);
  },
  'low income with savings': s => {
    s.setEmployedEarnings(14000);
    s.setSavingsInterest(1500);
  },
};

const GOALS: Record<string, Inputs> = {
  'take-home goal': s => { s.setGoalMode('take-home'); s.setGoalTargetMonthly(4200); },
  'student-loan goal': s => s.setGoalMode('student-loan'),
  'max-pension goal': s => { s.setGoalMode('max-pension'); s.setGoalFloorMonthly(3000); },
  'tax-band goal (first option)': s => { s.setGoalMode('tax-band'); s.setGoalTaxBandIdx(0); },
  'tax-band goal (second option)': s => { s.setGoalMode('tax-band'); s.setGoalTaxBandIdx(1); },
  'savings-allowance goal': s => { s.setGoalMode('savings-allowance'); s.setGoalPsaIdx(1); },
};

const SCENARIOS: Inputs = s => s.setScenarios([
  { id: 1, name: 'Option A', netContribution: 5000, netGiftAid: 0 },
  { id: 2, name: 'Option B', netContribution: 12000, netGiftAid: 1000 },
  { id: 3, name: 'Option C', netContribution: 0, netGiftAid: 2500 },
]);

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('pension results page', () => {
  for (const [profileName, profile] of Object.entries(PROFILES)) {
    for (const [goalName, goal] of Object.entries(GOALS)) {
      it(`${profileName} — ${goalName}`, () => {
        expect(renderResults(s => { profile(s); goal(s); SCENARIOS(s); })).toMatchSnapshot();
      });
    }
  }

  it('custom tax config from the admin page', () => {
    localStorage.setItem('pension-calc-tax-config', JSON.stringify({
      ...DEFAULT_CONFIG, B1: 45000, TR_H: 21, SL_T: 25000, SL_PLAN: 'Plan 1', TAX_YEAR: '2025/26',
    }));
    expect(renderResults(PROFILES['taper zone with mixed income'])).toMatchSnapshot();
  });
});
