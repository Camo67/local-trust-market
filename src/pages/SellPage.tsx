import { useState } from "react";
import { Camera, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES } from "@/types/marketplace";
import { useToast } from "@/hooks/use-toast";

const SellPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "",
    price: "",
    category: "",
    location: "",
    description: "",
    video_url: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category || !form.location) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    toast({ title: "Listing created!", description: "Your item is now live." });
    navigate("/");
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
        {/* Image upload placeholder */}
        <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5">
          <div className="text-center">
            <Camera className="mx-auto h-8 w-8 text-primary/50" />
            <p className="mt-2 text-sm text-muted-foreground">Tap to add photo</p>
            <p className="text-xs text-muted-foreground">1 required</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Title *</label>
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="What are you selling?"
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Price (Rands) *</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Category *</label>
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Location *</label>
          <input
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="e.g. Soweto, Johannesburg"
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Tell buyers about your item..."
            rows={3}
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Video URL (optional)</label>
          <input
            value={form.video_url}
            onChange={(e) => update("video_url", e.target.value)}
            placeholder="YouTube or Rumble link"
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-1 text-xs text-muted-foreground">Add a video to build trust with buyers</p>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
        >
          Publish Listing
        </button>
      </form>
    </div>
  );
};

export default SellPage;
