import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, AlertTriangle, Users, MessageSquare, Activity, ArrowLeft, UserPlus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { SupportThread } from "@/components/SupportThread";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend, CartesianGrid,
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
  risk_level: string; emotion: string; flagged_excerpt: string; created_at: string;
  pending_request_id: string | null; active_request_id: string | null;
};

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
  const [openSupport, setOpenSupport] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");

  const loadAll = async () => {
    const [o, e, r, a, u, d, hc] = await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.rpc("admin_emotion_distribution", { days: 7 }),
      supabase.rpc("admin_risk_trend", { days: 14 }),
      supabase.rpc("admin_high_risk_feed", { limit_n: 25 }),
      supabase.rpc("admin_user_list"),
      supabase.rpc("admin_demographics"),
      supabase.rpc("admin_high_risk_cases", { limit_n: 50 }),
    ]);
    setOverview((o.data as any)?.[0] ?? null);
    setEmotions((e.data as EmotionRow[]) ?? []);
    setRisk((r.data as RiskRow[]) ?? []);
    setAlerts((a.data as AlertRow[]) ?? []);
    setUsers((u.data as UserRow[]) ?? []);
    setDemo((d.data as DemoRow[]) ?? []);
    setHighCases((hc.data as HighCase[]) ?? []);
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

  useEffect(() => {
    if (isAdmin) {
      loadAll();
      const ch = supabase
        .channel("admin-mood")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "mood_logs" }, loadAll)
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!selected) { setTimeline([]); return; }
    supabase.rpc("admin_user_timeline", { target: selected.user_id, days: 30 })
      .then(({ data }) => setTimeline((data as TimelineRow[]) ?? []));
  }, [selected]);

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

  const emotionTotal = emotions.reduce((s, e) => s + Number(e.count), 0) || 1;

  return (
    <div className="min-h-screen p-4 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold gradient-text">Administrator Dashboard</h1>
            <p className="text-xs text-muted-foreground">EmoSense AI — analytics & monitoring</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Chat</Button></Link>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={<Users className="w-4 h-4" />} label="Users" value={overview?.total_users ?? 0} />
        <Stat icon={<MessageSquare className="w-4 h-4" />} label="Messages" value={overview?.total_messages ?? 0} />
        <Stat icon={<Activity className="w-4 h-4" />} label="Active 24h" value={overview?.active_today ?? 0} />
        <Stat icon={<AlertTriangle className="w-4 h-4 text-destructive" />} label="High-risk 24h" value={overview?.high_risk_today ?? 0} highlight />
        <Stat icon={<AlertTriangle className="w-4 h-4" />} label="Panic events" value={overview?.total_panic ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Emotion distribution (7 days)</h2>
          {emotions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={emotions}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="emotion" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Risk trend (14 days)</h2>
          {risk.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={risk.map(r => ({ ...r, day: new Date(r.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="low" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="moderate" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="high" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* High-risk alerts */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="text-sm font-semibold">High-risk alerts (latest)</h2>
          <span className="ml-auto text-[10px] text-muted-foreground">live</span>
        </div>
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No high-risk events. 💙</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {alerts.map((a, i) => (
              <button
                key={i}
                onClick={() => setSelected(users.find(u => u.user_id === a.user_id) ?? { user_id: a.user_id, display_name: a.display_name, message_count: 0, last_active: a.created_at, recent_high_risk: 1 })}
                className="w-full text-left flex items-center gap-3 p-2 rounded-lg bg-destructive/5 hover:bg-destructive/10 border border-destructive/20 transition"
              >
                <Badge variant="destructive" className="text-[10px]">HIGH</Badge>
                <span className="text-sm font-medium truncate flex-1">{a.display_name ?? a.user_id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">{a.emotion}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </button>
            ))}
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

        {/* Counts */}
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
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">
              Mood timeline — {selected.display_name ?? selected.user_id.slice(0, 8)} (30 days)
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
          </div>
          {timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">No mood data for this user.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeline.map(t => ({
                  time: new Date(t.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                  score: Number(t.sentiment_score ?? 0),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis domain={[-1, 1]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {timeline.slice(-30).reverse().map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-secondary/60 border border-border/50">
                    {new Date(t.created_at).toLocaleDateString()} · {t.emotion} ·{" "}
                    <span className={t.risk_level === "high" ? "text-destructive font-semibold" : ""}>{t.risk_level}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
};

const Stat = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) => (
  <Card className={`p-4 ${highlight ? "border-destructive/40 bg-destructive/5" : ""}`}>
    <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
    <div className="text-2xl font-semibold mt-1">{value}</div>
  </Card>
);

export default Admin;
