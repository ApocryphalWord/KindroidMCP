import express, { Router, Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

// --- Types ---

interface OAuthClient {
  client_id: string;
  client_secret: string;
  client_name?: string;
}

interface AuthCode {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  expires_at: number;
}

interface TokenRecord {
  client_id: string;
  access_token: string;
  access_expires_at: number;
  refresh_expires_at: number;
  refresh_token: string;
}

// --- In-memory stores ---

const clients = new Map<string, OAuthClient>();
const authCodes = new Map<string, AuthCode>();
const accessTokens = new Map<string, TokenRecord>();
const refreshTokens = new Map<string, TokenRecord>();

// Periodic cleanup of expired auth codes, access tokens, and refresh tokens
// to prevent unbounded memory growth from unused/expired entries.
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of authCodes) {
    if (now > entry.expires_at) authCodes.delete(code);
  }
  for (const [token, record] of accessTokens) {
    if (now > record.access_expires_at) accessTokens.delete(token);
  }
  for (const [token, record] of refreshTokens) {
    if (now > record.refresh_expires_at) refreshTokens.delete(token);
  }
}, 5 * 60 * 1000).unref(); // every 5 minutes

// --- Client registration ---

export function registerClient(
  clientId: string,
  clientSecret: string,
): void {
  const client: OAuthClient = {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: "Kindroid MCP Client",
  };
  clients.set(clientId, client);
  console.error(`Registered OAuth client: ${clientId}`);
}

// --- Constants ---

const ACCESS_TOKEN_TTL = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const AUTH_CODE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Helpers ---

function randomId(): string {
  return crypto.randomBytes(32).toString("hex");
}

function getServerUrl(req: Request): string {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) || "http";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  return hash.toString("base64url") === codeChallenge;
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    // Still run a comparison to avoid timing leakage from the branch
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validate that a redirect URI is safe per OAuth 2.1 / MCP spec requirements.
 * Redirect URIs MUST be either localhost URLs (any scheme) or HTTPS URLs.
 */
function isValidRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    const isLocalhost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    return isLocalhost || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// --- Rate limiting ---

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
): (req: Request, res: Response, next: NextFunction) => void {
  const entries = new Map<string, RateLimitEntry>();

  // Periodic cleanup to prevent unbounded memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (now - entry.windowStart > windowMs * 2) {
        entries.delete(key);
      }
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = entries.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      entries.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil(
        (entry.windowStart + windowMs - now) / 1000,
      );
      res
        .status(429)
        .set("Retry-After", String(retryAfter))
        .json({ error: "too_many_requests" });
      return;
    }

    next();
  };
}

// --- Router factory ---

const authRateLimit = createRateLimiter(10, 60_000); // 10 req/min/IP
const tokenRateLimit = createRateLimiter(20, 60_000); // 20 req/min/IP

