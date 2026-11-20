import { getCloudflareContext } from "@opennextjs/cloudflare";

const SESSION_COOKIE = "tpid_session";
const SESSION_DAYS = 30;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100_000, hash: "SHA-256" },
    key,
    256
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return { hash, salt: bytesToBase64Url(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const actual = await derivePasswordHash(password, base64UrlToBytes(salt));
  return actual === hash;
}

export async function createSession(database: any, userId: string) {
  const rawToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await database
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(tokenHash, userId, expiresAt, new Date().toISOString())
    .run();

  return { rawToken, expiresAt };
}

export async function getDb() {
  const { env } = getCloudflareContext();
  return (env as any).DB;
}

export async function ensureAuthSchema(database: any) {
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    )
    .run();
}

export async function getAuthenticatedUser(request: Request) {
  const database = await getDb();
  if (!database) return { database: null, user: null };

  await ensureAuthSchema(database);

  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)tpid_session=([^;]+)/);
  if (!match) return { database, user: null };

  const tokenHash = await sha256(decodeURIComponent(match[1]));
  const row = await database
    .prepare(
      `SELECT u.id, u.email, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .bind(tokenHash)
    .first();

  if (!row) return { database, user: null };

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await database.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return { database, user: null };
  }

  return { database, user: { id: row.id as string, email: row.email as string } };
}

export function setSessionCookie(response: Response, rawToken: string, expiresAt: string) {
  const cookie = [
    `${SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ].join("; ");
  response.headers.append("Set-Cookie", cookie);
}

export function clearSessionCookie(response: Response) {
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

export async function deleteCurrentSession(request: Request) {
  const database = await getDb();
  if (!database) return;

  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)tpid_session=([^;]+)/);
  if (!match) return;

  const tokenHash = await sha256(decodeURIComponent(match[1]));
  await database.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}
