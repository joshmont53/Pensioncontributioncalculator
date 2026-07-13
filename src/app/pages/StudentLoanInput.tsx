import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useStudentLoanState } from '../context/StudentLoanContext';
import { StatInput } from '../components/StatInput';
import { PercentInput } from '../components/PercentInput';
import { YearInput } from '../components/YearInput';

export default function StudentLoanInput() {
  const navigate = useNavigate();
  const {
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
  } = useStudentLoanState();

  const salaryRef = useRef<HTMLInputElement>(null);
  const debtRef = useRef<HTMLInputElement>(null);
  const lumpRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1a1a18] mb-2">Student Loan Repayment Calculator</h1>
          <p className="text-sm text-[#4a4a46] leading-relaxed max-w-xl mx-auto">
            Compare overpaying a student loan against investing the same money instead —
            as a one-off lump sum, an ongoing extra monthly amount, or both.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-black/8 shadow-sm mb-6 overflow-hidden divide-y divide-black/6">
          <div className="flex items-center gap-6 pl-5 pr-6 py-5 border-l-[3px] border-[#4a90a4]">
            <div className="shrink-0 w-36">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84]">Loan details</p>
            </div>
            <div className="flex-1 flex flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <div className="text-[11px] text-[#8a8a84] mb-1.5">Loan plan</div>
                <div className="flex gap-2">
                  {([2, 5] as const).map(plan => (
                    <button
                      key={plan}
                      onClick={() => setLoanPlan(plan)}
                      className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors ${
                        loanPlan === plan
                          ? 'bg-[#1d4e3a] text-white border-[#1d4e3a]'
                          : 'bg-white text-[#4a4a46] border-black/15 hover:border-[#1d4e3a] hover:text-[#1d4e3a]'
                      }`}
                    >
                      Plan {plan}
                    </button>
                  ))}
                </div>
              </div>
              <YearInput label="Start year" value={startYear} onChange={setStartYear} tooltip="The tax year to start modelling from." />
              <YearInput label="Graduation year" value={graduationYear} onChange={setGraduationYear} tooltip="The year you graduated (or left the course). Repayments start the following April." />
            </div>
          </div>

          <div className="flex items-center gap-6 pl-5 pr-6 py-5 border-l-[3px] border-[#9b7fd4]">
            <div className="shrink-0 w-36">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84]">Income &amp; growth assumptions</p>
            </div>
            <div className="flex-1 flex flex-wrap gap-x-8 gap-y-4">
              <StatInput
                label="Annual salary"
                value={annualSalary}
                onChange={setAnnualSalary}
                inputRef={salaryRef}
                step={1000}
                tooltip="Gross salary in year 1 of the model."
              />
              <PercentInput
                label="Salary growth"
                value={salaryGrowthRate}
                onChange={setSalaryGrowthRate}
                step={0.5}
                tooltip="Assumed annual salary growth rate."
              />
              <PercentInput
                label="Inflation (RPI)"
                value={inflationRate}
                onChange={setInflationRate}
                step={0.1}
                tooltip="Assumed RPI inflation rate — drives the loan interest rate, repayment threshold, and real-terms figures."
              />
              <PercentInput
                label="Savings growth"
                value={savingsGrowthRate}
                onChange={setSavingsGrowthRate}
                step={0.5}
                tooltip="Assumed annual investment/savings growth rate for the 'invest' scenario."
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pl-5 pr-6 py-5 border-l-[3px] border-[#1d4e3a]">
            <div className="shrink-0 w-36">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84]">Outstanding balance</p>
            </div>
            <div className="flex-1 flex flex-wrap gap-x-8 gap-y-4">
              <StatInput
                label="Debt amount"
                value={debtAmount}
                onChange={setDebtAmount}
                inputRef={debtRef}
                step={1000}
                tooltip="Current outstanding student loan balance."
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pl-5 pr-6 py-5 border-l-[3px] border-[#e8a87c]">
            <div className="shrink-0 w-36">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84]">Extra repayment options</p>
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-[#8a8a84] mb-3 leading-relaxed">
                Both optional — leave either (or both) at £0. Fill in one to model that option alone, or both to model doing them together.
              </p>
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <StatInput
                  label="One-off lump sum"
                  value={lumpSumAmount}
                  onChange={setLumpSumAmount}
                  inputRef={lumpRef}
                  step={500}
                  tooltip="A one-off amount available today — either invested, or put straight toward the loan balance."
                />
                <StatInput
                  label="Extra monthly amount"
                  value={extraMonthlyReal}
                  onChange={setExtraMonthlyReal}
                  inputRef={extraRef}
                  step={50}
                  tooltip="An ongoing amount available each month, in today's money — either invested, or added to the monthly repayment. Rises with inflation each year."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[13px] text-[#8a8a84] max-w-sm leading-relaxed">
            Plan 2 and Plan 5 only. Uses simplified interest and threshold assumptions —
            check current SLC rates before relying on this for client advice.
          </p>
          <button
            onClick={() => navigate('/student-loan-calculator/results')}
            className="text-sm bg-[#1d4e3a] text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-[#163d2e] active:scale-95 transition-all shrink-0"
          >
            Enter calculator →
          </button>
        </div>
      </div>
    </div>
  );
}
