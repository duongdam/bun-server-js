FROM oven/bun:latest as build-stage

WORKDIR /dist

COPY . .
COPY .env.stg .env
COPY package.json package.json
COPY bun.lockb bun.lockb

# Firebase staging
#COPY firebase/stg.json stg.json
# Firebase Production
#COPY firebase/prod.json prod.json

RUN bun install
RUN bun build ./server.ts --compile --outfile server

# Reduce image size
FROM  --platform=linux/amd64 oven/bun:latest

WORKDIR /app

COPY --from=build-stage /dist/.env ./.env
#COPY --from=build-stage /dist/stg.json ./firebase/stg.json
COPY --from=build-stage /dist/server ./server

EXPOSE 8080
ENV PORT 8080
# set hostname to localhost - Use when deploying to Google Cloud Run
ENV HOSTNAME "0.0.0.0"

CMD ["./server"]
