FROM node:20-slim

WORKDIR /app

COPY server/package*.json ./server/
RUN npm --prefix server install --omit=dev

COPY server/server.js server/bettingMode.js ./server/
COPY shared/gameLogic.js ./shared/
COPY src/battleEngine.js src/targeting.js src/spell.js src/spells.js src/effects.js src/heroes.js ./src/
COPY src/tower/augments.js ./src/tower/
COPY src/ai/easyAIPlusAI.js src/ai/easyAI.js src/ai/mediumAI.js src/ai/effectValue.js src/ai/effectEvaluationOverrides.js ./src/ai/
COPY src/ai/training/easyAIPlusTeacher.js ./src/ai/training/

EXPOSE 3002

CMD ["node", "server/server.js"]