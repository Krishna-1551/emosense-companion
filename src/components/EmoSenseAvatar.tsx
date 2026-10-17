import { cn } from "@/lib/utils";
import chetana from "@/assets/chetana.jpg.asset.json";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "error";

const LABELS: Record<AvatarState, string> = {
  idle: "Chetana is ready when you are",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Something went wrong — text chat still works",
};

/** Chetana — illustrated AI companion portrait. Not a human, therapist or diagnostic system. */
export const EmoSenseAvatar = ({ state, size = 96, className }: { state: AvatarState; size?: number; className?: string }) => (
  <div
    role="img"
    aria-label={`Chetana, EmoSense AI companion — ${LABELS[state]}`}
    data-state={state}
    className={cn("chetana-avatar relative shrink-0", className)}
    style={{ width: size, height: size }}
  >
    {state === "listening" && (
      <>
        <span className="chetana-ring" aria-hidden />
        <span className="chetana-ring chetana-ring-2" aria-hidden />
      </>
    )}
    <div className="chetana-frame">
      <img src={chetana.url} alt="" draggable={false} className="chetana-img" />
    </div>
    {state === "thinking" && (
      <span className="absolute -top-1 -right-1 flex gap-[2px] px-1.5 py-1 rounded-full bg-card border border-border" aria-hidden>
        <span className="chetana-dot" /><span className="chetana-dot" /><span className="chetana-dot" />
      </span>
    )}
    {state === "speaking" && (
      <span className="absolute -bottom-1 -right-1 flex items-end gap-[2px] h-4 px-1 rounded-full bg-primary" aria-hidden>
        <span className="chetana-bar" /><span className="chetana-bar" /><span className="chetana-bar" />
      </span>
    )}
    {state === "listening" && (
      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center" aria-hidden>●</span>
    )}
    {state === "error" && (
      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-secondary border border-border text-muted-foreground text-[11px] flex items-center justify-center" aria-hidden>!</span>
    )}
  </div>
);

export const avatarLabel = (s: AvatarState) => LABELS[s];
