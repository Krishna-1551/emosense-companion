import { Lock, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type MeterLevel = "calm" | "neutral" | "stressed";

const NEG = ["sadness", "anxiety", "stress", "fear", "loneliness", "anger"];

export function deriveMeter(emotions: (string | null | undefined)[]): MeterLevel {
  const recent = emotions.filter(Boolean).slice(-6) as string[];
  if (!recent.length) return "neutral";
  const negCount = recent.filter(e => NEG.includes(e.toLowerCase())).length;
  const joyCount = recent.filter(e => e.toLowerCase() === "joy").length;
  if (negCount >= Math.ceil(recent.length / 2)) return "stressed";
  if (joyCount >= Math.ceil(recent.length / 2)) return "calm";
  return "neutral";
}

export function EmotionMeter({ level }: { level: MeterLevel }) {
  const map: Record<MeterLevel, { label: string; dot: string; text: string }> = {
    calm: { label: "Calm", dot: "bg-[hsl(var(--success))]", text: "text-[hsl(var(--success))]" },
    neutral: { label: "Neutral", dot: "bg-accent", text: "text-accent" },
    stressed: { label: "Stressed", dot: "bg-[hsl(var(--warning))]", text: "text-[hsl(var(--warning))]" },
  };
  const v = map[level];
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/50 text-xs">
      <span className={cn("w-2 h-2 rounded-full", v.dot)} />
      <span className="text-muted-foreground">Mood:</span>
      <span className={cn("font-medium", v.text)}>{v.label}</span>
    </div>
  );
}

export function PrivacyBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-muted-foreground">
      <Lock className="w-3 h-3" />
      <span>Your conversation is private</span>
    </div>
  );
}

export function QuickEmotions({ onPick, disabled }: { onPick: (text: string) => void; disabled?: boolean }) {
  const opts = [
    { label: "Feeling Sad", text: "I'm feeling sad right now." },
    { label: "Feeling Stressed", text: "I'm feeling stressed right now." },
    { label: "Feeling Okay", text: "I'm feeling okay today." },
  ];
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {opts.map(o => (
        <button
          key={o.label}
          onClick={() => onPick(o.text)}
          disabled={disabled}
          className="px-3 py-1.5 rounded-full text-xs bg-secondary/60 hover:bg-secondary border border-border/50 text-foreground/90 disabled:opacity-50 transition-colors"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function InsightBubble({ level, onDismiss }: { level: MeterLevel; onDismiss: () => void }) {
  const text = level === "stressed"
    ? "You seem a bit stressed today 💙"
    : level === "calm"
      ? "You sound steady today ✨"
      : "I'm here whenever you want to share more 🌿";
  return (
    <div className="max-w-2xl mx-auto flex items-center gap-2 px-3 py-2 rounded-xl bg-card/60 border border-border/50 text-xs text-muted-foreground">
      <span className="flex-1">{text}</span>
      <button onClick={onDismiss} className="p-1 rounded-md hover:bg-secondary/60" aria-label="Dismiss">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function useDismissible(key: string) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
  });
  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(key, "1"); } catch {}
  };
  return { dismissed, dismiss };
}
