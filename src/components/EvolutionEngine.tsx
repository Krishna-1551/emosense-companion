import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity, Brain, CheckCircle2, ChevronDown, ChevronUp, History, Lightbulb,
  RefreshCw, Sparkles, TrendingUp, XCircle, Archive, Zap, Radar
} from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";

type Rec = {
  id: string;
  title: string;
  description: string;
  problem: string | null;
  proposed_solution: string | null;
  benefits: string | null;
  implementation_plan: string | null;
  area: string;
  priority: "critical" | "high" | "medium" | "low";
  difficulty: "small" | "medium" | "large";
  risk_level: "low" | "medium" | "high";
  time_estimate: string | null;
  dependencies: string[];
  source: string;
  status: "pending" | "approved" | "rejected" | "archived" | "implemented";
  decision_notes: string | null;
  created_at: string;
  decided_at: string | null;
};

type Health = {
  generated_at: string;
  health_score: number;
  evolution_score: number;
  kpis: any;
  observations: Array<{
    bucket_start: string; active_users: number; message_count: number;
    avg_repetition: number; avg_questions: number; high_risk_count: number; solution_mode_pct: number;
  }>;
};

type Decision = {
  id: string; recommendation_id: string; prior_status: string; new_status: string;
  reason: string | null; created_at: string;
  evolution_recommendations: { title: string } | null;
};

const priColor: Record<Rec["priority"], string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/40",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  medium: "bg-cyan-500/15 text-cyan-400 border-cyan-500/40",
  low: "bg-muted text-muted-foreground border-border",
};

const statusColor: Record<Rec["status"], string> = {
  pending: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  approved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  archived: "bg-muted text-muted-foreground border-border",
  implemented: "bg-primary/15 text-primary border-primary/40",
};

