"use client";

import { useEffect, useState } from "react";
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
  slides: Slide[];
}

export default function ReviewPage() {
  const params = useParams();
  const code = params.code as string;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [selectedSlide, setSelectedSlide] = useState<number | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/presentations/${code}`).then((r) => r.json()),
      fetch(`/api/presentations/${code}/feedback`).then((r) => r.json()),
    ])
      .then(([pres, fb]) => {
        if (pres.error) throw new Error(pres.error);
        setPresentation(pres);
        setFeedback(fb);
      })
      .catch(() => setError("Presentation not found"));
  }, [code]);

  async function fetchSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch(
        `/api/presentations/${code}/summary?context=review`
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
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  const filteredFeedback = selectedSlide
    ? feedback.filter((f) => f.slide_number === selectedSlide)
    : feedback;

  const feedbackBySlide = new Map<number, FeedbackItem[]>();
  for (const item of feedback) {
    const group = feedbackBySlide.get(item.slide_number) || [];
    group.push(item);
    feedbackBySlide.set(item.slide_number, group);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xl font-bold text-indigo-600 dark:text-indigo-400"
            >
              DeckPulse
            </Link>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <h2 className="font-medium">{presentation.title}</h2>
            <span className="text-sm text-slate-400">Post-Session Review</span>
          </div>
          <Link
            href={`/present/${presentation.presenter_code}`}
            className="text-sm text-indigo-600 hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">
              {feedback.length}
            </p>
            <p className="text-sm text-slate-500">Total Responses</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {feedback.filter((f) => f.feedback_type === "question").length}
            </p>
            <p className="text-sm text-slate-500">Questions</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {feedback.filter((f) => f.feedback_type === "comment").length}
            </p>
            <p className="text-sm text-slate-500">Comments</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {new Set(feedback.map((f) => f.author_name)).size}
            </p>
            <p className="text-sm text-slate-500">Participants</p>
          </div>
        </div>

        {/* AI Summary */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">AI Summary</h3>
            <button
              onClick={fetchSummary}
              disabled={summaryLoading || feedback.length === 0}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {summaryLoading ? "Generating..." : "Generate Comprehensive Summary"}
            </button>
          </div>
          {summary ? (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {summary}
            </div>
          ) : (
            <p className="text-slate-400">
              Generate a comprehensive AI summary of all audience feedback.
            </p>
          )}
        </div>

        {/* Slide-by-slide review */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Feedback by Slide</h3>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setSelectedSlide(null)}
                className={`px-2 py-1 text-xs rounded ${
                  selectedSlide === null
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700"
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
                  onClick={() => setSelectedSlide(n)}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedSlide === n
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                >
                  S{n}{" "}
                  <span className="opacity-60">
                    ({feedbackBySlide.get(n)?.length || 0})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedSlide ? (
            // Single slide view
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {(() => {
                  const slide = presentation.slides.find(
                    (s) => s.slide_number === selectedSlide
                  );
                  return slide ? (
                    <div className="aspect-video bg-slate-900 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slide.image_path}
                        alt={`Slide ${selectedSlide}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="space-y-2">
                {filteredFeedback.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    No feedback for this slide
                  </p>
                ) : (
                  filteredFeedback.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            item.feedback_type === "question"
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                              : item.feedback_type === "note"
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                              : "bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {item.feedback_type}
                        </span>
                        <span className="text-xs text-slate-400">
                          {item.author_name}
                        </span>
                        <span className="text-xs text-slate-300">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p>{item.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            // All slides overview
            <div className="space-y-6">
              {presentation.slides.map((slide) => {
                const slideFeedback = feedbackBySlide.get(slide.slide_number) || [];
                return (
                  <div
                    key={slide.id}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                  >
                    <div className="grid md:grid-cols-3 gap-0">
                      <div className="aspect-video bg-slate-900 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slide.image_path}
                          alt={`Slide ${slide.slide_number}`}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="md:col-span-2 p-4">
                        <h4 className="font-semibold text-sm mb-2">
                          Slide {slide.slide_number}{" "}
                          <span className="font-normal text-slate-400">
                            ({slideFeedback.length} responses)
                          </span>
                        </h4>
                        {slideFeedback.length === 0 ? (
                          <p className="text-sm text-slate-400">No feedback</p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {slideFeedback.map((item) => (
                              <div
                                key={item.id}
                                className="text-sm rounded p-2 bg-slate-50 dark:bg-slate-700/50"
                              >
                                <span
                                  className={`text-xs font-medium mr-2 ${
                                    item.feedback_type === "question"
                                      ? "text-amber-600"
                                      : item.feedback_type === "note"
                                      ? "text-blue-600"
                                      : "text-slate-500"
                                  }`}
                                >
                                  [{item.feedback_type}]
                                </span>
                                <span className="text-xs text-slate-400 mr-2">
                                  {item.author_name}:
                                </span>
                                {item.content}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
