import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, AlertTriangle, Users, MessageSquare, Activity, ArrowLeft,
  UserPlus, MessageCircle, Lock, TrendingUp, TrendingDown, Sparkles,
  CheckCircle2, MailCheck, Clock, Bell, X
} from "lucide-react";
import { toast } from "sonner";
import { SupportThread } from "@/components/SupportThread";
import { AdminMoodTimeline } from "@/components/AdminMoodTimeline";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend, CartesianGrid, ReferenceDot,
} from "recharts";

type Overview = { total_users: number; total_messages: number; total_panic: number; high_risk_today: number; active_today: number };
type EmotionRow = { emotion: string; count: number };
type RiskRow = { day: string; low: number; moderate: number; high: number };
type AlertRow = { user_id: string; display_name: string | null; emotion: string; sentiment_score: number | null; created_at: string };
type UserRow = { user_id: string; display_name: string | null; message_count: number; last_active: string | null; recent_high_risk: number };
type TimelineRow = { created_at: string; emotion: string; sentiment_score: number | null; risk_level: string };
type DemoRow = { user_id: string; display_name: string | null; age: number | null; gender: string | null; profession: string | null; profile_completed_at: string | null; created_at: string };
type HighCase = {
  message_id: string; user_id: string; display_name: string | null;
  age: number | null; gender: string | null; profession: string | null;
  risk_level: string; emotion: string; sentiment_score: number | null;
  flagged_excerpt: string; created_at: string;
  pending_request_id: string | null; active_request_id: string | null;
  follow_up_sent_at: string | null; resolved_at: string | null;
  user_last_message_at: string | null; user_message_count_24h: number;
};
type EmotionInsight = { emotion: string; this_week: number; last_week: number; pct_change: number };
type BehaviorFlag = { user_id: string; display_name: string | null; flag: string; detail: string; last_active: string | null };

// ---------- helpers ----------
const NEG_KEYWORDS = ["panic","overwhelmed","hopeless","worthless","suicid","self-harm","selfharm","kill myself","end it","can't go on","cant go on","numb","empty","alone","scared","terrified","exhausted","tired of"];

