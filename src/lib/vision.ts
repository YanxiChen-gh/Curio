import OpenAI from "openai";
import { env } from "./env.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function describeImages(
  imageUrls: string[],
  noteTitle: string,
): Promise<string[]> {
  if (imageUrls.length === 0) return [];

  const validUrls = imageUrls.filter(
    (u) => u && (u.startsWith("http://") || u.startsWith("https://")),
  );
  if (validUrls.length === 0) return [];

  const dataUrls = await Promise.all(validUrls.map(urlToBase64));
  const usableUrls = dataUrls.filter((u): u is string => u !== null);
  if (usableUrls.length === 0) return [];

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `这篇帖子标题是"${noteTitle}"。请详细描述每张图片，包括：食物名称和食材、地点和地标、产品和品牌、人物活动、图中可见的文字。请用[图片1]、[图片2]等标记每张图片。用中文回答，具体且真实。`,
    },
    ...usableUrls.map(
      (url): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
        type: "image_url",
        image_url: { url },
      }),
    ),
  ];

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      max_tokens: 300 * usableUrls.length,
    });

    const text = res.choices[0]?.message?.content || "";
    const parts = text.split(/\[图片\d+\]/).filter((s) => s.trim());

    if (parts.length === usableUrls.length) {
      return parts.map((s) => s.trim());
    }
    return [text];
  } catch (err) {
    console.error("[vision] Failed to describe images:", err);
    return [];
  }
}
