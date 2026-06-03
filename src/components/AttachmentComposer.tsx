import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon, Mic, Paperclip, Square } from "lucide-react";
import { toast } from "sonner";
import { AttachmentChip, AttachmentAnalysis } from "./AttachmentChip";
import { cn } from "@/lib/utils";

type Kind = AttachmentAnalysis["kind"];

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:<mime>;base64,"
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

type PendingAttachment = {
  id: string;
  kind: Kind;
  filename: string;
  mime: string;
  pending: boolean;
  analysis?: AttachmentAnalysis;
};

export const AttachmentComposer = ({
  attachments, onChange, disabled,
}: {
  attachments: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
  disabled?: boolean;
}) => {
  const imageInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const ingest = async (kind: Kind, file: Blob, filename: string, mime: string) => {
    const id = crypto.randomUUID();
    const placeholder: PendingAttachment = { id, kind, filename, mime, pending: true };
    const current = [...attachments, placeholder];
    onChange(current);

    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("ingest-attachment", {
        body: { kind, filename, mime, base64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const an: AttachmentAnalysis = { kind, filename, mime, ...(data.analysis || {}) };
      onChange(current.map(a => a.id === id ? { ...a, pending: false, analysis: an } : a));
    } catch (e: any) {
      toast.error(e.message ?? "Could not analyze attachment");
      onChange(current.filter(a => a.id !== id));
    }
  };

  const handleFiles = (files: FileList | null, kind: Kind) => {
    if (!files || !files.length) return;
    const file = files[0];
    const MAX = 8 * 1024 * 1024;
    if (file.size > MAX) {
      toast.error("File too large (max 8MB)");
      return;
    }
    ingest(kind, file, file.name, file.type || (kind === "image" ? "image/png" : "application/octet-stream"));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recordedChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) recordedChunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunks.current, { type: "audio/webm" });
        await ingest("audio", blob, `voice-${Date.now()}.webm`, "audio/webm");
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      // safety cap 60s
      setTimeout(() => { if (rec.state === "recording") rec.stop(); setRecording(false); }, 60_000);
    } catch (e: any) {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const remove = (id: string) => onChange(attachments.filter(a => a.id !== id));

  return (
    <div className="flex flex-col gap-2 w-full">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map(a => (
            <AttachmentChip
              key={a.id}
              attachment={a.analysis ?? { kind: a.kind, filename: a.filename }}
              pending={a.pending}
              onRemove={() => remove(a.id)}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-1">
        <input ref={imageInput} type="file" accept="image/*" className="hidden"
          onChange={e => { handleFiles(e.target.files, "image"); e.target.value = ""; }} />
        <input ref={docInput} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={e => { handleFiles(e.target.files, "document"); e.target.value = ""; }} />

        <button type="button" onClick={() => imageInput.current?.click()} disabled={disabled}
          className="w-9 h-9 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition"
          aria-label="Upload image">
          <ImageIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => docInput.current?.click()} disabled={disabled}
          className="w-9 h-9 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition"
          aria-label="Upload document">
          <Paperclip className="w-4 h-4" />
        </button>
        <button type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={disabled}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center transition",
            recording
              ? "bg-destructive text-destructive-foreground animate-pulse"
              : "hover:bg-secondary text-muted-foreground hover:text-foreground"
          )}
          aria-label={recording ? "Stop recording" : "Record voice"}>
          {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        {recording && <span className="text-[11px] text-muted-foreground">Recording… tap to stop</span>}
      </div>
    </div>
  );
};

export type { PendingAttachment };
