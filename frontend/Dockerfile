FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM dependencies AS development
ENV NODE_ENV=development
COPY tsconfig.base.json ./
COPY frontend frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "@imageword/frontend"]

FROM dependencies AS builder
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY tsconfig.base.json ./
COPY frontend frontend
RUN npm run build --workspace @imageword/frontend

FROM nginx:1.29-alpine AS production
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
