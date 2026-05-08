import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Icon from "@/components/ui/icon";
import Dashboard from "@/pages/Dashboard";
import Sales from "@/pages/Sales";
import Warehouse from "@/pages/Warehouse";
import Construction from "@/pages/Construction";
import Rental from "@/pages/Rental";
import Procurement from "@/pages/Procurement";
import Quality from "@/pages/Quality";
import Documents from "@/pages/Documents";
import Contractors from "@/pages/Contractors";
import Finance from "@/pages/Finance";
import Employees from "@/pages/Employees";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import Estimate from "@/pages/Estimate";
import Realtor from "@/pages/Realtor";
import NotificationBell from "@/components/NotificationBell";
import ClientPortal from "@/pages/ClientPortal";

export type Role =
  | "director"
  | "commercial"
  | "construction_director"
  | "supply_director"
  | "finance_director"
  | "crm_manager"
  | "foreman"
  | "supplier"
  | "mechanic"
  | "accountant"
  | "realtor"
  | "client"
  | "project_manager";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  component: React.ReactNode;
  roles: Role[];
}

const ROLES: { value: Role; label: string }[] = [
  { value: "director", label: "Генеральный директор" },
  { value: "commercial", label: "Коммерческий директор" },
  { value: "construction_director", label: "Директор по строительству" },
  { value: "supply_director", label: "Директор по снабжению" },
  { value: "finance_director", label: "Финансовый директор" },
  { value: "crm_manager", label: "Менеджер CRM" },
  { value: "foreman", label: "Прораб" },
  { value: "supplier", label: "Снабженец" },
  { value: "mechanic", label: "Механик" },
  { value: "accountant", label: "Бухгалтер" },
  { value: "realtor", label: "Риэлтор" },
  { value: "client", label: "Клиент" },
  { value: "project_manager", label: "Руководитель проекта" },
];

const queryClient = new QueryClient();

