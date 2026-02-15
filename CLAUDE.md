# CLAUDE.md

## Project Overview

Kindroid MCP Server — a TypeScript MCP (Model Context Protocol) server that enables Claude to interact with the Kindroid AI platform. Supports two deployment modes: local (stdio) and remote (HTTP with OAuth 2.1).

## Build & Run

```bash
npm run build     # Compile TypeScript (tsc)
npm run start     # Run production server (node dist/index.js)
npm run dev       # Watch mode for development (tsc --watch)
```

No test or lint scripts are configured.

## Project Structure

```
src/
  index.ts            # Server entry point, stdio/HTTP transport setup
  kindroid-client.ts  # Kindroid API client wrapper (api.kindroid.ai/v1)
  oauth.ts            # OAuth 2.1 + PKCE implementation for remote mode
  tools/              # MCP tool definitions (8 tools, one per file, Zod schemas)
    index.ts          # Tool registration entry point
```

Output compiles to `dist/`. Docker + Railway deployment supported via `Dockerfile` and `railway.json`.

## Key Conventions

- **TypeScript strict mode** enabled (`tsconfig.json`). Target ES2022, module Node16.
- **Three runtime dependencies**: `@modelcontextprotocol/sdk`, `express`, `zod`.
- **No test framework or linter** currently configured.
- **Environment variables**: `KINDROID_API_KEY` (required), `OAUTH_CLIENT_ID` + `OAUTH_CLIENT_SECRET` (required for remote), `PORT` (default 3000), `TRANSPORT` (set to "stdio" for local mode). See `.env.example`.
- **OAuth tokens are in-memory only** — they reset on server restart.
- Tools are registered in `src/tools/index.ts` using Zod for parameter validation.
- API calls go through `src/kindroid-client.ts` with Bearer token auth.

## MCP Tools

1. `send_message` — Send a message to a Kin (supports media attachments)
2. `create_kin` — Create a new Kindroid AI companion
3. `update_kin` — Update a Kin's profile (backstory, memories, directives, context, avatar settings)
4. `request_selfie` — Request a solo selfie image of a Kin
5. `request_group_selfie` — Request a group selfie of multiple Kins and/or the user
6. `chat_break` — Clear conversation history
7. `check_subscription` — Check account subscription status
8. `create_journal_entry` — Create a journal entry with key phrases for contextual Kin recall
