# SmartPlan — деплой на Render.com

## Что внутри

| Папка / файл | Назначение |
|---|---|
| `index.html` | Главная страница (SPA) |
| `root_index/` | Фронтенд (модули: app, api_client, sync_polling, *_db, конфиг, PWA-иконки) |
| `server/` | Backend (Express + PostgreSQL) |
| `render.yaml` | Конфиг Render (web-service + PostgreSQL) |
| `package.json` | Точка входа для npm start |
| `.gitignore` | Исключает node_modules, .env, мусор |

---

## Что нужно

1. **GitHub-аккаунт** — заливаем код
2. **Render.com-аккаунт** — бесплатный, регистрация через GitHub

---

## Шаг 1. Залить код на GitHub

### 1.1. Создать репозиторий

1. Откройте https://github.com/new
2. Заполните:
   - **Repository name**: `smartplan`
   - **Description**: `SmartPlan — УП «МИНГАЗ»`
   - **Visibility**: `Private` ← обязательно
   - ❌ НЕ добавляйте README / .gitignore / license (они уже есть)
3. **Create repository**
4. Скопируйте URL репозитория (формат `https://github.com/ВАШ_ЛОГИН/smartplan.git`)

### 1.2. Personal Access Token (если ещё нет)

GitHub не принимает пароли для push — нужен токен:

1. Откройте https://github.com/settings/tokens
2. **Generate new token → Classic**
3. **Note**: `render-deploy`
4. **Expiration**: `No expiration` (или 90 дней)
5. **Scopes**: только `repo` (галочка «Full control of private repositories»)
6. **Generate token** → скопируйте (больше не покажут!)

### 1.3. Залить код

```bash
cd /home/user
git remote add origin https://github.com/ВАШ_ЛОГИН/smartplan.git
git branch -M main
git push -u origin main
```

При запросе:
- **Username**: ваш логин GitHub
- **Password**: вставьте токен (не пароль!)

> Если ошибка «repository not found» — проверьте URL и что репозиторий создан.

После успешного push на GitHub появится **40 файлов**.

---

## Шаг 2. Создать PostgreSQL на Render

1. Откройте https://dashboard.render.com
2. **New + → PostgreSQL**
3. Заполните:
   - **Name**: `smartplan-db`
   - **Database**: `smartplan`
   - **User**: `smartplan`
   - **Region**: **Frankfurt (EU Central)** ← ближе к Минску
   - **Plan**: **Free**
4. **Create Database**
5. Дождитесь статуса **Available** (~1 мин)
6. На странице БД найдите **Internal Database URL** (формат `postgres://smartplan:...@...`)
7. **Скопируйте** его (пригодится на шаге 3.2)

---

## Шаг 3. Создать Web Service на Render

> **Два способа** — выбирайте удобный:
>
> ### Способ A. Blueprint (рекомендуется, всё автоматически)
>
> 1. На https://dashboard.render.com → **New + → Blueprint**
> 2. **Connect** репозиторий `smartplan`
> 3. Render найдёт `render.yaml` в корне и **сам** создаст Web Service + PostgreSQL + переменную `DATABASE_URL`
> 4. Нажмите **Apply** — больше ничего настраивать не нужно
>
> ### Способ B. Web Service вручную (если Blueprint не подходит)
>
> 1. Сначала создайте PostgreSQL (Шаг 2)
> 2. **New + → Web Service**
> 3. **Connect** репозиторий `smartplan`
> 4. Заполните форму:

| Поле | Значение |
|---|---|
| **Name** | `smartplan` |
| **Region** | **Frankfurt (EU Central)** |
| **Branch** | `main` |
| **Runtime** | **`Docker`** ← обязательно! |
| **Dockerfile Path** | `server/Dockerfile` |
| **Docker Context** | пусто (корень репо) |
| **Plan** | **Free** |

> ⚠️ **Build Command** и **Start Command** — оставьте **пустыми**! Эти поля активны только при Runtime = Node. При Runtime = Docker они игнорируются — Render использует Dockerfile.

5. **Environment → Add Environment Variable**:

| Key | Value |
|---|---|
| `DATABASE_URL` | вставьте Internal Database URL из Шага 2 |

6. **Create Web Service**

---

## Шаг 4. Инициализация БД (без Shell)

