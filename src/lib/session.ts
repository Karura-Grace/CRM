/**
 * Edge-safe JWT helpers (no database, no Node APIs) — shared by proxy.ts and auth.ts.
 */
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "pac_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type Role = "admin" | "staff";
export interface SessionPayload {
  staffId: number;
  role: Role;
  name: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (min 16 chars). Set it in .env.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.staffId !== "number" || (payload.role !== "admin" && payload.role !== "staff")) return null;
    return { staffId: payload.staffId, role: payload.role, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
