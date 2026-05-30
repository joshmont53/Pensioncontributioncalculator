import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTaxConfig, DEFAULT_CONFIG, TaxConfig } from './hooks/useTaxConfig';

export default function Admin() {
  const navigate = useNavigate();
  const { config, saveConfig, resetConfig } = useTaxConfig();
  const [form, setForm] = useState<TaxConfig>(config);
  const [saved, setSaved] = useState(false);

  const field = (
    key: keyof TaxConfig,
    label: string,
    description: string,
    prefix?: string,
    suffix?: string
  ) => {
    const isString = typeof DEFAULT_CONFIG[key] === 'string';
    return (
      <div className="flex items-start justify-between py-4 border-b border-black/5 gap-6">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[#1a1a18]">{label}</div>
          <div className="text-xs text-[#8a8a84] mt-0.5">{description}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {prefix && <span className="text-sm text-[#4a4a46]">{prefix}</span>}
          <input
            type={isString ? 'text' : 'number'}
            value={form[key] as string | number}
            onChange={e =>
              setForm(prev => ({
                ...prev,
                [key]: isString ? e.target.value : Number(e.target.value),
              }))
            }
            className="w-28 text-right border border-black/15 rounded-lg px-3 py-1.5 text-sm text-[#1a1a18] outline-none focus:border-[#1d4e3a] focus:ring-1 focus:ring-[#1d4e3a]/20 bg-white"
            step={isString ? undefined : key.startsWith('C') || key === 'SL_R' || key.startsWith('TR') ? '0.1' : '1'}
          />
          {suffix && <span className="text-sm text-[#4a4a46]">{suffix}</span>}
        </div>
      </div>
    );
  };

  const handleSave = () => {
    saveConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetConfig();
    setForm(DEFAULT_CONFIG);
  };

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <header className="bg-white border-b border-black/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-[#4a4a46] hover:text-[#1a1a18] flex items-center gap-1.5 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to calculator
            </button>
            <div className="w-px h-4 bg-black/10" />
            <span className="text-sm font-medium text-[#1a1a18]">Admin — Tax Configuration</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleReset} className="text-sm text-[#8a8a84] hover:text-[#4a4a46] px-3 py-1.5 rounded-lg border border-black/10 transition-colors">
              Reset to defaults
            </button>
            <button
              onClick={handleSave}
              className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${saved ? 'bg-[#e8f2ed] text-[#1d4e3a]' : 'bg-[#1d4e3a] text-white hover:bg-[#163d2d]'}`}
            >
              {saved ? '✓ Saved' : 'Save changes'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a18] mb-1">Tax Configuration</h1>
          <p className="text-sm text-[#8a8a84]">Update these values when HMRC changes tax bands or rates. Changes apply immediately.</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Note:</strong> This page is for administrators only. Always verify figures against HMRC guidance before saving.
        </div>

        <section className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
          <h2 className="text-xs uppercase tracking-wider text-[#8a8a84] mb-4">General</h2>
          {field('TAX_YEAR', 'Tax year', 'The tax year this configuration applies to, e.g. 2024/25')}
          {field('SL_PLAN', 'Student loan plan name', 'Display name for the student loan plan, e.g. Plan 2')}
        </section>

        <section className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
          <h2 className="text-xs uppercase tracking-wider text-[#8a8a84] mb-4">Income Tax — Band Boundaries</h2>
          {field('B0', 'Personal allowance upper limit', 'Upper boundary of the nil-rate / personal allowance band', '£')}
          {field('B1', 'Basic rate upper limit', 'Upper boundary of the basic rate (20%) band', '£')}
          {field('B2', 'Personal allowance taper upper limit', 'Upper boundary of the 60% effective rate (PA taper) band', '£')}
          {field('B3', 'Additional rate threshold', 'Income at which the 45% additional rate begins', '£')}
        </section>

        <section className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
          <h2 className="text-xs uppercase tracking-wider text-[#8a8a84] mb-4">Pension & Gift Aid Relief Rates</h2>
          <p className="text-xs text-[#8a8a84] mb-4">Additional relief rates reclaimed via self-assessment (on top of basic rate relief added at source).</p>
          {field('TR_B', 'Basic rate — at source', 'Relief automatically added to pension/gift aid contributions', undefined, '%')}
          {field('TR_H', 'Higher rate — additional relief', 'Extra relief for income in the 40% band', undefined, '%')}
          {field('TR_60', 'PA taper — additional relief', 'Extra relief for income in the 60% effective rate band', undefined, '%')}
          {field('TR_A', 'Additional rate — additional relief', 'Extra relief for income in the 45% band (above £125,140)', undefined, '%')}
        </section>

        <section className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
          <h2 className="text-xs uppercase tracking-wider text-[#8a8a84] mb-4">National Insurance</h2>
          <p className="text-xs text-[#8a8a84] mb-4">
            Class 1 is paid by employees through PAYE. Class 4 is paid by the self-employed via self-assessment. Both share the same band thresholds.
          </p>
          {field('NI_L', 'Primary threshold (lower)', 'Earnings below this are exempt from NI', '£')}
          {field('NI_U', 'Upper earnings limit', 'Earnings above this pay the upper rate', '£')}
          {field('C1_Main', 'Class 1 main rate', 'Employee NI rate on earnings between L and U', undefined, '%')}
          {field('C1_Upper', 'Class 1 upper rate', 'Employee NI rate on earnings above U', undefined, '%')}
          {field('C4_Main', 'Class 4 main rate', 'Self-employed NI rate on profits between L and U (shared with Class 1)', undefined, '%')}
          {field('C4_Upper', 'Class 4 upper rate', 'Self-employed NI rate on profits above U', undefined, '%')}
        </section>

        <section className="bg-white rounded-2xl border border-black/10 p-6 shadow-sm">
          <h2 className="text-xs uppercase tracking-wider text-[#8a8a84] mb-4">Student Loan</h2>
          {field('SL_T', 'Repayment threshold', 'Annual earnings above which student loan repayments begin', '£')}
          {field('SL_R', 'Repayment rate', 'Percentage of earnings above the threshold that is repaid', undefined, '%')}
        </section>

        <div className="flex justify-end gap-3 pb-8">
          <button onClick={handleReset} className="text-sm text-[#8a8a84] hover:text-[#4a4a46] px-4 py-2 rounded-lg border border-black/10 transition-colors">
            Reset to defaults
          </button>
          <button
            onClick={handleSave}
            className={`text-sm px-6 py-2 rounded-lg font-medium transition-all ${saved ? 'bg-[#e8f2ed] text-[#1d4e3a]' : 'bg-[#1d4e3a] text-white hover:bg-[#163d2d]'}`}
          >
            {saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
