FROM node:20-alpine
WORKDIR /app
COPY bot/package*.json ./
RUN npm install --omit=dev
COPY bot/ ./
CMD ["node", "index.js"]
