import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle, X, Eye, Clock, ShieldCheck,
  FileText, User, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type VerifStatus = "pending" | "approved" | "rejected";

const STATUS_TABS: { key: VerifStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const DOC_LABEL: Record<string, string> = {
  sa_id: "SA ID",
  passport: "Passport",
  drivers_license: "Driver's Licence",
};

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<VerifStatus | "all">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin_verification_requests", tab],
    queryFn: async () => {
      let q = supabase
        .from("verification_requests")
        .select(`
          *,
          profile:profiles!verification_requests_user_id_fkey(display_name, seller_level, verification_status, rating, completed_sales)
        `)
        .order("created_at", { ascending: false });

      if (tab !== "all") q = q.eq("status", tab);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        profile: r.profile?.[0] ?? r.profile ?? null,
      }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: VerifStatus; notes?: string }) => {
      const { error } = await supabase
        .from("verification_requests")
        .update({
          status,
          notes: notes || null,
          reviewer_id: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin_verification_requests"] });
      setExpanded(null);
      setShowRejectInput(null);
      toast({
        title: vars.status === "approved" ? "Request approved" : "Request rejected",
        description: vars.status === "approved"
          ? "The user's profile has been upgraded to Verified."
          : "The user has been notified to resubmit.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const counts = useQuery({
    queryKey: ["admin_verification_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_requests")
        .select("status");
      if (error) throw error;
      const result: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
      for (const r of (data as any[])) result[r.status] = (result[r.status] ?? 0) + 1;
      return result;
    },
  });

  const approve = (id: string) => updateMutation.mutate({ id, status: "approved" });

  const reject = (id: string) => {
    updateMutation.mutate({ id, status: "rejected", notes: rejectNotes[id] || undefined });
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate("/")}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Admin — Verifications</h1>
          <p className="text-xs text-muted-foreground">Review submitted identity documents</p>
        </div>
        {counts.data?.pending ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning text-[11px] font-bold text-warning-foreground">
            {counts.data.pending}
          </span>
        ) : null}
      </header>

      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t.label}
              {t.key !== "all" && counts.data?.[t.key] ? (
                <span className={`ml-1 ${t.key === "pending" ? "text-warning" : ""}`}>
                  ({counts.data[t.key]})
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 py-3 space-y-3 pb-12">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : requests && requests.length > 0 ? (
          requests.map((req: any) => {
            const isOpen = expanded === req.id;
            const isRejecting = showRejectInput === req.id;
            const statusColor = req.status === "pending"
              ? "text-warning bg-warning/10"
              : req.status === "approved"
                ? "text-escrow bg-escrow/10"
                : "text-destructive bg-destructive/10";

            return (
              <div key={req.id} className="rounded-2xl bg-card shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : req.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {req.profile?.display_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "??"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-card-foreground truncate">
                        {req.profile?.display_name || "Unknown user"}
                      </p>
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColor}`}>
                        {req.status === "pending" && <Clock className="h-2.5 w-2.5" />}
                        {req.status === "approved" && <CheckCircle className="h-2.5 w-2.5" />}
                        {req.status === "rejected" && <X className="h-2.5 w-2.5" />}
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {DOC_LABEL[req.doc_type] ?? req.doc_type} · {new Date(req.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="border-t border-border px-4 pb-4 space-y-4">
                    <div className="pt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-muted px-3 py-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Seller Level</p>
                        <p className="font-medium capitalize">{req.profile?.seller_level ?? "—"}</p>
                      </div>
                      <div className="rounded-xl bg-muted px-3 py-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Completed Sales</p>
                        <p className="font-medium">{req.profile?.completed_sales ?? 0}</p>
                      </div>
                    </div>

                    {req.notes && (
                      <div className="rounded-xl bg-destructive/10 px-3 py-2">
                        <p className="text-xs font-medium text-destructive mb-0.5">Review Notes</p>
                        <p className="text-xs text-muted-foreground">{req.notes}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documents</p>
                      <div className="space-y-2">
                        {[
                          { label: "Front", url: req.doc_front_url },
                          { label: "Back", url: req.doc_back_url },
                          { label: "Selfie", url: req.selfie_url },
                        ].filter((d) => d.url).map((doc) => (
                          <a
                            key={doc.label}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5 hover:bg-muted transition-colors"
                          >
                            {doc.label === "Selfie" ? (
                              <User className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{doc.label}</p>
                              <p className="text-xs text-muted-foreground">Tap to open in new tab</p>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </a>
                        ))}
                      </div>
                    </div>

                    {req.status === "pending" && (
                      <div className="space-y-2 pt-1">
                        {isRejecting ? (
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-foreground">Rejection reason (optional)</label>
                            <textarea
                              value={rejectNotes[req.id] || ""}
                              onChange={(e) => setRejectNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                              placeholder="e.g. Document blurry, ID not clearly visible..."
                              rows={3}
                              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowRejectInput(null)}
                                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => reject(req.id)}
                                disabled={updateMutation.isPending}
                                className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                              >
                                {updateMutation.isPending ? "Saving..." : "Confirm Reject"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowRejectInput(req.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 py-2.5 text-sm font-semibold text-destructive"
                            >
                              <X className="h-4 w-4" /> Reject
                            </button>
                            <button
                              onClick={() => approve(req.id)}
                              disabled={updateMutation.isPending}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-escrow py-2.5 text-sm font-semibold text-escrow-foreground disabled:opacity-50"
                            >
                              <ShieldCheck className="h-4 w-4" />
                              {updateMutation.isPending ? "Saving..." : "Approve"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {req.status !== "pending" && req.reviewed_at && (
                      <p className="text-center text-xs text-muted-foreground">
                        Reviewed on {new Date(req.reviewed_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No {tab === "all" ? "" : tab} requests</p>
            <p className="text-xs text-muted-foreground/70 mt-1">New submissions will appear here</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPage;
