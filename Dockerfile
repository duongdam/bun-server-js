FROM oven/bun:0.7.1
WORKDIR /app
COPY package.json package.json
COPY bun.lockb bun.lockb
RUN bun install
COPY . .
EXPOSE 8080
ENTRYPOINT ["bun", "server.js"]