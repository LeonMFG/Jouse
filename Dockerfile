# FIU SigEp BMP Tracker — production container
FROM node:20-bookworm

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# App source
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
# Persistent data lives on a mounted volume at /data (database + uploaded proof files)
ENV DATA_DIR=/data
ENV UPLOAD_DIR=/data/uploads
VOLUME /data

EXPOSE 3000

# Seed is idempotent — it loads requirements/demo accounts on first boot and is a no-op afterwards.
CMD ["sh", "-c", "node seed.js && node server.js"]
