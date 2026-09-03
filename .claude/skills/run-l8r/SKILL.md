---
name: run-l8r
description: Launch and drive the l8r Next.js customer-service chatbot locally, including the Postgres container, Prisma migrate/generate/seed, and the Braintrust gateway for model access. Use when asked to run, start, restart, or smoke-test the l8r app, or to confirm a change works in the running app rather than only in tests.
---

# Running l8r locally

Verified end to end on macOS, 2026-09-03 (Next.js 14.2.35, Node 24, Prisma 5.22).

## Why this exists

Nothing here starts out of the box. `prisma/schema.prisma` is `provider = "postgresql"`,
so there is no SQLite fallback (the README's `DATABASE_URL="file:./dev.db"` is stale) —
you need a real Postgres. And the chat path needs model credentials, which come from
the Braintrust gateway rather than a local `OPENAI_API_KEY`.

## Prerequisites

- Docker running (`docker ps` must succeed — start Docker Desktop if it errors on the socket).
- `BRAINTRUST_API_KEY` in the shell env. Check with `env | grep BRAINTRUST_API_KEY`.
  Everything except the chatbot works without it; `/api/chat` needs it.
- No `OPENAI_API_KEY` needed — see "Model access" below.

## Startup

```bash
# 1. Deps (skip if node_modules exists)
npm install

# 2. Local Postgres. Port 55432 avoids colliding with a system Postgres on 5432.
docker run -d --name l8r-pg \
  -e POSTGRES_PASSWORD=l8r -e POSTGRES_USER=l8r -e POSTGRES_DB=l8r \
  -p 55432:5432 postgres:16
until docker exec l8r-pg pg_isready -U l8r >/dev/null 2>&1; do sleep 0.5; done

# If the container already exists from a previous session, just restart it —
# the seeded data persists, so you can skip steps 3-5. Prisma reconnects on the
# next request, so a running dev server does not need restarting either:
#   docker start l8r-pg

# 3. .env (gitignored). sslmode=disable — the container has no TLS, and the
#    Neon-style sslmode=require in .env.example will fail against it.
cat > .env <<'EOF'
DATABASE_URL="postgresql://l8r:l8r@localhost:55432/l8r?sslmode=disable"
DIRECT_URL="postgresql://l8r:l8r@localhost:55432/l8r?sslmode=disable"
EOF

# 4. Schema + client. `prisma generate` must run BEFORE the seed: the seed
#    imports @prisma/client and dies with MODULE_NOT_FOUND otherwise, even
#    though package.json has a postinstall generate.
npx prisma migrate deploy
npx prisma generate

# 5. Seed. Note `npm run db:reset` does NOT seed — package.json has no
#    prisma.seed key — so call the seed script explicitly.
npm run db:seed

# 6. Dev server
npm run dev
```

Ready in ~1s. `/` 307-redirects to `/dashboard`.

To restart cleanly: stop the old server, then `lsof -ti:3000 | xargs -r kill -9`
before relaunching, or Next will pick a different port.

## Model access

`src/lib/braintrust.ts` points the OpenAI client at the Braintrust gateway, so
provider credentials live in Braintrust settings instead of a local key:

```ts
const openaiClient = new OpenAI({
  baseURL: 'https://gateway.braintrust.dev',
  apiKey: process.env.BRAINTRUST_API_KEY,
})
```

If that has been reverted to `apiKey: process.env.OPENAI_API_KEY`, either restore the
gateway config or put a real `OPENAI_API_KEY` in `.env`.

## Seeded demo data

User `user_demo_001` / Alex Johnson, $5000 limit, $2847.50 available, 6 orders,
3 plans, 12 payments. The scenarios worth driving:

- `payment_failed_001` — failed IKEA payment ($147.38, "Insufficient funds in linked
  payment method") on `plan_002` / `order_003`.
- A pending refund request on the Nike order.

## Drive it, don't just launch it

```bash
# Pages
for p in dashboard dashboard/chat dashboard/orders dashboard/payments dashboard/plans; do
  printf "%-20s %s\n" "/$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/$p)"
done

# DB-backed API
curl -s http://localhost:3000/api/dashboard | head -c 200

# Chat (SSE stream). Exercises the LLM, the tool loop, and Postgres in one shot.
curl -s -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Why did my IKEA payment fail, and what is my available credit?"}]}' \
  --max-time 90 > /tmp/chat.txt

# Which tools the model chose:
grep -o '"name":"[a-z_]*"' /tmp/chat.txt
# Reassemble the streamed answer:
grep -o '"content":"[^"]*"' /tmp/chat.txt | sed 's/"content":"//;s/"$//' | tr -d '\n' | sed 's/\\n/\n/g'
```

A correct run calls `get_payment_history({status:"failed"})` and `get_account_balance`,
then reports the insufficient-funds reason and $2,847.50 available.

## Tracing

Every chat request is traced to the Braintrust project `l8r-customer-service` whenever
`BRAINTRUST_API_KEY` is set: `initLogger` in `src/lib/braintrust.ts`, an explicit
`conversation` span plus `logger.traced` turn span in `src/app/api/chat/route.ts`,
`wrapOpenAI` for LLM spans, and `wrapTracedTool` for per-tool spans. The first SSE frame
is `{"type":"span_id","spanId":"..."}` — the exported conversation span, which the client
passes back as `parentSpanId` so later turns nest in the same trace.

## Teardown

```bash
docker stop l8r-pg          # data persists; `docker rm l8r-pg` to discard it
```
