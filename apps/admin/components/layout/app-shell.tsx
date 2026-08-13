"use client";

import {
  Check,
  ChevronDown,
  LogOut,
  Settings2,
  ShoppingBag,
  Store,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

export type AdminView =
  | "orders"
  | "menu"
  | "menu-editor"
  | "settings"
  | "order-detail"
  | "kot";

type PrimaryView = "orders" | "menu" | "settings";

interface NavigationItem {
  icon: LucideIcon;
  label: string;
  view: PrimaryView;
}

export interface BranchOption {
  id: string;
  label: string;
}

const navigationItems: NavigationItem[] = [
  { icon: ShoppingBag, label: "Orders", view: "orders" },
  { icon: Utensils, label: "Menu", view: "menu" },
  { icon: Settings2, label: "Settings", view: "settings" },
];

const pageTitles: Record<AdminView, string> = {
  orders: "Orders",
  menu: "Menu availability",
  "menu-editor": "Edit menu",
  settings: "Business Settings",
  "order-detail": "Order details",
  kot: "Order details",
};

function activeNavigationView(view: AdminView): PrimaryView {
  if (view === "menu" || view === "menu-editor") return "menu";
  if (view === "settings") return "settings";
  return "orders";
}

interface AppShellProps {
  view: AdminView;
  onNavigate: (view: AdminView) => void;
  activeBranch: BranchOption;
  branches: BranchOption[];
  onBranchChange: (branchId: string) => void;
  onSignOut: () => void;
  orderingOpen: boolean;
  onKillSwitch: () => void;
  children: ReactNode;
}

export function AppShell({
  view,
  onNavigate,
  activeBranch,
  branches,
  onBranchChange,
  onSignOut,
  orderingOpen,
  onKillSwitch,
  children,
}: AppShellProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const activeNav = activeNavigationView(view);

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <div className="brand-lockup shell-brand">
          <span className="brand-mark">A2</span>
          <span>A2</span>
        </div>
        <nav aria-label="Primary navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                className={activeNav === item.view ? "active" : ""}
                onClick={() => onNavigate(item.view)}
              >
                <Icon size={19} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <span className="service-state"><span className={`service-dot ${orderingOpen ? "" : "offline"}`} />{orderingOpen ? "Service online" : "Orders paused"}</span>
          <button className={`kill-switch ${orderingOpen ? "" : "is-killed"}`} onClick={onKillSwitch} aria-pressed={!orderingOpen}>
            <span className="kill-switch-dot" />
            {orderingOpen ? "Kill" : "Resume"}
          </button>
        </div>
      </aside>

      <div className="shell-content">
        <header className="topbar no-print">
          <div className="mobile-brand">
            <span className="brand-mark">A2</span>
            <span>A2</span>
          </div>
          <div className="topbar-context">
            <p>{pageTitles[view]}</p>
          </div>
          <div className="account-wrap">
            <button
              className="account-button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
            >
              <span className="avatar">AV</span>
              <span className="account-copy">
                <strong>{activeBranch.label}</strong>
                <small>Owner</small>
              </span>
              <ChevronDown size={16} />
            </button>
            {accountOpen && (
              <div className="account-menu" role="menu">
                {branches.length > 1 && (
                  <>
                    <p className="menu-label">Switch branch</p>
                    {branches.map((branch) => (
                      <button
                        key={branch.id}
                        role="menuitem"
                        className={branch.id === activeBranch.id ? "selected" : ""}
                        onClick={() => {
                          onBranchChange(branch.id);
                          setAccountOpen(false);
                        }}
                      >
                        <span><Store size={16} />{branch.label}</span>
                        {branch.id === activeBranch.id && <Check size={16} />}
                      </button>
                    ))}
                    <div className="menu-divider" />
                  </>
                )}
                <button role="menuitem" onClick={onSignOut} className="signout-item">
                  <span><LogOut size={16} />Sign out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="workspace">{children}</main>

        <nav className="mobile-nav no-print" aria-label="Mobile navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                className={activeNav === item.view ? "active" : ""}
                onClick={() => onNavigate(item.view)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
