import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} .env faylida ko'rsatilmagan!`);
  return val;
}

export const config = {
  BOT_TOKEN: required("BOT_TOKEN"),
  GROUP_CHAT_ID: required("GROUP_CHAT_ID"),
  SEND_TIME: process.env.SEND_TIME ?? "18:00",
  TIMEZONE: process.env.TIMEZONE ?? "Asia/Tashkent",
} as const;
