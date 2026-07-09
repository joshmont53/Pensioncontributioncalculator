import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useCalculatorState } from './context/CalculatorContext';
import { StatInput } from './components/StatInput';

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
  } = useCalculatorState();

  const empRef = useRef<HTMLInputElement>(null);
  const seRef = useRef<HTMLInputElement>(null);
  const netRef = useRef<HTMLInputElement>(null);
  const gaRef = useRef<HTMLInputElement>(null);
  const empContribRef = useRef<HTMLInputElement>(null);
  const ssRef = useRef<HTMLInputElement>(null);
  const siRef = useRef<HTMLInputElement>(null);

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

        <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-6 mb-6">
          <p className="text-[11px] uppercase tracking-wider text-[#8a8a84] mb-4">Your details</p>
          <div className="grid gap-y-4 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
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
            <StatInput
              label="Net pension"
              value={Math.round(netContribution)}
              onChange={setNetContribution}
              inputRef={netRef}
              step={100}
              tooltip="Amount you personally contribute. Provider adds 20% basic rate relief on top."
            />
            <StatInput
              label="Net gift aid"
              value={Math.round(netGiftAid)}
              onChange={setNetGiftAid}
              inputRef={gaRef}
              step={100}
              tooltip="Amount donated to charity. Charity reclaims 20% basic rate from HMRC."
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
              label="Savings interest"
              value={Math.round(savingsInterest)}
              onChange={setSavingsInterest}
              inputRef={siRef}
              step={100}
              tooltip="Gross interest received on savings/investments over the tax year. Shielded in part by your Personal Savings Allowance."
            />
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
