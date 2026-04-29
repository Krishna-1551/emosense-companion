import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";

type Log = { created_at: string; sentiment_score: number | null; emotion: string; risk_level: string };

export const MoodDashboard = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("mood_logs")
        .select("created_at, sentiment_score, emotion, risk_level")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);
      setLogs(data ?? []);
    };
    load();
    const ch = supabase.channel("mood")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mood_logs", filter: `user_id=eq.${user.id}` },
        (p) => setLogs(prev => [...prev, p.new as Log]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const data = logs.map((l, i) => ({
    i,
    score: Number(l.sentiment_score ?? 0),
    label: new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));

  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.emotion] = (acc[l.emotion] ?? 0) + 1; return acc;
  }, {});
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,4);

  return (
    <div className="space-y-3">
      <Card className="p-4 bg-card/60 backdrop-blur border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium">Mood trend</h3>
        </div>
        <div className="h-32">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[-1, 1]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Start chatting to see your mood trend ✨
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4 bg-card/60 backdrop-blur border-border/50">
        <h3 className="text-sm font-medium mb-3">Recent emotions</h3>
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground">No data yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {top.map(([emo, n]) => (
              <span key={emo} className="px-2.5 py-1 rounded-full bg-secondary text-xs">
                {emo} <span className="text-muted-foreground">· {n}</span>
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
