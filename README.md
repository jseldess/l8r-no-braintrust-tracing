# l8r Customer Service Chatbot

A Next.js customer service chatbot for the fictional "l8r" buy-now-pay-later service.

## Prerequisites

- Node.js 18+
- npm
- A Postgres database ([Neon](https://console.neon.tech) in production, or a local container for development)
- Braintrust API key (for the AI gateway that fronts model calls)

No OpenAI key is needed: model calls are routed through the Braintrust gateway, which
holds the provider credentials. The gateway is used for model access only — the app
sends no traces or logs to Braintrust.

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

## Model access

`src/lib/openai.ts` points the OpenAI client at the Braintrust AI gateway:

```ts
new OpenAI({
  baseURL: 'https://gateway.braintrust.dev',
  apiKey: process.env.BRAINTRUST_API_KEY,
})
```

Provider credentials live in Braintrust settings rather than in this repo. This is the
gateway only — no tracing, logging, or spans. To call OpenAI directly instead, drop
`baseURL` and use `process.env.OPENAI_API_KEY`.

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
│   │   ├── api/chat/     # Chat API endpoint (streaming)
│   │   └── dashboard/    # Dashboard, orders, payments, plans, chat UI
│   └── lib/
│       ├── chatbot/      # Tool definitions, tool executor, system prompt
│       ├── services/     # Data access (orders, payments, plans, refunds, users)
│       ├── openai.ts     # OpenAI client (via the Braintrust gateway)
│       └── prisma.ts     # Prisma client singleton
└── prisma/
    ├── schema.prisma     # Database schema
    └── seed.ts           # Database seeding script
```
