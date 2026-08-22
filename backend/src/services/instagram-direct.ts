import type { InstagramDirectThreadStatus } from "@prisma/client";
import OpenAI from "openai";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

const graphHost = env.INSTAGRAM_API_MODE === "facebook_login" ? "https://graph.facebook.com" : "https://graph.instagram.com";
const graphBase = `${graphHost}/${env.INSTAGRAM_GRAPH_API_VERSION}`;
const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 2 }) : null;

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: unknown[];
  };
  postback?: {
    mid?: string;
    title?: string;
    payload?: string;
  };
};

function graphConfigured() {
  return Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID);
}

function cleanMessageText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 2_000);
}

function fallbackReply(text: string) {
  const topic = cleanMessageText(text).slice(0, 140);
  return [
    "Assalomu alaykum. Murojaatingiz qabul qilindi.",
    topic ? `Mavzu: ${topic}` : "",
    "Tez orada BEST Team NEWS admini sizga javob beradi."
  ].filter(Boolean).join("\n");
}

async function generateAiReply(text: string) {
  const cleaned = cleanMessageText(text);
  if (!openai) return fallbackReply(cleaned);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.35,
    messages: [
      {
        role: "system",
        content:
          "Sen BEST Team NEWS sahifasining Instagram Direct yordamchisisan. Javoblar qisqa, muloyim, o'zbek tilida va professional bo'lsin. Maxfiy ma'lumot so'rama. Noaniq savolda admin javob berishini ayt."
      },
      {
        role: "user",
        content: `Instagram foydalanuvchisi quyidagicha yozdi. 1-3 jumlada javob tayyorla:\n\n${cleaned}`
      }
    ]
  });
  return completion.choices[0]?.message?.content?.trim().slice(0, 1_000) || fallbackReply(cleaned);
}

export function verifyInstagramWebhook(query: Record<string, unknown>) {
  const mode = typeof query["hub.mode"] === "string" ? query["hub.mode"] : "";
  const token = typeof query["hub.verify_token"] === "string" ? query["hub.verify_token"] : "";
  const challenge = typeof query["hub.challenge"] === "string" ? query["hub.challenge"] : "";
  if (mode === "subscribe" && env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN && token === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

async function sendInstagramMessage(recipientId: string, text: string) {
  if (!graphConfigured()) throw new Error("Instagram Direct uchun token yoki user ID sozlanmagan");
  const response = await fetch(`${graphBase}/${env.INSTAGRAM_USER_ID}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text }
    }),
    signal: AbortSignal.timeout(30_000)
  });
  const data = (await response.json().catch(() => null)) as { message_id?: string; recipient_id?: string; error?: { message?: string } } | null;
  if (!response.ok || data?.error) throw new Error(`Instagram Direct: ${data?.error?.message ?? response.status}`);
  return data?.message_id ?? null;
}

async function storeInbound(event: MessagingEvent) {
  if (event.message?.is_echo) return null;
  const senderId = event.sender?.id;
  if (!senderId || senderId === env.INSTAGRAM_USER_ID) return null;
  const rawText = event.message?.text ?? event.postback?.title ?? event.postback?.payload ?? "";
  const text = cleanMessageText(rawText || (event.message?.attachments?.length ? "Media xabar yuborildi" : ""));
  if (!text) return null;
  const externalId = event.message?.mid ?? event.postback?.mid ?? `${senderId}-${event.timestamp ?? Date.now()}`;
  const existing = await prisma.instagramDirectMessage.findUnique({
    where: { externalId },
    include: { thread: true }
  });
  if (existing) return null;

  const at = event.timestamp ? new Date(event.timestamp) : new Date();
  const thread = await prisma.instagramDirectThread.upsert({
    where: { instagramUserId: senderId },
    update: { status: "NEEDS_REVIEW", lastMessageAt: at },
    create: { instagramUserId: senderId, status: "NEEDS_REVIEW", lastMessageAt: at }
  });
  const message = await prisma.instagramDirectMessage.create({
    data: {
      threadId: thread.id,
      externalId,
      direction: "INBOUND",
      text,
      rawPayload: event as never,
      createdAt: at
    }
  });
  return { thread, message };
}

export async function handleInstagramWebhookPayload(payload: unknown) {
  if (!env.INSTAGRAM_DIRECT_ENABLED) return { handled: 0, skipped: "disabled" as const };
  const entries = (payload as { entry?: Array<{ messaging?: MessagingEvent[] }> } | null)?.entry ?? [];
  let handled = 0;
  for (const entry of entries) {
    for (const event of entry.messaging ?? []) {
      const stored = await storeInbound(event);
      if (!stored) continue;
      handled += 1;
      const aiDraft = await generateAiReply(stored.message.text).catch(() => fallbackReply(stored.message.text));
      await prisma.instagramDirectMessage.create({
        data: {
          threadId: stored.thread.id,
          direction: "AI_DRAFT",
          text: aiDraft,
          aiDraft,
          createdAt: new Date()
        }
      });
      if (env.INSTAGRAM_DIRECT_AUTO_REPLY_ENABLED) {
        const externalId = await sendInstagramMessage(stored.thread.instagramUserId, aiDraft);
        await prisma.instagramDirectMessage.create({
          data: {
            threadId: stored.thread.id,
            externalId,
            direction: "OUTBOUND",
            text: aiDraft,
            sentAt: new Date()
          }
        });
        await prisma.instagramDirectThread.update({
          where: { id: stored.thread.id },
          data: { status: "AUTO_REPLIED", lastMessageAt: new Date() }
        });
      }
    }
  }
  return { handled };
}

export async function listInstagramDirectThreads(status?: InstagramDirectThreadStatus) {
  return prisma.instagramDirectThread.findMany({
    where: status ? { status } : undefined,
    orderBy: { lastMessageAt: "desc" },
    take: 60,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 2
      }
    }
  });
}

export async function getInstagramDirectThread(id: string) {
  return prisma.instagramDirectThread.findUniqueOrThrow({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });
}

export async function updateInstagramDirectThreadStatus(id: string, status: InstagramDirectThreadStatus) {
  return prisma.instagramDirectThread.update({ where: { id }, data: { status } });
}

export async function createInstagramDirectDraft(threadId: string) {
  const thread = await getInstagramDirectThread(threadId);
  const latestInbound = [...thread.messages].reverse().find((message) => message.direction === "INBOUND");
  if (!latestInbound) throw new Error("Javob yozish uchun foydalanuvchi xabari topilmadi");
  const aiDraft = await generateAiReply(latestInbound.text);
  return prisma.instagramDirectMessage.create({
    data: { threadId: thread.id, direction: "AI_DRAFT", text: aiDraft, aiDraft }
  });
}

export async function replyToInstagramDirectThread(threadId: string, text: string) {
  const thread = await prisma.instagramDirectThread.findUniqueOrThrow({ where: { id: threadId } });
  const cleaned = cleanMessageText(text);
  if (!cleaned) throw new Error("Javob matni bo'sh bo'lmasligi kerak");
  const externalId = await sendInstagramMessage(thread.instagramUserId, cleaned);
  const message = await prisma.instagramDirectMessage.create({
    data: {
      threadId: thread.id,
      externalId,
      direction: "OUTBOUND",
      text: cleaned,
      sentAt: new Date()
    }
  });
  await prisma.instagramDirectThread.update({
    where: { id: thread.id },
    data: { status: "OPEN", lastMessageAt: new Date() }
  });
  return message;
}
