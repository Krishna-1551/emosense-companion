import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { isValidEmail, isValidPhone } from "@/lib/careBridge";

export type TrustedContact = {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  preferred_method: string;
  consent_urgent: boolean;
};

const METHODS = ["call", "text", "email"] as const;

export const useTrustedContacts = (userId?: string) => {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("care_trusted_contacts")
      .select("id, name, relationship, phone, email, preferred_method, consent_urgent")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    setContacts((data as TrustedContact[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  return { contacts, loading, reload: load };
};

export const TrustedContactsDialog = ({
  userId,
  open,
  onOpenChange,
  onChanged,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) => {
  const { contacts, loading, reload } = useTrustedContacts(open ? userId : undefined);
  const [form, setForm] = useState({ name: "", relationship: "", phone: "", email: "", preferred_method: "call", consent_urgent: false });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (saving) return;
    if (!form.name.trim()) { toast.error("Please add a name."); return; }
    if (form.phone.trim() && !isValidPhone(form.phone)) { toast.error("Please enter a valid phone number."); return; }
    if (form.email.trim() && !isValidEmail(form.email)) { toast.error("Please enter a valid email address."); return; }
    if (!form.phone.trim() && !form.email.trim()) { toast.error("Add a phone number or an email address."); return; }
    setSaving(true);
    const { error } = await supabase.from("care_trusted_contacts").insert({
      user_id: userId,
      name: form.name.trim().slice(0, 100),
      relationship: form.relationship.trim().slice(0, 60) || null,
      phone: form.phone.trim().slice(0, 25) || null,
      email: form.email.trim().slice(0, 255) || null,
      preferred_method: form.preferred_method,
      consent_urgent: form.consent_urgent,
    });
    setSaving(false);
    if (error) { toast.error("Could not save this contact. Please try again."); return; }
    setForm({ name: "", relationship: "", phone: "", email: "", preferred_method: "call", consent_urgent: false });
    toast.success("Trusted support contact saved.");
    reload();
    onChanged?.();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("care_trusted_contacts").delete().eq("id", id);
    if (error) { toast.error("Could not remove this contact."); return; }
    reload();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Trusted support contacts
          </DialogTitle>
          <DialogDescription className="text-xs">
            Completely optional. EmoSense never contacts anyone automatically — you always choose and confirm first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground rounded-xl border border-border/50 bg-secondary/30 p-3">
              No trusted contacts yet. You can still reach verified professional helplines at any time.
            </p>
          ) : (
            <div className="space-y-2">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/30 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">
                      {c.name} {c.relationship && <span className="text-muted-foreground text-xs">• {c.relationship}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Prefers {c.preferred_method}
                      {c.consent_urgent ? " • consented for urgent moments" : " • not consented for urgent moments"}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label={`Remove ${c.name}`}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-border/50 p-3">
            <p className="text-xs font-medium flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5 text-primary" /> Add a contact</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} /></div>
              <div><Label className="text-xs">Relationship</Label><Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder="Sister, friend, mentor…" maxLength={60} /></div>
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" maxLength={25} /></div>
              <div><Label className="text-xs">Email (optional)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preferred contact method</Label>
              <div className="flex gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm({ ...form, preferred_method: m })}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      form.preferred_method === m
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <Checkbox checked={form.consent_urgent} onCheckedChange={(v) => setForm({ ...form, consent_urgent: !!v })} />
              <span className="text-[11px] text-muted-foreground leading-snug">
                I consent to EmoSense showing me this contact during an urgent support moment. Only a neutral request for help
                is ever shared — never my conversations, files or emotional details.
              </span>
            </label>
            <Button onClick={add} disabled={saving} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save contact"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
