import { FileText, Image as ImageIcon, Mic, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type AttachmentAnalysis = {
  kind: "image" | "audio" | "document";
  filename?: string | null;
  mime?: string | null;
  emotion?: string;
  intensity?: string;
  language?: string;
  riskScore?: number;
  summary?: string;
  extractedText?: string;
  visualCues?: string;
  speakingPatterns?: string;
};

const KindIcon = ({ kind }: { kind: AttachmentAnalysis["kind"] }) => {
  if (kind === "image") return <ImageIcon className="w-3.5 h-3.5" />;
  if (kind === "audio") return <Mic className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
};

export const AttachmentChip = ({
  attachment, pending, onRemove,
}: {
  attachment: AttachmentAnalysis | { kind: AttachmentAnalysis["kind"]; filename?: string | null };
  pending?: boolean;
  onRemove?: () => void;
}) => {
  const a = attachment as AttachmentAnalysis;
  return (
    <div className={cn(
      "inline-flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/60 px-2.5 py-1.5 text-[11px] max-w-full",
      pending && "opacity-70"
    )}>
      <KindIcon kind={a.kind} />
      <span className="truncate max-w-[140px]">{a.filename || a.kind}</span>
      {pending ? (
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      ) : (
        <>
          {a.emotion && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary capitalize">
              {a.emotion}{a.intensity ? ` · ${a.intensity}` : ""}
            </span>
          )}
          {typeof a.riskScore === "number" && a.riskScore >= 60 && (
            <span className="px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">risk {a.riskScore}</span>
          )}
        </>
      )}
      {onRemove && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground" aria-label="Remove">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
