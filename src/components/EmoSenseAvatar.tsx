import { cn } from "@/lib/utils";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "error";

const LABELS: Record<AvatarState, string> = {
  idle: "Ready when you are",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Something went wrong — text chat still works",
};

/** Friendly animated AI companion face. Not a human, therapist or diagnostic system. */
export const EmoSenseAvatar = ({ state, size = 96, className }: { state: AvatarState; size?: number; className?: string }) => (
  <div
    role="img"
    aria-label={`EmoSense AI companion — ${LABELS[state]}`}
    data-state={state}
    className={cn("emo-avatar relative shrink-0", className)}
    style={{ width: size, height: size }}
  >
    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
      <defs>
        <radialGradient id="emo-face" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--avatar-light))" />
          <stop offset="60%" stopColor="hsl(var(--avatar-mid))" />
          <stop offset="100%" stopColor="hsl(var(--avatar-deep))" />
        </radialGradient>
      </defs>
      {state === "listening" && (
        <>
          <circle cx="50" cy="50" r="46" className="emo-ring" />
          <circle cx="50" cy="50" r="46" className="emo-ring emo-ring-2" />
        </>
      )}
      <g className="emo-body">
        <circle cx="50" cy="50" r="40" fill="url(#emo-face)" />
        <ellipse cx="36" cy="34" rx="10" ry="6" fill="hsl(var(--avatar-light))" opacity="0.35" />
        <g className="emo-eyes">
          {state === "error" ? (
            <>
              <path d="M32 44 q6 -4 12 0" className="emo-stroke" />
              <path d="M56 44 q6 -4 12 0" className="emo-stroke" />
            </>
          ) : (
            <>
              <ellipse cx="38" cy="44" rx="4" ry="5" className="emo-eye" />
              <ellipse cx="62" cy="44" rx="4" ry="5" className="emo-eye" />
            </>
          )}
        </g>
        <circle cx="30" cy="56" r="4" fill="hsl(var(--avatar-cheek))" opacity="0.45" />
        <circle cx="70" cy="56" r="4" fill="hsl(var(--avatar-cheek))" opacity="0.45" />
        {state === "speaking" ? (
          <ellipse cx="50" cy="63" rx="7" ry="4" className="emo-mouth-talk" />
        ) : state === "thinking" ? (
          <path d="M43 63 h14" className="emo-stroke" />
        ) : state === "error" ? (
          <path d="M42 65 q8 -4 16 0" className="emo-stroke" />
        ) : (
          <path d="M41 61 q9 7 18 0" className="emo-stroke" />
        )}
      </g>
      {state === "thinking" && (
        <g className="emo-dots">
          <circle cx="80" cy="18" r="3" />
          <circle cx="88" cy="10" r="2.2" />
          <circle cx="94" cy="3" r="1.6" />
        </g>
      )}
    </svg>
    {state === "listening" && (
      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center" aria-hidden>●</span>
    )}
    {state === "error" && (
      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-secondary border border-border text-muted-foreground text-[11px] flex items-center justify-center" aria-hidden>!</span>
    )}
  </div>
);

export const avatarLabel = (s: AvatarState) => LABELS[s];
