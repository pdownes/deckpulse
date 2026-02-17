"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  const urlError = searchParams.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send link");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 w-full max-w-md">
      {sent ? (
        <div className="text-center">
          <div className="text-4xl mb-4">&#9993;</div>
          <h2 className="text-xl font-semibold mb-2">Check your email</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            We sent a login link to <strong>{email}</strong>. Click the link to
            access your presentations.
          </p>
          <p className="text-slate-400 text-xs mt-4">
            The link expires in 15 minutes.
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-2">
            Access Your Presentations
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
            Enter the email you used when uploading. We&apos;ll send you a login
            link.
          </p>

          {urlError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg mb-4">
              {urlError === "invalid_or_expired"
                ? "That link has expired or already been used. Please request a new one."
                : "Something went wrong. Please try again."}
            </div>
          )}

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="presenter@example.com"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Sending..." : "Send Login Link"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-bold text-indigo-600 dark:text-indigo-400"
          >
            DeckPulse
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <Suspense
          fallback={
            <div className="text-slate-500">Loading...</div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
