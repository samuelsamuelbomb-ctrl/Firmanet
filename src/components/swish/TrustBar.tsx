export function TrustBar({ value }: { value: number }) {
  const tone =
    value >= 80 ? "bg-danger" : value >= 60 ? "bg-warn" : value >= 40 ? "bg-peach" : "bg-mint";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-foreground/80">{value}%</span>
    </div>
  );
}