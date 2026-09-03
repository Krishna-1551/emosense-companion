import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeartHandshake, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type EventRow = {
  event_id: string;
  masked_user: string;
  event_name: string;
  support_level: number | null;
  risk_band: string | null;
  human_support_requested: boolean;
  confirmed_safe: boolean | null;
  follow_up_status: string | null;
  created_at: string;
};

type Summary = {
  events_24h: number;
  safety_checks_24h: number;
  urgent_requests_24h: number;
  confirmed_safe_24h: number;
  false_alarms_24h: number;
  follow_ups_pending: number;
};

const LABELS: Record<string, string> = {
  support_plan_offered: "Support plan offered",
  safety_check_displayed: "Safety check shown",
  user_confirmed_safe: "Confirmed safe",
  user_unsure: "Unsure",
  urgent_support_requested: "Urgent support requested",
  trusted_contact_action_selected: "Trusted contact action",
  helpline_action_selected: "Helpline action",
  follow_up_requested: "Follow-up requested",
  false_alarm_reported: "False alarm reported",
};

/**
 * Care Bridge audit feed. Reads only the restricted admin RPCs — no conversation
 * text, no uploads, no safety-plan content, no trusted-contact details.
 */
export const CareBridgeAdminPanel = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [ev, sm] = await Promise.all([
      supabase.rpc("admin_care_bridge_events", { limit_n: 100 }),
      supabase.rpc("admin_care_bridge_summary"),
    ]);
    if (ev.error || sm.error) setError(ev.error?.message ?? sm.error?.message ?? "Could not load Care Bridge events");
    setEvents((ev.data as EventRow[]) ?? []);
    setSummary(((sm.data as Summary[]) ?? [])[0] ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats: [string, number | undefined][] = [
    ["Events 24h", summary?.events_24h],
    ["Safety checks", summary?.safety_checks_24h],
    ["Urgent requests", summary?.urgent_requests_24h],
    ["Confirmed safe", summary?.confirmed_safe_24h],
    ["False alarms", summary?.false_alarms_24h],
    ["Follow-ups pending", summary?.follow_ups_pending],
  ];

  return (
    <Card className="p-4 space-y-4 border-accent/30">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shrink-0">
          <HeartHandshake className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Care Bridge</h2>
          <p className="text-xs text-muted-foreground">Safety workflow audit — masked IDs and workflow status only</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-8 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/50 bg-background/40 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{loading && value === undefined ? "—" : value ?? 0}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!loading && events.length === 0 && !error && (
        <p className="text-xs text-muted-foreground">No Care Bridge events recorded yet.</p>
      )}

      {events.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">User</th>
                <th className="text-left px-3 py-2 font-medium">Event</th>
                <th className="text-left px-3 py-2 font-medium">Level</th>
                <th className="text-left px-3 py-2 font-medium">Risk</th>
                <th className="text-left px-3 py-2 font-medium">Human support</th>
                <th className="text-left px-3 py-2 font-medium">Safe</th>
                <th className="text-left px-3 py-2 font-medium">Follow-up</th>
                <th className="text-left px-3 py-2 font-medium">When</th>
                <th className="text-left px-3 py-2 font-medium">Event ID</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.event_id} className="border-t border-border/40">
                  <td className="px-3 py-2 font-mono text-xs">{e.masked_user}</td>
                  <td className="px-3 py-2 text-xs">{LABELS[e.event_name] ?? e.event_name}</td>
                  <td className="px-3 py-2 text-xs">{e.support_level ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {e.risk_band ? (
                      <Badge variant={e.risk_band === "high" ? "destructive" : "secondary"} className="text-[10px]">{e.risk_band}</Badge>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{e.human_support_requested ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-xs">{e.confirmed_safe === null ? "—" : e.confirmed_safe ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-xs">{e.follow_up_status ?? "—"}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{e.event_id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