function severityScore(c: HighCase): number {
  let score = 60; // baseline for high-risk
  // sentiment contribution (more negative = higher)
  if (c.sentiment_score != null) score += Math.round((1 - Number(c.sentiment_score)) * 15); // -1..1 -> +0..30
  // keyword density
  const text = (c.flagged_excerpt || "").toLowerCase();
  const hits = NEG_KEYWORDS.reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0);
  score += Math.min(hits * 6, 24);
  // recency
  const mins = (Date.now() - new Date(c.created_at).getTime()) / 60000;
  if (mins < 15) score += 8;
  else if (mins < 60) score += 4;
  // resolved/follow-up reduces
  if (c.follow_up_sent_at) score -= 10;
  if (c.resolved_at) score -= 40;
  return Math.max(0, Math.min(100, score));
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const Admin = () => {
  const { user, loading, isAdmin, signOut } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [emotions, setEmotions] = useState<EmotionRow[]>([]);
  const [risk, setRisk] = useState<RiskRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [demo, setDemo] = useState<DemoRow[]>([]);
  const [highCases, setHighCases] = useState<HighCase[]>([]);
  const [insights, setInsights] = useState<EmotionInsight[]>([]);
  const [behavior, setBehavior] = useState<BehaviorFlag[]>([]);
  const [openSupport, setOpenSupport] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [showOnlyOpen, setShowOnlyOpen] = useState(true);
  const [smartAlert, setSmartAlert] = useState<{ id: string; excerpt: string } | null>(null);
  const [, forceTick] = useState(0);

  // periodic re-render so "time ago" updates
  useEffect(() => { const t = setInterval(() => forceTick(x => x + 1), 30000); return () => clearInterval(t); }, []);

  const loadAll = async () => {
    const [o, e, r, a, u, d, hc, ei, bf] = await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.rpc("admin_emotion_distribution", { days: 7 }),
      supabase.rpc("admin_risk_trend", { days: 14 }),
      supabase.rpc("admin_high_risk_feed", { limit_n: 25 }),
      supabase.rpc("admin_user_list"),
      supabase.rpc("admin_demographics"),
      supabase.rpc("admin_high_risk_cases", { limit_n: 50 }),
      supabase.rpc("admin_emotion_insights"),
      supabase.rpc("admin_behavior_flags"),
    ]);
    setOverview((o.data as any)?.[0] ?? null);
    setEmotions((e.data as EmotionRow[]) ?? []);
    setRisk((r.data as RiskRow[]) ?? []);
    setAlerts((a.data as AlertRow[]) ?? []);
    setUsers((u.data as UserRow[]) ?? []);
    setDemo((d.data as DemoRow[]) ?? []);
    setHighCases((hc.data as HighCase[]) ?? []);
    setInsights((ei.data as EmotionInsight[]) ?? []);
    setBehavior((bf.data as BehaviorFlag[]) ?? []);
  };

  const requestConnect = async (messageId: string) => {
    const { data, error } = await supabase.rpc("admin_request_connect", { _message_id: messageId });
    if (error) { toast.error(error.message); return; }
    toast.success("Request sent. The user will be asked to consent.");
    if (typeof data === "string") loadAll();
  };

  const endConnect = async (requestId: string) => {
    await supabase.from("connect_requests").update({ status: "ended" }).eq("id", requestId);
    setOpenSupport(null);
    loadAll();
  };

  const markCase = async (messageId: string, action: "follow_up" | "resolved" | "reopen") => {
    const { error } = await supabase.rpc("admin_mark_case", { _message_id: messageId, _action: action });
    if (error) { toast.error(error.message); return; }
    toast.success(action === "resolved" ? "Marked as resolved" : action === "reopen" ? "Case reopened" : "Follow-up logged");
    loadAll();
  };

  useEffect(() => {
    if (isAdmin) {
      loadAll();
      const ch = supabase
        .channel("admin-mood")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "mood_logs" }, loadAll)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "risk_level=eq.high" },
          (payload) => {
            loadAll();
            const row: any = payload.new;
            setSmartAlert({ id: row.id, excerpt: String(row.content || "").slice(0, 120) });
            toast.warning("⚠ New high-risk message detected", { duration: 6000 });
          })
        .on("postgres_changes", { event: "*", schema: "public", table: "connect_requests" }, loadAll)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, loadAll)
        .subscribe();
      const refresh = setInterval(() => { loadAll(); }, 15000);
      const onVis = () => { if (document.visibilityState === "visible") loadAll(); };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        supabase.removeChannel(ch);
        clearInterval(refresh);
        document.removeEventListener("visibilitychange", onVis);
      };
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!selected) { setTimeline([]); return; }
    supabase.rpc("admin_user_timeline", { target: selected.user_id, days: 30 })
      .then(({ data }) => setTimeline((data as TimelineRow[]) ?? []));
  }, [selected]);

  // ---------- derived insights ----------
  const dominantEmotion = useMemo(() => emotions[0]?.emotion ?? null, [emotions]);
  const totalEmotions = useMemo(() => emotions.reduce((s, e) => s + Number(e.count), 0), [emotions]);

  const riskInsight = useMemo(() => {
    if (risk.length < 3) return null;
    const recent = risk.slice(-3);
    const prev = risk.slice(-6, -3);
    const sum = (rs: RiskRow[], k: keyof RiskRow) => rs.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    const modNow = sum(recent, "moderate"), modPrev = sum(prev, "moderate");
    const highNow = sum(recent, "high"), highPrev = sum(prev, "high");
    if (highNow > highPrev && highNow > 0) return { tone: "danger" as const, text: `High-risk rising (${highPrev}→${highNow})` };
    if (modNow > modPrev && modNow > 0) return { tone: "warn" as const, text: `Moderate risk rising (${modPrev}→${modNow})` };
    if (highNow + modNow < highPrev + modPrev) return { tone: "good" as const, text: "Risk levels easing this week" };
    return { tone: "neutral" as const, text: "Risk levels stable" };
  }, [risk]);

  const peakRiskDay = useMemo(() => {
    if (!risk.length) return null;
    return risk.reduce((max, r) => (Number(r.high) + Number(r.moderate) > Number(max.high) + Number(max.moderate) ? r : max));
  }, [risk]);

  const aiSummary = useMemo(() => {
    const parts: string[] = [];
    if (dominantEmotion && totalEmotions > 0) {
      const top = emotions[0];
      const pct = Math.round((Number(top.count) / totalEmotions) * 100);
      parts.push(`${dominantEmotion} dominates the past week (${pct}% of logged moods).`);
    }
    const risingNeg = insights.find(i => ["sad","anxious","angry","stressed"].includes((i.emotion||"").toLowerCase()) && i.pct_change >= 25);
    if (risingNeg) parts.push(`${risingNeg.emotion} is up ${risingNeg.pct_change}% vs last week.`);
    if (riskInsight && riskInsight.tone !== "neutral") parts.push(riskInsight.text + ".");
    const open = highCases.filter(c => !c.resolved_at).length;
    if (open > 0) parts.push(`${open} high-risk case${open === 1 ? "" : "s"} awaiting follow-up.`);
    else parts.push("No critical cases detected. 💙");
    return parts.join(" ");
  }, [dominantEmotion, emotions, totalEmotions, insights, riskInsight, highCases]);

  const visibleCases = useMemo(
    () => (showOnlyOpen ? highCases.filter(c => !c.resolved_at) : highCases),
    [highCases, showOnlyOpen]
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center space-y-3">
          <Shield className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="text-sm text-muted-foreground">This area is restricted to administrators of EmoSense AI.</p>
          <Link to="/"><Button variant="outline">Back to chat</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold gradient-text">Administrator Dashboard</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>EmoSense AI — analytics & monitoring</span>
              <Badge variant="outline" className="text-[10px] gap-1"><Lock className="w-3 h-3" /> Privacy-first</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Chat</Button></Link>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>

      {/* Smart alert banner */}
      {smartAlert && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex items-center gap-3 animate-in slide-in-from-top-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
          <Bell className="w-4 h-4 text-destructive" />
          <div className="flex-1 text-sm">
            <span className="font-medium">New high-risk message just now.</span>
            <span className="text-muted-foreground ml-2">"{smartAlert.excerpt}…"</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSmartAlert(null)}><X className="w-4 h-4" /></Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={<Users className="w-4 h-4" />} label="Users" value={overview?.total_users ?? 0} />
        <Stat icon={<MessageSquare className="w-4 h-4" />} label="Messages" value={overview?.total_messages ?? 0} />
        <Stat icon={<Activity className="w-4 h-4" />} label="Active 24h" value={overview?.active_today ?? 0} />
        <Stat
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          label="High-risk 24h"
          value={overview?.high_risk_today ?? 0}
          highlight
          emptyText="No critical cases detected"
        />
        <Stat
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Panic events"
          value={overview?.total_panic ?? 0}
          emptyText="No panic events"
        />
      </div>

      {/* AI Insight box */}
      <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">AI Insight</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{aiSummary}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Emotion distribution + insights */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Emotion distribution (7 days)</h2>
            {dominantEmotion && (
              <Badge variant="default" className="text-[10px]">Dominant: {dominantEmotion}</Badge>
            )}
          </div>
          {emotions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No emotion data this week.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={emotions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="emotion" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {insights.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {insights.slice(0, 6).map(i => {
                    const up = i.pct_change > 0;
                    const flat = i.pct_change === 0;
                    return (
                      <Badge key={i.emotion} variant="outline" className="text-[10px] gap-1">
                        {flat ? null : up ? <TrendingUp className="w-3 h-3 text-destructive" /> : <TrendingDown className="w-3 h-3 text-primary" />}
                        {i.emotion} {flat ? "—" : `${up ? "+" : ""}${i.pct_change}%`}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Risk trend + peak + insight */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Risk trend (14 days)</h2>
            {riskInsight && (
              <Badge
                variant={riskInsight.tone === "danger" ? "destructive" : riskInsight.tone === "good" ? "default" : "secondary"}
                className="text-[10px]"
              >
                {riskInsight.text}
              </Badge>
            )}
          </div>
          {risk.length === 0 ? (
            <p className="text-xs text-muted-foreground">No risk data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={risk.map(r => ({ ...r, dayLabel: new Date(r.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dayLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="low" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="moderate" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="high" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                {peakRiskDay && (
                  <ReferenceDot
                    x={new Date(peakRiskDay.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    y={Number(peakRiskDay.high) + Number(peakRiskDay.moderate)}
                    r={5} fill="hsl(var(--destructive))" stroke="hsl(var(--background))" strokeWidth={2}
                    label={{ value: "peak", position: "top", fontSize: 10, fill: "hsl(var(--destructive))" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ⚠ High Priority Cases — privacy-safe */}
      <Card className="p-4 border-destructive/30">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="text-sm font-semibold">⚠ High Priority Cases</h2>
          <Badge variant="outline" className="text-[10px] gap-1"><Lock className="w-3 h-3" /> No full chat shown</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant={showOnlyOpen ? "default" : "outline"}
              onClick={() => setShowOnlyOpen(v => !v)}
              className="text-xs h-7"
            >
              {showOnlyOpen ? "Showing open" : "Showing all"}
            </Button>
            <span className="text-[10px] text-muted-foreground">live</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Only the flagged message and basic profile are shown. Direct chat requires the user's explicit consent.
        </p>
        {visibleCases.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-primary/70" />
            No critical cases detected. 💙
          </div>
        ) : (
          <div className="space-y-3">
            {visibleCases.map(c => {
              const requested = !!c.pending_request_id;
              const accepted = !!c.active_request_id;
              const sev = severityScore(c);
              const sevColor = sev >= 80 ? "destructive" : sev >= 60 ? "destructive" : "secondary";
              const isFresh = !c.resolved_at && (Date.now() - new Date(c.created_at).getTime()) < 60 * 60 * 1000;
              const droppedOff = !c.resolved_at && c.user_message_count_24h === 0
                && c.user_last_message_at && (Date.now() - new Date(c.user_last_message_at).getTime()) > 6 * 60 * 60 * 1000;
              return (
                <div
                  key={c.message_id}
                  className={`relative rounded-lg border p-3 space-y-2 ${
                    c.resolved_at ? "border-border/50 bg-muted/30 opacity-80"
                    : isFresh ? "border-destructive/40 bg-destructive/10"
                    : "border-destructive/20 bg-destructive/5"
                  }`}
                >
                  {isFresh && !c.resolved_at && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                    </span>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="destructive" className="text-[10px]">HIGH RISK</Badge>
                    <Badge variant={sevColor as any} className="text-[10px]">Severity {sev}/100</Badge>
                    <span className="text-xs text-muted-foreground">{c.emotion}</span>
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {timeAgo(c.created_at)}
                    </span>
                    {c.follow_up_sent_at && (
                      <Badge variant="outline" className="text-[10px] gap-1"><MailCheck className="w-3 h-3" /> Follow-up sent</Badge>
                    )}
                    {c.resolved_at && (
                      <Badge variant="default" className="text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" /> Resolved</Badge>
                    )}
                    {droppedOff && (
                      <Badge variant="destructive" className="text-[10px]">Drop-off after stress</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Severity bar */}
                  <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${sev >= 80 ? "bg-destructive" : sev >= 60 ? "bg-destructive/80" : "bg-accent"}`}
                      style={{ width: `${sev}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {c.age != null && <Badge variant="secondary">Age {c.age}</Badge>}
                    {c.gender && <Badge variant="secondary">{c.gender}</Badge>}
                    {c.profession && <Badge variant="secondary">{c.profession}</Badge>}
                    <Badge variant="outline" className="font-mono">user · {c.user_id.slice(0, 8)}</Badge>
                  </div>

                  <blockquote className="text-sm bg-background/60 border-l-2 border-destructive/60 pl-3 py-1.5 rounded">
                    "{c.flagged_excerpt}"
                  </blockquote>

                  <div className="flex gap-2 flex-wrap">
                    {accepted ? (
                      <Button size="sm" variant="default" onClick={() => setOpenSupport(openSupport === c.active_request_id ? null : c.active_request_id!)}>
                        <MessageCircle className="w-3.5 h-3.5 mr-1" />
                        {openSupport === c.active_request_id ? "Hide chat" : "Open private chat"}
                      </Button>
                    ) : requested ? (
                      <Button size="sm" variant="outline" disabled>
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Awaiting user consent…
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => requestConnect(c.message_id)}>
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Request to Connect
                      </Button>
                    )}

                    {!c.resolved_at && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => markCase(c.message_id, "follow_up")}>
                          <MailCheck className="w-3.5 h-3.5 mr-1" />
                          {c.follow_up_sent_at ? "Re-log follow-up" : "Mark follow-up sent"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => markCase(c.message_id, "resolved")}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark resolved
                        </Button>
                      </>
                    )}
                    {c.resolved_at && (
                      <Button size="sm" variant="ghost" onClick={() => markCase(c.message_id, "reopen")}>
                        Reopen
                      </Button>
                    )}
                  </div>

                  {accepted && openSupport === c.active_request_id && user && (
                    <SupportThread
                      requestId={c.active_request_id!}
                      selfRole="admin"
                      selfId={user.id}
                      title={`Support · ${c.display_name ?? c.user_id.slice(0,8)}`}
                      onClose={() => setOpenSupport(null)}
                      onEnd={() => endConnect(c.active_request_id!)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Behavior flags */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4" />
          <h2 className="text-sm font-semibold">Behavior flags</h2>
          <Badge variant="outline" className="text-[10px] ml-auto">{behavior.length} flagged</Badge>
        </div>
        {behavior.length === 0 ? (
          <p className="text-xs text-muted-foreground">No behavior anomalies detected. 💙</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {behavior.map((b, i) => {
              const meta: Record<string, { label: string; variant: "default"|"secondary"|"destructive"|"outline" }> = {
                drop_off_after_stress: { label: "Drop-off after stress", variant: "destructive" },
                sudden_drop: { label: "Sudden mood drop", variant: "destructive" },
                low_activity: { label: "Low activity", variant: "secondary" },
                irregular: { label: "Irregular usage", variant: "outline" },
              };
              const m = meta[b.flag] ?? { label: b.flag, variant: "secondary" as const };
              return (
                <div key={i} className="rounded-lg border border-border/50 p-2.5 flex items-center gap-2">
                  <Badge variant={m.variant} className="text-[10px] shrink-0">{m.label}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{b.display_name ?? b.user_id.slice(0,8)}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{b.detail}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(b.last_active)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Users list */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Users ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Messages</th>
                <th className="py-2 pr-3">Last active</th>
                <th className="py-2 pr-3">High-risk (7d)</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-b border-border/30 hover:bg-secondary/30">
                  <td className="py-2 pr-3">{u.display_name ?? u.user_id.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{u.message_count}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {u.last_active ? new Date(u.last_active).toLocaleString() : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {u.recent_high_risk > 0
                      ? <Badge variant="destructive" className="text-[10px]">{u.recent_high_risk}</Badge>
                      : <span className="text-xs text-muted-foreground">0</span>}
                  </td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(u)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Demographics */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-sm font-semibold">User demographics ({demo.filter(d => d.profile_completed_at).length} completed)</h2>
          <div className="flex gap-2">
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {["Student","Working Professional","Homemaker","Freelancer","Unemployed","Retired","Other"].map(r =>
                  <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterGender} onValueChange={setFilterGender}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genders</SelectItem>
                {["Male","Female","Prefer not to say","Other"].map(g =>
                  <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(() => {
          const filtered = demo.filter(d =>
            (filterRole === "all" || d.profession === filterRole) &&
            (filterGender === "all" || d.gender === filterGender)
          );
          const byRole: Record<string, number> = {};
          const byGender: Record<string, number> = {};
          filtered.forEach(d => {
            if (d.profession) byRole[d.profession] = (byRole[d.profession] ?? 0) + 1;
            if (d.gender) byGender[d.gender] = (byGender[d.gender] ?? 0) + 1;
          });
          return (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground mb-2">By role</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(byRole).length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                      Object.entries(byRole).map(([k,v]) => (
                        <Badge key={k} variant="secondary" className="text-[10px]">{k}: {v}</Badge>
                      ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground mb-2">By gender</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(byGender).length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                      Object.entries(byGender).map(([k,v]) => (
                        <Badge key={k} variant="secondary" className="text-[10px]">{k}: {v}</Badge>
                      ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Age</th>
                      <th className="py-2 pr-3">Gender</th>
                      <th className="py-2 pr-3">Role</th>
                      <th className="py-2 pr-3">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">No matching users.</td></tr>
                    ) : filtered.map(d => (
                      <tr key={d.user_id} className="border-b border-border/30 hover:bg-secondary/30">
                        <td className="py-2 pr-3">{d.display_name ?? d.user_id.slice(0, 8)}</td>
                        <td className="py-2 pr-3">{d.age ?? "—"}</td>
                        <td className="py-2 pr-3">{d.gender ?? "—"}</td>
                        <td className="py-2 pr-3">{d.profession ?? "—"}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {d.profile_completed_at ? new Date(d.profile_completed_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </Card>

      {selected && (
        <AdminMoodTimeline
          userId={selected.user_id}
          displayName={selected.display_name ?? selected.user_id.slice(0, 8)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

const Stat = ({ icon, label, value, highlight, emptyText }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean; emptyText?: string }) => (
  <Card className={`p-4 ${highlight ? "border-destructive/40 bg-destructive/5" : ""}`}>
    <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
    {value === 0 && emptyText ? (
      <div className="text-sm font-medium mt-1 text-muted-foreground">{emptyText}</div>
    ) : (
      <div className="text-2xl font-semibold mt-1">{value}</div>
    )}
  </Card>
);

export default Admin;
