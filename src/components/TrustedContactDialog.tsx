import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
});

export const TrustedContactDialog = ({ onSaved }: { onSaved?: () => void }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    if (!user || !open) return;
    supabase.from("profiles").select("trusted_contact_name, trusted_contact_email, trusted_contact_phone")
      .eq("id", user.id).maybeSingle().then(({ data }) => {
        setForm({
          name: data?.trusted_contact_name ?? "",
          email: data?.trusted_contact_email ?? "",
          phone: data?.trusted_contact_phone ?? "",
        });
      });
  }, [user, open]);

  const save = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error("Check the contact details"); return; }
    const { error } = await supabase.from("profiles").update({
      trusted_contact_name: form.name || null,
      trusted_contact_email: form.email || null,
      trusted_contact_phone: form.phone || null,
    }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Trusted contact saved");
    setOpen(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-3 py-2 rounded-full bg-secondary/60 hover:bg-secondary border border-border/50 text-xs flex items-center gap-1.5 transition">
          <Shield className="w-3.5 h-3.5" /> Trusted contact
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50">
        <DialogHeader>
          <DialogTitle>Trusted contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <Button onClick={save} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
