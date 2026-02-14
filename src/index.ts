#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KindroidClient } from "./kindroid-client.js";
import { registerTools } from "./tools/index.js";

// Type-only imports are erased at compile time — no runtime require() generated
import type { Request, Response, NextFunction } from "express";

// All diagnostic logging MUST go to stderr. In stdio mode stdout is the
// MCP transport — writing anything else there corrupts the protocol stream.
const log = (...args: unknown[]) => console.error(...args);

// Catch any crash the normal .catch() flow might miss
process.on("uncaughtException", (err) => {
  log("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  log("UNHANDLED REJECTION:", reason);
  process.exit(1);
});

// --- Configuration ---

// Use stdio only when explicitly requested via TRANSPORT=stdio.
// Default to HTTP so Railway deployments work without extra config.
const useStdio = process.env.TRANSPORT === "stdio";

log(`Kindroid MCP server starting in ${useStdio ? "stdio" : "HTTP"} mode...`);

const apiKey = process.env.KINDROID_API_KEY?.trim();
if (!apiKey) {
  console.error("Error: KINDROID_API_KEY environment variable is required.");
  process.exit(1);
}

const oauthClientId = process.env.OAUTH_CLIENT_ID?.trim();
const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET?.trim();

function parsePort(env: string | undefined, fallback: number): number {
  if (!env) return fallback;
  const parsed = parseInt(env, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    log(`WARNING: Invalid PORT "${env}", falling back to ${fallback}`);
    return fallback;
  }
  return parsed;
}

const port = parsePort(process.env.PORT, 3000);

const kindroidClient = new KindroidClient(apiKey);

// --- Server factory ---

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "kindroid",
      version: "1.0.0",
      description:
        "MCP server for interacting with Kindroid AI companions (Kins)",
    },
    {
      instructions: [
        "This server connects you to the Kindroid AI platform (kindroid.ai).",
        "Kindroid lets users create and chat with AI companions called Kins.",
        "",
        "You can use this server to:",
        "- Send messages to a Kin and receive their responses (send_message)",
        "- Request a solo selfie of a Kin (request_selfie)",
        "- Request a group selfie of multiple Kins and/or the user (request_group_selfie)",
        "- Start a fresh conversation with a Kin, clearing chat history (chat_break)",
        "- Create journal entries with key phrases for contextual Kin recall (create_journal_entry)",
        "- Check the user's Kindroid subscription status (check_subscription)",
        "",
        "Each Kin has a unique ai_id which must be provided to every tool call",
        "that targets a specific Kin. Ask the user which Kin they want to interact with.",
        "",
        "When sending messages, you are acting as the user — the Kin will",
        "respond as their AI persona. Relay the Kin's responses back to the user.",
      ].join("\n"),
    },
  );
  registerTools(server, kindroidClient);
  return server;
}

// --- Stdio mode (local) ---
// Only imports the lightweight StdioServerTransport — no express, no HTTP deps.

async function startStdio() {
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );

  const server = createServer();
  const transport = new StdioServerTransport();

  transport.onclose = () => {
    log("Stdio transport closed");
  };

  await server.connect(transport);
  log("Stdio transport connected, waiting for messages...");
}

// --- HTTP mode (Railway / remote) ---
// Lazily loads express, StreamableHTTPServerTransport, and OAuth modules so
// stdio mode never pulls in any HTTP dependencies.

async function startHttp() {
  const [
    expressModule,
    { StreamableHTTPServerTransport },
    { createOAuthRouter, requireBearerAuth, registerClient },
  ] = await Promise.all([
    import("express"),
    import("@modelcontextprotocol/sdk/server/streamableHttp.js"),
    import("./oauth.js"),
  ]);
  const express = expressModule.default;

  const app = express();
  app.use(express.json());

  // Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      "Content-Security-Policy": "default-src 'none'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    next();
  });

  // Log every incoming request
  app.use((req: Request, _res: Response, next: NextFunction) => {
    log(`[HTTP] ${req.method} ${req.path}`);
    next();
  });

  // OAuth routes (discovery, authorize, token)
  if (oauthClientId && oauthClientSecret) {
    registerClient(oauthClientId, oauthClientSecret);

    app.use(createOAuthRouter());
    app.use("/mcp", requireBearerAuth);
    log("OAuth authentication enabled.");
  } else if (oauthClientId || oauthClientSecret) {
    log(
      "WARNING: Both OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET must be set together. " +
        "Ignoring partial configuration. The server is running without authentication.",
    );
  } else {
    log(
      "WARNING: OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET are not set. " +
        "The server is running without authentication.",
    );
  }

  // MCP request handler — stateless: fresh server + transport per request
  async function handleMcpPost(req: Request, res: Response) {
    const body = req.body;
    const methods = Array.isArray(body)
      ? body.map((m: { method?: string }) => m.method).join(", ")
      : body?.method;
    log(`[MCP] POST ${req.path} — method(s): ${methods}`);
    log(
      `[MCP] Headers: accept=${req.headers.accept}, content-type=${req.headers["content-type"]}`,
    );

    const server = createServer();
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      res.on("close", () => {
        log(
          `[MCP] Response closed for method(s): ${methods}, status: ${res.statusCode}`,
        );
        transport.close();
        server.close();
      });
    } catch (error) {
      console.error("[MCP] Error handling request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  }

  // 405 handler for GET/DELETE on MCP endpoints (stateless — no SSE stream)
  function handleMcpMethodNotAllowed(_req: Request, res: Response) {
    log(`[MCP] ${_req.method} ${_req.path} — returning 405`);
    res.status(405).set("Allow", "POST").json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  }

  // Mount MCP on /mcp
  app.post("/mcp", handleMcpPost);
  app.get("/mcp", handleMcpMethodNotAllowed);
  app.delete("/mcp", handleMcpMethodNotAllowed);

  // Health check for Railway
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.listen(port, "0.0.0.0", () => {
    log(`Kindroid MCP server listening on port ${port}`);
  });
}

// --- Entrypoint ---

(useStdio ? startStdio() : startHttp()).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
