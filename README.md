# Curio 拾趣

A personal knowledge assistant that turns your saved Xiaohongshu posts into a searchable, chat-based knowledge base. Ask questions like "where should I eat near Shibuya?" and get answers grounded in your own saved content.

## How It Works

```
Your saved XHS posts → OpenCLI ingestion → Embeddings → PostgreSQL (pgvector)
                                                              ↓
                          You ask a question → Vector search → LLM generates answer
```

- **Ingestion**: OpenCLI fetches your saved posts from Xiaohongshu via your Chrome browser session
- **Processing**: Posts are chunked and embedded using OpenAI `text-embedding-3-small`
- **Storage**: Chunks + vector embeddings stored in PostgreSQL with pgvector
- **Chat**: Questions are embedded, matched via cosine similarity, and answered by GPT-4o-mini with source attribution

## Tech Stack

- **Backend**: Hono + TypeScript
- **Database**: PostgreSQL + pgvector (Neon for production)
- **ORM**: Prisma 7
- **Embeddings**: OpenAI `text-embedding-3-small`
- **LLM**: GPT-4o-mini via Vercel AI SDK
- **Frontend**: React 19 + Vite + Tailwind CSS 4 (PWA)
- **Ingestion**: OpenCLI

## Quick Start

### Prerequisites

- Node.js 21+
- PostgreSQL 17 with pgvector extension
- OpenAI API key

### Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and OPENAI_API_KEY

# Run database migration
npx prisma migrate dev

# Seed with sample data (optional, for testing)
npm run seed

# Start the API server
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 to use the chat interface.

### Ingestion (requires OpenCLI + Chrome)

```bash
# Install OpenCLI globally
npm install -g @jackwener/opencli

# Ingest from your XHS feed
npm run ingest feed

# Search and ingest specific topics
npm run ingest search "ramen"
```

## Project Structure

```
src/
  index.ts              # Hono server entry point
  lib/
    db.ts               # Prisma client
    env.ts              # Environment config (zod)
    embeddings.ts       # OpenAI embedding calls
    llm.ts              # LLM model config
  ingestion/
    opencli.ts          # OpenCLI wrapper
    processor.ts        # Content chunking + embedding
    sync.ts             # Ingestion orchestrator
    cli.ts              # CLI entry for manual ingestion
  routes/
    chat.ts             # POST /api/chat (RAG streaming)
    notes.ts            # GET /api/notes
    syncRoute.ts        # POST /api/sync/trigger
    health.ts           # GET /health
  scripts/
    seed.ts             # Seed database with sample notes
frontend/
  src/
    App.tsx             # Main app with tab navigation
    components/
      ChatView.tsx      # Chat interface with streaming
      ChatMessage.tsx   # Message bubble component
      ChatInput.tsx     # Input with send button
      NotesList.tsx     # Browse ingested notes
prisma/
  schema.prisma         # Database schema
```

## Production Deployment

- **API + Frontend**: Deploy to Vercel (free tier)
- **Database**: Neon PostgreSQL with pgvector (free tier)
- **Ingestion**: Runs locally on your machine (requires Chrome logged into XHS)

## License

MIT
