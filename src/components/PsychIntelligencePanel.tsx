import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Search, FlaskConical, Loader2, ShieldAlert, BookOpen, Gauge } from "lucide-react";
import { toast } from "sonner";

type PsychCase = {
  id: string; case_code: string; category: string; subcategory: string | null;
  user_situation: string; severity_level: number; possible_patterns: string[];
  response_strategy: string; follow_up_questions: string[]; avoid_saying: string[];
  next_steps: string[]; escalation_criteria: string | null; source: string | null;
  enabled: boolean; reviewed: boolean; confidence: number;
};

type Simulation = {
  id: string; created_at: string; category: string; severity_level: number;
  persona: string | null; emotional_intensity: number; turns: number;
  transcript: { role: string; content: string; severity_level?: number }[];
  scores: Record<string, number | string>; overall_score: number | null;
  verdict: string | null; notes: string | null;
};

const SEV_LABEL: Record<number, string> = {
  1: "L1 · Normal distress", 2: "L2 · Significant distress",
  3: "L3 · Possible MH concern", 4: "L4 · Safety critical",
};
const SEV_CLASS: Record<number, string> = {
  1: "bg-primary/10 text-primary border-primary/30",
  2: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  3: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  4: "bg-destructive/10 text-destructive border-destructive/40",
};
const DIMENSIONS = [
  ["empathy", "Empathy"], ["context_awareness", "Context awareness"],
  ["psychological_appropriateness", "Psych. appropriateness"],
  ["non_diagnostic_language", "Non-diagnostic language"],
  ["relevance", "Relevance"], ["personalization", "Personalization"],
  ["safety", "Safety"], ["escalation_correctness", "Escalation"],
  ["hallucination_avoidance", "No hallucination"],
] as const;

