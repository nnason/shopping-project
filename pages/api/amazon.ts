
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

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

const ACCESS_KEY = process.env.AMAZON_PAAPI_ACCESS_KEY!;
const SECRET_KEY = process.env.AMAZON_PAAPI_SECRET_KEY!;
const PARTNER_TAG = process.env.AMAZON_PAAPI_PARTNER_TAG!;
const REGION = process.env.AMAZON_PAAPI_REGION || "us-east-1";
const HOST = process.env.AMAZON_PAAPI_HOST || "webservices.amazon.com";
const ENDPOINT = `https://${HOST}/paapi5/searchitems`;
const TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";

function hmac(key: any, str: string) {
  return crypto.createHmac("sha256", key).update(str, "utf8").digest();
}
function hmacHex(key: any, str: string) {
  return crypto.createHmac("sha256", key).update(str, "utf8").digest("hex");
}
function hashHex(str: string) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function sign(headers: Record<string, string>, payload: string) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const datestamp = amzDate.slice(0, 8);

  headers["content-type"] = "application/json; charset=UTF-8";
  headers["host"] = HOST;
  headers["x-amz-date"] = amzDate;
  headers["x-amz-target"] = TARGET;

  const signedHeaders = Object.keys(headers).map(k=>k.toLowerCase()).sort().join(";");
  const canonicalHeaders = Object.keys(headers).map(k=>k.toLowerCase() + ":" + headers[k]).sort().join("\n");

  const canonicalRequest = [
    "POST",
    "/paapi5/searchitems",
    "",
    canonicalHeaders + "\n",
    signedHeaders,
    hashHex(payload),
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${datestamp}/${REGION}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, hashHex(canonicalRequest)].join("\n");

  const kDate = hmac("AWS4" + SECRET_KEY, datestamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, "ProductAdvertisingAPI");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmacHex(kSigning, stringToSign);

  headers.Authorization = `${algorithm} Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = (req.query.query as string) || "";
    const page = Number(req.query.page || 1);

    if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
      res.status(500).json({ error: "Missing AMAZON_PAAPI_* env vars" });
      return;
    }

    const body = JSON.stringify({
      Keywords: q,
      PartnerTag: PARTNER_TAG,
      PartnerType: "Associates",
      Marketplace: "www.amazon.com",
      ItemCount: 20,
      ItemPage: page,
      Resources: [
        "Images.Primary.Large",
        "ItemInfo.Title",
        "ItemInfo.ByLineInfo",
        "Offers.Listings.Price",
        "Offers.Listings.Availability",
        "BrowseNodeInfo.BrowseNodes"
      ],
    });

    const headers: Record<string, string> = {};
    sign(headers, body);

    const r = await fetch(ENDPOINT, { method: "POST", headers, body, next: { revalidate: 120 } });
    if (!r.ok) {
      const text = await r.text();
      res.status(r.status).json({ error: `Amazon PA-API error: ${text}` });
      return;
    }
    const data = await r.json();

    const items: Product[] = (data.SearchResult?.Items || []).map((it: any) => {
      const price = it.Offers?.Listings?.[0]?.Price?.Amount;
      const img = it.Images?.Primary?.Large?.URL;
      return {
        id: it.ASIN,
        name: it.ItemInfo?.Title?.DisplayValue,
        brand: it.ItemInfo?.ByLineInfo?.Brand?.DisplayValue,
        price: price ? Number(price) : undefined,
        gender: "Unisex",
        sizes: [],
        palette: "",
        body: [],
        materials: [],
        type: it.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName,
        image: img,
        url: it.DetailPageURL,
        rating: undefined,
        inStock: !!String(it.Offers?.Listings?.[0]?.Availability?.Message || '').toLowerCase().includes('in stock'),
      };
    });

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
