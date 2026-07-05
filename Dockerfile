# ---- Stage 1: build the React client -------------------------------------
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: production server -------------------------------------------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

COPY server/package*.json server/
RUN cd server && npm ci --omit=dev

COPY server/src server/src
COPY --from=client-build /app/client/dist client/dist

# All persistent state (SQLite DB + photos) lives under /data — mount a volume here.
ENV DATA_DIR=/data
ENV PORT=3001
VOLUME /data
EXPOSE 3001

USER node
CMD ["node", "server/src/index.js"]
