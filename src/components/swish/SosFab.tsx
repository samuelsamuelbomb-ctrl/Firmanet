import { useState, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Siren } from "lucide-react";

export function SosFab() {
  const [pos, setPos] = useState(() => {
    // Default: bottom-right
    const right = typeof window !== "undefined" ? window.innerWidth - 88 : 400;
    const bottom = typeof window !== "undefined" ? window.innerHeight - 120 : 700;
    return { x: right, y: bottom };
  });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const elRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = elRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    dragging.current = true;
    moved.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    if (Math.abs(e.clientX - start.current.x) > 5 || Math.abs(e.clientY - start.current.y) > 5) {
      moved.current = true;
    }
    const newX = e.clientX - offset.current.x;
    const newY = e.clientY - offset.current.y;
    // Clamp to viewport
    const clampedX = Math.max(0, Math.min(newX, window.innerWidth - 72));
    const clampedY = Math.max(0, Math.min(newY, window.innerHeight - 72));
    setPos({ x: clampedX, y: clampedY });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    // Snap to nearest edge
    const snapX = pos.x + 36 > window.innerWidth / 2
      ? window.innerWidth - 72
      : 0;
    const snapY = Math.max(0, Math.min(pos.y, window.innerHeight - 72));
    setPos({ x: snapX, y: snapY });
  }, [pos]);

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 50,
        cursor: "grab",
        touchAction: "none",
      }}
    >
      <Link
        to="/sos"
        onClick={(e) => { if (moved.current) e.preventDefault(); }}
        aria-label="Activate SOS"
        className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full bg-danger text-danger-foreground animate-sos-pulse select-none"
      >
        <span className="absolute inset-0 rounded-full bg-danger/40 animate-soft-ping" />
        <Siren className="relative h-7 w-7" strokeWidth={2.4} />
        <span className="sr-only">SOS</span>
      </Link>
    </div>
  );
}
