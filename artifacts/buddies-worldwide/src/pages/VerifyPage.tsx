import { useState } from "react";
import { ArrowLeft, Upload, CheckCircle, Clock, X, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const DOC_TYPES = [
  { value: "sa_id", label: "South African ID" },
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's Licence" },
] as const;

type DocFile = { file: File | null; preview: string | null };

const VerifyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [docType, setDocType] = useState<string>("");
  const [docFront, setDocFront] = useState<DocFile>({ file: null, preview: null });
  const [docBack, setDocBack] = useState<DocFile>({ file: null, preview: null });
  const [selfie, setSelfie] = useState<DocFile>({ file: null, preview: null });

  const { data: existingRequest, refetch } = useQuery({
    queryKey: ["verification_request", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const handleFileSelect = (setter: (v: DocFile) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB per document", variant: "destructive" });
      return;
    }
    setter({ file, preview: URL.createObjectURL(file) });
  };

  const uploadDoc = async (docFile: File, folder: string): Promise<string> => {
    const ext = docFile.name.split(".").pop();
    const path = `${user!.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("verification-docs").upload(path, docFile, { cacheControl: "3600" });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("verification-docs").getPublicUrl(path);
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docType) { toast({ title: "Select document type", variant: "destructive" }); return; }
    if (!docFront.file) { toast({ title: "Upload front of document", variant: "destructive" }); return; }
    if (!selfie.file) { toast({ title: "Upload a selfie", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const frontUrl = await uploadDoc(docFront.file, "front");
      const backUrl = docBack.file ? await uploadDoc(docBack.file, "back") : null;
      const selfieUrl = await uploadDoc(selfie.file, "selfie");

      const { error } = await supabase.from("verification_requests").insert({
        user_id: user!.id,
        doc_type: docType,
        doc_front_url: frontUrl,
        doc_back_url: backUrl,
        selfie_url: selfieUrl,
        status: "pending",
      });

      if (error) throw error;
      await refetch();
      toast({ title: "Submitted!", description: "We'll review your documents within 24 hours." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    pending: { icon: Clock, label: "Under Review", color: "text-warning", bg: "bg-warning/10" },
    approved: { icon: CheckCircle, label: "Verified!", color: "text-escrow", bg: "bg-escrow/10" },
    rejected: { icon: X, label: "Rejected", color: "text-destructive", bg: "bg-destructive/10" },
  };

  if (existingRequest && existingRequest.status !== "rejected") {
    const cfg = statusConfig[existingRequest.status as keyof typeof statusConfig] ?? statusConfig.pending;
    const Icon = cfg.icon;
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          <h1 className="text-lg font-semibold">ID Verification</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 gap-4 text-center">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full ${cfg.bg}`}>
            <Icon className={`h-10 w-10 ${cfg.color}`} />
          </div>
          <h2 className="text-xl font-bold text-foreground">{cfg.label}</h2>
          {existingRequest.status === "pending" && (
            <p className="text-sm text-muted-foreground max-w-xs">
              Your documents are being reviewed. This usually takes up to 24 hours. We'll notify you once done.
            </p>
          )}
          {existingRequest.status === "approved" && (
            <p className="text-sm text-muted-foreground max-w-xs">
              Your identity has been verified. You now have a Verified badge on your profile.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Submitted: {new Date(existingRequest.created_at).toLocaleDateString("en-ZA")}
          </p>
          <button onClick={() => navigate("/")} className="mt-4 w-full max-w-xs rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const FileUploadBox = ({
    label,
    docFile,
    onChange,
    required = false,
  }: {
    label: string;
    docFile: DocFile;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean;
  }) => (
    <div>
      <label className="text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {docFile.preview ? (
        <div className="mt-1 relative rounded-xl overflow-hidden border border-border h-36">
          <img src={docFile.preview} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
        </div>
      ) : (
        <label className="mt-1 flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 gap-2">
          <Upload className="h-6 w-6 text-primary/60" />
          <span className="text-xs text-muted-foreground text-center px-4">Tap to upload (JPG, PNG, max 10MB)</span>
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onChange} />
        </label>
      )}
    </div>
  );

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-semibold">Get Verified</h1>
      </header>

      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 rounded-2xl bg-escrow/10 p-4 mb-4">
          <ShieldCheck className="h-8 w-8 text-escrow flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Why get verified?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified sellers get more trust, higher visibility, and access to higher-value transactions.
            </p>
          </div>
        </div>

        {existingRequest?.status === "rejected" && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 mb-4">
            <p className="text-sm font-semibold text-destructive">Previous submission rejected</p>
            {existingRequest.notes && <p className="text-xs text-muted-foreground mt-1">{existingRequest.notes}</p>}
            <p className="text-xs text-muted-foreground mt-1">Please resubmit with clearer documents.</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground">Document Type <span className="text-destructive">*</span></label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select document type</option>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <FileUploadBox label="Document Front" docFile={docFront} onChange={handleFileSelect(setDocFront)} required />
        <FileUploadBox label="Document Back (if applicable)" docFile={docBack} onChange={handleFileSelect(setDocBack)} />
        <FileUploadBox label="Selfie holding your document" docFile={selfie} onChange={handleFileSelect(setSelfie)} required />

        <div className="rounded-xl bg-muted px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Your documents are stored securely and only used for identity verification. We comply with POPIA.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Uploading documents..." : "Submit for Verification"}
        </button>
      </form>
    </div>
  );
};

export default VerifyPage;
