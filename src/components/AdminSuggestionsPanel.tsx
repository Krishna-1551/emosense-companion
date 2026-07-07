import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, RefreshCw, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Suggestion = {
  title: string;
  detail: string;
  area: "safety" | "reply_quality" | "personalization" | "engagement" | "admin" | "ux";
  priority: "critical" | "high" | "medium" | "low";
  effort: "small" | "medium" | "large";
};

type Payload = {
  generated_at: string;
  health_summary: string;
  top_focus: string;
  suggestions: Suggestion[];
};

const CACHE_KEY = "emosense_admin_suggestions_v1";
const REFRESH_HOURS = 6;

const priorityColor: Record<Suggestion["priority"], string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/40",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  medium: "bg-primary/15 text-primary border-primary/40",
  low: "bg-muted text-muted-foreground border-border",
};

const areaLabel: Record<Suggestion["area"], string> = {
  safety: "Safety",
  reply_quality: "Reply quality",
  personalization: "Personalization",
  engagement: "Engagement",
  admin: "Admin tools",
  ux: "UX",
};

export function AdminSuggestionsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  const load = async (force = false) => {
    if (!force) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Payload;
          const ageHr = (Date.now() - new Date(parsed.generated_at).getTime()) / 3_600_000;
          setData(parsed);
          if (ageHr < REFRESH_HOURS) return;
        } catch { /* ignore */ }
      }
    }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("admin-suggestions", { body: {} });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      setData(res);
      localStorage.setItem(CACHE_KEY, JSON.stringify(res));
    } catch (e: any) {
      toast.error(e.message ?? "Could not load suggestions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(false); }, []);

  const ageLabel = data ? (() => {
    const min = Math.round((Date.now() - new Date(data.generated_at).getTime()) / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.round(hr / 24)}d ago`;
  })() : null;

  const sorted = data?.suggestions
    ? [...data.suggestions].sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      })
    : [];

  return (
    <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">AI Improvement Suggestions</h3>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Sparkles className="w-3 h-3" /> auto-generated
              </Badge>
              {ageLabel && <span className="text-[11px] text-muted-foreground">updated {ageLabel}</span>}
            </div>
            {data?.health_summary && (
              <p className="text-xs text-muted-foreground mt-1">{data.health_summary}</p>
            )}
            {data?.top_focus && (
              <p className="text-xs mt-1"><span className="text-muted-foreground">Top focus:</span> <span className="text-foreground">{data.top_focus}</span></p>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Analyzing…" : "Refresh"}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setExpanded(v => !v)} aria-label="Toggle">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2">
          {!data && loading && (
            <div className="text-xs text-muted-foreground py-4 text-center">Analyzing last 14 days of app metrics…</div>
          )}
          {!data && !loading && (
            <div className="text-xs text-muted-foreground py-4 text-center">No suggestions yet. Click Refresh to generate.</div>
          )}
          {sorted.map((s, i) => {
            const open = expandedItems[i] ?? false;
            return (
              <div key={i} className="rounded-lg border border-border/50 bg-background/40 p-3 hover:bg-background/60 transition">
                <button className="w-full flex items-start gap-3 text-left" onClick={() => setExpandedItems(p => ({ ...p, [i]: !open }))}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-semibold tracking-wide ${priorityColor[s.priority]}`}>{s.priority}</span>
                      <Badge variant="outline" className="text-[10px]">{areaLabel[s.area]}</Badge>
                      <Badge variant="secondary" className="text-[10px]">effort: {s.effort}</Badge>
                    </div>
                    <div className="text-sm font-medium mt-1.5">{s.title}</div>
                    {open && <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{s.detail}</p>}
                  </div>
                  {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
