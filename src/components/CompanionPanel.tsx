import { Mic, MicOff, Play, Settings2, Square, Volume2, VolumeX } from "lucide-react";
import { EmoSenseAvatar, avatarLabel, type AvatarState } from "@/components/EmoSenseAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const btn = "inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-full border text-[13px] font-medium transition-colors disabled:opacity-40";
const sel = "h-9 w-full rounded-lg bg-secondary/60 border border-border/50 px-2.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";
const lbl = "block text-xs font-medium text-muted-foreground";

/** One compact row: portrait, live status, and the few controls that matter. */
export const CompanionPanel = (p: Props) => {
  const langVoices = p.voices.filter(v => v.lang.toLowerCase().startsWith(p.lang.slice(0, 2)));
  const status = p.listening && p.interim ? `“${p.interim}”` : p.statusDetail ?? avatarLabel(p.state);
  const voiceName = langVoices.find(v => v.voiceURI === p.voiceURI)?.name;
  const settingsSummary = `${p.lang === "hi-IN" ? "हिन्दी" : "English"} · ${p.engine === "cloud" ? "Natural voice" : `Device voice${voiceName ? ` · ${voiceName}` : ""}`}`;

  return (
    <section aria-label="Voice companion" className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-border/50 bg-card/50 px-2 py-1.5">
      <EmoSenseAvatar state={p.state} size={36} />
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" aria-live="polite" title={status}>{status}</p>

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
          {p.micSupported ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          {p.listening ? "Done" : "Speak"}
        </button>
        {p.speaking ? (
          <button type="button" onClick={p.onStop} className={cn(btn, "bg-secondary/60 border-border/50 text-foreground hover:bg-secondary")} aria-label="Stop speaking">
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        ) : (
          <button type="button" onClick={p.onPlay} disabled={!p.canPlay} className={cn(btn, "bg-secondary/60 border-border/50 text-foreground hover:bg-secondary")} aria-label="Read last reply aloud">
            <Play className="w-3.5 h-3.5" /> Play
          </button>
        )}
        <button
          type="button"
          onClick={p.onToggleMute}
          aria-pressed={!p.muted}
          aria-label={p.muted ? "Auto-read replies: off" : "Auto-read replies: on"}
          className={cn(btn, p.muted ? "bg-secondary/60 border-border/50 text-muted-foreground" : "bg-primary/15 border-primary/40 text-foreground")}
        >
          {p.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-primary" />}
          {p.muted ? "Muted" : "Auto-read"}
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Voice settings: ${settingsSummary}`}
              title={settingsSummary}
              className={cn(btn, "px-2 bg-secondary/60 border-border/50 text-foreground hover:bg-secondary")}
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3 p-3">
            <label className="space-y-1">
              <span className={lbl}>Language</span>
              <select aria-label="Language" value={p.lang} onChange={e => p.onLang(e.target.value as VoiceLang)} className={sel}>
                <option value="en-IN">English</option>
                <option value="hi-IN">हिन्दी</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className={lbl}>Voice</span>
              <select aria-label="Voice engine" value={p.engine} onChange={e => p.onEngine(e.target.value as VoiceEngine)} className={sel}>
                <option value="cloud">Natural voice</option>
                <option value="browser" disabled={!p.ttsSupported}>Device voice</option>
              </select>
            </label>
            {p.engine === "browser" && langVoices.length > 0 && (
              <label className="space-y-1">
                <span className={lbl}>Device voice</span>
                <select aria-label="Device voice" value={p.voiceURI} onChange={e => p.onVoice(e.target.value)} className={sel}>
                  <option value="">Default</option>
                  {langVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                </select>
              </label>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
};
