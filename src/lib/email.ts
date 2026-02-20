import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "DeckPulse <onboarding@resend.dev>";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendMagicLinkEmail(
  to: string,
  token: string
): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const link = `${baseUrl}/api/auth/verify?token=${token}`;

  if (!resend) {
    console.log("=== Magic Link (no RESEND_API_KEY configured) ===");
    console.log(`To: ${to}`);
    console.log(`Link: ${link}`);
    console.log("================================================");
    return true;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Your DeckPulse login link",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">DeckPulse</h2>
        <p>Click the link below to sign in and access your presentations:</p>
        <a href="${link}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Sign in to DeckPulse
        </a>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
          This link expires in 15 minutes. If you didn't request this, you can safely ignore it.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send magic link email:", error);
    return false;
  }

  return true;
}

interface FeedbackReportItem {
  slide_number: number;
  author_name: string;
  feedback_type: string;
  content: string;
  created_at: string;
}

export async function sendFeedbackReportEmail(
  to: string,
  presentationTitle: string,
  feedback: FeedbackReportItem[]
): Promise<boolean> {
  const questions = feedback.filter((f) => f.feedback_type === "question");
  const comments = feedback.filter((f) => f.feedback_type !== "question");

  const feedbackBySlide = new Map<number, FeedbackReportItem[]>();
  for (const item of feedback) {
    const group = feedbackBySlide.get(item.slide_number) || [];
    group.push(item);
    feedbackBySlide.set(item.slide_number, group);
  }

  const slideRows = Array.from(feedbackBySlide.entries())
    .sort((a, b) => a[0] - b[0])
    .map(
      ([slideNum, items]) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-weight: 600;">
            Slide ${slideNum}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
            ${items
              .map(
                (item) =>
                  `<div style="margin-bottom: 8px;">
                    <span style="font-size: 12px; background: ${
                      item.feedback_type === "question" ? "#fef3c7" : "#f1f5f9"
                    }; padding: 2px 6px; border-radius: 4px;">${escHtml(item.feedback_type)}</span>
                    <strong style="font-size: 12px; margin-left: 4px;">${escHtml(item.author_name)}:</strong>
                    <span>${escHtml(item.content)}</span>
                  </div>`
              )
              .join("")}
          </td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">DeckPulse — Feedback Report</h2>
      <h3>${escHtml(presentationTitle)}</h3>
      <p style="color: #64748b;">
        ${feedback.length} total responses &middot;
        ${questions.length} questions &middot;
        ${comments.length} comments/notes &middot;
        ${new Set(feedback.map((f) => f.author_name)).size} participants
      </p>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; width: 100px;">Slide</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Feedback</th>
          </tr>
        </thead>
        <tbody>
          ${slideRows}
        </tbody>
      </table>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
        Sent from DeckPulse
      </p>
    </div>
  `;

  if (!resend) {
    console.log("=== Feedback Report Email (no RESEND_API_KEY configured) ===");
    console.log(`To: ${to}`);
    console.log(`Subject: Feedback Report — ${presentationTitle}`);
    console.log("(HTML email body logged to console)");
    console.log("============================================================");
    return true;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Feedback Report — ${presentationTitle}`,
    html,
  });

  if (error) {
    console.error("Failed to send feedback report email:", error);
    return false;
  }

  return true;
}
