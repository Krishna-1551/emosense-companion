import { Component, ErrorInfo, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Phone, ShieldCheck, HeartHandshake, NotebookPen, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  assessSupportLevel, detectCareLang, buildSupportPlan, logCareEvent,
  CareInputMsg, SupportLevel, CARE_T, VERIFIED_HELPLINES, telHref,
  FOLLOW_UP_OPTIONS, CARE_DISCLAIMER_EN, CARE_DISCLAIMER_HI,
} from "@/lib/careBridge";
import { SupportPlanCard } from "./SupportPlanCard";
import { SafetyCheckCard } from "./SafetyCheckCard";
import { UrgentSupportCard } from "./UrgentSupportCard";
import { SafetyPlanDialog } from "./SafetyPlanDialog";
import { TrustedContactsDialog, useTrustedContacts } from "./TrustedContactsDialog";

/* ------------------------------------------------------------------ *
 * Error boundary — Care Bridge must never take the chat down. If a card
 * throws, we still render verified helplines from the local constant.
 * ------------------------------------------------------------------ */
class CareBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.warn("[CareBridge] recovered from render error", e.message, info.componentStack); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const HelplineFallback = ({ lang }: { lang: "en" | "hi" }) => (
  <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-3 space-y-2">
    <p className="text-xs font-medium">{lang === "hi" ? "सत्यापित सहायता संपर्क" : "Verified support lines"}</p>
    <div className="grid gap-2 sm:grid-cols-3">
      {VERIFIED_HELPLINES.map((h) => (
        <a key={h.id} href={telHref(h.number)} className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2 hover:border-primary/40 transition">
          <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs truncate">{lang === "hi" ? h.labelHi : h.label}</span>
          <span className="text-[11px] font-mono text-primary ml-auto">{h.number}</span>
        </a>
      ))}
    </div>
    <p className="text-[10px] text-muted-foreground">{lang === "hi" ? CARE_DISCLAIMER_HI : CARE_DISCLAIMER_EN}</p>
  </div>
);

type Props = {
  userId: string;
  conversationId: string | null;
  messages: CareInputMsg[];
  /** Stop any active voice playback before a Care Bridge prompt appears. */
  onStopVoice?: () => void;
  /** Continue the conversation from a Care Bridge action. */
  onContinueTalking?: () => void;
};

type FollowUpRow = {
  id: string;
  choice_label: string;
  due_at: string;
};

