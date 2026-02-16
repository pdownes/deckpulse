"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Slide {
  id: string;
  slide_number: number;
  image_path: string;
}

interface Presentation {
  id: string;
  title: string;
  share_code: string;
  slide_count: number;
  current_slide: number;
  slides: Slide[];
}

interface FeedbackItem {
  id: string;
  slide_number: number;
  feedback_type: string;
  content: string;
  created_at: string;
}

export default function AudienceView() {
  const params = useParams();
  const code = params.code as string;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [authorName, setAuthorName] = useState("");
  const [content, setContent] = useState("");
  const [feedbackType, setFeedbackType] = useState<"comment" | "question" | "note">("comment");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<FeedbackItem[]>([]);
  const [error, setError] = useState("");
  const [nameSet, setNameSet] = useState(false);

  useEffect(() => {
    fetch(`/api/presentations/${code}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setPresentation(data);
        if (data.current_slide > 0) {
          setCurrentSlide(data.current_slide);
        }
      })
      .catch(() => setError("Session not found. Check your code and try again."));
  }, [code]);

  // Poll for presenter's current slide
  useEffect(() => {
    if (!presentation) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/presentations/${code}`);
        if (res.ok) {
          const data = await res.json();
          if (data.current_slide > 0) {
            setCurrentSlide(data.current_slide);
          }
        }
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [presentation, code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/presentations/${code}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slide_number: currentSlide,
          content: content.trim(),
          author_name: authorName || "Anonymous",
          feedback_type: feedbackType,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");

      const data = await res.json();
      setSubmitted((prev) => [data, ...prev]);
      setContent("");
    } catch {
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Oops</h1>
          <p className="text-slate-500 mb-4">{error}</p>
          <Link href="/" className="text-indigo-600 hover:underline">
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

  // Name entry screen
  if (!nameSet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full">
          <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">
            DeckPulse
          </h1>
          <h2 className="text-lg font-semibold mb-1">{presentation.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {presentation.slide_count} slides
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Your Name (optional)
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Anonymous"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => setNameSet(true)}
              className="w-full bg-emerald-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Join Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSlideData = presentation.slides.find(
    (s) => s.slide_number === currentSlide
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              DeckPulse
            </span>
            <span className="text-slate-300 dark:text-slate-600 mx-2">|</span>
            <span className="text-sm font-medium truncate">
              {presentation.title}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {authorName || "Anonymous"}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-4 space-y-4">
        {/* Slide viewer */}
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
              onClick={() => setCurrentSlide(Math.max(1, currentSlide - 1))}
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
                setCurrentSlide(
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

        {/* Feedback form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="font-semibold text-sm mb-3">
            Share your feedback for Slide {currentSlide}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Type selector */}
            <div className="flex gap-2">
              {(["comment", "question", "note"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFeedbackType(type)}
                  className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${
                    feedbackType === type
                      ? type === "question"
                        ? "bg-amber-500 text-white"
                        : type === "note"
                        ? "bg-blue-500 text-white"
                        : "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                feedbackType === "question"
                  ? "What question would you like answered?"
                  : feedbackType === "note"
                  ? "Add a note about this slide..."
                  : "Share your comment..."
              }
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />

            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Submitting..." : `Submit ${feedbackType}`}
            </button>
          </form>
        </div>

        {/* My submissions */}
        {submitted.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-semibold text-sm mb-2">
              Your Submissions ({submitted.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {submitted.map((item) => (
                <div
                  key={item.id}
                  className="text-sm rounded-lg p-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600"
                >
                  <span className="text-xs text-slate-400">
                    Slide {item.slide_number} &middot; {item.feedback_type}
                  </span>
                  <p className="mt-0.5">{item.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slide thumbnails for navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {presentation.slides.map((slide) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(slide.slide_number)}
              className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
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
      </main>
    </div>
  );
}
