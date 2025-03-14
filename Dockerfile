FROM node:20.19.0-bookworm-slim AS base
RUN adduser --disabled-password -home /home/cfu -shell /bin/bash cfu
WORKDIR /root/cf-runtime
COPY package.json yarn.lock ./

FROM base AS build-dependencies
RUN apt-get update \
    && apt upgrade -y \
    && apt-get install -y \
    g++ \
    git \
    make \
    python3

FROM build-dependencies AS build
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM build-dependencies AS prod-dependencies
RUN yarn install --frozen-lockfile --production

FROM base AS production
COPY --from=prod-dependencies /root/cf-runtime/node_modules ./node_modules
COPY --from=build /root/cf-runtime/dist ./lib

#purpose of security
RUN npm -g uninstall npm

USER cfu
CMD ["node", "lib/index.js"]
