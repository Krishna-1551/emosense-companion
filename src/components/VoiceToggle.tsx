import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  enabled: boolean;
  speaking: boolean;
  onToggle: () => void;
  onStop: () => void;
};

export const VoiceToggle = ({ enabled, speaking, onToggle, onStop }: Props) => {
  const label = speaking ? "Stop speaking" : enabled ? "Turn voice replies off" : "Turn voice replies on (experimental)";
  return (
    <button
      onClick={() => (speaking ? onStop() : onToggle())}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border text-[11px] transition-colors",
        enabled
          ? "bg-primary/15 border-primary/40 text-foreground"
          : "bg-secondary/60 border-border/50 text-muted-foreground hover:text-foreground",
      )}
    >
      {speaking ? (
        <span className="flex items-end gap-[2px] h-3" aria-hidden>
          <span className="w-[2px] h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="w-[2px] h-3 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.15s" }} />
          <span className="w-[2px] h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.3s" }} />
        </span>
      ) : enabled ? (
        <Volume2 className="w-3.5 h-3.5 text-primary" />
      ) : (
        <VolumeX className="w-3.5 h-3.5" />
      )}
      <span>{speaking ? "Speaking… tap to stop" : "Voice"}</span>
      <span className="px-1.5 py-[1px] rounded-full bg-accent/20 text-accent text-[9px] uppercase tracking-wide">Beta</span>
    </button>
  );
};
