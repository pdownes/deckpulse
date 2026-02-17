"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PresentationRow {
  id: string;
  title: string;
  share_code: string;
  presenter_code: string;
  slide_count: number;
  is_live: number;
  created_at: string;
  feedback_count: number;
}

export default function MyPresentationsPage() {
  const [presentations, setPresentations] = useState<PresentationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const sessionRes = await fetch("/api/auth/session");
      if (!sessionRes.ok) {
        router.push("/login");
        return;
      }
      const session = await sessionRes.json();
      setEmail(session.email);

      const res = await fetch("/api/my-presentations");
      if (res.ok) {
        setPresentations(await res.json());
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-2xl font-bold text-indigo-600 dark:text-indigo-400"
            >
              DeckPulse
            </Link>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-sm font-medium">My Presentations</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {presentations.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold mb-2">No presentations yet</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Upload a presentation from the home page to get started.
            </p>
            <Link
              href="/"
              className="inline-block bg-indigo-600 text-white py-2.5 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Upload a Presentation
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {presentations.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{p.title}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                    <span>{p.slide_count} slides</span>
                    <span>{p.feedback_count} responses</span>
                    <span>
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                    {p.is_live ? (
                      <span className="text-red-500 font-medium">LIVE</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Audience code:{" "}
                    <span className="font-mono font-bold text-indigo-500">
                      {p.share_code}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Link
                    href={`/present/${p.presenter_code}`}
                    className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href={`/review/${p.presenter_code}`}
                    className="px-3 py-1.5 text-sm rounded-lg bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
