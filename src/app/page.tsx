"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name.replace(".pptx", ""));
      if (email) formData.append("email", email);

      const res = await fetch("/api/presentations", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      router.push(`/present/${data.presenterCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (joinCode.trim()) {
      router.push(`/join/${joinCode.trim().toUpperCase()}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            DeckPulse
          </h1>
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Live Presentation Feedback
            </p>
            <Link
              href="/my-presentations"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              My Presentations
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Presenter: Upload */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-xl font-semibold mb-2">Presenter</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Upload a PowerPoint to create a feedback session
            </p>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Presentation Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q1 Strategy Review"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Your Email <span className="text-slate-400 font-normal">(to access later)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="presenter@example.com"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  PowerPoint File (.pptx)
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
                  <input
                    type="file"
                    accept=".pptx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
                  />
                  {file && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={!file || uploading}
                className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? "Processing slides..." : "Upload & Create Session"}
              </button>
            </form>
          </div>

          {/* Audience: Join */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-xl font-semibold mb-2">Audience</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Join a presentation to give feedback
            </p>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Session Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                  maxLength={6}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-2xl tracking-widest font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={joinCode.trim().length < 4}
                className="w-full bg-emerald-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Join Session
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                How it works
              </h3>
              <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                <li>1. Get the session code from the presenter</li>
                <li>2. View each slide and share your thoughts</li>
                <li>3. Submit questions, comments, or notes</li>
                <li>4. Your feedback is shared with the presenter in real time</li>
              </ol>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-700 py-4 text-center text-sm text-slate-400">
        DeckPulse — Real-time presentation feedback
      </footer>
    </div>
  );
}
