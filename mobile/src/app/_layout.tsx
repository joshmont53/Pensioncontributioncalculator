import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StudentLoanProvider } from '@/state/StudentLoanContext';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const t = useTheme();
  return (
    <StudentLoanProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTintColor: t.brand,
          headerTitleStyle: { color: t.text },
          headerStyle: { backgroundColor: t.background },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Calculators' }} />
        <Stack.Screen name="student-loan/index" options={{ title: 'Student Loan' }} />
        <Stack.Screen name="student-loan/results" options={{ title: 'Results' }} />
      </Stack>
    </StudentLoanProvider>
  );
}
