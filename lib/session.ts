import { cookies } from "next/headers";
import { type YahooTokens } from "./yahoo/client";

const COOKIE_NAME = "yh_session";
const SECRET = process.env.SESSION_SECRET ?? "";

/**
 * Minimal AES-GCM encrypt/decrypt using Web Crypto (available in Edge + Node 20+).
 * Stores Yahoo tokens as an encrypted cookie so users stay logged in.
 */

async function deriveKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET.padEnd(32, "0").slice(0, 32)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
  return keyMaterial;
}

function toBase64(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64url");
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64url"));
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encoded,
  );
  return `${toBase64(iv.buffer as ArrayBuffer)}.${toBase64(ciphertext)}`;
}

async function decrypt(token: string): Promise<string> {
  const [ivPart, ctPart] = token.split(".");
  if (!ivPart || !ctPart) throw new Error("Invalid session token");
  const key = await deriveKey();
  const iv = fromBase64(ivPart);
  const ciphertext = fromBase64(ctPart);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(plaintext);
}

export async function setSession(tokens: YahooTokens): Promise<void> {
  const jar = await cookies();
  const encrypted = await encrypt(JSON.stringify(tokens));
  jar.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days (refresh token lasts longer)
  });
}

export async function getSession(): Promise<YahooTokens | null> {
  try {
    const jar = await cookies();
    const cookie = jar.get(COOKIE_NAME);
    if (!cookie?.value) return null;
    const json = await decrypt(cookie.value);
    return JSON.parse(json) as YahooTokens;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}