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
* Running a Chat Break on a conversation, with optional cascaded memory wipe.
* Getting suggested user messages for individual or group chats.
* Creating Journal Entries.
* Creating and Updating Group Chats with multiple Kins, including turn-taking, memory settings, and group messaging.
* Updating user profile fields (name, gender, backstory, avatar) and setting the active persona.

The power of the above is being able to do so without using the UI, and with the right setup (storing or looking up the Kindroid's AI ID from another source), run these operations in bulk. If the user has stored a collection of their Kindroid's IDs and names (in a Notion Database or somewhere else Claude can access), running any of the above is as easy as asking claude to "Turn off Time Awareness for Kin1, Kin2, and Kin3" or "Run this selfie prompt on Kin1, Kin2, and Kin3."

These capabilities can be easily leveraged via Claude Skills. Several skills making use of this MCP server are available at [ClaudeKindroidSkills](https://github.com/ApocryphalWord/KindroidClaudeSkills).

## Limitations

- **The API is write-only.** There are no endpoints to read back Kin profiles, conversation history, or other account data. Once you create or update a Kin, there is no way to read its current state back through the API. Consider pairing this MCP with [Notion](https://www.notion.so/) or another tool to keep a local record of Kin configurations you push to Kindroid.
- **No avatar image upload.** The API does not support uploading avatar images directly. Kins created via the API will not have an avatar picture. Set one manually in the Kindroid app before requesting selfies — selfie generation will fail for Kins without an avatar.
- **Selfies are fire-and-forget.** Selfie and group selfie requests are queued asynchronously. The generated images are delivered in the Kindroid app — they are not returned through the API or the MCP.

## Working with User Personas

User personas in Kindroid let you present different identities to your Kins — each with its own name, gender, backstory, and avatar. The `update_user_profile` tool lets you manage these through the API, but there are some rough edges to be aware of.

### How personas work on the backend

The author (Apocryphus), believes through observation, that your Kindroid account has a single "active" persona state on the backend, consisting of two parts:

1. **Active persona ID** — which persona is selected
2. **User profile fields** — the actual name, gender, backstory, and avatar URL

When you switch personas in the Kindroid UI, the app makes two separate API calls: one to set the `active_persona_id`, and another to set the user profile fields (`user_name`, `user_gender`, `user_backstory`, `user_custom_avatar`). The "tied persona" concept — where selecting a persona automatically loads its profile data — is a frontend convenience, not a backend feature.

This means that to fully switch personas through the API, you need to make both updates yourself: set the active persona ID **and** set all the user profile fields to match.

### What's not available

- **No way to read personas.** Like most Kindroid data, there is no API endpoint to list your personas or read their details. You cannot retrieve persona IDs, names, or other fields through the API.
- **Persona IDs are not shown in the UI.** The Kindroid app doesn't display persona IDs anywhere visible, so you'll need to extract them manually (see below).

### How to find your persona IDs

1. Open [Kindroid](https://kindroid.ai/) in Chrome
2. Open Chrome DevTools (`F12` or `Ctrl+Shift+I`)
3. Go to the **Network** tab
4. In the Kindroid app, switch to the persona you want the ID for
5. In the Network tab, look for a request to `update-info`
6. Click the request and check the **Payload** tab — you'll see `active_persona_id` with the persona's ID

### Recommended workflow

Since the API can't read persona data, you'll want to store your persona details externally (e.g., in a Notion database or local file) so you can reference them when switching. For each persona, record:

- **Persona ID** (extracted via DevTools)
- **Name** (`user_name`)
- **Gender** (`user_gender`)
- **Backstory** (`user_backstory`)
- **Avatar URL** (`user_custom_avatar`)

Then to switch personas, call `update_user_profile` with both the `active_persona_id` and all the profile fields for that persona.

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
- `current_scene` (optional) — A high-weight description of the current scene (location, attire, activity, time, etc.). Max 160 characters

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

### `create_groupchat`

Create a new group chat with multiple Kindroid AI companions. Returns the new group chat's ID.

**Parameters:**
- `ai_list` (required) — Array of Kin AI IDs to include in the group chat
- `group_name` (required) — Name for the group chat
- `group_context` (optional) — Backstory and context for how the Kindroids should relate to each other. Character limits vary by subscription: Base 1000, Ultra 1500, MAX 3000
- `group_directive` (optional) — A strong suggestion for all Kindroids (e.g. "be concise"). Added on top of individual Kin directives
- `use_manual_turntaking` (optional) — If true, user manually triggers each Kin's turn; if false (default), Kins speak automatically
- `share_short_term_memory` (optional) — Whether short-term memory is shared with participants' solo chats (default: false)
- `disable_ltm_recall` (optional) — Disable long-term memory recall in this group chat (default: false)
- `disable_ltm_consolidate` (optional) — Disable long-term memory creation from this group chat (default: false)
- `user_persona_id` (optional) — User persona ID to use in this group chat

### `update_groupchat`

Update a group chat's settings. Only provided fields are changed.

**Parameters:**
- `group_id` (required) — The ID of the group chat to update
- `ai_list` (optional) — Updated array of Kin AI IDs
- `group_name` (optional) — Updated group chat name
- `group_context` (optional) — Updated backstory/context (max 3000 characters)
- `group_directive` (optional) — Updated directive for all Kindroids
- `use_manual_turntaking` (optional) — Toggle manual vs automatic turn-taking
- `share_short_term_memory` (optional) — Toggle short-term memory sharing
- `disable_ltm_recall` (optional) — Toggle long-term memory recall
- `disable_ltm_consolidate` (optional) — Toggle long-term memory creation
- `user_persona_id` (optional) — User persona ID to use

### `send_groupchat_message`

Send a user message to a group chat. Does not trigger AI responses — use `groupchat_get_turn` and `groupchat_ai_response` to get Kin replies. Supports attaching images, video, or links.

**Parameters:**
- `group_id` (required) — The ID of the group chat
- `message` (required) — The message to send
- `image_urls` (optional) — Array of image URLs to attach
- `image_description` (optional) — Description of attached images
- `video_url` (optional) — Video URL to attach
- `video_description` (optional) — Description of attached video
- `link_url` (optional) — Link URL to share
- `link_description` (optional) — Description of the shared link

### `groupchat_get_turn`

Determine which Kin should respond next in a group chat. Returns the `ai_id` of the next speaker. Used in automatic turn-taking mode.

**Parameters:**
- `group_id` (required) — The ID of the group chat
- `allow_user` (optional) — Whether the user can be selected as the next speaker (default: true)

### `groupchat_ai_response`

Request a specific Kin to respond in a group chat. Returns the Kin's response text. Can be called after `groupchat_get_turn` (auto mode) or directly (manual mode).

**Parameters:**
- `ai_id` (required) — The ID of the Kin to respond
- `group_id` (required) — The ID of the group chat
- `request_id` (optional) — Request ID for deduplication (auto-generated if not provided)

### `chat_break`

Clear the current conversation and start fresh.

**Parameters:**
- `ai_id` (required) — The ID of the target Kin
- `greeting` (optional) — Custom greeting for the AI to open with
- `wipe_cascaded` (optional) — Whether to also clear cascaded memory along with short-term memory (default: false)

### `check_subscription`

Check the Kindroid account's subscription status (base subscription and add-on tiers). No parameters required.

### `create_journal_entry`

Create a journal entry for a Kin — a recallable piece of contextual lore (20–500 characters) that is surfaced during conversation when triggered by associated key phrases.

**Parameters:**
- `ai_id` (required) — The ID of the target Kin
- `entry` (required) — Journal entry text (20–500 characters)
- `keyphrases` (required) — Array of key phrases (each at least 3 characters) that trigger recall of this entry

### `suggest_user_message`

Get a suggested message for the user to send to a Kindroid AI. Useful for generating conversation starters or continuing a message.

**Parameters:**
- `ai_id` (required) — The ID of the Kindroid AI to get a suggestion for
- `existing_message` (optional) — The start of a message the suggestion can continue from

### `suggest_user_group_message`

Get a suggested message for the user to send in a group chat. Useful for generating conversation starters or continuing a message in group conversations.

**Parameters:**
- `group_id` (required) — The ID of the group chat to get a suggestion for
- `existing_message` (optional) — The start of a message the suggestion can continue from

### `update_user_profile`

Update the authenticated user's profile fields or set the active persona. Only provided fields are changed. See [Working with User Personas](#working-with-user-personas) for important context on how personas work.

> **Note:** This tool uses the same underlying `/update-info` endpoint as `update_kin`. The Kindroid API uses a single endpoint for both kin profile updates (when `ai_id` is provided) and user profile/persona updates. They are split into separate MCP tools for clarity.

**Parameters:**
- `active_persona_id` (optional) — The ID of the user persona to set as active
- `user_name` (optional) — User profile display name
- `user_gender` (optional) — User profile gender
- `user_backstory` (optional) — User profile backstory/description
- `user_custom_avatar` (optional) — URL for a custom user profile avatar image

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
