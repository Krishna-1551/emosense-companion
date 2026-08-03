import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Share2, Copy, Check, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";

const SHARE_TITLE = "EmoSense AI — a calm space to talk";
const SHARE_TEXT =
  "I've been using EmoSense AI — a private, emotionally intelligent companion you can talk to any time. Thought you might like it:";

export function ShareAppButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleClick = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
        return;
      } catch {
        // user cancelled or share unavailable — fall through to dialog
      }
    }
    setOpen(true);
  };

  const encoded = encodeURIComponent(`${SHARE_TEXT} ${url}`);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          onClick={(e) => {
            e.preventDefault();
            handleClick();
          }}
        >
          <Share2 className="w-4 h-4 mr-2" /> Share app
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share EmoSense AI</DialogTitle>
          <DialogDescription>
            Send this link to someone who could use a calm space to talk. Your conversations stay private.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input readOnly value={url} className="text-sm" onFocus={(e) => e.currentTarget.select()} />
          <Button size="icon" variant="secondary" onClick={copy} aria-label="Copy link">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button asChild variant="outline" size="sm">
            <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encoded}`}>
              <Mail className="w-4 h-4 mr-2" /> Email
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
