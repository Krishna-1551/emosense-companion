import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Check, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { SupportThread } from "./SupportThread";

type Req = {
  id: string;
  admin_id: string;
  status: "pending" | "accepted" | "declined" | "ended";
  flagged_message_excerpt: string | null;
  created_at: string;
};

/** User-side inbox: shows admin connect requests + accepted support thread. */
export const ConnectInbox = ({ userId }: { userId: string }) => {
  const [requests, setRequests] = useState<Req[]>([]);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("connect_requests")
      .select("id, admin_id, status, flagged_message_excerpt, created_at")
      .eq("user_id", userId)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false });
    if (data) setRequests(data as Req[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`user-requests-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "connect_requests", filter: `user_id=eq.${userId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const respond = async (id: string, status: "accepted" | "declined") => {
    const { error } = await supabase.from("connect_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else if (status === "accepted") toast.success("Connected. Admin can now message you privately.");
    else toast("Request declined. You stay anonymous.");
  };

  if (requests.length === 0) return null;

  return (
    <div className="space-y-3">
      {requests.map(r => (
        <Card key={r.id} className="p-3 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {r.status === "pending" ? (
                <>
                  <p className="text-sm font-medium">A support admin would like to connect with you</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    They saw a recent message and want to check in. Connection only happens if you accept.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => respond(r.id, "accepted")}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => respond(r.id, "declined")}>
                      <X className="w-3.5 h-3.5 mr-1" /> Decline
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Support conversation active</p>
                    <p className="text-xs text-muted-foreground">Private chat with an admin.</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setOpenThread(openThread === r.id ? null : r.id)}>
                    <MessageCircle className="w-3.5 h-3.5 mr-1" />
                    {openThread === r.id ? "Hide" : "Open"}
                  </Button>
                </div>
              )}
            </div>
          </div>
          {openThread === r.id && r.status === "accepted" && (
            <div className="mt-3">
              <SupportThread
                requestId={r.id}
                selfRole="user"
                selfId={userId}
                title="Private support chat"
                onClose={() => setOpenThread(null)}
              />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