const CareBridgeInner = ({ userId, conversationId, messages, onStopVoice, onContinueTalking }: Props) => {
  const lang = useMemo(() => detectCareLang(messages), [messages]);
  const t = CARE_T[lang];
  const assessment = useMemo(() => assessSupportLevel(messages), [messages]);

  const { contacts, reload: reloadContacts } = useTrustedContacts(userId);
  const [planOpen, setPlanOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  /** Card currently displayed. Escalation is sticky until the user resolves it. */
  const [shown, setShown] = useState<SupportLevel>(0);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  /* A card should never reappear turn after turn. Per conversation we remember
   * the highest level already surfaced; the same (or a lower) level stays quiet
   * unless the situation genuinely escalates. */
  const seenKey = `emosense-care-seen:${conversationId ?? "new"}`;
  const readSeen = (): number => {
    try { return Number(sessionStorage.getItem(seenKey) || 0); } catch { return 0; }
  };
  const markSeen = (lvl: number) => {
    try { if (lvl > readSeen()) sessionStorage.setItem(seenKey, String(lvl)); } catch { /* ignore */ }
  };
  const [safetyAnswer, setSafetyAnswer] = useState<string | null>(null);
  const [dueFollowUp, setDueFollowUp] = useState<FollowUpRow | null>(null);
  const [followUpAnswered, setFollowUpAnswered] = useState(false);

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const anchor = `${conversationId ?? "new"}:${messages.filter((m) => m.role === "user").length}`;
  const anchorRef = useRef(anchor);

  // Decide which card to display for the current turn.
  useEffect(() => {
    if (dismissedKey === anchor) return;
    const level = assessment.level;
    if (level === 0) { setShown(0); return; }

    // A new user turn resets the level-2 answer state.
    if (anchorRef.current !== anchor) {
      anchorRef.current = anchor;
      setSafetyAnswer(null);
    }

    // Never de-escalate an active urgent card automatically.
    setShown((prev) => (prev === 3 ? 3 : level));

    if (level >= 2) onStopVoice?.();

    const eventName = level === 3 ? "urgent_support_requested" : level === 2 ? "safety_check_displayed" : "support_plan_offered";
    logCareEvent({
      userId,
      conversationId,
      event: eventName,
      level,
      riskBand: assessment.riskBand,
      humanSupportRequested: level === 3,
      dedupeKey: `${anchor}:${eventName}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, assessment.level]);

  // Stored follow-up preference — shown when the user next opens EmoSense.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("care_follow_ups")
          .select("id, choice_label, due_at")
          .eq("user_id", userId)
          .eq("status", "pending")
          .lte("due_at", new Date().toISOString())
          .order("due_at", { ascending: true })
          .limit(1);
        if (!cancelled && data && data.length) setDueFollowUp(data[0] as FollowUpRow);
      } catch {
        /* silent — follow-ups are never allowed to block chat */
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const storeFollowUp = async (optionId: string) => {
    const opt = FOLLOW_UP_OPTIONS.find((o) => o.id === optionId);
    if (!opt) return;
    if (opt.minutes === 0) return;
    try {
      await supabase.from("care_follow_ups").insert({
        user_id: userId,
        conversation_id: conversationId,
        due_at: new Date(Date.now() + opt.minutes * 60_000).toISOString(),
        choice_label: opt.label,
        status: "pending",
      });
      logCareEvent({
        userId, conversationId, event: "follow_up_requested",
        level: assessment.level, riskBand: assessment.riskBand,
        followUpStatus: "pending", dedupeKey: `${anchor}:follow_up:${optionId}`,
      });
    } catch {
      toast.message(lang === "hi" ? "प्राथमिकता सेव नहीं हो सकी।" : "Could not save that preference right now.");
    }
  };

  const answerFollowUp = async (outcome: string) => {
    if (!dueFollowUp) return;
    setFollowUpAnswered(true);
    try {
      await supabase.from("care_follow_ups")
        .update({ status: "answered", outcome, responded_at: new Date().toISOString() })
        .eq("id", dueFollowUp.id);
    } catch { /* silent */ }
    if (outcome === "human") {
      setShown(3);
      logCareEvent({
        userId, conversationId, event: "urgent_support_requested",
        level: 3, riskBand: assessment.riskBand, humanSupportRequested: true,
        dedupeKey: `${dueFollowUp.id}:human`,
      });
    }
  };

  const onSafetyAnswer = (a: "safe" | "unsure" | "help" | "false_alarm" | "talk") => {
    setSafetyAnswer(a);
    const map = {
      safe: "user_confirmed_safe",
      unsure: "user_unsure",
      help: "urgent_support_requested",
      false_alarm: "false_alarm_reported",
      talk: "user_unsure",
    } as const;
    logCareEvent({
      userId, conversationId, event: map[a],
      level: a === "help" ? 3 : 2,
      riskBand: assessment.riskBand,
      humanSupportRequested: a === "help",
      confirmedSafe: a === "safe" ? true : a === "false_alarm" ? true : a === "help" ? false : null,
      dedupeKey: `${anchor}:answer:${a}`,
    });
    if (a === "help") setShown(3);
    if (a === "safe") setShown(1);
    if (a === "false_alarm" || a === "talk") {
      setDismissedKey(anchor);
      setShown(0);
    }
  };

  const dialogs = (
    <>
      <SafetyPlanDialog userId={userId} open={planOpen} onOpenChange={setPlanOpen} />
      <TrustedContactsDialog userId={userId} open={contactsOpen} onOpenChange={setContactsOpen} onChanged={reloadContacts} />
    </>
  );

  /* ---------------- Follow-up check-in ---------------- */
  if (dueFollowUp && !followUpAnswered) {
    return (
      <div className="space-y-3">
        {dialogs}
        <div className="rounded-2xl border border-primary/30 bg-card/60 backdrop-blur p-4 space-y-2.5 animate-float-up">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t.followUpTitle}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {lang === "hi" ? "आपने यह जाँच माँगी थी" : "You asked for this check-in"} • {dueFollowUp.choice_label}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-8 text-xs bg-gradient-to-r from-primary to-accent text-primary-foreground" onClick={() => answerFollowUp("better")}>{t.better}</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => answerFollowUp("same")}>{t.same}</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => answerFollowUp("worse")}>{t.worse}</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => answerFollowUp("human")}>{t.wantHuman}</Button>
          </div>
        </div>
      </div>
    );
  }

  if (shown === 0) return dialogs;

  return (
    <div className="space-y-3">
      {dialogs}

      {shown === 1 && safetyAnswer !== "false_alarm" && (
        <SupportPlanCard
          plan={buildSupportPlan(lastUserMsg?.emotion)}
          lang={lang}
          onDismiss={() => { setDismissedKey(anchor); setShown(0); }}
          onSaveForLater={() => { setPlanOpen(true); }}
          onContinueTalking={() => { setDismissedKey(anchor); setShown(0); onContinueTalking?.(); }}
          onFeedback={(helped) => logCareEvent({
            userId, conversationId, event: "support_plan_offered",
            level: 1, riskBand: assessment.riskBand,
            followUpStatus: helped ? "helped" : "not_helped",
            dedupeKey: `${anchor}:feedback:${helped}`,
          })}
          onFollowUp={storeFollowUp}
        />
      )}

      {shown === 2 && (
        <SafetyCheckCard
          lang={lang}
          onAnswer={onSafetyAnswer}
          onOpenPlan={() => setPlanOpen(true)}
          onAddTrusted={() => setContactsOpen(true)}
          hasTrusted={contacts.length > 0}
        />
      )}

      {shown === 3 && (
        <UrgentSupportCard
          lang={lang}
          contacts={contacts}
          onOpenPlan={() => setPlanOpen(true)}
          onAddTrusted={() => setContactsOpen(true)}
          onHelplineSelected={(id) => logCareEvent({
            userId, conversationId, event: "helpline_action_selected",
            level: 3, riskBand: assessment.riskBand, humanSupportRequested: true,
            dedupeKey: `${anchor}:helpline:${id}`,
          })}
          onTrustedSelected={() => logCareEvent({
            userId, conversationId, event: "trusted_contact_action_selected",
            level: 3, riskBand: assessment.riskBand, humanSupportRequested: true,
            dedupeKey: `${anchor}:trusted`,
          })}
          onContinueTalking={() => { onContinueTalking?.(); }}
        />
      )}
    </div>
  );
};

/** Quick-access buttons for the sidebar / settings area. */
export const CareBridgeSettings = ({ userId }: { userId: string }) => {
  const [planOpen, setPlanOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setPlanOpen(true)}
        className="px-3 py-2 rounded-full bg-secondary/60 hover:bg-secondary border border-border/50 text-xs flex items-center gap-1.5 transition"
      >
        <NotebookPen className="w-3.5 h-3.5" /> Safety plan
      </button>
      <button
        onClick={() => setContactsOpen(true)}
        className="px-3 py-2 rounded-full bg-secondary/60 hover:bg-secondary border border-border/50 text-xs flex items-center gap-1.5 transition"
      >
        <UserPlus className="w-3.5 h-3.5" /> Support contacts
      </button>
      <SafetyPlanDialog userId={userId} open={planOpen} onOpenChange={setPlanOpen} />
      <TrustedContactsDialog userId={userId} open={contactsOpen} onOpenChange={setContactsOpen} />
    </>
  );
};

export const CareBridge = (props: Props) => {
  const lang = detectCareLang(props.messages);
  const level = (() => {
    try { return assessSupportLevel(props.messages).level; } catch { return 0; }
  })();
  return (
    <CareBoundary fallback={level > 0 ? <HelplineFallback lang={lang} /> : null}>
      <CareBridgeInner {...props} />
    </CareBoundary>
  );
};

export { HeartHandshake as CareBridgeIcon };