export const PsychIntelligencePanel = () => {
  const [cases, setCases] = useState<PsychCase[]>([]);
  const [q, setQ] = useState("");
  const [sevFilter, setSevFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [sims, setSims] = useState<Simulation[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Simulation | null>(null);

  const [form, setForm] = useState({
    category: "Anxiety", severity_level: "2", turns: "3",
    emotional_intensity: "6",
    persona: "College student, 20, lives with family in Delhi",
    scenario: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [c, s] = await Promise.all([
      supabase.from("psych_cases").select("*").order("category").order("case_code").limit(500),
      supabase.from("psych_simulations").select("*").order("created_at", { ascending: false }).limit(15),
    ]);
    if (c.data) setCases(c.data as unknown as PsychCase[]);
    if (s.data) setSims(s.data as unknown as Simulation[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cases.filter((c) => {
      if (sevFilter !== "all" && String(c.severity_level) !== sevFilter) return false;
      if (!term) return true;
      return [c.case_code, c.category, c.subcategory, c.user_situation, (c.possible_patterns || []).join(" ")]
        .join(" ").toLowerCase().includes(term);
    });
  }, [cases, q, sevFilter]);

  const categories = useMemo(
    () => Array.from(new Set(cases.map((c) => c.category))).sort(),
    [cases],
  );

  const toggleEnabled = async (c: PsychCase) => {
    const next = !c.enabled;
    setCases((prev) => prev.map((x) => (x.id === c.id ? { ...x, enabled: next } : x)));
    const { error } = await supabase.from("psych_cases").update({ enabled: next }).eq("id", c.id);
    if (error) {
      toast.error("Could not update case");
      setCases((prev) => prev.map((x) => (x.id === c.id ? { ...x, enabled: !next } : x)));
    }
  };

  const runSimulation = async () => {
    setRunning(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("psych-simulate", {
        body: {
          category: form.category,
          severity_level: Number(form.severity_level),
          turns: Number(form.turns),
          emotional_intensity: Number(form.emotional_intensity),
          persona: form.persona,
          scenario: form.scenario || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as Simulation);
      toast.success("Simulation complete");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setRunning(false);
    }
  };

  const stats = useMemo(() => ({
    total: cases.length,
    enabled: cases.filter((c) => c.enabled).length,
    reviewed: cases.filter((c) => c.reviewed).length,
    crisis: cases.filter((c) => c.severity_level === 4).length,
  }), [cases]);

  return (
    <Card className="p-4 space-y-4 border-primary/25">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Psychological Intelligence Engine</h2>
          <p className="text-xs text-muted-foreground">
            Curated case knowledge, severity model and response-quality simulator. Pattern recognition only — never diagnostic.
          </p>
        </div>
        <div className="hidden sm:flex gap-2 text-xs">
          <Badge variant="outline">{stats.enabled}/{stats.total} active</Badge>
          <Badge variant="outline">{stats.reviewed} reviewed</Badge>
          <Badge variant="outline" className="border-destructive/40 text-destructive">{stats.crisis} crisis</Badge>
        </div>
      </div>

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library" className="text-xs gap-1"><BookOpen className="w-3 h-3" /> Case library</TabsTrigger>
          <TabsTrigger value="sim" className="text-xs gap-1"><FlaskConical className="w-3 h-3" /> Simulator</TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1"><Gauge className="w-3 h-3" /> Evaluations</TabsTrigger>
        </TabsList>

        {/* ------------------------------ LIBRARY ------------------------------ */}
        <TabsContent value="library" className="space-y-3 pt-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cases, patterns, situations…" className="pl-8 h-9 text-sm" />
            </div>
            <Select value={sevFilter} onValueChange={setSevFilter}>
              <SelectTrigger className="h-9 w-full sm:w-48 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                {[1, 2, 3, 4].map((l) => <SelectItem key={l} value={String(l)}>{SEV_LABEL[l]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground">Loading case library…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cases match this filter.</p>
          ) : (
            <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
              {filtered.map((c) => (
                <div key={c.id} className="rounded-xl border bg-card/60 p-3 space-y-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-[10px]">{c.case_code}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${SEV_CLASS[c.severity_level]}`}>{SEV_LABEL[c.severity_level]}</Badge>
                    <span className="text-xs text-muted-foreground">{c.category}{c.subcategory ? ` / ${c.subcategory}` : ""}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{c.enabled ? "active" : "off"}</span>
                      <Switch checked={c.enabled} onCheckedChange={() => toggleEnabled(c)} />
                    </div>
                  </div>
                  <p className="text-sm">{c.user_situation}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Strategy:</span> {c.response_strategy}
                  </p>
                  {!!(c.possible_patterns || []).length && (
                    <div className="flex flex-wrap gap-1">
                      {c.possible_patterns.map((p) => (
                        <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{p}</span>
                      ))}
                    </div>
                  )}
                  {c.escalation_criteria && (
                    <p className="text-xs text-destructive/90 flex items-start gap-1">
                      <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" /> {c.escalation_criteria}
                    </p>
                  )}
                  {c.source && <p className="text-[10px] text-muted-foreground">Source: {c.source}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ----------------------------- SIMULATOR ----------------------------- */}
        <TabsContent value="sim" className="space-y-3 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(categories.length ? categories : ["Anxiety", "Depression", "Academic Stress"]).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Target severity</label>
              <Select value={form.severity_level} onValueChange={(v) => setForm({ ...form, severity_level: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((l) => <SelectItem key={l} value={String(l)}>{SEV_LABEL[l]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Turns</label>
              <Select value={form.turns} onValueChange={(v) => setForm({ ...form, turns: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((t) => <SelectItem key={t} value={String(t)}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Emotional intensity (1–10)</label>
              <Input type="number" min={1} max={10} value={form.emotional_intensity}
                onChange={(e) => setForm({ ...form, emotional_intensity: e.target.value })} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Persona</label>
            <Input value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Scenario (optional)</label>
            <Textarea value={form.scenario} onChange={(e) => setForm({ ...form, scenario: e.target.value })}
              rows={2} className="text-sm" placeholder="e.g. failed a semester exam, parents comparing with cousin" />
          </div>
          <Button onClick={runSimulation} disabled={running} size="sm" className="gap-2">
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
            {running ? "Simulating & scoring…" : "Run simulation"}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Synthetic personas only — no real user conversations are used or exposed.
          </p>

          {result && <SimulationView sim={result} />}
        </TabsContent>

        {/* ----------------------------- HISTORY ----------------------------- */}
        <TabsContent value="history" className="space-y-3 pt-3">
          {sims.length === 0 ? (
            <p className="text-xs text-muted-foreground">No simulations run yet.</p>
          ) : sims.map((s) => (
            <details key={s.id} className="rounded-xl border bg-card/60 p-3">
              <summary className="cursor-pointer text-sm flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${SEV_CLASS[s.severity_level]}`}>{SEV_LABEL[s.severity_level]}</Badge>
                <span className="font-medium">{s.category}</span>
                <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                <span className="ml-auto text-xs font-semibold">{s.overall_score ?? "—"}/100 · {s.verdict ?? "—"}</span>
              </summary>
              <div className="pt-3"><SimulationView sim={s} /></div>
            </details>
          ))}
        </TabsContent>
      </Tabs>
    </Card>
  );
};

const SimulationView = ({ sim }: { sim: Simulation }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-2xl font-semibold">{sim.overall_score ?? "—"}<span className="text-xs text-muted-foreground">/100</span></span>
      <Badge variant="outline" className="capitalize">{String(sim.verdict ?? "—").replace("_", " ")}</Badge>
    </div>
    {sim.notes && <p className="text-xs text-muted-foreground leading-relaxed">{sim.notes}</p>}
    <div className="grid gap-1.5 sm:grid-cols-3">
      {DIMENSIONS.map(([key, label]) => {
        const v = Number(sim.scores?.[key] ?? 0);
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{label}</span><span>{v}/10</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${v >= 8 ? "bg-primary" : v >= 6 ? "bg-amber-500" : "bg-destructive"}`}
                style={{ width: `${Math.max(0, Math.min(10, v)) * 10}%` }} />
            </div>
          </div>
        );
      })}
    </div>
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {(sim.transcript || []).map((m, i) => (
        <div key={i} className={`text-xs rounded-lg p-2 ${m.role === "user" ? "bg-muted" : "bg-primary/5 border border-primary/20"}`}>
          <span className="font-semibold uppercase text-[10px] text-muted-foreground">
            {m.role === "user" ? "Simulated user" : "EmoSense"}
            {m.severity_level ? ` · engine L${m.severity_level}` : ""}
          </span>
          <p className="whitespace-pre-wrap leading-relaxed mt-0.5">{m.content}</p>
        </div>
      ))}
    </div>
  </div>
);
