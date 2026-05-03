import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceArea, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Sparkles, AlertTriangle, Heart } from "lucide-react";

type TimelineRow = {
  created_at: string;
  emotion: string;
  sentiment_score: number | null;
  risk_level: string;
};

type Props = {
  userId: string;
  displayName: string;
  onClose: () => void;
};

type Win = "24h" | "7d" | "30d";

const WIN_DAYS: Record<Win, number> = { "24h": 1, "7d": 7, "30d": 30 };

function fmtX(iso: string, win: Win) {
  const d = new Date(iso);
  if (win === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (win === "7d") return d.toLocaleDateString(undefined, { weekday: "short", hour: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const AdminMoodTimeline = ({ userId, displayName, onClose }: Props) => {
  const [win, setWin] = useState<Win>("7d");
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase.rpc("admin_user_timeline", { target: userId, days: WIN_DAYS[win] })
      .then(({ data }) => {
        setRows((data as TimelineRow[]) ?? []);
        setLoading(false);
      });
  }, [userId, win]);

  const chartData = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    // moving average (window 3)
    const scores = sorted.map(r => Number(r.sentiment_score ?? 0));
    const ma = scores.map((_, i) => {
      const slice = scores.slice(Math.max(0, i - 2), i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
    return sorted.map((r, i) => {
      const score = Number(r.sentiment_score ?? 0);
      const prev = i > 0 ? Number(sorted[i - 1].sentiment_score ?? 0) : score;
      const drop = prev - score;
      const isHigh = r.risk_level === "high";
      const isSpike = drop >= 0.4;
      const isRecovery = i > 0 && score - prev >= 0.4;
      return {
        idx: i,
        ts: r.created_at,
        label: fmtX(r.created_at, win),
        score,
        trend: Number(ma[i].toFixed(3)),
        emotion: r.emotion,
        risk: r.risk_level,
        high: isHigh ? score : null,
        spike: !isHigh && isSpike ? score : null,
        recovery: isRecovery ? score : null,
      };
    });
  }, [rows, win]);

  // dedupe x-axis labels
  const xTicks = useMemo(() => {
    const seen = new Set<string>();
    const ticks: number[] = [];
    chartData.forEach(d => {
      if (!seen.has(d.label)) {
        seen.add(d.label);
        ticks.push(d.idx);
      }
    });
    // limit to ~8
    const step = Math.max(1, Math.ceil(ticks.length / 8));
    return ticks.filter((_, i) => i % step === 0);
  }, [chartData]);

  const insight = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData.slice(0, Math.ceil(chartData.length / 2));
    const second = chartData.slice(Math.ceil(chartData.length / 2));
    const avg = (a: typeof chartData) => a.reduce((s, x) => s + x.score, 0) / a.length;
    const firstAvg = avg(first), secondAvg = avg(second);
    const delta = secondAvg - firstAvg;
    let trend: "improving" | "worsening" | "stable" = "stable";
    if (delta > 0.1) trend = "improving";
    else if (delta < -0.1) trend = "worsening";

    const peak = chartData.reduce((min, x) => (x.score < min.score ? x : min), chartData[0]);
    const current = chartData[chartData.length - 1];
    const currentState =
      current.score >= 0.2 ? "Positive" : current.score <= -0.2 ? "Negative" : "Neutral";

    // risk score 0-100 (higher = more risk)
    const highCount = chartData.filter(d => d.risk === "high").length;
    const negRatio = chartData.filter(d => d.score < -0.2).length / chartData.length;
    const avgScore = avg(chartData);
    let riskScore = Math.round(
      35 * (1 - (avgScore + 1) / 2) + // negative bias
      40 * negRatio +
      25 * Math.min(1, highCount / 3)
    );
    riskScore = Math.max(0, Math.min(100, riskScore));

    return { trend, delta, peak, current, currentState, riskScore };
  }, [chartData]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Mood timeline — {displayName}</h2>
          <Badge variant="outline" className="text-[10px]">Admin analytics</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            {(["24h", "7d", "30d"] as Win[]).map(w => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  win === w ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>

      {/* Insight summary */}
      {insight && (
        <div className="mb-3 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">Insight summary</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Trend</p>
              <p className="font-medium flex items-center gap-1">
                {insight.trend === "improving" && <TrendingUp className="w-3 h-3 text-primary" />}
                {insight.trend === "worsening" && <TrendingDown className="w-3 h-3 text-destructive" />}
                {insight.trend === "stable" && <Activity className="w-3 h-3 text-muted-foreground" />}
                <span className="capitalize">{insight.trend}</span>
                <span className="text-muted-foreground">
                  ({insight.delta > 0 ? "+" : ""}{insight.delta.toFixed(2)})
                </span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Peak stress</p>
              <p className="font-medium">{fmtX(insight.peak.ts, win)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Current state</p>
              <p className={`font-medium ${
                insight.currentState === "Positive" ? "text-primary" :
                insight.currentState === "Negative" ? "text-destructive" : "text-muted-foreground"
              }`}>
                {insight.currentState}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Risk score</p>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${
                  insight.riskScore >= 70 ? "text-destructive" :
                  insight.riskScore >= 40 ? "text-accent-foreground" : "text-primary"
                }`}>{insight.riskScore}/100</span>
                <div className="flex-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                  <div
                    className={`h-full ${
                      insight.riskScore >= 70 ? "bg-destructive" :
                      insight.riskScore >= 40 ? "bg-accent" : "bg-primary"
                    }`}
                    style={{ width: `${insight.riskScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Loading…</p>
      ) : chartData.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">No mood data in this window.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              {/* mood zones */}
              <ReferenceArea y1={0.2} y2={1} fill="hsl(var(--primary))" fillOpacity={0.08} />
              <ReferenceArea y1={-0.2} y2={0.2} fill="hsl(var(--muted-foreground))" fillOpacity={0.06} />
              <ReferenceArea y1={-1} y2={-0.2} fill="hsl(var(--destructive))" fillOpacity={0.08} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 4" />

              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="idx"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={xTicks}
                tickFormatter={(i) => chartData[i]?.label ?? ""}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <YAxis domain={[-1, 1]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(i) => {
                  const d = chartData[i as number];
                  return d ? new Date(d.ts).toLocaleString() : "";
                }}
                formatter={(value: any, name: string, item: any) => {
                  if (name === "score") {
                    const p = item.payload;
                    return [`${Number(value).toFixed(2)} · ${p.emotion} · ${p.risk}`, "Sentiment"];
                  }
                  if (name === "trend") return [Number(value).toFixed(2), "Trend (MA)"];
                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="trend"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
              <Scatter dataKey="high" fill="hsl(var(--destructive))" shape="triangle" />
              <Scatter dataKey="spike" fill="hsl(var(--destructive))" shape="cross" />
              <Scatter dataKey="recovery" fill="hsl(var(--primary))" shape="star" />
            </ComposedChart>
          </ResponsiveContainer>

          {/* legend */}
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary/30 border border-primary/40" /> Positive zone
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/20 border border-border" /> Neutral zone
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-destructive/30 border border-destructive/40" /> Negative zone
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-destructive" /> High-risk
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-destructive font-bold">✕</span> Stress spike
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-primary">★</span> Recovery
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-4 h-0.5 bg-accent" style={{ borderTop: "1px dashed" }} /> Trend (MA-3)
            </span>
            <span className="inline-flex items-center gap-1 ml-auto">
              <Heart className="w-3 h-3" /> Hover points for emotion & risk
            </span>
          </div>
        </>
      )}
    </Card>
  );
};
