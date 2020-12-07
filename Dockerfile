FROM node:12.20-alpine

WORKDIR /root/cf-runtime

RUN apk add --no-cache bash git openssh-client tini

COPY package.json ./

COPY yarn.lock ./

# install cf-runtime required binaries
RUN apk add --no-cache --virtual deps python make g++ && \
    yarn install --frozen-lockfile --production && \
    yarn cache clean && \
    apk del deps && \
    rm -rf /tmp/*

# copy app files
COPY . ./

CMD ["node", "/root/cf-runtime/lib/index.js"]
