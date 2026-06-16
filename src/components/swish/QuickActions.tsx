import { Link } from "@tanstack/react-router";
import { Plus, Map, Siren, Users } from "lucide-react";

const actions = [
  { label: "Report", icon: Plus, to: "/feed", tone: "bg-mint text-mint-foreground" },
  { label: "Map", icon: Map, to: "/map", tone: "bg-lavender text-lavender-foreground" },
  { label: "SOS", icon: Siren, to: "/sos", tone: "bg-danger text-danger-foreground" },
  { label: "Circle", icon: Users, to: "/circle", tone: "bg-peach text-peach-foreground" },
] as const;

export function QuickActions() {
  return (
    <div className="glass rounded-3xl border border-border/60 p-2 shadow-soft">
      <div className="grid grid-cols-4 gap-1">
        {actions.map(({ label, icon: Icon, to, tone }) => (
          <Link
            key={label}
            to={to}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-2.5 active:scale-95 transition-transform"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone} shadow-soft`}>
              <Icon className="h-5 w-5" strokeWidth={2.3} />
            </span>
            <span className="text-[11px] font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}