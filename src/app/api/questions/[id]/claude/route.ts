import { NextRequest, NextResponse } from "next/server";
import { getClient, buildSystemPrompt } from "@/lib/claude";
import { getQuestion, getOrCreateConversation, appendMessage, getNotesForQuestion } from "@/lib/queries";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = getOrCreateConversation(parseInt(id));
  return NextResponse.json(conv);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const questionId = parseInt(id);
  const body = await request.json();
  const userMessage = body.message as string;

  if (!userMessage?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const question = getQuestion(questionId);
  if (!question) {
    return NextResponse.json({ error: "question not found" }, { status: 404 });
  }

  const conv = getOrCreateConversation(questionId);
  appendMessage(conv.id, "user", userMessage.trim());

  // Build context for Claude
  const notes = getNotesForQuestion(questionId);
  let contextBlock = `Research question: ${question.text}`;
  if (question.source) contextBlock += `\nSource: ${question.source}`;
  if (notes.length > 0) {
    contextBlock += `\nNotes:\n${notes.map((n) => `- ${n.content}`).join("\n")}`;
  }

  // Build messages array from conversation history
  const messages: { role: "user" | "assistant"; content: string }[] = [];

  // First message includes context
  if (conv.messages.length === 0) {
    messages.push({ role: "user", content: `${contextBlock}\n\n${userMessage.trim()}` });
  } else {
    // Replay history
    for (const msg of conv.messages) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }
  }

  const client = getClient();

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages,
  });

  let fullResponse = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        // Save the complete response to the conversation
        appendMessage(conv.id, "assistant", fullResponse);
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
