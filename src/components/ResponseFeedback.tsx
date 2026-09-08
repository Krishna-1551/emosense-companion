import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const REASONS: { id: string; label: string }[] = [
  { id: "repetitive", label: "Repetitive" },
  { id: "too_generic", label: "Too generic" },
  { id: "too_long", label: "Too long" },
  { id: "not_understood", label: "Did not understand me" },
  { id: "not_useful", label: "Advice was not useful" },
];

type Props = {
  memoryId: string;
  initial?: "up" | "down" | null;
};

/** Small thumbs up / down control under an assistant reply. Never blocks chat. */
export const ResponseFeedback = ({ memoryId, initial = null }: Props) => {
  const [value, setValue] = useState<"up" | "down" | null>(initial);
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (feedback: "up" | "down", feedbackReason?: string | null) => {
    setBusy(true);
    const { error } = await supabase
      .from("response_memory")
      .update({ feedback, feedback_reason: feedbackReason ?? null })
      .eq("id", memoryId);
    setBusy(false);
    if (error) {
      toast.error("Couldn't save your feedback right now");
      return;
    }
    setValue(feedback);
    if (feedbackReason) setReason(feedbackReason);
  };

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={busy}
          aria-label="This reply was helpful"
          title="Helpful"
          onClick={() => { setAskReason(false); save("up"); }}
          className={cn(
            "inline-flex items-center p-1 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/70",
            value === "up" && "text-primary bg-primary/10",
          )}
        >
          <ThumbsUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label="This reply was not helpful"
          title="Not helpful"
          onClick={() => { setAskReason(v => !v); if (value !== "down") save("down"); }}
          className={cn(
            "inline-flex items-center p-1 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/70",
            value === "down" && "text-destructive bg-destructive/10",
          )}
        >
          <ThumbsDown className="w-3 h-3" />
        </button>
        {value === "up" && <span className="text-[10px] text-muted-foreground">Thanks — noted</span>}
        {value === "down" && reason && (
          <span className="text-[10px] text-muted-foreground">
            Noted: {REASONS.find(r => r.id === reason)?.label}
          </span>
        )}
      </div>

      {askReason && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {REASONS.map(r => (
            <button
              key={r.id}
              type="button"
              disabled={busy}
              onClick={() => { save("down", r.id); setAskReason(false); }}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full border border-border/60 bg-secondary/50 hover:bg-secondary transition-colors",
                reason === r.id && "border-primary/60 text-primary",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
