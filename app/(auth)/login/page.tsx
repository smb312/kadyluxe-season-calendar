"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/list";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    // Full navigation so the server (middleware) picks up the new session cookie.
    window.location.assign(next);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <header className="border-b-2 border-ink pb-3 mb-8">
          <h1 className="font-serif text-[34px] font-bold leading-none tracking-[-0.02em]">
            Season <span className="font-light italic">Calendar</span>
          </h1>
          <div className="font-mono text-[11px] tracking-[0.09em] uppercase text-ink-60 mt-2">
            KADYLUXE · Sign in
          </div>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-rule bg-[#FBFAF6] text-ink focus:border-ink focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block font-mono text-[10px] tracking-[0.1em] uppercase text-ink-38 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-rule bg-[#FBFAF6] text-ink focus:border-ink focus:outline-none"
            />
          </div>

          {error && (
            <div className="border-l-[3px] border-gate bg-[rgba(159,18,57,0.05)] px-3 py-2 text-[12px] text-gate">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-ink text-paper py-2.5 text-[13px] font-medium hover:bg-black disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 font-mono text-[10px] tracking-[0.06em] uppercase text-ink-38 leading-relaxed">
          Accounts are created by the admin. No self-signup. Forgot your password?
          Ask Scott to reset it.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
