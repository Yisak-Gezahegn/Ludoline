FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src ./src
COPY migrations ./migrations

# Create logs directory
RUN mkdir -p logs

EXPOSE 3001

CMD ["node", "src/index.js"]
