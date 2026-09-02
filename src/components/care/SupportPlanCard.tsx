import { useState } from "react";
import { Sparkles, X, Check, Bookmark, MessageCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARE_T, CareLang, SupportPlan, FOLLOW_UP_OPTIONS } from "@/lib/careBridge";

type Props = {
  plan: SupportPlan;
  lang: CareLang;
  onDismiss: () => void;
  onSaveForLater: () => void;
  onContinueTalking: () => void;
  onFeedback: (helped: boolean) => void;
  onFollowUp: (optionId: string) => void;
};

/** Level 1 — everyday support. Calm, small, never alarming. */
export const SupportPlanCard = ({
  plan, lang, onDismiss, onSaveForLater, onContinueTalking, onFeedback, onFollowUp,
}: Props) => {
  const t = CARE_T[lang];
  const [started, setStarted] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [followUpChosen, setFollowUpChosen] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-accent/10 backdrop-blur soft-shadow animate-float-up">
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/60 transition"
        aria-label="Dismiss support plan"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t.planTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{plan.acknowledgement}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-primary/80 font-semibold">{t.tryThis}</p>
          <p className="text-sm font-medium">{plan.activity.title}</p>
          {started && (
            <ol className="list-decimal list-inside space-y-0.5 text-xs text-muted-foreground animate-float-up">
              {plan.activity.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-background/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-accent/80 font-semibold mb-1">{t.todayAction}</p>
          <p className="text-sm">{plan.todayAction}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-8 text-xs bg-gradient-to-r from-primary to-accent text-primary-foreground" onClick={() => setStarted(true)}>
            <Play className="w-3 h-3 mr-1.5" /> {t.startActivity}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={saved}
            onClick={() => { setSaved(true); onSaveForLater(); }}
          >
            <Bookmark className="w-3 h-3 mr-1.5" /> {saved ? t.saved : t.saveForLater}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onContinueTalking}>
            <MessageCircle className="w-3 h-3 mr-1.5" /> {t.continueTalking}
          </Button>
        </div>

        <div className="border-t border-border/40 pt-2.5 space-y-2">
          {feedbackGiven ? (
            <p className="text-[11px] text-muted-foreground">{t.thanks}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">{t.whatHelped}</span>
              <button
                onClick={() => { setFeedbackGiven(true); onFeedback(true); }}
                className="px-2.5 py-1 rounded-full text-[11px] bg-secondary/60 hover:bg-secondary border border-border/50 transition"
              >
                <Check className="w-3 h-3 inline mr-1" />{t.helped}
              </button>
              <button
                onClick={() => { setFeedbackGiven(true); onFeedback(false); }}
                className="px-2.5 py-1 rounded-full text-[11px] bg-secondary/60 hover:bg-secondary border border-border/50 transition"
              >
                {t.notHelped}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{t.followUpAsk}</span>
            {FOLLOW_UP_OPTIONS.map((o) => (
              <button
                key={o.id}
                disabled={!!followUpChosen}
                onClick={() => { setFollowUpChosen(o.id); onFollowUp(o.id); }}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition disabled:opacity-60 ${
                  followUpChosen === o.id
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-secondary/60 hover:bg-secondary border-border/50"
                }`}
              >
                {lang === "hi" ? o.labelHi : o.label}
              </button>
            ))}
          </div>
          {followUpChosen && followUpChosen !== "none" && (
            <p className="text-[11px] text-muted-foreground">{t.followUpStored}</p>
          )}
        </div>
      </div>
    </div>
  );
};
