
import type { NextApiRequest, NextApiResponse } from "next";

type Product = {
  id: string;
  name: string;
  brand?: string;
  price?: number;
  gender?: string;
  sizes?: string[];
  palette?: string;
  body?: string[];
  materials?: string[];
  type?: string;
  image?: string;
  url: string;
  rating?: number;
  inStock?: boolean;
};

const SKIM_API = "https://product-api.skimlinks.com/search";
const SKIM_KEY = process.env.SKIMLINKS_PRODUCT_API_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = (req.query.query as string) || "";
    const page = Number(req.query.page || 1);
    const perPage = Number(req.query.perPage || 50);

    if (!SKIM_KEY) {
      res.status(500).json({ error: "Missing SKIMLINKS_PRODUCT_API_KEY" });
      return;
    }

    const url = new URL(SKIM_API);
    url.searchParams.set("query", q);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${SKIM_KEY}` },
      next: { revalidate: 120 }
    });

    if (!r.ok) {
      const text = await r.text();
      res.status(r.status).json({ error: `Skimlinks error: ${text}` });
      return;
    }

    const data = await r.json();
    const items: Product[] = (data?.products || []).map((p: any) => ({
      id: String(p.productId ?? p.id ?? p.sku ?? p.url),
      name: p.title,
      brand: p.brand,
      price: p.price?.amount ?? p.price,
      gender: p.gender || "Unisex",
      sizes: [],
      palette: "",
      body: [],
      materials: p.materials || [],
      type: p.categoryPath?.[p.categoryPath.length - 1],
      image: p.images?.[0]?.url || p.imageUrl,
      url: p.url,
      rating: p.rating || 0,
      inStock: p.availability ? String(p.availability).toLowerCase().includes("in_stock") : true,
    }));

    const seen = new Set<string>();
    const dedup = items.filter((it) => {
      const key = it.id || it.url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json(dedup);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
