import { Mic, MicOff, Play, Square, Volume2, VolumeX } from "lucide-react";
import { EmoSenseAvatar, avatarLabel, type AvatarState } from "@/components/EmoSenseAvatar";
import type { VoiceLang } from "@/lib/browserVoice";
import { cn } from "@/lib/utils";

export type VoiceEngine = "cloud" | "browser";

type Props = {
  state: AvatarState;
  statusDetail?: string | null;
  muted: boolean;
  onToggleMute: () => void;
  canPlay: boolean;
  onPlay: () => void;
  onStop: () => void;
  speaking: boolean;
  listening: boolean;
  micSupported: boolean;
  micDisabled?: boolean;
  onMic: () => void;
  interim: string;
  lang: VoiceLang;
  onLang: (l: VoiceLang) => void;
  engine: VoiceEngine;
  onEngine: (e: VoiceEngine) => void;
  ttsSupported: boolean;
  voices: SpeechSynthesisVoice[];
  voiceURI: string;
  onVoice: (uri: string) => void;
};

const btn = "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full border text-[11px] transition-colors disabled:opacity-40";
const sel = "h-8 rounded-full bg-secondary/60 border border-border/50 px-2 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

export const CompanionPanel = (p: Props) => {
  const langVoices = p.voices.filter(v => v.lang.toLowerCase().startsWith(p.lang.slice(0, 2)));
  return (
    <section aria-label="Voice companion" className="flex items-center gap-3 rounded-2xl bg-card/50 border border-border/50 p-2.5">
      <EmoSenseAvatar state={p.state} size={56} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-xs text-foreground truncate" aria-live="polite">
          {p.listening && p.interim ? `“${p.interim}”` : p.statusDetail ?? avatarLabel(p.state)}
          <span className="ml-2 text-[10px] text-muted-foreground">Chetana · AI companion, not a person or therapist</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={p.onMic}
            disabled={p.micDisabled}
            aria-pressed={p.listening}
            aria-label={p.listening ? "Stop listening" : "Speak your message"}
            title={p.micSupported ? undefined : "Voice input isn't supported in this browser"}
            className={cn(btn, p.listening ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/60 border-border/50 text-foreground hover:bg-secondary")}
          >
            {p.micSupported ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            {p.listening ? "Done" : "Speak"}
          </button>
          {p.speaking ? (
            <button type="button" onClick={p.onStop} className={cn(btn, "bg-secondary/60 border-border/50 text-foreground hover:bg-secondary")} aria-label="Stop speaking">
              <Square className="w-3 h-3" /> Stop
            </button>
          ) : (
            <button type="button" onClick={p.onPlay} disabled={!p.canPlay} className={cn(btn, "bg-secondary/60 border-border/50 text-foreground hover:bg-secondary")} aria-label="Read last reply aloud">
              <Play className="w-3 h-3" /> Play
            </button>
          )}
          <button
            type="button"
            onClick={p.onToggleMute}
            aria-pressed={!p.muted}
            aria-label={p.muted ? "Auto-read replies: off" : "Auto-read replies: on"}
            className={cn(btn, p.muted ? "bg-secondary/60 border-border/50 text-muted-foreground" : "bg-primary/15 border-primary/40 text-foreground")}
          >
            {p.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-primary" />}
            {p.muted ? "Muted" : "Auto-read"}
          </button>
          <select aria-label="Language" value={p.lang} onChange={e => p.onLang(e.target.value as VoiceLang)} className={sel}>
            <option value="en-IN">English</option>
            <option value="hi-IN">हिन्दी</option>
          </select>
          <select aria-label="Voice engine" value={p.engine} onChange={e => p.onEngine(e.target.value as VoiceEngine)} className={sel}>
            <option value="cloud">Natural voice</option>
            <option value="browser" disabled={!p.ttsSupported}>Device voice</option>
          </select>
          {p.engine === "browser" && langVoices.length > 0 && (
            <select aria-label="Device voice" value={p.voiceURI} onChange={e => p.onVoice(e.target.value)} className={cn(sel, "max-w-[9rem]")}>
              <option value="">Default</option>
              {langVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
            </select>
          )}
        </div>
      </div>
    </section>
  );
};
