import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { SosFab } from "./SosFab";

export function AppShell({ children, hideSos = false }: { children: ReactNode; hideSos?: boolean }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md pb-32">{children}</div>
      {!hideSos && <SosFab />}
      <BottomNav />
    </div>
  );
}