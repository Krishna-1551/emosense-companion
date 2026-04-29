import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MessageBubble } from "@/components/MessageBubble";
import { PanicButton } from "@/components/PanicButton";
import { TrustedContactDialog } from "@/components/TrustedContactDialog";
import { MoodDashboard } from "@/components/MoodDashboard";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, LogOut } from "lucide-react";
import { toast } from "sonner";

type Msg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  emotion?: string | null;
  risk_level?: string | null;
  created_at?: string;
};

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [contact, setContact] = useState<{ name?: string | null; email?: string | null; phone?: string | null } | null>(null);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("messages")
      .select("id, role, content, emotion, risk_level, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data && data.length) setMessages(data as Msg[]);
        else setMessages([{
          role: "assistant",
          content: "Hi, I'm EmoSense 🌙 A safe space for whatever you're feeling. How are you, really?",
          emotion: "neutral",
        }]);
      });
    refreshContact();
  }, [user]);

  const refreshContact = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles")
      .select("trusted_contact_name, trusted_contact_email, trusted_contact_phone")
      .eq("id", user.id).maybeSingle();
    setContact(data ? {
      name: data.trusted_contact_name, email: data.trusted_contact_email, phone: data.trusted_contact_phone
    } : null);
  };

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Smart check-in on inactivity (5 min)
  useEffect(() => {
    const t = setInterval(() => {
      const idleMin = (Date.now() - lastActivity.getTime()) / 60000;
      if (idleMin > 5 && messages.length > 0 && messages[messages.length - 1].role === "assistant") {
        // Only show one check-in
        const lastIsCheckin = messages[messages.length - 1].content.startsWith("Just checking in");
        if (!lastIsCheckin) {
          setMessages(m => [...m, {
            role: "assistant",
            content: "Just checking in 💙 — how are you holding up right now?",
            emotion: "neutral",
          }]);
          setLastActivity(new Date());
        }
      }
    }, 60_000);
    return () => clearInterval(t);
  }, [lastActivity, messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setLastActivity(new Date());
    const userMsg: Msg = { role: "user", content: text };
    setMessages(m => [...m, userMsg]);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { message: text, history: messages.slice(-10) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // attach emotion to last user msg
      setMessages(m => {
        const copy = [...m];
        const lastUserIdx = copy.map(x => x.role).lastIndexOf("user");
        if (lastUserIdx >= 0) copy[lastUserIdx] = { ...copy[lastUserIdx], emotion: data.emotion, risk_level: data.risk_level };
        copy.push({ role: "assistant", content: data.reply });
        return copy;
      });
      if (data.risk_level === "high") {
        toast.error("We sense you're going through a lot. Please consider the support options.", { duration: 8000 });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
      setMessages(m => [...m, { role: "assistant", content: "I'm having trouble responding right now. Please try again in a moment." }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-80 lg:h-screen lg:sticky lg:top-0 p-4 lg:p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-border/50 bg-card/30 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center pulse-ring">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-none gradient-text">EmoSense AI</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your gentle companion</p>
          </div>
        </div>

        <div className="hidden lg:block">
          <MoodDashboard />
        </div>

        <div className="flex flex-wrap gap-2">
          <TrustedContactDialog onSaved={refreshContact} />
          <PanicButton trustedContact={contact} />
        </div>

        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col h-[calc(100vh-180px)] lg:h-screen">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id ?? i}
                role={m.role}
                content={m.content}
                emotion={m.emotion}
                risk={m.risk_level}
                time={m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined}
              />
            ))}
            {sending && (
              <div className="flex gap-1.5 px-4">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 lg:p-6 border-t border-border/50 bg-card/40 backdrop-blur">
          <div className="max-w-2xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Share what's on your mind…"
              className="flex-1 bg-secondary/60 border border-border/50 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              disabled={sending}
              maxLength={2000}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:scale-105 transition glow"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="max-w-2xl mx-auto mt-2 text-[10px] text-muted-foreground text-center">
            EmoSense offers emotional support — it is not a medical or crisis service.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
