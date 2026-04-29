import { cn } from "@/lib/utils";

const emotionEmoji: Record<string, string> = {
  joy: "😊", sadness: "💙", anxiety: "🫧", stress: "🌊",
  anger: "🔥", fear: "🌫️", loneliness: "🌙", neutral: "✨",
};

type Props = {
  role: "user" | "assistant";
  content: string;
  emotion?: string | null;
  risk?: string | null;
  time?: string;
};

export const MessageBubble = ({ role, content, emotion, risk, time }: Props) => {
  const isUser = role === "user";
  return (
    <div className={cn("flex w-full animate-float-up", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 soft-shadow",
        isUser
          ? "bubble-user text-primary-foreground rounded-br-sm"
          : "bubble-ai text-foreground rounded-bl-sm border border-border/50"
      )}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        <div className={cn("flex items-center gap-2 mt-1.5 text-[10px]",
          isUser ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {emotion && <span>{emotionEmoji[emotion] ?? "✨"} {emotion}</span>}
          {risk && risk !== "low" && (
            <span className={cn(
              "px-1.5 py-0.5 rounded-full font-medium",
              risk === "high" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-[hsl(var(--warning))]"
            )}>{risk}</span>
          )}
          {time && <span className="ml-auto">{time}</span>}
        </div>
      </div>
    </div>
  );
};
