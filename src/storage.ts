import { MongoClient, Collection, Document } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = "mahmudov_bot";
const COLLECTION_NAME = "homework";

export interface HomeworkEntry {
  id: string;
  subject: string;
  task: string;
  dueDate: string;
  added: string;
}

let client: MongoClient | null = null;
let collection: Collection<HomeworkEntry & Document> | null = null;

export async function connectDB(): Promise<void> {
  if (client) return;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  collection = db.collection<HomeworkEntry & Document>(COLLECTION_NAME);
  // dueDate bo'yicha tezkor qidirish uchun index
  await collection.createIndex({ dueDate: 1 });
  console.log("MongoDB ga ulandi ✅");
}

function getCollection(): Collection<HomeworkEntry & Document> {
  if (!collection) throw new Error("MongoDB ulanmagan! connectDB() chaqiring.");
  return collection;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Yangi vazifa saqlash. */
export async function saveHomework(
  subject: string,
  task: string,
  dueDate?: string
): Promise<string> {
  const col = getCollection();
  const due = dueDate ?? today();
  const count = await col.countDocuments({ dueDate: due });
  const id = `${due}_${count + 1}`;
  await col.insertOne({ id, subject, task, dueDate: due, added: today() });
  return id;
}

/** Berilgan sana uchun vazifalar (default: bugun). */
export async function getHomework(targetDate?: string): Promise<HomeworkEntry[]> {
  const col = getCollection();
  const due = targetDate ?? today();
  return col.find({ dueDate: due }).toArray();
}

/** Bugundan boshlab barcha kelgusi vazifalar. */
export async function getAllUpcoming(): Promise<Record<string, HomeworkEntry[]>> {
  const col = getCollection();
  const t = today();
  const entries = await col.find({ dueDate: { $gte: t } }).sort({ dueDate: 1 }).toArray();

  const grouped: Record<string, HomeworkEntry[]> = {};
  for (const e of entries) {
    if (!grouped[e.dueDate]) grouped[e.dueDate] = [];
    grouped[e.dueDate].push(e);
  }
  return grouped;
}

/** ID bo'yicha vazifani yangilash. Faqat berilgan maydonlar o'zgaradi. */
export async function updateHomework(
  entryId: string,
  fields: { subject?: string; task?: string; dueDate?: string }
): Promise<boolean> {
  const col = getCollection();
  const update: Partial<HomeworkEntry> = {};
  if (fields.subject) update.subject = fields.subject;
  if (fields.task) update.task = fields.task;
  if (fields.dueDate) update.dueDate = fields.dueDate;
  if (Object.keys(update).length === 0) return true;
  const result = await col.updateOne({ id: entryId }, { $set: update });
  return result.matchedCount === 1;
}

/** ID bo'yicha o'chirish. */
export async function deleteHomework(entryId: string): Promise<boolean> {
  const col = getCollection();
  const result = await col.deleteOne({ id: entryId });
  return result.deletedCount === 1;
}

/** Vazifalar ro'yxatini HTML matn sifatida formatlash. */
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
