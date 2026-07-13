import { Link } from 'react-router';
import { calculators } from '../config/calculators';

export default function HomePage() {
  return (
    <div className="min-h-full bg-[#faf9f6] px-6 py-12 md:px-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-[#1a1a18] mb-2">Calculator Suite</h1>
          <p className="text-sm text-[#4a4a46] max-w-xl leading-relaxed">
            A growing set of financial planning tools. Pick a calculator below, or use the
            sidebar to jump between them at any time.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {calculators.map((calc) => (
            <Link
              key={calc.id}
              to={calc.path}
              className="group bg-white rounded-2xl border border-black/8 shadow-sm p-6 flex flex-col gap-3 hover:border-[#1d4e3a]/30 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#1d4e3a]/10 flex items-center justify-center text-[#1d4e3a]">
                  <calc.icon size={20} />
                </div>
                {calc.status === 'coming-soon' && (
                  <span className="text-[10px] uppercase tracking-wider text-[#8a8a84] bg-black/5 px-2 py-1 rounded-full">
                    Coming soon
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#1a1a18] mb-1 group-hover:text-[#1d4e3a] transition-colors">
                  {calc.label}
                </h2>
                <p className="text-sm text-[#8a8a84] leading-relaxed">{calc.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
