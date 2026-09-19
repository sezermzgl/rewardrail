# The validator, as a long-running container.
#
# It is not serverless on purpose. Player records, the tier clock and the event
# feed the transaction log reads all live in memory, and a signup writes its
# custodial key to disk — none of which survives an instance that comes and
# goes between requests. A container that stays up is what the service already
# assumes, so this deploys it as one rather than reshaping it to fit a host.
FROM node:22-slim

WORKDIR /app

# Dependencies first: src changes on every deploy, package.json rarely does.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

# Where config.js looks for the setup scripts' output. The files themselves are
# not in the image — keys and ids arrive as VALIDATOR_KEYS, VALIDATOR_PLAYERS
# and VALIDATOR_DEPLOYED — but a player created at runtime is written here, so
# the directory has to exist.
RUN mkdir -p /scripts

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
