FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM dependencies AS development
ENV NODE_ENV=development
COPY tsconfig.base.json eslint.config.js .prettierrc.json ./
COPY backend backend
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace", "@imageword/backend"]

FROM dependencies AS builder
COPY tsconfig.base.json ./
COPY backend backend
RUN npm run build --workspace @imageword/backend

FROM node:22-alpine AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules node_modules
COPY --from=builder /app/backend/dist backend/dist
COPY backend/migrations backend/migrations
COPY backend/package.json backend/package.json
USER node
EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
