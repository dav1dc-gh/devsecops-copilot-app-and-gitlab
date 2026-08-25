# Deliberately naive. Lab 2 stretch goal is to have the agent harden this.
# Known issues: floating base tag, runs as root, single stage, copies everything.
FROM node:latest

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 3000

CMD ["node", "src/server.js"]
