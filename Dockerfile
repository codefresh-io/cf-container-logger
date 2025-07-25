ARG NODE_VERSION=22.17.1
FROM node:${NODE_VERSION}-bookworm-slim AS base
# that workdir MUST NOT be changed because of backward compatibility with the engine <= 1.177.7
WORKDIR /root/cf-runtime

FROM base AS build-dependencies
RUN apt-get update \
    && apt upgrade -y \
    && apt-get install -y \
    g++ \
    git \
    make \
    python3
COPY package.json yarn.lock ./

FROM build-dependencies AS build
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM build-dependencies AS prod-dependencies
RUN yarn install --frozen-lockfile --production

FROM base AS final
# purpose of security
RUN npm uninstall -g --logs-max=0 corepack npm
USER node

COPY --from=prod-dependencies --chown=node:node /root/cf-runtime/node_modules node_modules
COPY --from=build --chown=node:node /root/cf-runtime/dist lib

CMD ["node", "lib/index.js"]
