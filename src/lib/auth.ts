import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { staff } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session";

export type { SessionPayload } from "./session";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Decode the session cookie and confirm the staff row is still active. Cached per request. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token);
  if (!payload) return null;
  const row = await db.query.staff.findFirst({
    where: eq(staff.id, payload.staffId),
    columns: { id: true, active: true, role: true, firstName: true, lastName: true },
  });
  if (!row || !row.active) return null;
  // Database is the source of truth for role, in case it changed since sign-in.
  return { staffId: row.id, role: row.role, name: `${row.firstName} ${row.lastName}` };
});

/** For Server Components & Server Actions: fail closed when there is no session. */
export async function requireUser(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const s = await requireUser();
  if (s.role !== "admin") throw new Error("Forbidden: administrator access required.");
  return s;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function attemptLogin(email: string, password: string): Promise<LoginResult> {
  const found = await db.query.staff.findFirst({ where: eq(staff.email, email.trim().toLowerCase()) });
  if (!found || !(await bcrypt.compare(password, found.passwordHash))) {
    return { ok: false, error: "Invalid email or password." };
  }
  if (!found.active) return { ok: false, error: "This account has been deactivated." };
  await db.update(staff).set({ lastLogin: new Date().toISOString() }).where(eq(staff.id, found.id));
  await createSession({ staffId: found.id, role: found.role, name: `${found.firstName} ${found.lastName}` });
  return { ok: true };
}
