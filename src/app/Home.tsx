import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useCalculatorState } from './context/CalculatorContext';
import { StatInput } from './components/StatInput';
import { CheckboxField } from './components/CheckboxField';

export default function Home() {
  const navigate = useNavigate();
  const {
    employedEarnings, setEmployedEarnings,
    selfEmployedEarnings, setSelfEmployedEarnings,
    netContribution, setNetContribution,
    netGiftAid, setNetGiftAid,
    employerContribution, setEmployerContribution,
    salarySacrifice, setSalarySacrifice,
    savingsInterest, setSavingsInterest,
    rentalProfit, setRentalProfit,
    dividendIncome, setDividendIncome,
    hasStudentLoan, setHasStudentLoan,
  } = useCalculatorState();

  const empRef = useRef<HTMLInputElement>(null);
  const seRef = useRef<HTMLInputElement>(null);
  const netRef = useRef<HTMLInputElement>(null);
  const gaRef = useRef<HTMLInputElement>(null);
  const empContribRef = useRef<HTMLInputElement>(null);
  const ssRef = useRef<HTMLInputElement>(null);
  const siRef = useRef<HTMLInputElement>(null);
  const rpRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1a1a18] mb-2">Pension Contribution Calculator</h1>
          <p className="text-sm text-[#4a4a46] leading-relaxed max-w-xl mx-auto">
            Work out the tax relief, National Insurance and student loan impact of your pension
            contributions and gift aid donations, then plan the exact figures needed to hit your goals.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-black/8 shadow-sm mb-6 overflow-hidden divide-y divide-black/6">
          <div className="flex items-center gap-6 pl-5 pr-6 py-5 border-l-[3px] border-[#4a90a4]">
            <div className="shrink-0 w-36">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84]">Earnings</p>
            </div>
            <div className="flex-1 flex flex-wrap gap-x-8 gap-y-4">
              <StatInput
                label="Employed earnings"
                value={employedEarnings}
                onChange={setEmployedEarnings}
                inputRef={empRef}
                step={1000}
              />
              <StatInput
                label="Self-employed profit"
                value={selfEmployedEarnings}
                onChange={setSelfEmployedEarnings}
                inputRef={seRef}
                step={1000}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pl-5 pr-6 py-5 border-l-[3px] border-[#9b7fd4]">
            <div className="shrink-0 w-36">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84]">Unearned income</p>
            </div>
            <div className="flex-1 flex flex-wrap gap-x-8 gap-y-4">
              <StatInput
                label="Savings interest"
                value={Math.round(savingsInterest)}
                onChange={setSavingsInterest}
                inputRef={siRef}
                step={100}
                tooltip="Gross interest received on savings/investments over the tax year. Shielded in part by your Personal Savings Allowance."
              />
              <StatInput
                label="Rental Profit (Taxable)"
                value={Math.round(rentalProfit)}
                onChange={setRentalProfit}
                inputRef={rpRef}
                step={100}
                tooltip="Enter rental income after allowable expenses or any property allowance claimed. Do not enter gross rent received."
              />
              <StatInput
                label="Dividend income"
                value={Math.round(dividendIncome)}
                onChange={setDividendIncome}
                inputRef={divRef}
                step={100}
                tooltip="Gross dividend income for the tax year. Taxed last, on top of all other income, using dividend-specific rates. Shielded in part by your £500 dividend allowance."
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pl-5 pr-6 py-5 border-l-[3px] border-[#1d4e3a]">
            <div className="shrink-0 w-36">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84]">Pension &amp; gift aid</p>
            </div>
            <div className="flex-1 flex flex-wrap gap-x-8 gap-y-4">
              <StatInput
                label="Net pension"
                value={Math.round(netContribution)}
                onChange={setNetContribution}
                inputRef={netRef}
                step={100}
                tooltip="Amount you personally contribute. Provider adds 20% basic rate relief on top."
              />
              <StatInput
                label="Employer pension"
                value={Math.round(employerContribution)}
                onChange={setEmployerContribution}
                inputRef={empContribRef}
                step={100}
                tooltip="Total employer pension contributions for the tax year."
              />
              <StatInput
                label="Salary sacrifice"
                value={Math.round(salarySacrifice)}
                onChange={setSalarySacrifice}
                inputRef={ssRef}
                step={100}
                tooltip="Annual salary sacrifice pension amount (deducted before tax and NI)."
              />
              <StatInput
                label="Net gift aid"
                value={Math.round(netGiftAid)}
                onChange={setNetGiftAid}
                inputRef={gaRef}
                step={100}
                tooltip="Amount donated to charity. Charity reclaims 20% basic rate from HMRC."
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pl-5 pr-6 py-5 border-l-[3px] border-[#e8a87c]">
            <div className="shrink-0 w-36">
              <p className="text-[11px] uppercase tracking-wider text-[#8a8a84]">Student loan</p>
            </div>
            <div className="flex-1">
              <CheckboxField
                checked={hasStudentLoan}
                onChange={setHasStudentLoan}
                label="I have a student loan (Plan 2)"
                tooltip="Plan 2 only — other plans aren't currently supported. Repayments are calculated purely from income above the threshold; outstanding balance isn't taken into account."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/admin')}
            className="text-[13px] text-[#8a8a84] hover:text-[#4a4a46] transition-colors"
          >
            Tax configuration (Admin)
          </button>
          <button
            onClick={() => navigate('/calculator')}
            className="text-sm bg-[#1d4e3a] text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-[#163d2e] active:scale-95 transition-all"
          >
            Enter calculator →
          </button>
        </div>
      </div>
    </div>
  );
}
