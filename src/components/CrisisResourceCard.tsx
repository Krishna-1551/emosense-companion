import { useState } from "react";
import { Phone, Heart, X, ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Helpline = {
  name: string;
  detail: string;
  phone?: string;
  href?: string;
};

const HELPLINES: Helpline[] = [
  { name: "iCall (India)", detail: "Mon–Sat, 8am–10pm • Free & confidential", phone: "+919152987821" },
  { name: "Vandrevala Foundation", detail: "24×7 • Mental health support", phone: "+919999666555" },
  { name: "KIRAN Helpline", detail: "24×7 • Govt. of India, multilingual", phone: "1800-599-0019" },
  { name: "AASRA", detail: "24×7 • Crisis & suicide prevention", phone: "+919820466726" },
];

type Props = {
  onDismiss: () => void;
  trustedContact?: { name?: string | null; phone?: string | null; email?: string | null } | null;
};

export const CrisisResourceCard = ({ onDismiss, trustedContact }: Props) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-destructive/40 bg-gradient-to-br from-destructive/10 via-background/60 to-primary/10 backdrop-blur soft-shadow animate-float-up">
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_top_right,hsl(var(--destructive)/0.25),transparent_60%)]" />
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/60 transition"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="relative p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-destructive/20 flex items-center justify-center">
            <Heart className="w-4 h-4 text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">You don't have to carry this alone</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              If things feel too heavy right now, a trained human is one call away. Free, confidential, judgment-free.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {(expanded ? HELPLINES : HELPLINES.slice(0, 2)).map((h) => (
            <a
              key={h.name}
              href={h.phone ? `tel:${h.phone.replace(/\s/g, "")}` : h.href}
              className="group flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/50 hover:bg-background/80 hover:border-destructive/40 px-3 py-2 transition"
            >
              <div className="shrink-0 w-8 h-8 rounded-lg bg-destructive/15 group-hover:bg-destructive/25 flex items-center justify-center transition">
                <Phone className="w-3.5 h-3.5 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{h.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{h.detail}</p>
              </div>
              {h.phone && <span className="text-[11px] font-mono text-destructive shrink-0">Call</span>}
              {h.href && <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />}
            </a>
          ))}
        </div>

        {trustedContact?.name && (trustedContact.phone || trustedContact.email) && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-primary/80 font-semibold mb-1.5">Your trusted contact</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm truncate">{trustedContact.name}</p>
              <div className="flex gap-1.5 shrink-0">
                {trustedContact.phone && (
                  <a href={`tel:${trustedContact.phone}`} className="inline-flex items-center gap-1 text-xs rounded-full bg-primary/15 hover:bg-primary/25 px-2.5 py-1 text-primary transition">
                    <Phone className="w-3 h-3" /> Call
                  </a>
                )}
                {trustedContact.phone && (
                  <a href={`sms:${trustedContact.phone}`} className="inline-flex items-center gap-1 text-xs rounded-full bg-primary/15 hover:bg-primary/25 px-2.5 py-1 text-primary transition">
                    <MessageCircle className="w-3 h-3" /> Text
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show fewer" : "Show more helplines"}
          </Button>
          <p className="text-[10px] text-muted-foreground italic">Emergency: dial 112</p>
        </div>
      </div>
    </div>
  );
};
