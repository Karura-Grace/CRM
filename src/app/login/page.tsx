import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSession()) redirect("/dashboard");
  const { next } = await searchParams;
  const s = await getSettings();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="text-2xl font-bold">{s.company_name}</div>
          <div className="text-sm text-brand-200">Sign in to your workspace</div>
        </div>
        <div className="card">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
