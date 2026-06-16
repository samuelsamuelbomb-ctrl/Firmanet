import { Link } from "@tanstack/react-router";
import { Siren } from "lucide-react";

export function SosFab() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md justify-end px-6">
        <Link
          to="/sos"
          aria-label="Activate SOS"
          className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full bg-danger text-danger-foreground animate-sos-pulse"
        >
          <span className="absolute inset-0 rounded-full bg-danger/40 animate-soft-ping" />
          <Siren className="relative h-7 w-7" strokeWidth={2.4} />
          <span className="sr-only">SOS</span>
        </Link>
      </div>
    </div>
  );
}