import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Newspaper, Map, Users, Settings } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/feed", label: "Feed", icon: Newspaper },
  { to: "/map", label: "Map", icon: Map },
  { to: "/circle", label: "Circle", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md px-4 pb-3">
        <div className="glass shadow-pop rounded-3xl border border-border/60 px-2 py-2">
          <ul className="flex items-center justify-between">
            {items.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
              return (
                <li key={to} className="flex-1">
                  <Link
                    to={to}
                    className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-medium transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-all ${
                        active ? "bg-mint text-mint-foreground" : ""
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}