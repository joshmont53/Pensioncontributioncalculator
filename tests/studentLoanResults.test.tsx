// @vitest-environment jsdom
import { useLayoutEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import StudentLoanResults from '../src/app/pages/StudentLoanResults';
import { StudentLoanProvider, useStudentLoanState } from '../src/app/context/StudentLoanContext';
import { visibleText } from './helpers';

// Renders the real student loan results page with a range of inputs and
// snapshots every figure and sentence it shows. Recorded against the original
// page, so it proves the results are unchanged after the analysis logic moves
// into packages/core.

type StudentLoanState = ReturnType<typeof useStudentLoanState>;
type Inputs = (s: StudentLoanState) => void;

function Apply({ inputs }: { inputs: Inputs }) {
  const state = useStudentLoanState();
  useLayoutEffect(() => {
    // Pin the years so the snapshots don't depend on today's date.
    state.setStartYear(2026);
    state.setGraduationYear(2025);
    inputs(state);
  }, []);
  return null;
}

function renderResults(inputs: Inputs) {
  const { container } = render(
    <MemoryRouter>
      <StudentLoanProvider>
        <Apply inputs={inputs} />
        <StudentLoanResults />
      </StudentLoanProvider>
    </MemoryRouter>,
  );
  return visibleText(container);
}

const CASES: Record<string, Inputs> = {
  defaults: () => {},
  'plan 5 with lump sum and extra monthly': s => {
    s.setLoanPlan(5);
    s.setLumpSumAmount(5000);
    s.setExtraMonthlyReal(200);
  },
  'high earner clears the loan, real terms': s => {
    s.setAnnualSalary(80000);
    s.setDebtAmount(30000);
    s.setExtraMonthlyReal(400);
    s.setShowRealTerms(true);
  },
  'advanced salary path': s => {
    s.setUseAdvancedSalary(true);
    s.setSalaryOverrides({ 3: 45000, 6: 60000 });
  },
  'lump sum exceeds debt': s => {
    s.setDebtAmount(8000);
    s.setLumpSumAmount(12000);
  },
  'details hidden': s => s.setShowDetails(false),
  'invalid years': s => s.setGraduationYear(1980),
};

afterEach(cleanup);

describe('student loan results page', () => {
  for (const [name, inputs] of Object.entries(CASES)) {
    it(name, () => {
      expect(renderResults(inputs)).toMatchSnapshot();
    });
  }
});
