FROM node:11.10.0-alpine

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

EXPOSE 9229:9229

# Set tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

#CMD ["node", "node_modules/.bin/forever", "--minUptime",  "1", "--spinSleepTime", "1000", "-c", "node --inspect-brk", "lib/index.js"]
CMD ["node", "--inspect-brk=0.0.0.0:9229", "lib/index.js"]

