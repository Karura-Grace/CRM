"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</div>}
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="field-label">Email</span>
        <input name="email" type="email" required autoComplete="email" className="field-input" autoFocus />
      </label>
      <label className="block">
        <span className="field-label">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="field-input" />
      </label>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
