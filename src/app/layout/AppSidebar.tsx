import { Link, useLocation } from 'react-router';
import { Home as HomeIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarRail,
} from '../components/ui/sidebar';
import { calculators } from '../config/calculators';

export function AppSidebar() {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1">
          <Link
            to="/"
            className="text-[15px] font-semibold text-[#1a1a18] truncate group-data-[collapsible=icon]:hidden"
          >
            Calculator Suite
          </Link>
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/'} tooltip="Home">
                <Link to="/">
                  <HomeIcon />
                  <span>Home</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Calculators</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {calculators.map((calc) => (
                <SidebarMenuItem key={calc.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(calc.path)}
                    tooltip={calc.label}
                  >
                    <Link to={calc.path}>
                      <calc.icon />
                      <span>{calc.label}</span>
                      {calc.status === 'coming-soon' && (
                        <span className="ml-auto text-[10px] rounded-full px-2.5 py-0.5 font-medium tracking-wide bg-black/5 text-[#8a8a84] group-data-[collapsible=icon]:hidden">
                          Soon
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
