FROM node:11.10.1-alpine as build

WORKDIR /build

COPY package.json ./

COPY yarn.lock ./

RUN apk add git && \
    yarn install --frozen-lockfile --production

FROM codefresh/node:11.10.1-alpine3.11

WORKDIR /root/cf-runtime

RUN apk add --no-cache tini

COPY --from=build /build/node_modules node_modules

# copy app files
COPY . ./

# Set tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "lib/index.js"]