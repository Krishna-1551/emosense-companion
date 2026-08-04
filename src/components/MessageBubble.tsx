import { cn } from "@/lib/utils";
import { AttachmentChip, AttachmentAnalysis } from "./AttachmentChip";
import { Sparkles, Volume2 } from "lucide-react";

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
  onSpeak?: (text: string) => void;
};


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

// Lightweight inline formatter: **bold**, *italic*, `code`, and line breaks.
// No external deps; safe because we only wrap already-escaped React text.
const renderInline = (text: string) => {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    // tokenize
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) parts.push(<strong key={`b${li}-${key++}`} className="font-semibold">{tok.slice(2, -2)}</strong>);
      else if (tok.startsWith("`")) parts.push(<code key={`c${li}-${key++}`} className="px-1 py-0.5 rounded bg-black/20 text-[0.85em] font-mono">{tok.slice(1, -1)}</code>);
      else parts.push(<em key={`i${li}-${key++}`} className="italic">{tok.slice(1, -1)}</em>);
      last = m.index + tok.length;
    }
    if (last < line.length) parts.push(line.slice(last));
    // bullet
    const isBullet = /^\s*[-•]\s+/.test(line);
    if (isBullet) {
      return (
        <div key={li} className="flex gap-2">
          <span className="opacity-60 select-none">•</span>
          <span className="flex-1">{parts.length ? parts : line.replace(/^\s*[-•]\s+/, "")}</span>
        </div>
      );
    }
    return <div key={li}>{parts.length ? parts : line || <span>&nbsp;</span>}</div>;
  });
};

export const MessageBubble = ({ role, content, emotion, risk, time }: Props) => {
  const isUser = role === "user";
  const { text, attachments } = parseAttachments(content);
  return (
    <div className={cn("flex w-full gap-2 animate-float-up", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center soft-shadow mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
      <div className={cn(
        "max-w-[82%] rounded-2xl px-4 py-3 soft-shadow transition",
        isUser
          ? "bubble-user text-primary-foreground rounded-br-sm"
          : "bubble-ai text-foreground rounded-bl-sm border border-border/50 backdrop-blur-sm"
      )}>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((a, i) => <AttachmentChip key={i} attachment={a} />)}
          </div>
        )}
        {text && (
          <div className="text-[13.5px] leading-relaxed space-y-1">
            {renderInline(text)}
          </div>
        )}
        <div className={cn("flex items-center gap-2 mt-1.5 text-[10px]",
          isUser ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {emotion && <span className="inline-flex items-center gap-1">{emotionEmoji[emotion] ?? "✨"}<span className="capitalize">{emotion}</span></span>}
          {risk && risk !== "low" && (
            <span className={cn(
              "px-1.5 py-0.5 rounded-full font-medium capitalize",
              risk === "high" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-[hsl(var(--warning))]"
            )}>{risk} risk</span>
          )}
          {time && <span className="ml-auto tabular-nums">{time}</span>}
        </div>
      </div>
    </div>
  );
};
