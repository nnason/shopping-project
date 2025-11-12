# Fashion Aggregator (Next.js)

Search fashion items via Skimlinks, Rakuten, and Amazon PA-API with client-side filters.
Outbound links are monetized by the Skimlinks script.

## Quickstart
```bash
npm i
cp .env.local.example .env.local
# fill in keys
npm run dev
```

Open http://localhost:3000

## Env (.env.local)
- SKIMLINKS_PRODUCT_API_KEY=sk_live_xxx
- RAKUTEN_CLIENT_ID=...
- RAKUTEN_CLIENT_SECRET=...
- AMAZON_PAAPI_ACCESS_KEY=AKIA...
- AMAZON_PAAPI_SECRET_KEY=...
- AMAZON_PAAPI_PARTNER_TAG=yourtag-20
- AMAZON_PAAPI_REGION=us-east-1
- AMAZON_PAAPI_HOST=webservices.amazon.com

## Deploy
- Vercel recommended. Add the env vars above in your project settings.
- APIs are server-side only; keys are never sent to the browser.
