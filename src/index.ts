import { Bot } from "grammy";
import { session, initial, registerHandlers } from "./handlers";
import { setupScheduler } from "./scheduler";
import { config } from "./config";
import type { MyContext } from "./handlers";

async function main(): Promise<void> {
  const bot = new Bot<MyContext>(config.BOT_TOKEN);

  // Session middleware (xotirada saqlash — Railway uchun yetarli)
  bot.use(session({ initial }));

  // Handlerlarni ulash
  registerHandlers(bot);

  // Schedulerni yoqish
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setupScheduler(bot as Bot<any>);

  // Xatolarni ushlash
  bot.catch((err) => {
    console.error("Bot xatosi:", err);
  });

  console.log("Bot ishga tushdi...");
  await bot.start();
}

main().catch((err) => {
  console.error("Kritik xato:", err);
  process.exit(1);
});