export function EvolutionEngine() {
  const [tab, setTab] = useState<"dashboard" | "recommendations" | "history">("dashboard");
  const [health, setHealth] = useState<Health | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingDetect, setLoadingDetect] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Rec["status"] | "all">("pending");
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);

  const loadHealth = async () => {
    setLoadingHealth(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-health", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHealth(data);
    } catch (e: any) { toast.error(e.message ?? "Health failed"); }
    finally { setLoadingHealth(false); }
  };

  const loadRecs = async () => {
    const { data, error } = await supabase.from("evolution_recommendations")
      .select("*").order("created_at", { ascending: false }).limit(200);
    if (error) { toast.error(error.message); return; }
    setRecs((data as any) || []);
  };

  const loadDecisions = async () => {
    const { data, error } = await supabase.from("evolution_decisions")
      .select("*, evolution_recommendations(title)")
      .order("created_at", { ascending: false }).limit(100);
    if (error) { toast.error(error.message); return; }
    setDecisions((data as any) || []);
  };

  useEffect(() => { loadHealth(); loadRecs(); loadDecisions(); }, []);

  const runDetector = async () => {
    setLoadingDetect(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-detect", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Detected ${data.inserted_count ?? 0} new recommendations`);
      await loadRecs();
      await loadHealth();
    } catch (e: any) { toast.error(e.message ?? "Detector failed"); }
    finally { setLoadingDetect(false); }
  };

  const decide = async (r: Rec, new_status: Rec["status"]) => {
    try {
      const { data, error } = await supabase.functions.invoke("evolution-decide", {
        body: { id: r.id, new_status, reason: notes[r.id] || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${r.title} → ${new_status}`);
      setNotes(n => ({ ...n, [r.id]: "" }));
      await loadRecs();
      await loadDecisions();
      await loadHealth();
    } catch (e: any) { toast.error(e.message ?? "Decision failed"); }
  };

  const filtered = useMemo(() => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as Record<string, number>;
    return recs
      .filter(r => statusFilter === "all" || r.status === statusFilter)
      .sort((a, b) => (order[a.priority] - order[b.priority]) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  }, [recs, statusFilter]);

  const chartData = useMemo(() => (health?.observations || []).map(o => ({
    t: new Date(o.bucket_start).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" }),
    users: o.active_users,
    messages: o.message_count,
    repetition: Number((o.avg_repetition * 100).toFixed(1)),
    questions: Number(o.avg_questions.toFixed(2)),
    risk: o.high_risk_count,
    solution: o.solution_mode_pct,
  })), [health]);

  const kpi = health?.kpis;

  return (
    <Card className="relative overflow-hidden border border-cyan-500/30 bg-gradient-to-br from-background via-background to-cyan-950/20 backdrop-blur-xl">
      {/* neon backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative p-5 border-b border-cyan-500/20 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-primary flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold tracking-tight">EmoSense Evolution Engine</h2>
              <Badge variant="outline" className="text-[10px] gap-1 border-cyan-500/40 text-cyan-300">
                <Sparkles className="w-3 h-3" /> JARVIS mode
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Continuous observation → detection → admin-approved evolution. Nothing ships without your sign-off.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={runDetector} disabled={loadingDetect} className="border-cyan-500/40 hover:bg-cyan-500/10">
            <Radar className={`w-3.5 h-3.5 mr-1.5 ${loadingDetect ? "animate-spin" : ""}`} />
            {loadingDetect ? "Scanning…" : "Run detector"}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setCollapsed(v => !v)} aria-label="Toggle">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {!collapsed && (
      <div className="relative p-5 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-border/40 w-fit">
          {[
            { id: "dashboard", label: "Dashboard", icon: Activity },
            { id: "recommendations", label: "Recommendations", icon: Lightbulb },
            { id: "history", label: "Version History", icon: History },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition ${
                tab === t.id ? "bg-gradient-to-r from-cyan-500/20 to-primary/20 text-foreground border border-cyan-500/30" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NeonStat label="System Health" value={`${health?.health_score ?? "—"}`} suffix="/100" icon={<Activity className="w-4 h-4" />} accent="cyan" />
              <NeonStat label="Evolution Score" value={`${health?.evolution_score ?? "—"}`} suffix="/100" icon={<TrendingUp className="w-4 h-4" />} accent="primary" />
              <NeonStat label="Pending" value={`${kpi?.recommendations?.pending ?? 0}`} icon={<Lightbulb className="w-4 h-4" />} accent="amber" />
              <NeonStat label="Approved" value={`${kpi?.recommendations?.approved ?? 0}`} icon={<CheckCircle2 className="w-4 h-4" />} accent="emerald" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NeonStat label="Active today" value={`${kpi?.active_today ?? 0}`} icon={<Zap className="w-4 h-4" />} accent="cyan" />
              <NeonStat label="High risk today" value={`${kpi?.high_risk_today ?? 0}`} icon={<Activity className="w-4 h-4" />} accent="rose" />
              <NeonStat label="Avg repetition" value={`${((kpi?.avg_repetition ?? 0) * 100).toFixed(1)}%`} icon={<Radar className="w-4 h-4" />} accent="primary" />
              <NeonStat label="Avg questions" value={`${(kpi?.avg_questions ?? 0).toFixed(2)}`} icon={<Sparkles className="w-4 h-4" />} accent="amber" />
            </div>

            <Card className="p-4 bg-background/60 border-cyan-500/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> Live activity (last 7d)</h3>
                <Button size="sm" variant="ghost" onClick={loadHealth} disabled={loadingHealth}>
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="uGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="t" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                    <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="url(#uGrad)" name="Active users" />
                    <Area type="monotone" dataKey="messages" stroke="#22d3ee" fill="url(#mGrad)" name="Messages" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4 bg-background/60 border-cyan-500/20">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Radar className="w-4 h-4 text-primary" /> Reply-quality trend</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis dataKey="t" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="repetition" stroke="#f97316" name="Repetition %" dot={false} />
                    <Line type="monotone" dataKey="questions" stroke="#22d3ee" name="Avg questions" dot={false} />
                    <Line type="monotone" dataKey="solution" stroke="hsl(var(--primary))" name="Solution %" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {tab === "recommendations" && (
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {["pending","approved","rejected","archived","implemented","all"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s as any)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition ${
                    statusFilter === s ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >{s} {s !== "all" && `(${recs.filter(r => r.status === s).length})`}</button>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-border/60 rounded-lg">
                No recommendations in this state yet. Click <b>Run detector</b> to generate some.
              </div>
            )}

            {filtered.map(r => {
              const open = expandedItems[r.id] ?? false;
              return (
                <div key={r.id} className="rounded-lg border border-cyan-500/20 bg-background/40 hover:bg-background/60 transition">
                  <button className="w-full flex items-start gap-3 text-left p-3" onClick={() => setExpandedItems(p => ({ ...p, [r.id]: !open }))}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-semibold ${priColor[r.priority]}`}>{r.priority}</span>
                        <Badge variant="outline" className="text-[10px]">{r.area}</Badge>
                        <Badge variant="secondary" className="text-[10px]">effort: {r.difficulty}</Badge>
                        <Badge variant="outline" className="text-[10px]">risk: {r.risk_level}</Badge>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor[r.status]}`}>{r.status}</span>
                      </div>
                      <div className="text-sm font-medium mt-1.5">{r.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</div>
                    </div>
                    {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                  </button>

                  {open && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
                      {r.problem && <Section title="Problem">{r.problem}</Section>}
                      {r.proposed_solution && <Section title="Proposed solution">{r.proposed_solution}</Section>}
                      {r.benefits && <Section title="Benefits">{r.benefits}</Section>}
                      {r.implementation_plan && <Section title="Implementation plan"><pre className="whitespace-pre-wrap font-sans">{r.implementation_plan}</pre></Section>}
                      {r.time_estimate && <div className="text-xs"><span className="text-muted-foreground">Estimate:</span> {r.time_estimate}</div>}
                      {r.dependencies?.length > 0 && (
                        <div className="text-xs"><span className="text-muted-foreground">Depends on:</span> {r.dependencies.join(", ")}</div>
                      )}
                      {r.decision_notes && (
                        <div className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">Decision note: {r.decision_notes}</div>
                      )}

                      {r.status === "pending" && (
                        <div className="space-y-2 pt-1">
                          <Textarea
                            placeholder="Optional decision note (why approve/reject?)"
                            value={notes[r.id] ?? ""}
                            onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                            className="text-xs min-h-[60px]"
                          />
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" onClick={() => decide(r, "approved")} className="bg-emerald-600 hover:bg-emerald-500">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decide(r, "rejected")} className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10">
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => decide(r, "archived")}>
                              <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                            </Button>
                          </div>
                        </div>
                      )}
                      {r.status === "approved" && (
                        <Button size="sm" variant="outline" onClick={() => decide(r, "implemented")}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark implemented
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            {decisions.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-border/60 rounded-lg">
                No decisions logged yet.
              </div>
            )}
            {decisions.map(d => (
              <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-background/40">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-primary/20 flex items-center justify-center shrink-0">
                  <History className="w-4 h-4 text-cyan-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{d.evolution_recommendations?.title || "(deleted)"}</span>
                    <span className="text-muted-foreground"> · {d.prior_status} → </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColor[d.new_status as Rec["status"]] ?? "border-border"}`}>{d.new_status}</span>
                  </div>
                  {d.reason && <div className="text-xs text-muted-foreground mt-1">{d.reason}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(d.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{title}</div>
      <div className="text-xs text-foreground/90 whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function NeonStat({ label, value, suffix, icon, accent }: { label: string; value: string; suffix?: string; icon: React.ReactNode; accent: "cyan" | "primary" | "emerald" | "amber" | "rose" }) {
  const ring: Record<string, string> = {
    cyan: "border-cyan-500/30 shadow-[0_0_16px_-6px_rgba(34,211,238,0.5)]",
    primary: "border-primary/30 shadow-[0_0_16px_-6px_hsl(var(--primary)/0.5)]",
    emerald: "border-emerald-500/30 shadow-[0_0_16px_-6px_rgba(16,185,129,0.5)]",
    amber: "border-amber-500/30 shadow-[0_0_16px_-6px_rgba(245,158,11,0.5)]",
    rose: "border-rose-500/30 shadow-[0_0_16px_-6px_rgba(244,63,94,0.5)]",
  };
  const text: Record<string, string> = {
    cyan: "text-cyan-300", primary: "text-primary", emerald: "text-emerald-300", amber: "text-amber-300", rose: "text-rose-300",
  };
  return (
    <div className={`rounded-xl border bg-background/60 backdrop-blur p-3 ${ring[accent]}`}>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className={text[accent]}>{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight">
        {value}<span className="text-xs text-muted-foreground">{suffix || ""}</span>
      </div>
    </div>
  );
}
