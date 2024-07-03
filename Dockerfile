FROM node:20.15.0-bookworm-slim as base
RUN adduser --disabled-password -home /home/cfu -shell /bin/bash cfu
WORKDIR /root/cf-runtime
COPY package.json yarn.lock ./

FROM base AS dependencies
RUN apt-get update \
    && apt upgrade -y \
    && apt-get install -y \
    g++ \
    git \
    make \
    python3
RUN yarn install --frozen-lockfile --production

FROM base AS production
COPY --from=dependencies /root/cf-runtime/node_modules ./node_modules
COPY . .

USER cfu
CMD ["node", "lib/index.js"]
