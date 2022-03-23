FROM node:16.14.2-alpine3.15

WORKDIR /root/cf-runtime

RUN apk -U upgrade

# install cf-runtime required binaries
RUN apk add --no-cache bash git openssh-client tini

RUN npm install pm2 -g

COPY package.json yarn.lock ./

# install cf-runtime required binaries
RUN apk add --no-cache --virtual deps python3 make g++ && \
    yarn install --frozen-lockfile --production && \
    yarn cache clean && \
    apk del deps && \
    rm -rf /tmp/*

# copy app files
COPY . ./

# Set tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["pm2-runtime", "--restart-delay", "1000", "lib/index.js"]
