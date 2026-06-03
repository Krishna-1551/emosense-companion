import { cn } from "@/lib/utils";
import { AttachmentChip, AttachmentAnalysis } from "./AttachmentChip";

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

// Parse attachment tag the backend embeds in message.content
const ATTACHMENT_TAG = /\n*\[\[emosense-attachments:([\s\S]+?)\]\]\s*$/;
const parseAttachments = (content: string): { text: string; attachments: AttachmentAnalysis[] } => {
  const m = content.match(ATTACHMENT_TAG);
  if (!m) return { text: content, attachments: [] };
  try {
    const parsed = JSON.parse(m[1]);
    return { text: content.replace(ATTACHMENT_TAG, "").trim(), attachments: parsed };
  } catch {
    return { text: content, attachments: [] };
  }
};

export const MessageBubble = ({ role, content, emotion, risk, time }: Props) => {
  const isUser = role === "user";
  const { text, attachments } = parseAttachments(content);
  return (
    <div className={cn("flex w-full animate-float-up", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 soft-shadow",
        isUser
          ? "bubble-user text-primary-foreground rounded-br-sm"
          : "bubble-ai text-foreground rounded-bl-sm border border-border/50"
      )}>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((a, i) => <AttachmentChip key={i} attachment={a} />)}
          </div>
        )}
        {text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>}
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