export function createOAuthRouter(): Router {
  const router = Router();

  // RFC 9728 — Protected Resource Metadata
  router.get(
    "/.well-known/oauth-protected-resource",
    (req: Request, res: Response) => {
      const url = getServerUrl(req);
      res.json({
        resource: url,
        authorization_servers: [url],
      });
    },
  );

  // RFC 8414 — Authorization Server Metadata
  router.get(
    "/.well-known/oauth-authorization-server",
    (req: Request, res: Response) => {
      const url = getServerUrl(req);
      res.json({
        issuer: url,
        authorization_endpoint: `${url}/oauth/authorize`,
        token_endpoint: `${url}/oauth/token`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
      });
    },
  );

  // Authorization endpoint — auto-approve for registered clients
  router.get(
    "/oauth/authorize",
    authRateLimit,
    (req: Request, res: Response) => {
      const clientId = req.query.client_id as string;
      const redirectUri = req.query.redirect_uri as string;
      const codeChallenge = req.query.code_challenge as string;
      const codeChallengeMethod = req.query.code_challenge_method as string;
      const state = req.query.state as string | undefined;

      // Validate client
      const client = clientId ? clients.get(clientId) : undefined;
      if (!client) {
        res.status(400).json({ error: "invalid_request", error_description: "Unknown client." });
        return;
      }

      // Validate redirect_uri
      if (!redirectUri) {
        res.status(400).json({ error: "invalid_request", error_description: "redirect_uri is required." });
        return;
      }

      // Validate redirect_uri is localhost or HTTPS (OAuth 2.1 / MCP spec requirement)
      if (!isValidRedirectUri(redirectUri)) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "redirect_uri must be a localhost URL or an HTTPS URL.",
        });
        return;
      }

      // Validate PKCE
      if (codeChallengeMethod !== "S256" || !codeChallenge) {
        res.status(400).json({ error: "invalid_request", error_description: "PKCE S256 is required." });
        return;
      }

      // Issue authorization code immediately (no user interaction needed)
      const code = randomId();
      authCodes.set(code, {
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        expires_at: Date.now() + AUTH_CODE_TTL,
      });

      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set("code", code);
      if (state) redirectUrl.searchParams.set("state", state);

      console.error(`[OAuth] Auto-approved authorization for client: ${client.client_name || clientId}`);
      res.redirect(redirectUrl.toString());
    },
  );

  // Token endpoint — code exchange and refresh
  router.post(
    "/oauth/token",
    tokenRateLimit,
    express.urlencoded({ extended: false, limit: "16kb" }),
    (req: Request, res: Response) => {
      const { grant_type } = req.body;

      if (grant_type === "authorization_code") {
        const { code, code_verifier, client_id, client_secret, redirect_uri } =
          req.body;

        const authCode = authCodes.get(code);
        if (!authCode) {
          res.status(400).json({ error: "invalid_grant" });
          return;
        }
        authCodes.delete(code);

        if (Date.now() > authCode.expires_at) {
          res.status(400).json({ error: "invalid_grant" });
          return;
        }
        if (authCode.client_id !== client_id) {
          res.status(400).json({ error: "invalid_grant" });
          return;
        }
        if (authCode.redirect_uri !== redirect_uri) {
          res.status(400).json({ error: "invalid_grant" });
          return;
        }

        // Verify client_secret
        const client = clients.get(client_id);
        if (
          !client ||
          !client_secret ||
          !safeCompare(client_secret, client.client_secret)
        ) {
          res.status(401).json({ error: "invalid_client" });
          return;
        }

        // Verify PKCE
        if (
          !code_verifier ||
          !verifyPKCE(code_verifier, authCode.code_challenge)
        ) {
          res.status(400).json({ error: "invalid_grant" });
          return;
        }

        // Issue tokens
        const access_token = randomId();
        const refresh_token = randomId();
        const now = Date.now();
        const record: TokenRecord = {
          client_id,
          access_token,
          access_expires_at: now + ACCESS_TOKEN_TTL,
          refresh_expires_at: now + REFRESH_TOKEN_TTL,
          refresh_token,
        };
        accessTokens.set(access_token, record);
        refreshTokens.set(refresh_token, record);

        res.json({
          access_token,
          token_type: "Bearer",
          expires_in: Math.floor(ACCESS_TOKEN_TTL / 1000),
          refresh_token,
        });
        return;
      }

      if (grant_type === "refresh_token") {
        const { refresh_token, client_id, client_secret } = req.body;

        const record = refreshTokens.get(refresh_token);
        if (!record || Date.now() > record.refresh_expires_at) {
          if (record) refreshTokens.delete(refresh_token);
          res.status(400).json({ error: "invalid_grant" });
          return;
        }

        // Verify client credentials (OAuth 2.1 requires confidential clients to
        // authenticate on refresh token grants)
        const client = clients.get(client_id);
        if (
          !client ||
          !client_secret ||
          !safeCompare(client_secret, client.client_secret)
        ) {
          res.status(401).json({ error: "invalid_client" });
          return;
        }

        // Ensure refresh token belongs to this client
        if (record.client_id !== client_id) {
          res.status(400).json({ error: "invalid_grant" });
          return;
        }

        // Revoke old access token (O(1) via stored key)
        accessTokens.delete(record.access_token);
        refreshTokens.delete(refresh_token);

        // Issue new tokens
        const new_access_token = randomId();
        const new_refresh_token = randomId();
        const now = Date.now();
        const newRecord: TokenRecord = {
          client_id: record.client_id,
          access_token: new_access_token,
          access_expires_at: now + ACCESS_TOKEN_TTL,
          refresh_expires_at: now + REFRESH_TOKEN_TTL,
          refresh_token: new_refresh_token,
        };
        accessTokens.set(new_access_token, newRecord);
        refreshTokens.set(new_refresh_token, newRecord);

        res.json({
          access_token: new_access_token,
          token_type: "Bearer",
          expires_in: Math.floor(ACCESS_TOKEN_TTL / 1000),
          refresh_token: new_refresh_token,
        });
        return;
      }

      res.status(400).json({ error: "unsupported_grant_type" });
    },
  );

  // Compatibility aliases — some MCP clients (e.g. Claude Desktop) hit
  // /authorize and /token directly, ignoring the well-known metadata that
  // advertises /oauth/authorize and /oauth/token.
  router.get("/authorize", (req: Request, res: Response) => {
    const qs = new URLSearchParams(req.query as Record<string, string>);
    res.redirect(307, `/oauth/authorize?${qs.toString()}`);
  });
  router.post("/token", (req: Request, res: Response) => {
    res.redirect(307, "/oauth/token");
  });

  return router;
}

// --- Middleware to protect /mcp with Bearer tokens ---

export function requireBearerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    console.error(
      `[Auth] Rejected ${req.method} ${req.path} — no Bearer token`,
    );
    res.status(401).set("WWW-Authenticate", "Bearer").json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Unauthorized" },
      id: null,
    });
    return;
  }

  const token = header.slice(7);
  const record = accessTokens.get(token);
  if (!record || Date.now() > record.access_expires_at) {
    console.error(
      `[Auth] Rejected ${req.method} ${req.path} — token invalid or expired`,
    );
    if (record) accessTokens.delete(token);
    res.status(401).set("WWW-Authenticate", "Bearer").json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Unauthorized" },
      id: null,
    });
    return;
  }

  console.error(`[Auth] Accepted ${req.method} ${req.path} — token valid`);
  next();
}
