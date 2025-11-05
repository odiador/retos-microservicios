FROM node:18-alpine

WORKDIR /usr/src/app

COPY package.json .
RUN npm install --production

COPY . .

EXPOSE 8085

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8085/health-check || exit 1

CMD ["node", "index.js"]
