import OpenAI from "openai";
import { env } from "../config/env.js";

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 2 }) : null;
const MODEL = "gpt-4o-mini";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("OPENAI_API_KEY sozlanmagan");
  }
}

export async function generateArticleShortDescription(input: { title: string; summary?: string; content: string }) {
  if (!client) throw new AiNotConfiguredError();

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.35,
    messages: [
      {
        role: "system",
        content:
          "Sen professional o'zbek jurnalistisan. Faqat berilgan maqola matniga tayanib, aniq, xolis va SEO-friendly qisqa izoh yozasan."
      },
      {
        role: "user",
        content:
          "Quyidagi yangilik matni asosida 1-2 jumladan iborat qisqa izoh yoz. " +
          "Izoh maqolaning boshidagi gaplarni ko'chirmasin. Asosiy mazmunni tushunarli, professional va SEO-friendly tarzda ifodalasin. " +
          "Clickbait qilma. Matnda yo'q fakt qo'shma. O'zbek tilida yoz.\n\n" +
          JSON.stringify({
            title: input.title,
            summary: input.summary,
            content: input.content.slice(0, 12000)
          })
      }
    ]
  });

  const text = completion.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
  if (!text) throw new Error("AI bo'sh javob qaytardi");
  return text.replace(/\s+/g, " ").slice(0, 500);
}
