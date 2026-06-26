# GSC Tool

Локальний дашборд для аналізу даних Google Search Console по кожній сторінці сайту.

## Що вміє

- Авторизація через Google OAuth
- Список всіх сайтів з вашого GSC акаунту
- Список сторінок з метриками (кліки, покази, CTR, позиція) і пошуком
- Дашборд сторінки:
  - Графік динаміки з порівнянням попереднього періоду
  - Статус індексації, дата сканування, canonical (URL Inspection API)
  - Таблиця запитів з сортуванням
  - Rank tracker — динаміка позицій по тижнях/днях

---

## Налаштування (5 кроків)

### 1. Клонуй і встанови залежності

```bash
git clone <repo>
cd gsc-tool
npm install
```

### 2. Створи проєкт у Google Cloud Console

1. Відкрий https://console.cloud.google.com/
2. **Select a project → New Project** — назви як хочеш
3. У лівому меню: **APIs & Services → Library**
4. Знайди і увімкни: **Google Search Console API**

### 3. Створи OAuth 2.0 credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
2. Якщо вперше — налаштуй **OAuth consent screen**:
   - User Type: **External**
   - App name, email — будь-які
   - Scopes: додай `https://www.googleapis.com/auth/webmasters.readonly`
   - Test users: додай свій Google-акаунт
3. Application type: **Web application**
4. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Збережи — отримаєш **Client ID** і **Client Secret**

### 4. Створи `.env.local`

Скопіюй `.env.local.example` і заповни:

```bash
cp .env.local.example .env.local
```

Відредагуй `.env.local`:

```env
GOOGLE_CLIENT_ID=тут_твій_client_id
GOOGLE_CLIENT_SECRET=тут_твій_client_secret
NEXTAUTH_SECRET=будь-який-рядок-мінімум-32-символи
NEXTAUTH_URL=http://localhost:3000
```

Згенерувати NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 5. Запусти

```bash
npm run dev
```

Відкрий http://localhost:3000 — натисни "Увійти через Google".

---

## Структура проєкту

```
gsc-tool/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth OAuth
│   │   └── gsc/
│   │       ├── sites/            # GET /api/gsc/sites
│   │       ├── pages/            # GET /api/gsc/pages
│   │       └── page/             # GET /api/gsc/page?type=...
│   ├── site/                     # Список сторінок
│   ├── page-view/                # Дашборд сторінки
│   └── page.jsx                  # Головна / логін
├── lib/
│   ├── gsc.js                    # Обгортка над GSC API
│   └── cache.js                  # In-memory кеш
└── .env.local.example
```

## Ліміти GSC API

| API | Ліміт |
|-----|-------|
| Search Analytics | ~50 000 рядків / запит, без жорсткого добового ліміту |
| URL Inspection | 2 000 запитів / день на property |

Кеш зберігає дані в пам'яті (TTL: 3 хв для аналітики, 1 год для inspection).
При рестарті сервера кеш очищається.
