import { Link, useLocation } from "@tanstack/react-router";
import { Home, Newspaper, Map, Users, Settings } from "lucide-react";
import { lightTap } from "@/lib/haptics";

const TABS = [
  { icon: Home, label: "Home", to: "/" },
  { icon: Newspaper, label: "Feed", to: "/feed" },
  { icon: Map, label: "Map", to: "/map" },
  { icon: Users, label: "Circle", to: "/circle" },
  { icon: Settings, label: "Settings", to: "/settings" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  // Don't show nav on SOS page
  if (pathname === "/sos") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-5">
      <div className="mx-auto flex max-w-md items-center gap-1 rounded-[24px] border border-border/60 bg-surface/85 px-2 py-2 backdrop-blur-lg shadow-glass">
        {TABS.map(({ icon: Icon, label, to }) => {
          const isActive = pathname === to;
          return (
            <Link
              key={label}
              to={to}
              onClick={() => lightTap()}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors ${
                isActive ? "bg-mint/30" : "active:bg-muted/40"
              }`}
            >
              <div
                className={`flex items-center justify-center rounded-2xl p-2 ${
                  isActive ? "bg-mint/50" : ""
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={2.25}
                  className={isActive ? "text-mint-foreground" : "text-muted-foreground"}
                />
              </div>
              <span
                className={`text-[9px] font-semibold ${
                  isActive ? "text-mint-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}