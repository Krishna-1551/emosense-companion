import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SMsg = { id: string; sender_role: "admin" | "user"; sender_id: string; content: string; created_at: string };

type Props = {
  requestId: string;
  selfRole: "admin" | "user";
  selfId: string;
  title?: string;
  onClose?: () => void;
  onEnd?: () => void; // admin can end
};

export const SupportThread = ({ requestId, selfRole, selfId, title, onClose, onEnd }: Props) => {
  const [msgs, setMsgs] = useState<SMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    supabase.from("support_messages")
      .select("id, sender_role, sender_id, content, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (active && data) setMsgs(data as SMsg[]); });

    const ch = supabase.channel(`support-${requestId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `request_id=eq.${requestId}` },
        (payload) => setMsgs(m => [...m, payload.new as SMsg]))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [requestId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      request_id: requestId,
      sender_role: selfRole,
      sender_id: selfId,
      content: text,
    });
    setSending(false);
    if (!error) setInput("");
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur soft-shadow flex flex-col h-[420px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="text-sm font-medium">{title ?? "Support conversation"}</div>
        <div className="flex gap-1">
          {selfRole === "admin" && onEnd && (
            <Button size="sm" variant="ghost" onClick={onEnd} className="text-xs">End</Button>
          )}
          {onClose && <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7"><X className="w-4 h-4" /></Button>}
        </div>
      </div>
      <div ref={scroller} className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Conversation started. Messages here are private between you and the {selfRole === "admin" ? "user" : "admin"}.
          </p>
        ) : msgs.map(m => {
          const mine = m.sender_id === selfId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary/70 rounded-bl-sm"
              )}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                <p className={cn("text-[10px] mt-1", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {m.sender_role === "admin" ? "Admin" : "You"} · {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-2 border-t border-border/50 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type a message…"
          className="flex-1 bg-secondary/60 border border-border/50 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          maxLength={2000}
          disabled={sending}
        />
        <Button size="icon" onClick={send} disabled={sending || !input.trim()} className="rounded-full">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
