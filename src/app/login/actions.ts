"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { attemptLogin } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const res = await attemptLogin(parsed.data.email, parsed.data.password);
  if (!res.ok) return { error: res.error };
  const next = parsed.data.next && parsed.data.next.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/dashboard";
  redirect(next);
}
