import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import type { LoanPlan } from '../lib/studentLoanEngine';

function useStudentLoanStateInternal() {
  const currentYear = new Date().getFullYear();

  const [loanPlan, setLoanPlan] = useState<LoanPlan>(2);
  const [startYear, setStartYear] = useState(currentYear);
  const [graduationYear, setGraduationYear] = useState(currentYear - 1);
  const [annualSalary, setAnnualSalary] = useState(38000);
  const [salaryGrowthRate, setSalaryGrowthRate] = useState(0.03);
  const [inflationRate, setInflationRate] = useState(0.04);
  const [savingsGrowthRate, setSavingsGrowthRate] = useState(0.05);
  const [debtAmount, setDebtAmount] = useState(50000);
  const [lumpSumAmount, setLumpSumAmount] = useState(0);
  const [extraMonthlyReal, setExtraMonthlyReal] = useState(0);

  const [showDetails, setShowDetails] = useState(true);
  const [showRealTerms, setShowRealTerms] = useState(false);

  const [useAdvancedSalary, setUseAdvancedSalary] = useState(false);
  const [salaryOverrides, setSalaryOverrides] = useState<Record<number, number>>({});

  return {
    loanPlan, setLoanPlan,
    startYear, setStartYear,
    graduationYear, setGraduationYear,
    annualSalary, setAnnualSalary,
    salaryGrowthRate, setSalaryGrowthRate,
    inflationRate, setInflationRate,
    savingsGrowthRate, setSavingsGrowthRate,
    debtAmount, setDebtAmount,
    lumpSumAmount, setLumpSumAmount,
    extraMonthlyReal, setExtraMonthlyReal,
    showDetails, setShowDetails,
    showRealTerms, setShowRealTerms,
    useAdvancedSalary, setUseAdvancedSalary,
    salaryOverrides, setSalaryOverrides,
  };
}

type StudentLoanState = ReturnType<typeof useStudentLoanStateInternal>;

const StudentLoanContext = createContext<StudentLoanState | null>(null);

export function StudentLoanProvider({ children }: { children: ReactNode }) {
  const state = useStudentLoanStateInternal();
  return <StudentLoanContext.Provider value={state}>{children}</StudentLoanContext.Provider>;
}

export function useStudentLoanState(): StudentLoanState {
  const ctx = useContext(StudentLoanContext);
  if (!ctx) throw new Error('useStudentLoanState must be used within a StudentLoanProvider');
  return ctx;
}

export function StudentLoanCalculatorLayout() {
  return (
    <StudentLoanProvider>
      <Outlet />
    </StudentLoanProvider>
  );
}
