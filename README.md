# l8r Customer Service Chatbot

A Next.js customer service chatbot for the fictional "l8r" buy-now-pay-later service,
instrumented end to end with [Braintrust](https://www.braintrust.dev) tracing.

## Prerequisites

- Node.js 18+
- npm
- A Postgres database ([Neon](https://console.neon.tech) in production, or a local container for development)
- Braintrust API key

No OpenAI key is needed: model calls are routed through the Braintrust gateway, which
holds the provider credentials.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://..."   # pooled connection
DIRECT_URL="postgresql://..."     # direct connection, used for migrations
BRAINTRUST_API_KEY=sk-...
```

For local development you can run Postgres in a container instead of using Neon:

```bash
docker run -d --name l8r-pg \
  -e POSTGRES_PASSWORD=l8r -e POSTGRES_USER=l8r -e POSTGRES_DB=l8r \
  -p 55432:5432 postgres:16
```

and point both URLs at it:

```
DATABASE_URL="postgresql://l8r:l8r@localhost:55432/l8r?sslmode=disable"
DIRECT_URL="postgresql://l8r:l8r@localhost:55432/l8r?sslmode=disable"
```

### 3. Initialize the database

```bash
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

This applies the schema (Users, Orders, InstallmentPlans, Payments, RefundRequests) and
seeds sample customer data. Run `prisma generate` before seeding — the seed script
imports `@prisma/client`.

Seeded demo account: **Alex Johnson**, $5,000 credit limit, $2,847.50 available, with a
failed IKEA payment and a pending Nike refund request to exercise.

## Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to interact with the chatbot.

---

## Tracing

Every chat request is traced to the Braintrust project `l8r-customer-service` whenever
`BRAINTRUST_API_KEY` is set. Four pieces do the work:

| Where | What it does |
|-------|--------------|
| `initLogger` in `src/lib/braintrust.ts` | Registers the logger for the project |
| `wrapOpenAI` in `src/lib/braintrust.ts` | Turns every model call into an LLM span with messages, output, and token usage |
| `wrapTracedTool` in `src/lib/chatbot/tool-executor.ts` | Wraps each tool as a `tool` span with its arguments and result |
| `logger.startSpan` / `logger.traced` in `src/app/api/chat/route.ts` | Creates the `conversation` root span and a per-turn child span |

### Multi-turn traces

Turns of the same conversation nest under one root span. The chat route opens a
`conversation` span, exports its ID, and streams it to the client as the first
server-sent event:

```
data: {"type":"span_id","spanId":"..."}
```

The client passes that ID back as `parentSpanId` on subsequent requests, so later turns
attach to the existing trace instead of starting a new one.

### Gateway

`src/lib/braintrust.ts` points the OpenAI client at the Braintrust gateway:

```ts
const openaiClient = new OpenAI({
  baseURL: 'https://gateway.braintrust.dev',
  apiKey: process.env.BRAINTRUST_API_KEY,
})
```

Provider credentials live in Braintrust settings rather than in this repo. To call
OpenAI directly instead, swap `baseURL`/`apiKey` for `process.env.OPENAI_API_KEY`.

## Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:migrate:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:reset` | Reset database (destructive; does not reseed — run `db:seed` after) |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/chat/     # Chat API endpoint (streaming, span management)
│   │   └── dashboard/    # Dashboard, orders, payments, plans, chat UI
│   └── lib/
│       ├── chatbot/      # Tool definitions, tool executor, system prompt
│       ├── services/     # Data access (orders, payments, plans, refunds, users)
│       ├── braintrust.ts # Braintrust logger, traced OpenAI client
│       └── prisma.ts     # Prisma client singleton
└── prisma/
    ├── schema.prisma     # Database schema
    └── seed.ts           # Database seeding script
```
