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
  tools/              # MCP tool definitions (15 tools, one per file, Zod schemas)
    index.ts          # Tool registration entry point
    tool-utils.ts     # Shared error-handling wrapper for tool handlers
manifest.json         # MCP manifest for mcpb packaging
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
9. `create_groupchat` — Create a group chat with multiple Kins (name, context, directive, turn-taking, memory settings)
10. `update_groupchat` — Update a group chat's settings (participants, name, context, directive, memory settings)
11. `send_groupchat_message` — Send a user message to a group chat
12. `groupchat_get_turn` — Get which Kin should respond next in a group chat
13. `groupchat_ai_response` — Request a specific Kin to respond in a group chat
14. `suggest_user_message` — Get a suggested message for the user to send to a Kin
15. `suggest_user_group_message` — Get a suggested message for the user to send in a group chat

## Adding or Changing Endpoints

When adding new API endpoints or modifying existing ones, always complete these steps:

1. **Add/update the client method** in `src/kindroid-client.ts` (interface + method).
2. **Add/update the tool file** in `src/tools/` and register it in `src/tools/index.ts`.
3. **Document the tool** in `README.md` (Capabilities section + Tools section with parameters).
4. **Update `manifest.json`** — add the tool to the `tools` array.
5. **Bump the version** in both `package.json` and `manifest.json` to trigger a new release.
6. **Update this file** (`CLAUDE.md`) — update the tool count in Project Structure and add the tool to the MCP Tools list.
