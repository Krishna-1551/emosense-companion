import { useState } from "react";
import { LifeBuoy, Info, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARE_T, CareLang, VERIFIED_HELPLINES, telHref } from "@/lib/careBridge";

type Answer = "safe" | "unsure" | "help" | "false_alarm" | "talk";

/** Level 2 — calm safety verification. No red screens, no alarms. */
export const SafetyCheckCard = ({
  lang,
  onAnswer,
  onOpenPlan,
  onAddTrusted,
  hasTrusted,
}: {
  lang: CareLang;
  onAnswer: (a: Answer) => void;
  onOpenPlan: () => void;
  onAddTrusted: () => void;
  hasTrusted: boolean;
}) => {
  const t = CARE_T[lang];
  const [answered, setAnswered] = useState<Answer | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const pick = (a: Answer) => {
    if (answered) return; // prevent duplicate clicks
    setAnswered(a);
    onAnswer(a);
  };

  return (
    <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 via-card/60 to-primary/10 backdrop-blur soft-shadow animate-float-up">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
            <LifeBuoy className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t.safetyTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.safetyBody}</p>
          </div>
        </div>

        <button
          onClick={() => setShowWhy((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
        >
          <Info className="w-3 h-3" /> {showWhy ? t.why : lang === "hi" ? "मैं क्यों पूछ रहा हूँ?" : "Why am I seeing this?"}
        </button>

        {!answered ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-8 text-xs bg-gradient-to-r from-primary to-accent text-primary-foreground" onClick={() => pick("safe")}>
              {t.yesSafe}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => pick("unsure")}>
              {t.unsure}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => pick("help")}>
              {t.needHelp}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => pick("talk")}>
              {t.continueTalking}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => pick("false_alarm")}>
              {t.misunderstood}
            </Button>
          </div>
        ) : answered === "unsure" ? (
          <div className="space-y-2.5 animate-float-up">
            <p className="text-xs text-muted-foreground">
              {lang === "hi"
                ? "ठीक है। इस पल को थोड़ा आसान बनाने के कुछ तरीके, और चाहें तो मानवीय सहयोग भी।"
                : "That's okay. Here are a few ways to make this moment steadier — and human support if you want it."}
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              <li>{lang === "hi" ? "पाँच धीमी साँसें — बाहर छोड़ना लंबा रखें" : "Five slow breaths — make the out-breath longer"}</li>
              <li>{lang === "hi" ? "पानी पिएँ और किसी सुरक्षित जगह बैठें" : "Drink some water and sit somewhere you feel safe"}</li>
              <li>{lang === "hi" ? "किसी भरोसेमंद व्यक्ति को एक लाइन भेजें" : "Send one line to someone you trust"}</li>
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              {VERIFIED_HELPLINES.slice(0, 2).map((h) => (
                <a
                  key={h.id}
                  href={telHref(h.number)}
                  className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 px-3 py-2 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs min-w-0 truncate">{lang === "hi" ? h.labelHi : h.label}</span>
                  <span className="text-[11px] font-mono text-primary ml-auto">{h.number}</span>
                </a>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={hasTrusted ? onOpenPlan : onAddTrusted}>
                {hasTrusted ? t.viewPlan : t.addTrusted}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => { setAnswered(null); pick("help"); }}>
                {t.needHelp}
              </Button>
            </div>
          </div>
        ) : answered === "false_alarm" ? (
          <p className="text-xs text-muted-foreground">
            {lang === "hi" ? "समझ गया — कोई बात नहीं। हम सामान्य बातचीत जारी रखते हैं।" : "Understood — no problem at all. Let's carry on talking as usual."}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {lang === "hi" ? "बताने के लिए धन्यवाद। मैं यहीं हूँ।" : "Thank you for telling me. I'm right here."}
          </p>
        )}
      </div>
    </div>
  );
};
