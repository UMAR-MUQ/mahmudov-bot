# Mahmudov Bot 🤖

Har kuni belgilangan vaqtda Telegram guruhga uyga vazifalarni yuboradigan bot.
**Node.js + TypeScript + grammY** asosida yozilgan. Railway da deploy qilinadi.

---

## Lokal ishga tushirish

```bash
# 1. Kutubxonalar
npm install

# 2. .env faylni to'ldiring (pastga qarang)

# 3. Build
npm run build

# 4. Ishga tushiring
npm start
```

---

## .env sozlamalari

`.env` faylni oching va to'ldiring:

```env
BOT_TOKEN=8500958257:AAExxxxxx          # BotFather tokeni
GROUP_CHAT_ID=-1001234567890            # Guruh ID (manfiy raqam)
SEND_TIME=08:00                         # Har kuni qaysi vaqtda yuborsin
TIMEZONE=Asia/Tashkent                  # Vaqt zonasi
```

**GROUP_CHAT_ID qayerdan olish:**
1. Botni guruhga **admin** sifatida qo'shing
2. Guruhda `/sendnow` yozing
3. Brauzerda: `https://api.telegram.org/bot<TOKEN>/getUpdates` — `"chat":{"id":...}` ni oling

---

## Railway ga deploy

1. [railway.app](https://railway.app) ga kiring → **New Project → Deploy from GitHub**
2. Repo ni tanlang
3. **Variables** bo'limida quyidagilarni qo'shing:
   ```
   BOT_TOKEN=...
   GROUP_CHAT_ID=...
   SEND_TIME=08:00
   TIMEZONE=Asia/Tashkent
   ```
4. Railway avtomatik `npm install && npm run build` → `npm start` ishlatadi

---

## Buyruqlar

| Buyruq | Tavsif |
|--------|--------|
| `/start` | Botni ishga tushirish |
| `/add` | Yangi uyga vazifa qo'shish (bosqichma-bosqich) |
| `/today` | Bugungi vazifalar ro'yxati |
| `/list` | Barcha kelgusi vazifalar |
| `/delete <id>` | ID bo'yicha vazifani o'chirish |
| `/sendnow` | Guruhga darhol yuborish (test) |
| `/help` | Yordam |

---

## Loyiha strukturasi

```
mahmudov_bot/
├── src/
│   ├── index.ts       # Kirish nuqtasi
│   ├── config.ts      # .env sozlamalari
│   ├── handlers.ts    # Bot buyruqlari + FSM
│   ├── scheduler.ts   # Kunlik avtomatik yuborish
│   └── storage.ts     # JSON baza (data/homework.json)
├── data/              # Vazifalar (avtomatik yaratiladi)
├── dist/              # Build natijasi
├── .env               # Tokenlar (gitga yuklanmaydi)
├── railway.toml       # Railway konfiguratsiya
├── package.json
└── tsconfig.json
```
