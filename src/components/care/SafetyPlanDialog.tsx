import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, NotebookPen, Trash2 } from "lucide-react";
import { CARE_DISCLAIMER_EN } from "@/lib/careBridge";

type Plan = {
  warning_signs: string;
  calming_activities: string;
  safer_places: string;
  people_to_contact: string;
  professional_resources: string;
  reason_to_pause: string;
  follow_up_preference: string;
};

const EMPTY: Plan = {
  warning_signs: "",
  calming_activities: "",
  safer_places: "",
  people_to_contact: "",
  professional_resources: "",
  reason_to_pause: "",
  follow_up_preference: "",
};

const FIELDS: { key: keyof Plan; label: string; placeholder: string }[] = [
  { key: "warning_signs", label: "My personal warning signs", placeholder: "e.g. I stop replying to people, I skip meals…" },
  { key: "calming_activities", label: "Activities that help me feel calmer", placeholder: "e.g. slow breathing, a walk, music…" },
  { key: "safer_places", label: "Places where I feel safer", placeholder: "e.g. my sister's home, the campus library…" },
  { key: "people_to_contact", label: "People I can contact", placeholder: "First names or roles only — your choice" },
  { key: "professional_resources", label: "Professional resources", placeholder: "e.g. Tele-MANAS 14416, my counsellor's clinic" },
  { key: "reason_to_pause", label: "A personal reason to pause and seek help", placeholder: "Something or someone worth staying for" },
  { key: "follow_up_preference", label: "Optional follow-up preference", placeholder: "e.g. check in with me next evening" },
];

export const SafetyPlanDialog = ({
  userId,
  open,
  onOpenChange,
  trigger,
}: {
  userId: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [plan, setPlan] = useState<Plan>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    setError(null);
    supabase
      .from("care_safety_plans")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError("Could not load your plan right now.");
        if (data) {
          setExists(true);
          setPlan({
            warning_signs: data.warning_signs ?? "",
            calming_activities: data.calming_activities ?? "",
            safer_places: data.safer_places ?? "",
            people_to_contact: data.people_to_contact ?? "",
            professional_resources: data.professional_resources ?? "",
            reason_to_pause: data.reason_to_pause ?? "",
            follow_up_preference: data.follow_up_preference ?? "",
          });
        } else {
          setExists(false);
          setPlan(EMPTY);
        }
        setLoading(false);
      });
  }, [isOpen, userId]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const { error: err } = await supabase
      .from("care_safety_plans")
      .upsert({ user_id: userId, ...plan }, { onConflict: "user_id" });
    setSaving(false);
    if (err) { toast.error("Could not save your plan. Please try again."); return; }
    setExists(true);
    toast.success("Your safety plan is saved — only you can see it.");
    setOpen(false);
  };

  const remove = async () => {
    if (saving) return;
    setSaving(true);
    const { error: err } = await supabase.from("care_safety_plans").delete().eq("user_id", userId);
    setSaving(false);
    if (err) { toast.error("Could not delete your plan."); return; }
    setPlan(EMPTY);
    setExists(false);
    toast("Plan deleted.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="bg-card border-border/50 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="w-4 h-4 text-primary" /> My personal safety &amp; support plan
          </DialogTitle>
          <DialogDescription className="text-xs">
            Private to you. Administrators can never see this content.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your plan…
          </div>
        ) : (
          <div className="space-y-3">
            {error && <p className="text-xs text-destructive">{error}</p>}
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Textarea
                  value={plan[f.key]}
                  onChange={(e) => setPlan({ ...plan, [f.key]: e.target.value.slice(0, 1000) })}
                  placeholder={f.placeholder}
                  rows={2}
                  className="text-sm bg-secondary/40"
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={save} disabled={saving} className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save plan"}
              </Button>
              {exists && (
                <Button variant="ghost" size="icon" onClick={remove} disabled={saving} aria-label="Delete plan">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{CARE_DISCLAIMER_EN}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
