
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

const RAKUTEN_CLIENT_ID = process.env.RAKUTEN_CLIENT_ID!;
const RAKUTEN_CLIENT_SECRET = process.env.RAKUTEN_CLIENT_SECRET!;
const RAKUTEN_TOKEN_URL = "https://api.rakutenadvertising.com/token";
const RAKUTEN_PRODUCT_SEARCH = "https://api.rakutenadvertising.com/productsearch/1.0";

async function getRakutenAccessToken(): Promise<string> {
  const auth = Buffer.from(`${RAKUTEN_CLIENT_ID}:${RAKUTEN_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(RAKUTEN_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    next: { revalidate: 3600 }
  });
  if (!r.ok) throw new Error(`Rakuten token error: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.access_token as string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = (req.query.query as string) || "";
    const page = Number(req.query.page || 1);
    const perPage = Number(req.query.perPage || 50);

    if (!RAKUTEN_CLIENT_ID || !RAKUTEN_CLIENT_SECRET) {
      res.status(500).json({ error: "Missing RAKUTEN_CLIENT_ID / RAKUTEN_CLIENT_SECRET" });
      return;
    }

    const token = await getRakutenAccessToken();

    const url = new URL(RAKUTEN_PRODUCT_SEARCH);
    url.searchParams.set("keyword", q);
    url.searchParams.set("max", String(perPage));
    url.searchParams.set("pagenumber", String(page));

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 120 }
    });

    if (!r.ok) {
      const text = await r.text();
      res.status(r.status).json({ error: `Rakuten product search error: ${text}` });
      return;
    }

    const data = await r.json();

    const items: Product[] = (data?.item || data?.products || data?.results || []).map((p: any) => ({
      id: String(p.sku || p.advertiserProductId || p.productId || p.linkId || p.url),
      name: p.productName || p.name || p.title,
      brand: p.brandName || p.brand,
      price: Number(p.price || p.salePrice || p.retailPrice) || undefined,
      gender: "Unisex",
      sizes: [],
      palette: "",
      body: [],
      materials: [],
      type: p.categoryName || p.category,
      image: p.imageUrl || p.largeImage || p.thumbnailImage,
      url: p.productUrl || p.linkUrl || p.url,
      rating: undefined,
      inStock: true,
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
