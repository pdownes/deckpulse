"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Slide {
  id: string;
  slide_number: number;
  image_path: string;
}

interface FeedbackItem {
  id: string;
  slide_number: number;
  author_name: string;
  feedback_type: string;
  content: string;
  created_at: string;
}

interface Presentation {
  id: string;
  title: string;
  share_code: string;
  presenter_code: string;
  slide_count: number;
  is_live: number;
  current_slide: number;
  slides: Slide[];
}

export default function PresenterDashboard() {
  const params = useParams();
  const code = params.code as string;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState("");
  const [filterSlide, setFilterSlide] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load presentation
  useEffect(() => {
    fetch(`/api/presentations/${code}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setPresentation(data);
        setCurrentSlide(data.current_slide || 1);
        setIsLive(!!data.is_live);
      })
      .catch(() => setError("Presentation not found"));
  }, [code]);

  // Load all feedback via regular fetch (reliable, works on refresh)
  useEffect(() => {
    if (!presentation) return;
    fetch(`/api/presentations/${code}/feedback`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setFeedback(data);
      })
      .catch(() => {});
  }, [presentation, code]);

  // SSE for real-time new feedback only
  useEffect(() => {
    if (!presentation) return;

    let closed = false;

    function connect() {
      const es = new EventSource(
        `/api/presentations/${code}/feedback/stream`
      );
      eventSourceRef.current = es;

      es.addEventListener("new_feedback", (e) => {
        const newItems: FeedbackItem[] = JSON.parse(e.data);
        setFeedback((prev) => {
          const existingIds = new Set(prev.map((f) => f.id));
          const unique = newItems.filter((f) => !existingIds.has(f.id));
          return unique.length > 0 ? [...unique, ...prev] : prev;
        });
      });

      es.onerror = () => {
        es.close();
        if (!closed) {
          setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      eventSourceRef.current?.close();
    };
  }, [presentation, code]);

  // Update current slide on server
  const updateSlide = useCallback(
    async (slideNum: number) => {
      setCurrentSlide(slideNum);
      setSummary("");
      if (presentation) {
        await fetch(`/api/presentations/${code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ current_slide: slideNum }),
        });
      }
    },
    [code, presentation]
  );

  // Toggle live mode
  async function toggleLive() {
    const newLive = !isLive;
    setIsLive(newLive);
    await fetch(`/api/presentations/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_live: newLive }),
    });
  }

  // Get AI summary
  async function fetchSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch(
        `/api/presentations/${code}/summary?context=live&slide=${currentSlide}`
      );
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      setSummary("Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Error</h1>
          <p className="text-slate-500">{error}</p>
          <Link href="/" className="text-indigo-600 hover:underline mt-4 block">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading presentation...</p>
      </div>
    );
  }

  const currentSlideData = presentation.slides.find(
    (s) => s.slide_number === currentSlide
  );

  const filteredFeedback = filterSlide
    ? feedback.filter((f) => f.slide_number === filterSlide)
    : feedback;

  const questions = filteredFeedback.filter((f) => f.feedback_type === "question");
  const comments = filteredFeedback.filter((f) => f.feedback_type !== "question");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xl font-bold text-indigo-600 dark:text-indigo-400"
            >
              DeckPulse
            </Link>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <h2 className="font-medium truncate max-w-xs">
              {presentation.title}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-sm">
              Audience code:{" "}
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {presentation.share_code}
              </span>
            </div>

            <button
              onClick={toggleLive}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isLive
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-emerald-500 text-white hover:bg-emerald-600"
              }`}
            >
              {isLive ? "End Session" : "Go Live"}
            </button>

            <Link
              href={`/review/${presentation.presenter_code}`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
            >
              Review
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Left: Slide viewer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {currentSlideData && (
              <div className="aspect-video bg-slate-900 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentSlideData.image_path}
                  alt={`Slide ${currentSlide}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}

            {/* Slide navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => updateSlide(Math.max(1, currentSlide - 1))}
                disabled={currentSlide <= 1}
                className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm font-medium">
                Slide {currentSlide} of {presentation.slide_count}
              </span>
              <button
                onClick={() =>
                  updateSlide(
                    Math.min(presentation.slide_count, currentSlide + 1)
                  )
                }
                disabled={currentSlide >= presentation.slide_count}
                className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>

          {/* Slide thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {presentation.slides.map((slide) => (
              <button
                key={slide.id}
                onClick={() => updateSlide(slide.slide_number)}
                className={`flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  currentSlide === slide.slide_number
                    ? "border-indigo-500"
                    : "border-transparent hover:border-slate-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.image_path}
                  alt={`Slide ${slide.slide_number}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>

          {/* AI Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">AI Summary — Slide {currentSlide}</h3>
              <button
                onClick={fetchSummary}
                disabled={summaryLoading || feedback.length === 0}
                className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {summaryLoading ? "Generating..." : "Generate Summary"}
              </button>
            </div>
            {summary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                {summary}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                {feedback.length === 0
                  ? "Waiting for audience feedback..."
                  : "Click 'Generate Summary' to see AI-powered themes and key questions."}
              </p>
            )}
          </div>
        </div>

        {/* Right: Live feedback */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                Feedback{" "}
                <span className="text-sm font-normal text-slate-400">
                  ({feedback.length})
                </span>
              </h3>
              {isLive && (
                <span className="flex items-center gap-1.5 text-xs text-red-500">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>

            {/* Filter by slide */}
            <div className="flex gap-1 mb-3 flex-wrap">
              <button
                onClick={() => setFilterSlide(null)}
                className={`px-2 py-1 text-xs rounded ${
                  filterSlide === null
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                All
              </button>
              {Array.from(
                { length: presentation.slide_count },
                (_, i) => i + 1
              ).map((n) => (
                <button
                  key={n}
                  onClick={() => setFilterSlide(n)}
                  className={`px-2 py-1 text-xs rounded ${
                    filterSlide === n
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  S{n}
                </button>
              ))}
            </div>
          </div>

          {/* Questions */}
          {questions.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
              <h4 className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-2">
                Questions ({questions.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="bg-white dark:bg-slate-800 rounded-lg p-2.5 text-sm border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Slide {q.slide_number}
                      </span>
                      <span className="text-xs text-slate-400">
                        {q.author_name}
                      </span>
                    </div>
                    <p>{q.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments/Notes stream */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <h4 className="font-semibold text-sm mb-2">
              Comments & Notes ({comments.length})
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                  No feedback yet. Share the code{" "}
                  <span className="font-mono font-bold">
                    {presentation.share_code}
                  </span>{" "}
                  with your audience.
                </p>
              ) : (
                comments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg p-2.5 text-sm bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          item.feedback_type === "note"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {item.feedback_type}
                      </span>
                      <span className="text-xs text-slate-400">
                        S{item.slide_number} &middot; {item.author_name}
                      </span>
                    </div>
                    <p>{item.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
