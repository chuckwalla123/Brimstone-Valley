FROM node:20-slim

WORKDIR /app

COPY server/package*.json ./server/
RUN npm --prefix server install --omit=dev

COPY server ./server
COPY shared ./shared
COPY src/battleEngine.js ./src/battleEngine.js
COPY src/effects.js ./src/effects.js
COPY src/heroes.js ./src/heroes.js
COPY src/spell.js ./src/spell.js
COPY src/spells.js ./src/spells.js
COPY src/targeting.js ./src/targeting.js

EXPOSE 3002

CMD ["node", "server/server.js"]