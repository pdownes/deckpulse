interface FeedbackItem {
  content: string;
  feedback_type: string;
  slide_number: number;
  author_name: string;
}

/**
 * Summarize feedback using the Anthropic Claude API.
 * Falls back to a simple local summary if no API key is configured.
 */
export async function summarizeFeedback(
  feedbackItems: FeedbackItem[],
  context: "live" | "review" = "live"
): Promise<string> {
  if (feedbackItems.length === 0) {
    return "No feedback submitted yet.";
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    return await claudeSummarize(feedbackItems, context, apiKey);
  }

  return localSummarize(feedbackItems, context);
}

async function claudeSummarize(
  feedbackItems: FeedbackItem[],
  context: "live" | "review",
  apiKey: string
): Promise<string> {
  const feedbackText = feedbackItems
    .map(
      (f) =>
        `[Slide ${f.slide_number}] (${f.feedback_type}) ${f.author_name}: ${f.content}`
    )
    .join("\n");

  const prompt =
    context === "live"
      ? `You are helping a panel moderator during a live presentation. Below is audience feedback collected in real-time. Summarize the main themes, key questions the audience wants answered, and any important comments. Keep it concise and actionable - the moderator needs to quickly see what topics to discuss with panelists.

Audience feedback:
${feedbackText}

Provide a brief summary with:
1. **Key Themes** - What are the main topics on people's minds?
2. **Top Questions** - What questions should the moderator ask the panelists?
3. **Notable Comments** - Any standout observations or suggestions?`
      : `Below is audience feedback collected during a presentation. Provide a comprehensive summary organized by slide and by theme. Highlight recurring topics, key questions, and actionable insights.

Audience feedback:
${feedbackText}

Provide a detailed summary with:
1. **Overall Themes** - Major topics across all feedback
2. **Per-Slide Highlights** - Key feedback points organized by slide
3. **Questions Raised** - All questions from the audience
4. **Actionable Insights** - Suggestions and recommendations from the audience`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error("Claude API error:", response.status, await response.text());
      return localSummarize(feedbackItems, context);
    }

    const data = await response.json();
    return data.content[0]?.text || localSummarize(feedbackItems, context);
  } catch (error) {
    console.error("Claude API call failed:", error);
    return localSummarize(feedbackItems, context);
  }
}

function localSummarize(
  feedbackItems: FeedbackItem[],
  context: "live" | "review"
): string {
  const questions = feedbackItems.filter((f) => f.feedback_type === "question");
  const comments = feedbackItems.filter((f) => f.feedback_type === "comment");
  const notes = feedbackItems.filter((f) => f.feedback_type === "note");

  const slideGroups = new Map<number, FeedbackItem[]>();
  for (const item of feedbackItems) {
    const group = slideGroups.get(item.slide_number) || [];
    group.push(item);
    slideGroups.set(item.slide_number, group);
  }

  let summary = `## Feedback Summary (${feedbackItems.length} total responses)\n\n`;

  if (questions.length > 0) {
    summary += `### Questions (${questions.length})\n`;
    for (const q of questions) {
      summary += `- **Slide ${q.slide_number}**: ${q.content}\n`;
    }
    summary += "\n";
  }

  if (comments.length > 0) {
    summary += `### Comments (${comments.length})\n`;
    for (const c of comments) {
      summary += `- **Slide ${c.slide_number}**: ${c.content}\n`;
    }
    summary += "\n";
  }

  if (notes.length > 0) {
    summary += `### Notes (${notes.length})\n`;
    for (const n of notes) {
      summary += `- **Slide ${n.slide_number}**: ${n.content}\n`;
    }
    summary += "\n";
  }

  if (context === "review") {
    summary += `### By Slide\n`;
    for (const [slideNum, items] of Array.from(slideGroups.entries()).sort(
      (a, b) => a[0] - b[0]
    )) {
      summary += `**Slide ${slideNum}** (${items.length} responses)\n`;
      for (const item of items) {
        summary += `- [${item.feedback_type}] ${item.content}\n`;
      }
      summary += "\n";
    }
  }

  return summary;
}
