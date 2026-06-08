import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Brain,
  Languages,
  Lightbulb,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import emosenseLogo from "@/assets/emosense-logo.png";

export const ONBOARDING_KEY = "emosense_onboarded_v1";

type Slide = {
  icon: React.ReactNode;
  kicker?: string;
  title: string;
  subtitle?: string;
  description: React.ReactNode;
  visual: React.ReactNode;
  cta: string;
};

const EmotionChips = () => {
  const items = [
    { label: "Stress", c: "from-rose-500/30 to-rose-500/10 border-rose-400/40" },
    { label: "Anxiety", c: "from-amber-500/30 to-amber-500/10 border-amber-400/40" },
    { label: "Sadness", c: "from-sky-500/30 to-sky-500/10 border-sky-400/40" },
    { label: "Anger", c: "from-red-500/30 to-red-500/10 border-red-400/40" },
    { label: "Neutral", c: "from-violet-500/30 to-violet-500/10 border-violet-400/40" },
  ];
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {items.map((it, i) => (
        <span
          key={it.label}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border bg-gradient-to-br ${it.c} animate-float-up`}
          style={{ animationDelay: `${i * 90}ms` }}
        >
          {it.label}
        </span>
      ))}
    </div>
  );
};

const ChatPreview = () => {
  const lines = [
    { lang: "EN", text: "I feel stressed.", side: "right" as const },
    { lang: "HI", text: "मुझे बहुत तनाव हो रहा है।", side: "right" as const },
    { lang: "HG", text: "Yaar kaafi pressure feel ho raha hai.", side: "right" as const },
  ];
  return (
    <div className="w-full max-w-xs mx-auto space-y-2">
      {lines.map((l, i) => (
        <div
          key={i}
          className="flex justify-end animate-float-up"
          style={{ animationDelay: `${i * 150}ms` }}
        >
          <div className="bubble-user text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2 shadow-md max-w-[85%]">
            <div className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">{l.lang}</div>
            {l.text}
          </div>
        </div>
      ))}
      <div className="flex justify-start animate-float-up" style={{ animationDelay: "500ms" }}>
        <div className="bubble-ai text-foreground text-sm rounded-2xl rounded-tl-sm px-4 py-2 shadow-md max-w-[85%] border border-border/40">
          I hear you. Let's slow down together. 🌙
        </div>
      </div>
    </div>
  );
};

const FlowDiagram = () => (
  <div className="flex items-center justify-center gap-2 text-xs font-medium">
    {["Problem", "Insight", "Solution"].map((s, i) => (
      <div key={s} className="flex items-center gap-2">
        <div
          className={`px-3 py-2 rounded-xl border bg-gradient-to-br animate-float-up ${
            i === 0
              ? "from-rose-500/20 to-rose-500/5 border-rose-400/40"
              : i === 1
                ? "from-amber-500/20 to-amber-500/5 border-amber-400/40"
                : "from-emerald-500/20 to-emerald-500/5 border-emerald-400/40"
          }`}
          style={{ animationDelay: `${i * 200}ms` }}
        >
          {s}
        </div>
        {i < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
      </div>
    ))}
  </div>
);

const PrivacyVisual = () => (
  <div className="relative w-32 h-32 mx-auto">
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 blur-2xl animate-pulse" />
    <div className="relative w-full h-full rounded-full border border-primary/40 bg-card/60 backdrop-blur-xl flex items-center justify-center">
      <ShieldCheck className="w-14 h-14 text-primary" />
    </div>
  </div>
);

const GrowthVisual = () => (
  <div className="w-full max-w-xs mx-auto">
    <div className="flex items-end justify-between gap-2 h-24">
      {[30, 45, 38, 60, 55, 78, 90].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md bg-gradient-to-t from-primary/30 to-accent/80 animate-float-up"
          style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
    <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
      <span>Week 1</span>
      <span>Today</span>
    </div>
  </div>
);

const Companion = () => (
  <div className="relative w-32 h-32 mx-auto">
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent blur-2xl opacity-60 animate-pulse" />
    <div className="relative w-full h-full rounded-full overflow-hidden pulse-ring border border-primary/30">
      <img src={emosenseLogo} alt="EmoSense AI" className="w-full h-full object-cover" />
    </div>
  </div>
);

const slides: Slide[] = [
  {
    icon: <Sparkles className="w-4 h-4" />,
    kicker: "Welcome",
    title: "Welcome to EmoSense AI",
    subtitle: "Because every emotion deserves to be understood.",
    description:
      "A safe and judgment-free space where you can express your thoughts, emotions, and concerns openly.",
    visual: <Companion />,
    cta: "Next",
  },
  {
    icon: <Brain className="w-4 h-4" />,
    kicker: "Multimodal",
    title: "Understand Your Emotions",
    description: (
      <>
        EmoSense AI understands emotions from <b>text, voice notes, images</b> and <b>documents</b> —
        turning them into meaningful insights.
      </>
    ),
    visual: <EmotionChips />,
    cta: "Next",
  },
  {
    icon: <Languages className="w-4 h-4" />,
    kicker: "Your language",
    title: "Talk Naturally",
    description: (
      <>
        Chat the way you normally communicate. Supports <b>English, Hindi</b> and <b>Hinglish</b> — the
        AI adapts to your style automatically.
      </>
    ),
    visual: <ChatPreview />,
    cta: "Next",
  },
  {
    icon: <Lightbulb className="w-4 h-4" />,
    kicker: "Beyond chat",
    title: "More Than Just A Chatbot",
    description:
      "EmoSense understands emotional patterns, offers psychological support, and guides you toward practical solutions.",
    visual: <FlowDiagram />,
    cta: "Next",
  },
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    kicker: "Privacy first",
    title: "Your Privacy Comes First",
    description:
      "Your conversations remain private. Secure by design, with limited risk-based monitoring and no unnecessary exposure of personal chats.",
    visual: <PrivacyVisual />,
    cta: "Next",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    kicker: "Grows with you",
    title: "Support That Grows With You",
    description:
      "EmoSense remembers emotional patterns, understands your style, and becomes more personalized over time.",
    visual: <GrowthVisual />,
    cta: "Continue",
  },
];

const Onboarding = () => {
  const nav = useNavigate();
  const [index, setIndex] = useState(0);
  const [isFinal, setIsFinal] = useState(false);
  const touchStart = useRef<number | null>(null);

  const complete = (dest: "auth" | "signup") => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {}
    nav(dest === "signup" ? "/auth?mode=signup" : "/auth", { replace: true });
  };

  const next = () => {
    if (index < slides.length - 1) setIndex(index + 1);
    else setIsFinal(true);
  };
  const prev = () => {
    if (isFinal) setIsFinal(false);
    else if (index > 0) setIndex(index - 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) next();
      else prev();
    }
    touchStart.current = null;
  };

  if (isFinal) {
    return (
      <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center p-6">
        {/* particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="absolute block w-1 h-1 rounded-full bg-primary/50"
              style={{
                left: `${(i * 37) % 100}%`,
                top: `${(i * 53) % 100}%`,
                animation: `pulse-soft ${3 + (i % 4)}s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center animate-float-up">
          <div className="relative w-24 h-24 rounded-full overflow-hidden pulse-ring mb-6">
            <img src={emosenseLogo} alt="EmoSense AI" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            <span className="gradient-text">EmoSense AI</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-base">
            Because every emotion deserves to be understood.
          </p>

          <div className="mt-10 w-full space-y-3">
            <Button
              onClick={() => complete("signup")}
              className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
            >
              Get Started
            </Button>
            <Button
              onClick={() => complete("signup")}
              variant="outline"
              className="w-full h-12 text-base border-primary/30 bg-card/40 backdrop-blur"
            >
              Create Account
            </Button>
            <Button
              onClick={() => complete("auth")}
              variant="ghost"
              className="w-full h-12 text-base"
            >
              Login
            </Button>
          </div>

          <button
            onClick={prev}
            className="mt-6 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        </div>
      </div>
    );
  }

  const s = slides[index];

  return (
    <div
      className="relative min-h-screen flex flex-col p-6"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Skip */}
      <div className="flex justify-between items-center">
        <button
          onClick={prev}
          className={`text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ${index === 0 ? "invisible" : ""}`}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => setIsFinal(true)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center">
        <div
          key={index}
          className="w-full max-w-md rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl soft-shadow p-8 animate-float-up"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium mb-5">
            {s.icon}
            {s.kicker}
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
            {s.title}
          </h2>
          {s.subtitle && (
            <p className="mt-2 text-sm text-primary/90 italic">{s.subtitle}</p>
          )}
          <div className="my-7 flex items-center justify-center min-h-[140px]">
            {s.visual}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {s.description}
          </p>

          <Button
            onClick={next}
            className="mt-8 w-full h-12 text-base bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
          >
            {s.cta}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 pb-2">
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-8 bg-gradient-to-r from-primary to-accent" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Onboarding;
