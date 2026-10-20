import type { LucideIcon } from 'lucide-react';
import { Calculator, GraduationCap } from 'lucide-react';

export interface CalculatorNavItem {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  status: 'available' | 'coming-soon';
}

export const calculators: CalculatorNavItem[] = [
  {
    id: 'pension',
    label: 'Pension Contribution Calculator',
    description: 'Work out the tax relief, National Insurance and student loan impact of pension contributions and gift aid.',
    path: '/pension-calculator',
    icon: Calculator,
    status: 'available',
  },
  {
    id: 'student-loan',
    label: 'Student Loan Repayment Calculator',
    description: 'Compare overpaying a student loan against investing the difference.',
    path: '/student-loan-calculator',
    icon: GraduationCap,
    status: 'available',
  },
];
