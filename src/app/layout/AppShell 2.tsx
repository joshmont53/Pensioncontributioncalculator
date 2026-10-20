import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { SidebarProvider, SidebarInset, SidebarTrigger, useSidebar } from '../components/ui/sidebar';
import { AppSidebar } from './AppSidebar';

function isDenseRoute(pathname: string) {
  return pathname.startsWith('/pension-calculator') || pathname === '/admin'
    || pathname.startsWith('/student-loan-calculator');
}

function AppShellContent() {
  const { pathname } = useLocation();
  const { setOpen } = useSidebar();
  const dense = isDenseRoute(pathname);
  const prevDenseRef = useRef(dense);

  // These calculator screens (e.g. the pension calculator's results view) use a wide,
  // multi-column layout that overlaps once the expanded sidebar eats into the width at
  // common laptop screen sizes. Collapsing to the icon rail on entry keeps the sidebar
  // visible (so navigation still feels embedded) without touching the calculator's own
  // layout code, and the user can still expand it manually via the trigger.
  useEffect(() => {
    if (dense !== prevDenseRef.current) {
      setOpen(!dense);
      prevDenseRef.current = dense;
    }
  }, [dense, setOpen]);

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <header className="flex items-center gap-2 px-4 py-3 border-b border-black/10 bg-white md:hidden">
          <SidebarTrigger />
          <span className="text-[15px] font-semibold text-[#1a1a18]">Calculator Suite</span>
        </header>
        <Outlet />
      </SidebarInset>
    </>
  );
}

export default function AppShell() {
  const { pathname } = useLocation();
  return (
    <SidebarProvider defaultOpen={!isDenseRoute(pathname)}>
      <AppShellContent />
    </SidebarProvider>
  );
}
