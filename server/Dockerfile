# SmartPlan — Dockerfile для Render.com
# Контекст сборки: /home/user (корень репо)
# Запуск: cd /app && node server/server.js
FROM node:20-alpine

WORKDIR /app

# Зависимости сервера
COPY server/package.json ./server/package.json
RUN cd /app/server && npm install --production

# Серверные файлы
COPY server/ ./server/

# Фронтенд (index.html + root_index/) — отдаются через SPA fallback в server.js
COPY index.html ./index.html
COPY root_index/ ./root_index/

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server/server.js"]