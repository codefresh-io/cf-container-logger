FROM node:16.14.2-alpine3.15

WORKDIR /root/cf-runtime

RUN apk -U upgrade

# install cf-runtime required binaries
RUN apk add --no-cache --virtual deps \
    bash \
    g++ \
    git \
    make \
    openssh-client \
    python3 \
    tini

COPY package.json ./

COPY yarn.lock ./

RUN apk -U upgrade

# install cf-runtime required binaries
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean && \
    apk del deps && \
    rm -rf /tmp/*

# copy app files
COPY . ./

# Set tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["nodemon", "--delay", "1", "lib/index.js"]
