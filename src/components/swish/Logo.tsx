import logoUrl from "@/assets/firmanet-logo.jpeg";

export function Logo({ size = 28, withWordmark = false, className = "" }: { size?: number; withWordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoUrl}
        alt="Firmanet"
        width={size}
        height={size}
        className="rounded-[8px]"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <span className="font-display text-base font-bold tracking-tight">Firmanet</span>
      )}
    </span>
  );
}
