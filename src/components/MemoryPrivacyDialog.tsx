import { useState } from "react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Props = { userId: string; enabled: boolean; onEnabledChange: (enabled: boolean) => void };

export function MemoryPrivacyDialog({ userId, enabled, onEnabledChange }: Props) {
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setBusy(true);
    const [messages, memory, assessments] = await Promise.all([
      supabase.from("messages").select("role, content, emotion, sentiment, risk_level, created_at").eq("user_id", userId).order("created_at"),
      supabase.from("response_memory").select("situation_summary, approach, language, style, feedback, feedback_reason, outcome_signal, created_at").eq("user_id", userId).order("created_at"),
      supabase.from("psych_assessments").select("emotion, intensity, severity_level, patterns, uncertainty, created_at").eq("user_id", userId).order("created_at"),
    ]);
    setBusy(false);
    if (messages.error || memory.error || assessments.error) return toast.error("Could not export your data right now.");
    const payload = { exported_at: new Date().toISOString(), memory_enabled: enabled, messages: messages.data, response_memory: memory.data, assessments: assessments.data };
    const href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `emosense-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(href);
    toast.success("Your EmoSense data was exported.");
  };

  const deleteAdaptiveMemory = async () => {
    if (!window.confirm("Delete all adaptive response memory? Your chat messages will remain.")) return;
    setBusy(true);
    const { error } = await supabase.from("response_memory").delete().eq("user_id", userId);
    setBusy(false);
    if (error) return toast.error("Could not delete memory right now.");
    onEnabledChange(false);
    toast.success("Adaptive memory deleted and switched off.");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start"><ShieldCheck className="mr-2 h-4 w-4" /> Memory & privacy</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Memory & privacy</DialogTitle>
          <DialogDescription>You control whether EmoSense remembers response preferences. It never turns this into a diagnosis.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div><p className="text-sm font-medium">Adaptive response memory</p><p className="text-xs text-muted-foreground">Uses your feedback to reduce repetition and match response style.</p></div>
            <Switch checked={enabled} onCheckedChange={onEnabledChange} aria-label="Adaptive response memory" />
          </div>
          <p className="text-xs text-muted-foreground">Turning memory off stops future adaptive-memory reads and writes. Use delete to remove existing adaptive records. Export includes your chats, response memory and structured assessments.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" disabled={busy} onClick={exportData}><Download className="mr-2 h-4 w-4" /> Export my data</Button>
            <Button variant="destructive" disabled={busy} onClick={deleteAdaptiveMemory}><Trash2 className="mr-2 h-4 w-4" /> Delete memory</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
