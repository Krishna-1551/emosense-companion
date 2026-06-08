import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import emosenseLogo from "@/assets/emosense-logo.png";
import { ONBOARDING_KEY } from "./Onboarding";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(100),
});

const Auth = () => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // First-time visitors: show onboarding before auth
  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        nav("/welcome", { replace: true });
      }
    } catch {}
  }, [nav]);

  useEffect(() => { if (!loading && user) nav("/", { replace: true }); }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Welcome to EmoSense ✨");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 soft-shadow border-border/50 bg-card/70 backdrop-blur-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-20 h-20 rounded-full overflow-hidden pulse-ring">
            <img src={emosenseLogo} alt="EmoSense AI logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            <span className="gradient-text">EmoSense AI</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">A gentle space for your feelings</p>
        </div>

        <div className="flex w-full rounded-xl bg-secondary/50 p-1 mb-6">
          <Button
            type="button"
            variant={mode === "signin" ? "default" : "ghost"}
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-lg text-sm font-medium transition-all ${mode === "signin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={mode === "signup" ? "default" : "ghost"}
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg text-sm font-medium transition-all ${mode === "signup" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Create account
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
          <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

      </Card>
    </div>
  );
};

export default Auth;
