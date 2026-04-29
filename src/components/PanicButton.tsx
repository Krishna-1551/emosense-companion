import { useState } from "react";
import { AlertTriangle, Phone, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const PanicButton = ({ trustedContact }: { trustedContact?: { name?: string | null; email?: string | null; phone?: string | null } | null }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const trigger = async () => {
    setOpen(true);
    if (!user) return;
    await supabase.from("panic_events").insert({ user_id: user.id });
    if (trustedContact?.email || trustedContact?.phone) {
      toast.success(`We've noted this. Reach out to ${trustedContact.name ?? "your trusted contact"} now.`);
    }
  };

  return (
    <>
      <button
        onClick={trigger}
        className="relative px-3 py-2 rounded-full bg-destructive/15 hover:bg-destructive/25 border border-destructive/40 text-destructive text-xs font-medium transition flex items-center gap-1.5"
        aria-label="Panic button"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Need help now
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-destructive" />
              You're not alone
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-3 text-foreground">
              <p>Take a slow breath. What you're feeling is temporary.</p>
              <div className="rounded-xl bg-secondary/60 p-4 space-y-2">
                <p className="font-medium text-sm">Immediate support:</p>
                <a href="tel:988" className="flex items-center gap-2 text-accent hover:underline">
                  <Phone className="w-4 h-4" /> 988 — Suicide & Crisis Lifeline (US)
                </a>
                <a href="tel:112" className="flex items-center gap-2 text-accent hover:underline">
                  <Phone className="w-4 h-4" /> 112 — Emergency (EU)
                </a>
              </div>
              {trustedContact?.name && (
                <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 space-y-1">
                  <p className="font-medium text-sm">Your trusted contact:</p>
                  <p>{trustedContact.name}</p>
                  {trustedContact.phone && <a href={`tel:${trustedContact.phone}`} className="block text-accent hover:underline">{trustedContact.phone}</a>}
                  {trustedContact.email && <a href={`mailto:${trustedContact.email}`} className="block text-accent hover:underline">{trustedContact.email}</a>}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setOpen(false)} className="bg-gradient-to-r from-primary to-accent text-primary-foreground">I'm safe for now</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
