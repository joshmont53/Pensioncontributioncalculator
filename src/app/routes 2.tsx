import { createBrowserRouter } from 'react-router';
import AppShell from './layout/AppShell';
import { PensionCalculatorLayout } from './context/CalculatorContext';
import { StudentLoanCalculatorLayout } from './context/StudentLoanContext';
import HomePage from './pages/HomePage';
import StudentLoanInput from './pages/StudentLoanInput';
import StudentLoanResults from './pages/StudentLoanResults';
import PensionCalculatorInput from './Home';
import PensionCalculatorResults from './App';
import PensionCalculatorAdmin from './Admin';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      {
        element: <StudentLoanCalculatorLayout />,
        children: [
          { path: '/student-loan-calculator', element: <StudentLoanInput /> },
          { path: '/student-loan-calculator/results', element: <StudentLoanResults /> },
        ],
      },
      {
        element: <PensionCalculatorLayout />,
        children: [
          { path: '/pension-calculator', element: <PensionCalculatorInput /> },
          { path: '/pension-calculator/results', element: <PensionCalculatorResults /> },
          { path: '/admin', element: <PensionCalculatorAdmin /> },
        ],
      },
    ],
  },
]);
