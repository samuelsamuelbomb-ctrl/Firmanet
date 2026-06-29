import { ShieldAlert, MapPin, MoreVertical, X, ThumbsUp, Flag, Share2, ZoomIn } from "lucide-react";
import { Signal } from "@/lib/swish-mock";
import { formatTimeAgo } from "@/lib/utils";
import { useMediaViewer } from "./MediaViewer";
import { signalStore } from "@/lib/swish-store";

interface CategoryColors {
  bg: string;
  text: string;
}

const categoryColors: Record<string, CategoryColors> = {
  crime: { bg: "bg-red-500", text: "text-red-500" },
  fire: { bg: "bg-red-700", text: "text-red-700" },
  flood: { bg: "bg-blue-500", text: "text-blue-500" },
  accident: { bg: "bg-orange-500", text: "text-orange-500" },
  missing: { bg: "bg-purple-500", text: "text-purple-500" },
  other: { bg: "bg-gray-500", text: "text-gray-500" },
};

function isVideoUrl(url: string): boolean {
  const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"];
  return videoExtensions.some((ext) => url.toLowerCase().endsWith(ext));
}

export function SignalCard({ signal }: { signal: Signal }) {
  console.log("SignalCard received signal:", signal);
  const { open } = useMediaViewer();
  const colors = categoryColors[signal.category] || categoryColors.other;
  const isVerified = signal.state === "verified";

  const handleConfirm = () => {
    signalStore.toggleConfirm(signal.id);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: signal.title,
        text: signal.description,
      });
    }
  };

  return (
    <article className="rounded-3xl bg-card shadow-soft overflow-hidden">
      <div className="p-4 space-y-4">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className={`${colors.bg} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            {/* Meta Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-bold ${colors.text} text-sm`}>
                  {signal.category.charAt(0).toUpperCase() + signal.category.slice(1)}
                </span>
                <span className="text-muted-foreground text-sm">·</span>
                <span className="text-muted-foreground text-sm">{signal.trust}%</span>
                <span className="text-muted-foreground text-sm">·</span>
                <span className={isVerified ? "text-emerald-500 font-semibold text-sm" : "text-amber-500 font-semibold text-sm"}>
                  {isVerified ? "Verified" : "Unverified"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground text-sm truncate">{signal.location}</span>
                <span className="text-muted-foreground text-sm">·</span>
                <span className="text-muted-foreground text-sm">{formatTimeAgo(signal.minutesAgo)}</span>
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button className="p-1 text-muted-foreground hover:text-foreground">
              <MoreVertical className="w-5 h-5" />
            </button>
            <button className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Caption */}
        <div className="space-y-2">
          <h3 className="font-bold text-[15px] leading-tight">{signal.title}</h3>
          {signal.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{signal.description}</p>
          )}
          <div className="text-muted-foreground text-xs">
            {signal.distanceKm.toFixed(1)} km away · {signal.reports} report{signal.reports !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Media - edge to edge */}
      {signal.media_urls && signal.media_urls.length > 0 && (
        <div className="relative aspect-square">
          {isVideoUrl(signal.media_urls[0]) ? (
            <video
              src={signal.media_urls[0]}
              className="w-full h-full object-cover"
              playsInline
              muted
              loop
            />
          ) : (
            <img
              src={signal.media_urls[0]}
              alt={signal.title}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => open(signal.media_urls![0])}
            />
          )}
          {!isVideoUrl(signal.media_urls[0]) && (
            <button
              className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-sm rounded-full p-1.5"
              onClick={() => open(signal.media_urls![0])}
            >
              <ZoomIn className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Count Line */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
              <ThumbsUp className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium">{signal.confirms} confirmation{signal.confirms !== 1 ? "s" : ""}</span>
          </div>
          <span className="text-sm font-medium">{signal.reports} report{signal.reports !== 1 ? "s" : ""}</span>
        </div>

        {/* Action Row */}
        <div className="grid grid-cols-3 gap-2">
          <button
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
              signal.userConfirmed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            onClick={handleConfirm}
          >
            <ThumbsUp className="w-4 h-4" />
            Confirm
          </button>
          <button className="flex items-center justify-center gap-2 rounded-xl bg-muted py-3 text-sm font-semibold text-muted-foreground hover:bg-muted/80 transition-colors">
            <Flag className="w-4 h-4" />
            Dispute
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-xl bg-muted py-3 text-sm font-semibold text-muted-foreground hover:bg-muted/80 transition-colors"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </article>
  );
}
