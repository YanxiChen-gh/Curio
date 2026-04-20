import { Hono } from "hono";
import { streamText, createUIMessageStreamResponse } from "ai";
import { db } from "../lib/db.js";
import { embedText } from "../lib/embeddings.js";
import { chatModel } from "../lib/llm.js";
import { authMiddleware } from "../lib/auth.js";
import type { AppVariables } from "../types/context.js";

const app = new Hono<{ Variables: AppVariables }>();

app.use("/api/chat", authMiddleware);

interface ChunkResult {
  id: string;
  content: string;
  chunkIndex: number;
  noteId: string;
  distance: number;
}

async function findRelevantChunks(
  question: string,
  userId: string,
  topK = 5,
): Promise<ChunkResult[]> {
  const embedding = await embedText(question);
  const vectorStr = `[${embedding.join(",")}]`;

  const chunks = await db.$queryRawUnsafe<ChunkResult[]>(
    `SELECT c.id, c.content, c."chunkIndex", c."noteId",
            c.embedding <=> $1::vector AS distance
     FROM "Chunk" c
     JOIN "Note" n ON n.id = c."noteId"
     WHERE c.embedding IS NOT NULL AND n."userId" = $2
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    userId,
    topK,
  );

  return chunks;
}

interface UIMessagePart {
  type: string;
  text?: string;
}

interface UIMessage {
  role: string;
  content?: string;
  parts?: UIMessagePart[];
}

function extractText(msg: UIMessage): string {
  if (msg.parts?.length) {
    return msg.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join("");
  }
  return msg.content || "";
}

app.post("/api/chat", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json<{
    messages: UIMessage[];
    sessionId?: string;
  }>();
  const { messages, sessionId } = body;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMessage) {
    return c.json({ error: "No user message found" }, 400);
  }

  const userText = extractText(lastUserMessage);
  if (!userText) {
    return c.json({ error: "Empty message" }, 400);
  }

  let activeSessionId = sessionId;
  if (!activeSessionId) {
    const session = await db.chatSession.create({ data: { userId } });
    activeSessionId = session.id;
  }

  await db.chatMessage.create({
    data: { role: "user", content: userText, sessionId: activeSessionId },
  });

  const chunks = await findRelevantChunks(userText, userId);

  const noteIds = [...new Set(chunks.map((ch) => ch.noteId))];
  const notes = await db.note.findMany({
    where: { id: { in: noteIds } },
    select: { id: true, externalId: true, title: true, sourceUrl: true },
  });
  const noteMap = new Map(notes.map((n) => [n.id, n]));

  const context = chunks
    .map((ch) => {
      const note = noteMap.get(ch.noteId);
      const source = note ? `[${note.title}](${note.sourceUrl})` : "";
      return `---\n来源: ${source}\n${ch.content}`;
    })
    .join("\n\n");

  const hasContext = chunks.length > 0;

  const systemPrompt = `你是 Curio (拾趣)，一个个人知识助手。你根据用户收藏的笔记回答问题。

规则:
- 基于提供的上下文回答问题
- 如果上下文中没有相关信息，明确告诉用户"你的收藏中暂时没有相关内容"，并建议他们收藏更多相关笔记
- 回答末尾必须列出引用的来源笔记链接，格式为: 📎 来源: [笔记标题](链接)
- 用中文回答，除非用户用英文提问
- 回答要实用、简洁、有帮助
- 对于"去哪里吃"这类问题，优先提供地点、价格等实用信息

${hasContext ? `以下是用户收藏的相关笔记内容:\n\n${context}` : "用户的收藏中没有与此问题相关的内容。"}`;

  const result = streamText({
    model: chatModel,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: extractText(m),
    })),
    async onFinish({ text }) {
      await db.chatMessage.create({
        data: {
          role: "assistant",
          content: text,
          sessionId: activeSessionId!,
        },
      });
      await db.chatSession.update({
        where: { id: activeSessionId! },
        data: {
          title: userText.slice(0, 50),
          updatedAt: new Date(),
        },
      });
    },
  });

  return createUIMessageStreamResponse({
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "X-Session-Id": activeSessionId || "",
    },
    stream: result.toUIMessageStream(),
  });
});

export default app;
