FROM node:20-slim

WORKDIR /app

COPY server/package*.json ./server/
RUN npm --prefix server install --omit=dev

COPY server ./server
COPY shared ./shared
COPY src ./src

EXPOSE 3002

CMD ["node", "server/server.js"]