На Render Shell — **платная функция**. Поэтому сервер сам создаёт пользователей при первом запуске:

- При старте сервер проверяет таблицу `users`
- Если она пуста — создаёт 4 стандартных пользователей (admin, seogs, master, slesar)
- Если уже есть — пропускает

**Это происходит автоматически.** Никаких ручных действий не нужно.

Если по какой-то причине пользователи не создались (например, ошибка БД):

1. Откройте в браузере:
   ```
   https://smartplan-XXXX.onrender.com/api/admin/status
   ```
   Должно вернуть `{"users": 4, "ready": true}` — если `users: 0`, то инициализация не прошла.

2. Запустите принудительную инициализацию (без токена, бесплатно):
   ```bash
   curl -X POST https://smartplan-XXXX.onrender.com/api/admin/init-db
   ```
   Ответ:
   ```json
   {
     "ok": true,
     "message": "✅ БД инициализирована",
     "users_created": [...],
     "logins": [{"login": "admin", "password": "admin123"}, ...]
   }
   ```

3. После этого войдите как `admin` / `admin123`.

---

## Шаг 5. Проверка

1. Откройте URL вашего сервиса (формат `https://smartplan-XXXX.onrender.com/`)
2. Должна появиться страница входа SmartPlan
3. Войдите как **`admin`** / **`admin123`**
4. В **топбаре** — **зелёный индикатор** «Сервер: в сети»

---

## Стандартные аккаунты

| Логин | Пароль | Роль |
|---|---|---|
| `admin` | `admin123` | Администратор (полный доступ) |
| `seogs` | `seogs123` | Начальник СЭОГС (только просмотр) |
| `master` | `master123` | Мастер — Иванов С.П., УБиРОГС |
| `slesar` | `slesar123` | Слесарь — Петров А.Н., УБиРОГС |

---

## Если что-то пошло не так

| Проблема | Решение |
|---|---|
| **Build failed** | На странице Web Service → **Logs** — там полный текст ошибки |
| **DATABASE_URL not set** | Шаг 3.2 не выполнен или БД ещё не создана |
| **Неверный логин / пароль** | Откройте `/api/admin/status` — проверьте количество пользователей. Если 0 — выполните `curl -X POST /api/admin/init-db` (см. Шаг 4) |
| **Сайт медленно открывается** | Free-план Render усыпляет сервис после 15 мин простоя. Первый запрос «будит» его (10–30 сек) |
| **Internal Database URL не виден** | БД должна быть **Available** (зелёная плашка). Если **Provisioning** — подождите |

---

## Обновление кода

Внесли правки локально → залить на GitHub:

```bash
cd /home/user
git add .
git commit -m "описание изменений"
git push
```

Render **автоматически** подхватит изменения и пересоберёт (~3 мин).

> Если меняли SQL-схему — после деплоя снова зайдите в Shell и выполните `node migrations/init.js` (создание таблиц идемпотентно — `IF NOT EXISTS`).

---

## Кастомный домен (опционально)

Если хотите использовать `smartplan.mingas.by` вместо `*.onrender.com`:

1. В настройках Web Service → **Settings → Custom Domain → Add**
2. Введите ваш домен
3. Render выдаст CNAME-запись — добавьте её в DNS вашего домена
4. **Wait** — Render автоматически выпустит бесплатный SSL (~5 мин)

---

## Что дальше (для следующих сборок)

- 📋 Кнопка «Импорт из localStorage» для переноса старых данных
- 📋 Список «онлайн» в UI (кто сейчас работает)
- 📋 Экспорт всех разделов в Excel / CSV
- 📋 Кастомный домен `smartplan.mingas.by`
- 📋 Апгрейд на Starter ($7/мес) — неусыпляемый сервис + больше ресурсов

---

## Локальная разработка (бонус)

```bash
# 1. Установить зависимости
cd /home/user/server
npm install

# 2. Запустить PostgreSQL (Docker)
docker run --name smartplan-pg \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:15-alpine

# 3. Переменная окружения
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres

# 4. Создать пользователей
node migrations/run.js

# 5. Запустить сервер
node server.js
# → http://localhost:3000
```

Фронтенд (`index.html`) открывается напрямую через любой статический сервер (например `python3 -m http.server 8400`) — он шлёт запросы на `http://localhost:3000/api`.