function ERPApp() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentRole, setCurrentRole] = useState<Role>("director");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_collapsed") === "1";
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebar_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const navItems: NavItem[] = [
    {
      id: "dashboard",
      label: "Дашборд",
      icon: "LayoutDashboard",
      component: <Dashboard role={currentRole} />,
      roles: ["director", "commercial", "construction_director", "supply_director", "finance_director", "foreman", "project_manager"],
    },
    {
      id: "realtor",
      label: "ЛК риэлтора",
      icon: "UserSquare",
      component: <Realtor role={currentRole} />,
      roles: ["realtor"],
    },
    {
      id: "sales",
      label: "Продажи и CRM",
      icon: "TrendingUp",
      component: <Sales role={currentRole} />,
      roles: ["director", "commercial", "crm_manager"],
    },
    {
      id: "construction",
      label: "Строительство",
      icon: "HardHat",
      component: <Construction role={currentRole} />,
      roles: ["director", "construction_director", "foreman", "project_manager", "client"],
    },
    {
      id: "procurement",
      label: "Снабжение",
      icon: "ShoppingCart",
      component: <Procurement role={currentRole} />,
      roles: ["director", "supply_director", "supplier", "foreman"],
    },
    {
      id: "warehouse",
      label: "Розница / Склад",
      icon: "Warehouse",
      component: <Warehouse role={currentRole} />,
      roles: ["director", "commercial", "supply_director", "supplier"],
    },
    {
      id: "rental",
      label: "Аренда техники",
      icon: "Truck",
      component: <Rental role={currentRole} />,
      roles: ["director", "construction_director", "mechanic"],
    },
    {
      id: "quality",
      label: "Контроль качества",
      icon: "CheckSquare",
      component: <Quality role={currentRole} />,
      roles: ["director", "construction_director", "foreman", "project_manager"],
    },
    {
      id: "contractors",
      label: "Контрагенты",
      icon: "Building2",
      component: <Contractors role={currentRole} />,
      roles: ["director", "commercial", "supply_director", "finance_director", "accountant"],
    },
    {
      id: "documents",
      label: "Документы",
      icon: "FileText",
      component: <Documents role={currentRole} />,
      roles: ["director", "commercial", "crm_manager", "accountant", "finance_director", "supply_director"],
    },
    {
      id: "finance",
      label: "Финансы",
      icon: "DollarSign",
      component: <Finance role={currentRole} />,
      roles: ["director", "finance_director", "accountant"],
    },
    {
      id: "employees",
      label: "Сотрудники",
      icon: "Users",
      component: <Employees role={currentRole} />,
      roles: ["director", "commercial", "construction_director"],
    },
    {
      id: "reports",
      label: "Отчёты / KPI",
      icon: "BarChart2",
      component: <Reports role={currentRole} />,
      roles: ["director", "finance_director", "commercial", "construction_director", "supply_director"],
    },
    {
      id: "estimate",
      label: "Смета",
      icon: "ClipboardList",
      component: <Estimate role={currentRole} />,
      roles: ["director", "commercial", "supply_director", "construction_director"],
    },
    {
      id: "admin",
      label: "Администрирование",
      icon: "Settings",
      component: <Admin role={currentRole} />,
      roles: ["director", "construction_director"],
    },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(currentRole));
  const activeItem = navItems.find((item) => item.id === activeTab);
  const currentRoleLabel = ROLES.find((r) => r.value === currentRole)?.label;

  const safeActiveTab = visibleItems.find((i) => i.id === activeTab) ? activeTab : visibleItems[0]?.id;

  return (
    <div className="min-h-screen bg-background flex font-golos">
      {/* Боковая навигация */}
      <aside className={`bg-white border-r border-border flex flex-col sticky top-0 h-screen shrink-0 z-40 transition-[width] duration-200 ${sidebarCollapsed ? "w-16" : "w-60"}`}>
        <div className={`flex items-center h-14 border-b border-border shrink-0 ${sidebarCollapsed ? "justify-center px-2" : "gap-2 px-5"}`}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Icon name="Building2" size={16} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-slate-900 text-lg font-extralight">ГлобалСТ</span>
          )}
        </div>

        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto p-3">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`
                flex items-center rounded-md text-[13px] font-medium transition-all
                ${sidebarCollapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2 text-left"}
                ${safeActiveTab === item.id
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }
              `}
            >
              <Icon name={item.icon} size={15} />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
          className="border-t border-border h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
        >
          <Icon name={sidebarCollapsed ? "ChevronsRight" : "ChevronsLeft"} size={16} />
        </button>
      </aside>

      {/* Правая часть */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-border h-14 flex items-center justify-end px-6 gap-2 sticky top-0 z-30 shadow-sm">
          <NotificationBell role={currentRole} />

          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border border-border hover:bg-secondary transition-all text-[13px]"
            >
              <Icon name="UserCircle" size={15} className="text-primary" />
              <span className="text-foreground font-medium max-w-[160px] truncate">{currentRoleLabel}</span>
              <Icon name="ChevronDown" size={13} className="text-muted-foreground" />
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg py-1 w-64 z-50 animate-fade-in">
                <div className="px-3 py-1.5 text-hint border-b border-border mb-1">Сменить роль (демо)</div>
                {ROLES.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => {
                      setCurrentRole(role.value);
                      setRoleMenuOpen(false);
                      setActiveTab("dashboard");
                    }}
                    className={`w-full text-left px-3 py-2 text-[13px] hover:bg-secondary transition-colors flex items-center gap-2 ${
                      currentRole === role.value ? "text-primary font-medium" : "text-foreground"
                    }`}
                  >
                    {currentRole === role.value
                      ? <Icon name="Check" size={13} className="text-primary" />
                      : <span className="w-[13px] inline-block" />
                    }
                    {role.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 animate-fade-in" key={safeActiveTab}>
          {navItems.find(i => i.id === safeActiveTab)?.component}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  // Клиентский ЛК — публичная страница по ссылке /client/TOKEN
  const path = window.location.pathname;
  const clientMatch = path.match(/^\/client\/([A-Z0-9-]+)$/i);
  if (clientMatch) {
    return (
      <QueryClientProvider client={queryClient}>
        <ClientPortal token={clientMatch[1]} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ERPApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}