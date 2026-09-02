import { useState } from "react";
import { Phone, HeartHandshake, Copy, NotebookPen, MessageCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CARE_T, CareLang, VERIFIED_HELPLINES, telHref, TRUSTED_CONTACT_MESSAGE,
  CARE_DISCLAIMER_EN, CARE_DISCLAIMER_HI,
} from "@/lib/careBridge";
import type { TrustedContact } from "./TrustedContactsDialog";

/**
 * Level 3 — urgent human support. Verified numbers only, always rendered from a
 * controlled constant so they stay visible even when every backend call fails.
 */
export const UrgentSupportCard = ({
  lang,
  contacts,
  onOpenPlan,
  onAddTrusted,
  onHelplineSelected,
  onTrustedSelected,
  onContinueTalking,
}: {
  lang: CareLang;
  contacts: TrustedContact[];
  onOpenPlan: () => void;
  onAddTrusted: () => void;
  onHelplineSelected: (id: string) => void;
  onTrustedSelected: () => void;
  onContinueTalking: () => void;
}) => {
  const t = CARE_T[lang];
  const [confirming, setConfirming] = useState(false);
  const consented = contacts.filter((c) => c.consent_urgent);
  const usable = consented.length ? consented : contacts;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(TRUSTED_CONTACT_MESSAGE);
      toast.success(lang === "hi" ? "संदेश कॉपी हो गया।" : "Message copied — paste it wherever you like.");
    } catch {
      toast.error(lang === "hi" ? "कॉपी नहीं हो सका।" : "Could not copy. You can select the text manually.");
    }
  };

  return (
    <div className="rounded-2xl border border-destructive/40 bg-gradient-to-br from-destructive/10 via-card/70 to-primary/10 backdrop-blur soft-shadow animate-float-up">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center">
            <HeartHandshake className="w-4 h-4 text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t.urgentTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.urgentBody}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {VERIFIED_HELPLINES.map((h) => (
            <a
              key={h.id}
              href={telHref(h.number)}
              onClick={() => onHelplineSelected(h.id)}
              className="group flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/60 hover:border-destructive/40 px-3 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <div className="shrink-0 w-8 h-8 rounded-lg bg-destructive/15 group-hover:bg-destructive/25 flex items-center justify-center transition">
                <Phone className="w-3.5 h-3.5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{lang === "hi" ? h.labelHi : h.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{lang === "hi" ? h.detailHi : h.detail}</p>
              </div>
              <span className="text-xs font-mono text-destructive shrink-0">{h.number}</span>
            </a>
          ))}
        </div>

        {/* Trusted contact — explicit consent screen before anything is shared */}
        {usable.length === 0 ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onAddTrusted}>
            <UserPlus className="w-3 h-3 mr-1.5" /> {t.addTrusted}
          </Button>
        ) : !confirming ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setConfirming(true)}>
            <HeartHandshake className="w-3 h-3 mr-1.5" /> {t.contactTrusted}
          </Button>
        ) : (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 animate-float-up">
            <p className="text-[11px] uppercase tracking-wide text-primary/80 font-semibold">
              {lang === "hi" ? "साझा करने से पहले" : "Before you reach out"}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "hi"
                ? "केवल यह तटस्थ संदेश साझा किया जाएगा। आपकी बातचीत, फ़ाइलें या भावनात्मक विवरण कभी साझा नहीं होते:"
                : "Only this neutral message is shared. Your conversations, files, images and emotional details are never shared:"}
            </p>
            <p className="text-xs rounded-lg bg-background/60 border border-border/50 p-2 italic">“{TRUSTED_CONTACT_MESSAGE}”</p>
            <div className="space-y-1.5">
              {usable.map((c) => (
                <div key={c.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs min-w-0 truncate flex-1">
                    {c.name}
                    {c.relationship && <span className="text-muted-foreground"> • {c.relationship}</span>}
                  </span>
                  {c.phone && (
                    <a
                      href={telHref(c.phone)}
                      onClick={onTrustedSelected}
                      className="inline-flex items-center gap-1 text-xs rounded-full bg-primary/15 hover:bg-primary/25 px-2.5 py-1 text-primary transition"
                    >
                      <Phone className="w-3 h-3" /> {lang === "hi" ? "कॉल" : "Call"}
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`sms:${c.phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(TRUSTED_CONTACT_MESSAGE)}`}
                      onClick={onTrustedSelected}
                      className="inline-flex items-center gap-1 text-xs rounded-full bg-primary/15 hover:bg-primary/25 px-2.5 py-1 text-primary transition"
                    >
                      <MessageCircle className="w-3 h-3" /> {lang === "hi" ? "मैसेज" : "Text"}
                    </a>
                  )}
                  {c.email && (
                    <a
                      href={`mailto:${c.email}?subject=${encodeURIComponent("Request for support")}&body=${encodeURIComponent(TRUSTED_CONTACT_MESSAGE)}`}
                      onClick={onTrustedSelected}
                      className="inline-flex items-center gap-1 text-xs rounded-full bg-primary/15 hover:bg-primary/25 px-2.5 py-1 text-primary transition"
                    >
                      {lang === "hi" ? "ईमेल" : "Email"}
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={copyMessage}>
                <Copy className="w-3 h-3 mr-1.5" /> {lang === "hi" ? "संदेश कॉपी करें" : "Copy prepared message"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setConfirming(false)}>
                {lang === "hi" ? "रद्द करें" : "Cancel"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {lang === "hi"
                ? "EmoSense स्वयं कोई संदेश नहीं भेजता — कॉल या संदेश आप अपने डिवाइस से भेजते हैं।"
                : "EmoSense does not send anything itself — the call or message goes from your own device."}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenPlan}>
            <NotebookPen className="w-3 h-3 mr-1.5" /> {t.viewPlan}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onContinueTalking}>
            <MessageCircle className="w-3 h-3 mr-1.5" /> {t.keepTalking}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {lang === "hi" ? CARE_DISCLAIMER_HI : CARE_DISCLAIMER_EN}
        </p>
      </div>
    </div>
  );
};
