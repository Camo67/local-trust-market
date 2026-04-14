import { useState } from "react";
import { Camera, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES } from "@/types/marketplace";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const SellPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    price: "",
    category: "",
    location: "",
    description: "",
    video_url: "",
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category || !form.location) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (!imageFile) {
      toast({ title: "Image required", description: "Please add a photo of your item", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Upload image
      const fileExt = imageFile.name.split(".").pop();
      const filePath = `${user!.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(filePath, imageFile, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("listing-images")
        .getPublicUrl(filePath);

      // Extract video thumbnail
      let videoThumbnail: string | null = null;
      if (form.video_url) {
        const ytMatch = form.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (ytMatch) {
          videoThumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
        }
      }

      const { error } = await supabase.from("listings").insert({
        seller_id: user!.id,
        title: form.title,
        description: form.description || null,
        price: parseInt(form.price),
        category: form.category,
        location: form.location,
        image_url: publicUrl,
        video_url: form.video_url || null,
        video_thumbnail: videoThumbnail,
      });

      if (error) throw error;

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
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold">Create Listing</h1>
      </header>

      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        <label className="flex h-40 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 overflow-hidden">
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <div className="text-center">
              <Camera className="mx-auto h-8 w-8 text-primary/50" />
              <p className="mt-2 text-sm text-muted-foreground">Tap to add photo</p>
              <p className="text-xs text-muted-foreground">1 required (max 5MB)</p>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
        </label>

        <div>
          <label className="text-sm font-medium text-foreground">Title *</label>
          <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="What are you selling?" className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Price (Rands) *</label>
          <input type="number" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="0" className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Category *</label>
          <select value={form.category} onChange={(e) => update("category", e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">Select category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Location *</label>
          <input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Soweto, Johannesburg" className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Description</label>
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Tell buyers about your item..." rows={3} className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Video URL (optional)</label>
          <input value={form.video_url} onChange={(e) => update("video_url", e.target.value)} placeholder="YouTube or Rumble link" className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <p className="mt-1 text-xs text-muted-foreground">Add a video to build trust with buyers</p>
        </div>

        <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {loading ? "Publishing..." : "Publish Listing"}
        </button>
      </form>
    </div>
  );
};

export default SellPage;
