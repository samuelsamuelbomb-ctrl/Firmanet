import { Link } from "@tanstack/react-router";
import { Bell, MapPin, User } from "lucide-react";
import { Logo } from "./Logo";

export function TopBar({ location = "Ikeja, Lagos" }: { location?: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-3">
      <div className="flex items-center gap-2">
        <Logo size={28} />
        <button className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1.5 text-xs font-medium shadow-soft">
          <MapPin className="h-3.5 w-3.5 text-mint-foreground" />
          <span>{location}</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/notifications"
          aria-label="Alerts"
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-soft"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-danger" />
        </Link>
        <Link
          to="/profile"
          aria-label="Profile"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
        >
          <User className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </div>
  );
}