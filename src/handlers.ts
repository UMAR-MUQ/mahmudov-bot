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

// ---------------------------------------------------------------------------
// Handlerllarni botga ulash
// ---------------------------------------------------------------------------
export function registerHandlers(bot: Bot<MyContext>): void {
  // /start
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "👋 Salom! Men <b>Mahmudov Bot</b>man.\n\n" +
      "Uyga vazifalarni yozib, har kuni belgilangan vaqtda guruhga yuboraman.\n\n" +
      "📌 Buyruqlar:\n" +
      "/add — yangi vazifa qo'shish\n" +
      "/today — bugungi vazifalar\n" +
      "/list — barcha kelgusi vazifalar\n" +
      "/delete — vazifani o'chirish\n" +
      "/sendnow — guruhga hozir yuborish (test)\n" +
      "/help — batafsil yordam",
      { parse_mode: "HTML" }
    );
  });

  // /help
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "<b>📖 Yordam</b>\n\n" +
      "<b>/add</b> — yangi uyga vazifa qo'shish\n" +
      "<b>/today</b> — bugungi vazifalar ro'yxati\n" +
      "<b>/list</b> — barcha kelgusi vazifalar\n" +
      "<b>/delete &lt;id&gt;</b> — ID bo'yicha o'chirish\n" +
      "  misol: <code>/delete 2026-09-19_1</code>\n\n" +
      `Bot har kuni <b>${config.SEND_TIME}</b> da guruhga yuboradi.\n` +
      `Guruh ID: <code>${config.GROUP_CHAT_ID}</code>`,
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
  // FSM — oddiy matn xabarlari orqali /add bosqichlari
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
        "📅 Topshirish sanasini yozing (<code>YYYY-MM-DD</code>).\n" +
        "Bugun uchun <b>bugun</b> deb yozing yoki bo'sh qoldiring.",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (step === "dueDate") {
      let due: string;
      if (["bugun", "", "-"].includes(text.toLowerCase())) {
        due = new Date().toISOString().slice(0, 10);
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          await ctx.reply(
            "❌ Sana formati noto'g'ri. <code>YYYY-MM-DD</code> yoki <b>bugun</b> deb yozing.",
            { parse_mode: "HTML" }
          );
          return;
        }
        due = text;
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
