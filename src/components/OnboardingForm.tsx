import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

const GENDERS = ["Male", "Female", "Prefer not to say", "Other"] as const;
const PROFESSIONS = ["Student", "Working Professional", "Homemaker", "Freelancer", "Unemployed", "Retired", "Other"] as const;

const schema = z.object({
  age: z.number().int().min(1, "Enter a valid age").max(120, "Enter a valid age"),
  gender: z.enum(GENDERS, { required_error: "Please select" }),
  profession: z.enum(PROFESSIONS, { required_error: "Please select" }),
});

export const OnboardingForm = ({ onDone }: { onDone: () => void }) => {
  const { user } = useAuth();
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string>("");
  const [profession, setProfession] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ age: Number(age), gender, profession });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      age: parsed.data.age,
      gender: parsed.data.gender,
      profession: parsed.data.profession,
      profile_completed_at: new Date().toISOString(),
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome aboard ✨");
    onDone();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold gradient-text">A few quick details</h1>
            <p className="text-xs text-muted-foreground">Helps EmoSense understand you better.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="age">Age</Label>
            <Input id="age" type="number" min={1} max={120} required value={age}
              onChange={e => setAge(e.target.value)} placeholder="e.g. 24" />
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                {GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role / Profession</Label>
            <Select value={profession} onValueChange={setProfession}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {PROFESSIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Continue to Chat"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Your data stays private and is only used to personalize your experience.
          </p>
        </form>
      </Card>
    </div>
  );
};
