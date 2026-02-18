# Kindroid MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets you interact with the [Kindroid](https://kindroid.ai/) AI platform. Send messages to your Kins, manage conversations, and check account status — all from your MCP client.

The setup instructions below are written for Claude, but this server works with any MCP-compatible client.

Supports two modes:
- **Local (stdio)** — runs as a subprocess of your MCP client (e.g., Claude Desktop, Claude Code)
- **Remote (HTTP)** — deploy to Railway (or any host) and connect from any device

## Disclaimer

This is an **unofficial, community-built project** by [Apocryphus](https://github.com/ApocryphalWord). It is not affiliated with, endorsed by, or supported by Kindroid. The MCP server uses **undocumented Kindroid API endpoints** that may change without notice — updates to Kindroid could break this server at any time. I'll strive to repair any breakage as quickly as possible, and new features will be added over time.

**Please do not contact Kindroid for support with this MCP server.** If you encounter issues, [file an issue](https://github.com/ApocryphalWord/KindroidMCP/issues) on this GitHub repo.

## Capabilities
This Kindroid MCP server provides AI assistant tools (such as Claude) the ability to understand and access the Kindroid API for purposes of messaging and setting up Kindroids. Some such capabilities include:

* Sending messages to kins.
* Creating and Updating kins, setting any values available in the UI.
  * Including setup fields like `show_auto_selfies_in_chat` and `time_awareness`
* Requesting Selfies and Group Selfies.
* Running a Chat Break on a conversation.
* Creating Journal Entries.

The power of the above is being able to do so without using the AI, and with the right setup (storing or looking up the Kindroid's AI ID from another source), run these operations in bulk. If the user has stored a collection of their Kindroid's IDs and names (in a Notion Database or somewhere else Claude can access), running any of the above is as easy as asking claude to "Turn off Time Awareness for Kin1, Kin2, and Kin3" or "Run this selfie prompt on Kin1, Kin2, and Kin3."

These capabilities can be easily leveraged via Claude Skills. Several skills making use of this MCP server are available at [ClaudeKindroidSkills](https://github.com/ApocryphalWord/KindroidClaudeSkills).

## Limitations

- **The API is write-only.** There are no endpoints to read back Kin profiles, conversation history, or other account data. Once you create or update a Kin, there is no way to read its current state back through the API. Consider pairing this MCP with [Notion](https://www.notion.so/) or another tool to keep a local record of Kin configurations you push to Kindroid.
- **No avatar image upload.** The API does not support uploading avatar images directly. Kins created via the API will not have an avatar picture. Set one manually in the Kindroid app before requesting selfies — selfie generation will fail for Kins without an avatar.
- **Selfies are fire-and-forget.** Selfie and group selfie requests are queued asynchronously. The generated images are delivered in the Kindroid app — they are not returned through the API or the MCP.

## Local Setup (Claude Desktop)

1. Go to the [Releases](https://github.com/ApocryphalWord/KindroidMCP/releases) page and download the latest `.mcpb` file.
2. Open **Claude Desktop** and go to **Settings > Extensions**.
3. Click **Install Extension...** and select the `.mcpb` file you downloaded.
4. Enter your **Kindroid API key** when prompted.
5. The Kindroid tools should now appear in the tools menu (hammer icon).

## Deploy to Railway (Remote Access)

This lets you use the server from Claude on your phone, web, or any device.

### 1. Set up Railway

1. Push this repo to GitHub
2. Create a new project on [Railway](https://railway.app/) and connect the repo
3. Add these environment variables in Railway's dashboard:

| Variable | Required | Description |
|---|---|---|
| `KINDROID_API_KEY` | Yes | Your Kindroid API key (from Settings > API) |
| `OAUTH_CLIENT_ID` | Yes | OAuth client ID (choose any value you like) |
| `OAUTH_CLIENT_SECRET` | Yes | OAuth client secret (generate a strong, random password-like string) |

> **Note:** Do not set `PORT` — Railway assigns it automatically.

Railway auto-detects the Dockerfile and assigns a public URL.

### 2. Connect Claude to your deployed server

In Claude.ai, go to **Settings > Connectors > Add custom connector**:

- **Name:** Kindroid (or whatever you like)
- **Remote MCP server URL:** `https://your-app.up.railway.app/mcp`

Expand **Advanced Settings** and enter:
- **Client ID:** your `OAUTH_CLIENT_ID` value
- **Client Secret:** your `OAUTH_CLIENT_SECRET` value

Click **Add**, then **Connect**.

To verify everything works, try asking Claude: *"Request a selfie of Kin `<ai_id>` in a sunny park."*

## Security

> **Never share your Kindroid API key.** Anyone with your API key has full access to your Kindroid account. Sharing your key could result in data loss or unauthorized use of your account.

### Local mode (stdio)
The server runs as a local subprocess. No ports are opened and no network connections are made beyond the Kindroid API itself. Only the Claude instance that spawns the process can use it. Your API key is stored in your local config file and never leaves your machine.

### Remote mode (HTTP + OAuth 2.1)

Deploying in remote mode opens an internet-accessible service that proxies requests to the Kindroid API using your API key. While the server is secured with industry-standard protections, you should understand what this means:

- **Your API key lives on the server.** It is stored as an environment variable on your hosting platform (e.g., Railway). It is never exposed to clients, but anyone who gains access to your server environment can read it.
- **All authenticated clients share one API key.** The server uses your single Kindroid API key for all requests. There is no per-user scoping — any client that completes the OAuth flow has the same access.

The following security measures are in place:

- **OAuth 2.1 with PKCE:** The server implements a full OAuth 2.1 authorization code flow with S256 PKCE, which is what Claude.ai requires for custom connectors.
- **Client credentials:** Authentication requires the `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` configured on both the server and in Claude.ai's connector settings. The server verifies the client secret at token exchange using timing-safe comparison.
- **Token-based access:** After authorization, Claude receives short-lived access tokens (1h) with refresh tokens (30d). All requests to `/mcp` require a valid Bearer token. Old tokens are revoked when refreshed.
- **Redirect URI validation:** The authorization endpoint only accepts localhost or HTTPS redirect URIs.
- **Rate limiting:** Auth endpoints (10 req/min/IP), token endpoints (20 req/min/IP), and MCP endpoints (60 req/min/IP) are all rate-limited.
- **Security headers:** All responses include `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, and `Referrer-Policy` headers.
- **Input validation:** All tool parameters are validated at runtime with Zod schemas, including URL format validation and string length constraints.
- **HTTPS:** Railway provides TLS by default — all traffic is encrypted in transit.
- **No persistent state:** OAuth state (clients, tokens) is stored in-memory with periodic cleanup. If the server restarts, Claude automatically re-authenticates.

## Tools

### `send_message`

Send a message to a Kindroid AI and receive its response. Supports attaching images, video, or links.

**Parameters:**
- `message` (required) — The message to send
- `ai_id` (required) — The ID of the target Kin
- `image_urls` (optional) — Array of image URLs to attach
- `image_description` (optional) — Description of attached images
- `video_url` (optional) — Video URL to attach
- `video_description` (optional) — Description of attached video
- `link_url` (optional) — Link URL to share
- `link_description` (optional) — Description of the shared link

### `create_kin`

Create a new Kindroid AI companion. Returns the new Kin's `ai_id`.

**Parameters:**
- `ai_name` (required) — Name for the new Kin (max 20 characters)
- `ai_gender` (required) — Gender of the Kin: `Male` or `Female`
- `ai_backstory` (required) — Backstory/personality description
- `custom_greeting` (optional) — Custom greeting for new conversations
- `ai_directive` (optional) — System instruction for the Kin's behavior
- `ai_avatar` (optional) — Avatar preset index (-1 for custom avatar)
- `custom_avatar_url` (optional) — URL for a custom avatar image
- `custom_avatar_description` (optional) — Text description for avatar generation
- `custom_avatar_fidelity` (optional) — Avatar fidelity (0–1)
- `custom_avatar_face_detail` (optional) — Face detail level (0–1)
- `custom_avatar_face_prompt` (optional) — Prompt for face detail enhancement
- `avatar_is_anime` (optional) — Use anime style (default: false)

### `update_kin`

Update a Kin's profile fields. Only provided fields are changed.

**Parameters:**
- `ai_id` (required) — The ID of the target Kin
- `ai_name` (optional) — The Kin's display name (max 20 characters)
- `ai_gender` (optional) — The Kin's gender: `Male` or `Female`
- `ai_backstory` (optional) — Personality, history, and character description
- `ai_memory` (optional) — Key memories to persist across conversations
- `ai_example_message` (optional) — Example message showing desired response style
- `ai_directive` (optional) — Response directive for formatting/style
- `ai_additional_context` (optional) — Extra background information or context
- `user_set_temperature` (optional) — Dynamism (0.6–1.8, default 0.95)
- `reasoning_effort` (optional) — Reasoning level: `none`, `low`, `med`, `high`, `xhigh`
- `llm_flair` (optional) — Style preset: `companion`, `roleplay`, `narrative`, `classic`, `minimal`
- `proactive_mode` (optional) — Enable proactive mode (max 10 Kins per account)
- `proactive_action_directive` (optional) — How the Kin should proactively message, call, or send selfies (max 300 characters)
- `time_awareness` (optional) — Enable time awareness so the Kin knows the current time
- `show_auto_selfies_in_chat` (optional) — Whether auto-generated selfies appear in the chat
- `ai_avatar` (optional) — Avatar preset index (-1 for custom)
- `custom_avatar_url` (optional) — URL for a custom avatar image
- `custom_avatar_description` (optional) — Text description for avatar generation
- `custom_avatar_fidelity` (optional) — Avatar fidelity (0–1)
- `custom_avatar_face_detail` (optional) — Face detail level (0–1)
- `custom_avatar_face_prompt` (optional) — Prompt for face detail enhancement
- `avatar_is_anime` (optional) — Use anime style
- `unset_custom_avatar_animation` (optional) — Unset any custom avatar animation

### `request_selfie`

Request a solo selfie image of a Kin. The request is queued and processed asynchronously.

**Parameters:**
- `ai_id` (required) — The ID of the target Kin
- `prompt` (required) — Image generation prompt describing the desired scene
- `aspect` (optional) — Aspect ratio: `square` (default), `portrait`, or `landscape`
- `uses_nsfw` (optional) — Allow NSFW content (default: false)
- `seed` (optional) — Seed for reproducible generation

### `request_group_selfie`

Request a group selfie with multiple Kins (up to 3 participants). Include `"user"` as a participant to add the user's persona. The request is queued and processed asynchronously.

**Parameters:**
- `version` (required) — Group selfie API version (e.g. `"v7"`)
- `ai_ids` (required) — Array of 1–3 participant IDs (Kin AI IDs or `"user"`)
- `prompt` (required) — Image generation prompt describing the group scene
- `regional_prompts` (optional) — Per-person prompts (must match length of `ai_ids`)
- `aspect` (optional) — Aspect ratio: `square` (default), `portrait`, or `landscape`
- `uses_nsfw` (optional) — Allow NSFW content (default: false)
- `seed` (optional) — Seed for reproducible generation

### `chat_break`

Clear the current conversation and start fresh.

**Parameters:**
- `ai_id` (required) — The ID of the target Kin
- `greeting` (optional) — Custom greeting for the AI to open with

### `check_subscription`

Check the Kindroid account's subscription status (base subscription and add-on tiers). No parameters required.

### `create_journal_entry`

Create a journal entry for a Kin — a recallable piece of contextual lore (20–500 characters) that is surfaced during conversation when triggered by associated key phrases.

**Parameters:**
- `ai_id` (required) — The ID of the target Kin
- `entry` (required) — Journal entry text (20–500 characters)
- `keyphrases` (required) — Array of key phrases (each at least 3 characters) that trigger recall of this entry

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `KINDROID_API_KEY` | Yes | Your Kindroid API key |
| `OAUTH_CLIENT_ID` | No (local) / Yes (remote) | OAuth client ID for authentication |
| `OAUTH_CLIENT_SECRET` | No (local) / Yes (remote) | OAuth client secret (must be set together with `OAUTH_CLIENT_ID`) |
| `PORT` | No | HTTP listen port (default: 3000, set automatically by Railway) |
| `TRANSPORT` | No | Set to `stdio` for local subprocess mode. Defaults to HTTP. |

## License

This project is licensed under the [MIT License](LICENSE).
