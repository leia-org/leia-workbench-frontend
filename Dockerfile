FROM node:lts-alpine

WORKDIR /leia-workbench-frontend

COPY . .

RUN npm ci && \
    npm run build && \
    rm -rf $(npm get cache)

ENTRYPOINT ["node", "server.cjs"]
