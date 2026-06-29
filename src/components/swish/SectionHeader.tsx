import { Link, type LinkProps } from "@tanstack/react-router";
import { lightTap } from "@/lib/haptics";

export function SectionHeader({
  title,
  action,
  to,
}: {
  title: string;
  action?: string;
  to?: LinkProps["to"];
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {action && to && (
        <Link to={to} onClick={() => lightTap()} className="text-xs font-semibold text-primary">
          {action}
        </Link>
      )}
    </div>
  );
}