import cron from "node-cron";
import { Bot, RawApi } from "grammy";
import { config } from "./config";
import { getHomework, formatHomeworkList } from "./storage";

/** SEND_TIME "HH:MM" dan cron expression yasash: "MM HH * * *" */
function buildCronExpr(sendTime: string): string {
  const [hh, mm] = sendTime.split(":").map(Number);
  return `${mm} ${hh} * * *`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupScheduler(bot: Bot<any>): void {
  const expr = buildCronExpr(config.SEND_TIME);

  cron.schedule(
    expr,
    async () => {
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
        console.log(`[${new Date().toISOString()}] Vazifalar guruhga yuborildi.`);
      } catch (err) {
        console.error("Guruhga yuborishda xatolik:", err);
      }
    },
    { timezone: config.TIMEZONE }
  );

  console.log(
    `Scheduler yoqildi: har kuni ${config.SEND_TIME} da (${config.TIMEZONE})`
  );
}
