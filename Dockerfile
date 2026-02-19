FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ src/
COPY tsconfig.json ./
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

RUN apk add --no-cache python3 py3-pip \
    && pip3 install --break-system-packages "pydantic<2.12" aws-athena-mcp

COPY --from=builder /app/dist/ dist/

EXPOSE 3000

CMD ["node", "dist/index.js"]
