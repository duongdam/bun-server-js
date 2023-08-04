FROM oven/bun:latest as build-stage

WORKDIR /dist

COPY . .
COPY .env.stg .env
COPY package.json package.json
COPY bun.lockb bun.lockb

# Firebase staging
#COPY firebase/stg.json stg.json

# Firebase Production

RUN bun install
RUN bun build ./server.js --compile --outfile server

# Reduce image size
FROM  --platform=linux/amd64 oven/bun:latest

WORKDIR /app

COPY --from=build-stage /dist/.env ./.env
#COPY --from=build-stage /dist/stg.json ./firebase/stg.json
COPY --from=build-stage /dist/server ./server

EXPOSE 8080

CMD ["./server"]
