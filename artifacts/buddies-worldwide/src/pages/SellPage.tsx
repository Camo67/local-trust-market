import { useState, useRef } from "react";
import { Camera, ArrowLeft, X, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES } from "@/types/marketplace";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const MAX_IMAGES = 5;

const SellPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", price: "", category: "", location: "", description: "", video_url: "" });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    const oversized = toAdd.filter((f) => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      toast({ title: "Image too large", description: "Max 5MB per image", variant: "destructive" });
      return;
    }
    setImageFiles((prev) => [...prev, ...toAdd]);
    setImagePreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category || !form.location) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (imageFiles.length === 0) {
      toast({ title: "Image required", description: "Please add at least one photo", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop();
        const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("listing-images").getPublicUrl(path);
        uploadedUrls.push(publicUrl);
      }

      let videoThumbnail: string | null = null;
      if (form.video_url) {
        const ytMatch = form.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (ytMatch) videoThumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
      }

      const { data: newListing, error } = await supabase.from("listings").insert({
        seller_id: user!.id,
        title: form.title,
        description: form.description || null,
        price: parseInt(form.price),
        category: form.category,
        location: form.location,
        image_url: uploadedUrls[0],
        video_url: form.video_url || null,
        video_thumbnail: videoThumbnail,
      }).select("id").single();

      if (error) throw error;

      if (uploadedUrls.length > 0) {
        const imgRows = uploadedUrls.map((url, i) => ({
          listing_id: newListing.id,
          url,
          position: i,
        }));
        await supabase.from("listing_images").insert(imgRows);
      }

      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast({ title: "Listing created!", description: "Your item is now live." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-xl font-semibold">Create Listing</h1>
      </header>

      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Photos <span className="text-muted-foreground font-normal">({imageFiles.length}/{MAX_IMAGES})</span></p>
          <div className="flex flex-wrap gap-2">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-border">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-center text-[9px] text-white py-0.5">Cover</span>
                )}
              </div>
            ))}
            {imageFiles.length < MAX_IMAGES && (
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 flex-col gap-1">
                <Plus className="h-5 w-5 text-primary/60" />
                <span className="text-[10px] text-muted-foreground">Add photo</span>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
              </label>
            )}
          </div>
        </div>

        {[
          { label: "Title *", key: "title", placeholder: "e.g. Samsung Galaxy A14", type: "text" },
          { label: "Price (R) *", key: "price", placeholder: "e.g. 1500", type: "number" },
          { label: "Location *", key: "location", placeholder: "e.g. Soweto, Johannesburg", type: "text" },
        ].map(({ label, key, placeholder, type }) => (
          <div key={key}>
            <label className="text-sm font-medium text-foreground">{label}</label>
            <input
              type={type}
              value={(form as any)[key]}
              onChange={(e) => update(key, e.target.value)}
              placeholder={placeholder}
              className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        ))}

        <div>
          <label className="text-sm font-medium text-foreground">Category *</label>
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Describe your item..."
            rows={3}
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">YouTube URL (optional)</label>
          <input
            type="url"
            value={form.video_url}
            onChange={(e) => update("video_url", e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Post Listing"}
        </button>
      </form>
    </div>
  );
};

export default SellPage;
