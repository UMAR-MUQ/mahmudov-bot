import { Bot, Context, session, SessionFlavor } from "grammy";
import { config } from "./config";
import {
  saveHomework,
  getHomework,
  updateHomework,
  formatHomeworkList,
} from "./storage";

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
interface SessionData {
  step: "idle" | "subject" | "task" | "dueDate" | "editId" | "editSubject" | "editTask" | "editDueDate";
  subject?: string;
  task?: string;
  dueDate?: string;
  editId?: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

function initial(): SessionData {
  return { step: "idle" };
}

function parseDate(input: string): string | null {
  const t = input.trim().toLowerCase();
  if (["bugun", "today", "-", ""].includes(t)) {
    return new Date().toISOString().slice(0, 10);
  }
  const parts = t.split(/[-./]/);
  if (parts.length !== 3) return null;
  let year: number, month: number, day: number;
  if (parts[0].length === 4) {
    [year, month, day] = parts.map(Number);
  } else {
    [day, month, year] = parts.map(Number);
  }
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

// ---------------------------------------------------------------------------
export function registerHandlers(bot: Bot<MyContext>): void {

  // /start
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "👋 Salom! Men <b>Mahmudov Bot</b>man.\n\n" +
      "Uyga vazifalarni yozib, har kuni soat <b>18:00</b> da guruhga yuboraman.\n\n" +
      "📌 Buyruqlar:\n" +
      "/add — yangi vazifa qo'shish\n" +
      "/sendnow — guruhga hozir yuborish\n" +
      "/help — yordam",
      { parse_mode: "HTML" }
    );
  });

  // /help
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "<b>📖 Yordam</b>\n\n" +
      "<b>/add</b> — yangi uyga vazifa qo'shish\n" +
      "   Bot fan nomi, vazifa matni va sanani so'raydi\n\n" +
      "<b>/sendnow</b> — bugungi vazifalarni guruhga hozir yuborish\n" +
      "   Yuborilgandan keyin har bir vazifani o'zgartirish mumkin\n\n" +
      "🕕 Bot har kuni soat <b>18:00</b> da avtomatik guruhga yuboradi.",
      { parse_mode: "HTML" }
    );
  });

  // /add
  bot.command("add", async (ctx) => {
    ctx.session.step = "subject";
    await ctx.reply("📚 Fan nomini yozing:\n(masalan: Matematika, Fizika ...)");
  });

  // /sendnow — guruhga yuborish + har bir vazifa ostida "O'zgartirish" tugmasi
  bot.command("sendnow", async (ctx) => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const entries = await getHomework(dateStr);
    const text = formatHomeworkList(entries, `📚 Bugungi uyga vazifalar (${dateStr})`);

    // Guruhga oddiy xabar
    try {
      await bot.api.sendMessage(config.GROUP_CHAT_ID, text, { parse_mode: "HTML" });
      await ctx.reply("✅ Guruhga yuborildi!");
    } catch (err) {
      await ctx.reply(`❌ Xatolik: ${err}`);
      return;
    }

    // Adminga har bir vazifa uchun "O'zgartirish" tugmasi
    if (entries.length === 0) return;

    for (const e of entries) {
      await ctx.reply(
        `✏️ <b>${e.subject}</b>\n${e.task}`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "✏️ O'zgartirish", callback_data: `edit_${e.id}` }
            ]]
          }
        }
      );
    }
  });

  // "O'zgartirish" tugmasi bosilganda
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("edit_")) return;

    const id = data.replace("edit_", "");
    ctx.session.editId = id;
    ctx.session.step = "editSubject";

    await ctx.answerCallbackQuery();
    await ctx.reply(
      "✏️ Yangi fan nomini yozing:\n(o'zgartirmaslik uchun <b>-</b> yozing)",
      { parse_mode: "HTML" }
    );
  });

  // ---------------------------------------------------------------------------
  // FSM — matn xabarlari
  // ---------------------------------------------------------------------------
  bot.on("message:text", async (ctx) => {
    const step = ctx.session.step;
    const text = ctx.message.text.trim();

    // --- /add bosqichlari ---
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
        "📅 Topshirish sanasini yozing.\n\nMasalan: <code>20.09.2026</code>\nBugun uchun: <b>bugun</b>",
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
      await saveHomework(ctx.session.subject!, ctx.session.task!, due);
      ctx.session.step = "idle";
      await ctx.reply(
        `✅ Vazifa saqlandi!\n\n` +
        `📚 Fan: <b>${ctx.session.subject}</b>\n` +
        `📝 Vazifa: ${ctx.session.task}\n` +
        `📅 Sana: <b>${due}</b>`,
        { parse_mode: "HTML" }
      );
      ctx.session.subject = undefined;
      ctx.session.task = undefined;
      return;
    }

    // --- O'zgartirish bosqichlari ---
    if (step === "editSubject") {
      ctx.session.subject = text === "-" ? undefined : text;
      ctx.session.step = "editTask";
      await ctx.reply(
        "📝 Yangi vazifa matnini yozing:\n(o'zgartirmaslik uchun <b>-</b> yozing)",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (step === "editTask") {
      ctx.session.task = text === "-" ? undefined : text;
      ctx.session.step = "editDueDate";
      await ctx.reply(
        "📅 Yangi sanani yozing:\n(o'zgartirmaslik uchun <b>-</b> yozing)",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (step === "editDueDate") {
      let due: string | undefined;
      if (text === "-") {
        due = undefined;
      } else {
        const parsed = parseDate(text);
        if (!parsed) {
          await ctx.reply(
            "❌ Sana noto'g'ri. Masalan: <code>20.09.2026</code> yoki <b>-</b>",
            { parse_mode: "HTML" }
          );
          return;
        }
        due = parsed;
      }

      await updateHomework(ctx.session.editId!, {
        subject: ctx.session.subject,
        task: ctx.session.task,
        dueDate: due,
      });

      ctx.session.step = "idle";
      ctx.session.editId = undefined;
      ctx.session.subject = undefined;
      ctx.session.task = undefined;

      await ctx.reply("✅ Vazifa yangilandi!");
      return;
    }
  });
}

export { session, initial };
export type { MyContext };
