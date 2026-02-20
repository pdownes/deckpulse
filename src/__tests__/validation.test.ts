import { describe, it, expect } from "vitest";

// Test the validation logic used in API routes (extracted for testability)

const VALID_FEEDBACK_TYPES = ["comment", "question", "note"];
const MAX_CONTENT_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;

function validateFeedback(body: Record<string, unknown>, slideCount: number) {
  const { slide_number, content, author_name, feedback_type } = body;

  if (!slide_number || !content || typeof content !== "string") {
    return { error: "slide_number and content are required" };
  }

  const slideNum = Number(slide_number);
  if (!Number.isInteger(slideNum) || slideNum < 1 || slideNum > slideCount) {
    return { error: "Invalid slide number" };
  }

  const trimmedContent = String(content).slice(0, MAX_CONTENT_LENGTH).trim();
  if (!trimmedContent) {
    return { error: "Content cannot be empty" };
  }

  const type = VALID_FEEDBACK_TYPES.includes(feedback_type as string)
    ? (feedback_type as string)
    : "comment";
  const name = typeof author_name === "string"
    ? author_name.slice(0, MAX_NAME_LENGTH).trim() || "Anonymous"
    : "Anonymous";

  return { slideNum, content: trimmedContent, type, name };
}

function validateEmail(email: unknown): boolean {
  return typeof email === "string" && /^.+@.+\..+$/.test(email);
}

describe("Feedback Validation", () => {
  it("rejects missing slide_number", () => {
    const result = validateFeedback({ content: "hello" }, 10);
    expect(result).toHaveProperty("error");
  });

  it("rejects missing content", () => {
    const result = validateFeedback({ slide_number: 1 }, 10);
    expect(result).toHaveProperty("error");
  });

  it("rejects non-string content", () => {
    const result = validateFeedback({ slide_number: 1, content: 123 }, 10);
    expect(result).toHaveProperty("error");
  });

  it("rejects slide_number = 0", () => {
    const result = validateFeedback({ slide_number: 0, content: "hello" }, 10);
    expect(result).toHaveProperty("error");
  });

  it("rejects negative slide_number", () => {
    const result = validateFeedback({ slide_number: -1, content: "hello" }, 10);
    expect(result).toHaveProperty("error");
  });

  it("rejects slide_number beyond slide_count", () => {
    const result = validateFeedback({ slide_number: 11, content: "hello" }, 10);
    expect(result).toHaveProperty("error");
  });

  it("rejects non-integer slide_number", () => {
    const result = validateFeedback({ slide_number: 1.5, content: "hello" }, 10);
    expect(result).toHaveProperty("error");
  });

  it("accepts valid feedback", () => {
    const result = validateFeedback(
      { slide_number: 1, content: "Great slide!", author_name: "Alice", feedback_type: "comment" },
      10
    );
    expect(result).not.toHaveProperty("error");
    expect(result).toMatchObject({ slideNum: 1, content: "Great slide!", type: "comment", name: "Alice" });
  });

  it("defaults feedback_type to comment for invalid types", () => {
    const result = validateFeedback(
      { slide_number: 1, content: "hello", feedback_type: "evil_type" },
      10
    );
    expect(result).toHaveProperty("type", "comment");
  });

  it("defaults author_name to Anonymous when missing", () => {
    const result = validateFeedback(
      { slide_number: 1, content: "hello" },
      10
    );
    expect(result).toHaveProperty("name", "Anonymous");
  });

  it("truncates long content to MAX_CONTENT_LENGTH", () => {
    const longContent = "x".repeat(3000);
    const result = validateFeedback(
      { slide_number: 1, content: longContent },
      10
    );
    expect(result).not.toHaveProperty("error");
    if ("content" in result) {
      expect(result.content.length).toBeLessThanOrEqual(MAX_CONTENT_LENGTH);
    }
  });

  it("truncates long author_name to MAX_NAME_LENGTH", () => {
    const longName = "x".repeat(200);
    const result = validateFeedback(
      { slide_number: 1, content: "hello", author_name: longName },
      10
    );
    if ("name" in result) {
      expect(result.name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
    }
  });

  it("rejects whitespace-only content", () => {
    const result = validateFeedback({ slide_number: 1, content: "   " }, 10);
    expect(result).toHaveProperty("error");
  });
});

describe("Email Validation", () => {
  it("accepts valid email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  it("rejects string without @", () => {
    expect(validateEmail("not-an-email")).toBe(false);
  });

  it("rejects @ only", () => {
    expect(validateEmail("@")).toBe(false);
  });

  it("rejects @@", () => {
    expect(validateEmail("@@")).toBe(false);
  });

  it("rejects missing domain extension", () => {
    expect(validateEmail("user@localhost")).toBe(false);
  });

  it("rejects non-string", () => {
    expect(validateEmail(123)).toBe(false);
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
  });

  it("accepts email with subdomain", () => {
    expect(validateEmail("user@sub.domain.com")).toBe(true);
  });
});

describe("HTML Escaping", () => {
  function escHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  it("escapes angle brackets", () => {
    expect(escHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes double quotes", () => {
    expect(escHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  it("leaves safe strings unchanged", () => {
    expect(escHtml("Hello world 123")).toBe("Hello world 123");
  });
});

describe("SQLite Datetime Conversion", () => {
  function toSqliteDatetime(date: Date): string {
    return date.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
  }

  it("converts JS Date to SQLite format", () => {
    const date = new Date("2026-02-20T14:30:45.123Z");
    expect(toSqliteDatetime(date)).toBe("2026-02-20 14:30:45");
  });

  it("removes milliseconds", () => {
    const result = toSqliteDatetime(new Date());
    expect(result).not.toContain(".");
    expect(result).not.toContain("Z");
    expect(result).not.toContain("T");
  });

  it("produces format comparable with SQLite datetime()", () => {
    const result = toSqliteDatetime(new Date());
    // Should match YYYY-MM-DD HH:MM:SS format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
