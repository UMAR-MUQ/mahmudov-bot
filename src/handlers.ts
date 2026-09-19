import { Bot, Context, session, SessionFlavor } from "grammy";
import { config } from "./config";
import {
  saveHomework,
  getHomework,
  getAllUpcoming,
  deleteHomework,
  formatHomeworkList,
} from "./storage";

// ---------------------------------------------------------------------------
// Session — ko'p qadamli /add uchun
// ---------------------------------------------------------------------------
interface SessionData {
  step: "idle" | "subject" | "task" | "dueDate";
  subject?: string;
  task?: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

function initial(): SessionData {
  return { step: "idle" };
}

/**
 * Sana matnini "YYYY-MM-DD" formatiga o'tkazadi.
 * Qabul qilinadigan formatlar:
 *   bugun / today / "-" / ""  → bugungi sana
 *   20.09.2026                → 2026-09-20
 *   20/09/2026                → 2026-09-20
 *   2026.09.20                → 2026-09-20
 *   2026-09-20                → 2026-09-20
 *   2026/09/20                → 2026-09-20
 * Noto'g'ri bo'lsa null qaytaradi.
 */
function parseDate(input: string): string | null {
  const t = input.trim().toLowerCase();

  if (["bugun", "today", "-", ""].includes(t)) {
    return new Date().toISOString().slice(0, 10);
  }

  // Ajratuvchi sifatida - . / qabul qilinadi
  const parts = t.split(/[-./]/);
  if (parts.length !== 3) return null;

  let year: number, month: number, day: number;

  if (parts[0].length === 4) {
    // YYYY-MM-DD yoki YYYY.MM.DD
    [year, month, day] = parts.map(Number);
  } else {
    // DD.MM.YYYY yoki DD/MM/YYYY
    [day, month, year] = parts.map(Number);
  }

  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

// ---------------------------------------------------------------------------
// Handlerlarni botga ulash
// ---------------------------------------------------------------------------
export function registerHandlers(bot: Bot<MyContext>): void {

  // /start
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "👋 Salom! Men <b>Mahmudov Bot</b>man.\n\n" +
      "Uyga vazifalarni yozib, har kuni soat <b>18:00</b> da guruhga yuboraman.\n\n" +
      "📌 Buyruqlar:\n" +
      "/add — yangi vazifa qo'shish\n" +
      "/today — bugungi vazifalar\n" +
      "/list — barcha kelgusi vazifalar\n" +
      "/delete — vazifani o'chirish",
      { parse_mode: "HTML" }
    );
  });

  // /add — bosqich 1
  bot.command("add", async (ctx) => {
    ctx.session.step = "subject";
    await ctx.reply("📚 Fan nomini yozing:\n(masalan: Matematika, Fizika ...)");
  });

  // /today
  bot.command("today", async (ctx) => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const entries = getHomework(dateStr);
    await ctx.reply(
      formatHomeworkList(entries, `📚 Bugungi uyga vazifalar (${dateStr})`),
      { parse_mode: "HTML" }
    );
  });

  // /list
  bot.command("list", async (ctx) => {
    const upcoming = getAllUpcoming();
    const days = Object.keys(upcoming);
    if (days.length === 0) {
      await ctx.reply("❌ Hech qanday kelgusi vazifa yo'q.");
      return;
    }
    const lines = ["<b>📋 Barcha kelgusi vazifalar:</b>\n"];
    for (const [day, entries] of Object.entries(upcoming)) {
      lines.push(`<b>📅 ${day}</b>`);
      entries.forEach((e, i) => {
        lines.push(
          `  ${i + 1}. <b>${e.subject}</b> — ${e.task}\n` +
          `     🆔 <code>${e.id}</code>`
        );
      });
      lines.push("");
    }
    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  });

  // /delete <id>
  bot.command("delete", async (ctx) => {
    const parts = ctx.message?.text?.split(/\s+/) ?? [];
    if (parts.length < 2) {
      await ctx.reply(
        "❌ ID ko'rsating.\nMisol: <code>/delete 2026-09-19_1</code>",
        { parse_mode: "HTML" }
      );
      return;
    }
    const id = parts[1];
    if (deleteHomework(id)) {
      await ctx.reply(`🗑 Vazifa o'chirildi: <code>${id}</code>`, {
        parse_mode: "HTML",
      });
    } else {
      await ctx.reply(`❌ Bunday ID topilmadi: <code>${id}</code>`, {
        parse_mode: "HTML",
      });
    }
  });

  // /sendnow — test uchun
  bot.command("sendnow", async (ctx) => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const entries = getHomework(dateStr);
    const text = formatHomeworkList(
      entries,
      `📚 Bugungi uyga vazifalar (${dateStr})`
    );
    try {
      await bot.api.sendMessage(config.GROUP_CHAT_ID, text, {
        parse_mode: "HTML",
      });
      await ctx.reply("✅ Guruhga yuborildi!");
    } catch (err) {
      await ctx.reply(`❌ Xatolik: ${err}`);
    }
  });

  // ---------------------------------------------------------------------------
  // FSM — /add bosqichlari
  // ---------------------------------------------------------------------------
  bot.on("message:text", async (ctx) => {
    const step = ctx.session.step;
    const text = ctx.message.text.trim();

    if (step === "subject") {
      ctx.session.subject = text;
      ctx.session.step = "task";
      await ctx.reply("📝 Vazifa matnini yozing:");
      return;
    }

    if (step === "task") {
      ctx.session.task = text;
      ctx.session.step = "dueDate";
      await ctx.reply(
        "📅 Topshirish sanasini yozing.\n\n" +
        "Qabul qilinadigan formatlar:\n" +
        "<code>20.09.2026</code>  yoki  <code>2026-09-20</code>\n" +
        "Bugun uchun: <b>bugun</b>",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (step === "dueDate") {
      const due = parseDate(text);
      if (!due) {
        await ctx.reply(
          "❌ Sana noto'g'ri. Masalan: <code>20.09.2026</code> yoki <b>bugun</b>",
          { parse_mode: "HTML" }
        );
        return;
      }

      const id = saveHomework(ctx.session.subject!, ctx.session.task!, due);
      ctx.session.step = "idle";
      await ctx.reply(
        `✅ Vazifa saqlandi!\n\n` +
        `📚 Fan: <b>${ctx.session.subject}</b>\n` +
        `📝 Vazifa: ${ctx.session.task}\n` +
        `📅 Sana: <b>${due}</b>\n` +
        `🆔 ID: <code>${id}</code>`,
        { parse_mode: "HTML" }
      );
      ctx.session.subject = undefined;
      ctx.session.task = undefined;
    }
  });
}

// Session middleware ni eksport qilish
export { session, initial };
export type { MyContext };
