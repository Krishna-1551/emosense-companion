import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, MessageSquare, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

interface Props {
  userId: string;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey?: number;
}

function groupConversations(items: Conversation[]) {
  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
  const start7 = new Date(startToday); start7.setDate(start7.getDate() - 7);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 Days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of items) {
    const t = new Date(c.updated_at).getTime();
    if (t >= startToday.getTime()) groups[0].items.push(c);
    else if (t >= startYesterday.getTime()) groups[1].items.push(c);
    else if (t >= start7.getTime()) groups[2].items.push(c);
    else groups[3].items.push(c);
  }
  return groups.filter(g => g.items.length > 0);
}

export function ConversationSidebar({ userId, activeId, onSelect, onNew, refreshKey }: Props) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) toast.error("Could not load chats");
    setItems((data ?? []) as Conversation[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId, refreshKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(c => (c.title ?? "Untitled chat").toLowerCase().includes(q));
  }, [items, query]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  const handleRename = async (id: string) => {
    const title = renameValue.trim() || "Untitled chat";
    const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
    if (error) { toast.error("Rename failed"); return; }
    setItems(prev => prev.map(c => (c.id === id ? { ...c, title } : c)));
    setRenamingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) { toast.error("Delete failed"); return; }
    setItems(prev => prev.filter(c => c.id !== id));
    if (activeId === id) onNew();
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <Button
        onClick={(e) => { e.currentTarget.blur(); onNew(); }}
        onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).blur(); }}
        className="w-full justify-start gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        size="sm"
      >
        <Plus className="w-4 h-4" /> New chat
      </Button>


      <div className="relative">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search chats…"
          className="pl-8 h-9 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 rounded bg-muted/50 animate-pulse" />
            <div className="h-8 rounded bg-muted/50 animate-pulse" />
            <div className="h-8 rounded bg-muted/50 animate-pulse" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            {query ? "No chats match your search." : "No chats yet. Start a new conversation."}
          </div>
        ) : (
          groups.map(g => (
            <div key={g.label}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1.5">{g.label}</div>
              <ul className="space-y-0.5">
                {g.items.map(c => {
                  const active = c.id === activeId;
                  const isRenaming = renamingId === c.id;
                  return (
                    <li key={c.id}>
                      <div
                        className={cn(
                          "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors",
                          active ? "bg-primary/15 text-foreground" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => !isRenaming && onSelect(c.id)}
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        {isRenaming ? (
                          <>
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleRename(c.id);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              onClick={e => e.stopPropagation()}
                              className="flex-1 bg-transparent border-b border-border outline-none text-sm py-0.5"
                            />
                            <button onClick={e => { e.stopPropagation(); handleRename(c.id); }} className="p-1 hover:text-primary"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={e => { e.stopPropagation(); setRenamingId(null); }} className="p-1 hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 truncate">{c.title ?? "New chat"}</span>
                            <button
                              onClick={e => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.title ?? ""); }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-primary"
                              aria-label="Rename"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
