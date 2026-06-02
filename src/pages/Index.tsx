import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MessageBubble } from "@/components/MessageBubble";
import { PanicButton } from "@/components/PanicButton";
import { TrustedContactDialog } from "@/components/TrustedContactDialog";
import { MoodDashboard } from "@/components/MoodDashboard";
import { OnboardingForm } from "@/components/OnboardingForm";
import { EmotionMeter, PrivacyBadge, InsightBubble, deriveMeter, useDismissible } from "@/components/EngagementExtras";
import { ConnectInbox } from "@/components/ConnectInbox";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, LogOut, Shield, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "react-router-dom";
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
  const { user, loading, isAdmin, signOut } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [contact, setContact] = useState<{ name?: string | null; email?: string | null; phone?: string | null } | null>(null);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const insight = useDismissible("emosense_insight_dismissed");
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
      .select("trusted_contact_name, trusted_contact_email, trusted_contact_phone, profile_completed_at")
      .eq("id", user.id).maybeSingle();
    setContact(data ? {
      name: data.trusted_contact_name, email: data.trusted_contact_email, phone: data.trusted_contact_phone
    } : null);
    const localDone = user && localStorage.getItem(`emosense_onboarded_${user.id}`) === "1";
    const done = !!data?.profile_completed_at || !!localDone;
    setNeedsOnboarding(!done);
    setProfileChecked(true);
  };

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Smart, behavior-aware check-in
  // Signals used to choose timing AND tone:
  //   1. Recent risk/emotion (high risk → faster check-in)
  //   2. Response delay trend — current idle vs user's typical reply gap
  //   3. Interaction frequency — frequent chatters get longer waits, infrequent users get earlier nudges
  //   4. Message length drop — shorter-than-baseline replies trigger an earlier, softer check-in
  useEffect(() => {
    const pickCheckIn = () => {
      const userMsgs = messages.filter(m => m.role === "user");
      const recentUser = userMsgs.slice(-5);
      const emotions = recentUser.map(m => (m.emotion ?? "").toLowerCase());
      const risks = recentUser.map(m => (m.risk_level ?? "").toLowerCase());

      // --- Behavioral signals ---
      // Baseline reply gap (median of last 6 gaps) and current idle
      const timed = userMsgs.filter(m => m.created_at).slice(-7);
      const gaps: number[] = [];
      for (let i = 1; i < timed.length; i++) {
        gaps.push((new Date(timed[i].created_at!).getTime() - new Date(timed[i - 1].created_at!).getTime()) / 60000);
      }
      const sorted = [...gaps].sort((a, b) => a - b);
      const medianGap = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;

      // Interaction frequency: messages in last 24h
      const dayAgo = Date.now() - 24 * 3600_000;
      const freq24h = userMsgs.filter(m => m.created_at && new Date(m.created_at).getTime() > dayAgo).length;

      // Message length drop: current avg vs prior baseline
      const lens = recentUser.map(m => m.content.length);
      const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
      const baselineLens = userMsgs.slice(-15, -5).map(m => m.content.length);
      const baselineAvgLen = baselineLens.length ? baselineLens.reduce((a, b) => a + b, 0) / baselineLens.length : avgLen;
      const lengthDropped = baselineAvgLen > 30 && avgLen < baselineAvgLen * 0.5;

      const hasHigh = risks.includes("high");
      const hasModerate = risks.includes("moderate");
      const dominant = emotions.filter(Boolean).reduce<Record<string, number>>(
        (acc, e) => ({ ...acc, [e]: (acc[e] ?? 0) + 1 }), {}
      );
      const top = Object.entries(dominant).sort((a, b) => b[1] - a[1])[0]?.[0];
      const negative = ["sadness", "anxiety", "stress", "fear", "loneliness", "anger"].includes(top ?? "");

      // --- Choose threshold (minutes of inactivity) ---
      // Start from user's typical gap (or 6 min default)
      let thresholdMin = medianGap ? Math.max(2, Math.min(15, medianGap * 1.5)) : 6;

      // Emotion/risk modifiers (override toward shorter)
      if (hasHigh) thresholdMin = Math.min(thresholdMin, 2);
      else if (hasModerate || negative) thresholdMin = Math.min(thresholdMin, 4);
      else if (top === "joy") thresholdMin = Math.max(thresholdMin, 10);

      // Frequency modifier
      if (freq24h >= 20) thresholdMin = Math.min(15, thresholdMin * 1.3); // chatty → wait longer
      else if (freq24h > 0 && freq24h <= 3) thresholdMin = Math.max(2, thresholdMin * 0.7); // infrequent → nudge earlier

      // Length-drop modifier (withdrawal signal)
      if (lengthDropped) thresholdMin = Math.max(2, thresholdMin * 0.6);

      // --- Pick tone ---
      let content = "Just checking in 💙 — how are you holding up right now?";
      let emotion = "neutral";
      if (hasHigh) {
        content = "I'm still here with you 💙. You're not alone in this moment — would it help to talk, even just a little?";
        emotion = "stress";
      } else if (lengthDropped && negative) {
        content = "I notice you've been quieter than usual 🌿. No need for big words — even one feeling is enough.";
        emotion = top ?? "neutral";
      } else if (top === "sadness") {
        content = "Thinking of you 🌙. Whatever's weighing on your heart, I'm here to listen — no pressure to be okay.";
        emotion = "sadness";
      } else if (top === "anxiety" || top === "fear") {
        content = "Soft check-in 🫧 — let's take one slow breath together. What's loudest in your mind right now?";
        emotion = "anxiety";
      } else if (top === "stress") {
        content = "Pausing here with you ☁️. What's one small thing pressing on you most right now?";
        emotion = "stress";
      } else if (top === "loneliness") {
        content = "Still here 💙. You don't have to fill the silence — I'm just keeping you company.";
        emotion = "loneliness";
      } else if (top === "anger") {
        content = "I hear that something's stirred you up 🔥. Want to vent it out — no judgment from me.";
        emotion = "anger";
      } else if (top === "joy") {
        content = "Loved hearing from you earlier ✨ — anything else lighting you up today?";
        emotion = "joy";
      } else if (lengthDropped) {
        content = "No rush at all 🌿 — even a word or two is enough. How are you, really?";
      }

      return { thresholdMin, content, emotion };
    };

    const t = setInterval(() => {
      const idleMin = (Date.now() - lastActivity.getTime()) / 60000;
      if (messages.length === 0) return;
      const hasUserMessage = messages.some(m => m.role === "user");
      if (!hasUserMessage) return;
      const last = messages[messages.length - 1];
      if (last.role !== "assistant") return;

      const { thresholdMin, content, emotion } = pickCheckIn();
      if (idleMin < thresholdMin) return;

      const recentAssistant = messages.filter(m => m.role === "assistant").slice(-5).map(m => m.content);
      if (recentAssistant.includes(content)) return;

      const lastIsCheckin = /checking in|still here|thinking of you|soft check-in|pausing here|no rush|quieter than usual/i.test(last.content);
      if (lastIsCheckin) return;

      setMessages(m => [...m, { role: "assistant", content, emotion }]);
      setLastActivity(new Date());
    }, 30_000);
    return () => clearInterval(t);
  }, [lastActivity, messages]);

  // Short inactivity nudge — emotion-aware, only after user sends, max once per idle period
  useEffect(() => {
    if (nudgeSent) return;
    if (messages.length === 0) return;
    const userMsgs = messages.filter(m => m.role === "user");
    if (userMsgs.length === 0) return; // never nudge before user initiates
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;

    // Decide IF and WHEN to nudge based on the last user emotion + risk.
    // Default: STAY SILENT. Only check in when there's a real emotional signal.
    const lastUser = userMsgs[userMsgs.length - 1];
    const emo = (lastUser.emotion ?? "").toLowerCase();
    const risk = (lastUser.risk_level ?? "").toLowerCase();

    let delayMs: number | null = null; // silent unless a condition below triggers
    let pool: string[] = [];

    if (risk === "high") {
      delayMs = 12_000;
      pool = [
        "I'm right here with you 💙 — you're not alone in this.",
        "Still here. Even a single word is enough if that's all you have.",
        "Take your time. I'm not going anywhere.",
      ];
    } else if (emo === "sadness" || emo === "loneliness") {
      delayMs = 22_000;
      pool = [
        "Sitting quietly with you 🌙",
        "No need to fill the silence — I'm here.",
        "Whenever something comes up, I'm listening.",
      ];
    } else if (emo === "anxiety" || emo === "fear" || emo === "stress") {
      delayMs = 20_000;
      pool = [
        "One slow breath — I'm here whenever you're ready 🫧",
        "No pressure to find the right words.",
        "Take your time, no rush at all.",
      ];
    } else if (emo === "anger") {
      delayMs = 30_000;
      pool = [
        "Take the space you need — I'm here when you want to talk.",
        "No rush. Vent whenever feels right.",
      ];
    } else if (risk === "moderate") {
      delayMs = 25_000;
      pool = [
        "Just checking in gently — I'm here whenever you're ready.",
        "No rush. I'm around if you'd like to share more.",
      ];
    }
    // joy, neutral, low/empty risk → stay silent (delayMs stays null)

    if (delayMs === null) return;

    const t = setTimeout(() => {
      const idleMs = Date.now() - lastActivity.getTime();
      if (idleMs < delayMs!) return;

      const recentAssistant = messages.filter(m => m.role === "assistant").slice(-5).map(m => m.content);
      const fresh = pool.filter(n => !recentAssistant.includes(n));
      const choices = fresh.length ? fresh : pool;
      const pick = choices[Math.floor(Math.random() * choices.length)];
      setMessages(m => [...m, { role: "assistant", content: pick, emotion: emo || "neutral" }]);
      setNudgeSent(true);
    }, delayMs);
    return () => clearTimeout(t);
  }, [lastActivity, messages, nudgeSent]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || sending) return;
    if (!override) setInput("");
    setSending(true);
    setLastActivity(new Date());
    setNudgeSent(false);
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
  if (!profileChecked) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (needsOnboarding) return <OnboardingForm onDone={() => {
    if (user) localStorage.setItem(`emosense_onboarded_${user.id}`, "1");
    setNeedsOnboarding(false);
  }} />;

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

        {isAdmin && (
          <Link to="/admin" className="block">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Shield className="w-4 h-4 mr-2" /> Admin dashboard
            </Button>
          </Link>
        )}
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

        {(() => {
          const meter = deriveMeter(messages.map(m => m.emotion));
          const userMsgCount = messages.filter(m => m.role === "user").length;
          const showInsight = userMsgCount >= 4 && !insight.dismissed;
          return (
            <div className="p-3 lg:p-4 border-t border-border/50 bg-card/40 backdrop-blur space-y-3">
              <div className="max-w-2xl mx-auto flex justify-center">
                <PrivacyBadge />
              </div>

              <div className="max-w-2xl mx-auto">
                <ConnectInbox userId={user.id} />
              </div>

              {showInsight && (
                <InsightBubble level={meter} onDismiss={insight.dismiss} />
              )}


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
                  onClick={() => send()}
                  disabled={sending || !input.trim()}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:scale-105 transition glow"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="max-w-2xl mx-auto text-[10px] text-muted-foreground text-center">
                EmoSense offers emotional support — it is not a medical or crisis service.
              </p>
            </div>
          );
        })()}
      </main>
    </div>
  );
};

export default Index;
