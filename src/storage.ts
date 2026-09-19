import fs from "fs";
import path from "path";

// Railway Volume mount path — agar yo'q bo'lsa lokal data/ papka
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH)
  : path.join(__dirname, "..", "data");

const HOMEWORK_FILE = path.join(DATA_DIR, "homework.json");

export interface HomeworkEntry {
  id: string;
  subject: string;
  task: string;
  dueDate: string;
  added: string;
}

type HomeworkDB = Record<string, HomeworkEntry[]>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadAll(): HomeworkDB {
  ensureDir();
  if (!fs.existsSync(HOMEWORK_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(HOMEWORK_FILE, "utf-8")) as HomeworkDB;
  } catch {
    return {};
  }
}

function saveAll(db: HomeworkDB): void {
  ensureDir();
  fs.writeFileSync(HOMEWORK_FILE, JSON.stringify(db, null, 2), "utf-8");
}

/** Yangi vazifa saqlash */
export async function saveHomework(
  subject: string,
  task: string,
  dueDate?: string
): Promise<string> {
  const db = loadAll();
  const key = dueDate ?? today();
  if (!db[key]) db[key] = [];
  const id = `${key}_${db[key].length + 1}`;
  db[key].push({ id, subject, task, dueDate: key, added: today() });
  saveAll(db);
  return id;
}

/** Berilgan sana uchun vazifalar */
export async function getHomework(targetDate?: string): Promise<HomeworkEntry[]> {
  return loadAll()[targetDate ?? today()] ?? [];
}

/** Bugundan boshlab barcha kelgusi vazifalar */
export async function getAllUpcoming(): Promise<Record<string, HomeworkEntry[]>> {
  const db = loadAll();
  const t = today();
  return Object.fromEntries(
    Object.entries(db)
      .filter(([k]) => k >= t)
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

/** ID bo'yicha vazifani yangilash */
export async function updateHomework(
  entryId: string,
  fields: { subject?: string; task?: string; dueDate?: string }
): Promise<boolean> {
  const db = loadAll();
  for (const [key, entries] of Object.entries(db)) {
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx !== -1) {
      if (fields.subject) db[key][idx].subject = fields.subject;
      if (fields.task) db[key][idx].task = fields.task;
      if (fields.dueDate) db[key][idx].dueDate = fields.dueDate;
      saveAll(db);
      return true;
    }
  }
  return false;
}

/** ID bo'yicha o'chirish */
export async function deleteHomework(entryId: string): Promise<boolean> {
  const db = loadAll();
  for (const [key, entries] of Object.entries(db)) {
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx !== -1) {
      db[key].splice(idx, 1);
      if (db[key].length === 0) delete db[key];
      saveAll(db);
      return true;
    }
  }
  return false;
}

/** Vazifalar ro'yxatini HTML matn sifatida formatlash */
export function formatHomeworkList(
  entries: HomeworkEntry[],
  title = "📚 Uyga vazifalar"
): string {
  if (entries.length === 0)
    return `<b>${title}</b>\n\n❌ Hech qanday vazifa yo'q.`;
  const lines = [`<b>${title}</b>\n`];
  entries.forEach((e, i) => {
    lines.push(
      `${i + 1}. <b>${e.subject}</b>\n` +
      `   📝 ${e.task}`
    );
  });
  return lines.join("\n");
}

/** DB ulanish — JSON uchun hech narsa kerak emas */
export async function connectDB(): Promise<void> {
  ensureDir();
  console.log(`Ma'lumotlar saqlash joyi: ${HOMEWORK_FILE}`);
}
