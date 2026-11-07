FROM node:22.23.4-alpine3.23 AS dependencies
WORKDIR /app/backend

# Compile any native Node modules against the same musl-based runtime.
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22.23.4-alpine3.23 AS python-dependencies
# Build the PDF library outside the production image. Copy only pypdf's
# runtime files so pip/setuptools and their build-time metadata never ship.
RUN apk add --no-cache python3 py3-pip \
 && python3 -m pip install --break-system-packages --no-cache-dir --no-deps \
      --target=/opt/python-packages pypdf

FROM node:22.23.4-alpine3.23 AS runtime
ENV NODE_ENV=production PORT=4000 PYTHONPATH=/opt/python-packages
WORKDIR /app

# Keep the runtime minimal: Python is present for document processing, but
# pip, setuptools and virtual-environment tooling remain in the build stage.
RUN apk upgrade --no-cache \
 && apk add --no-cache \
      ca-certificates \
      ghostscript \
      poppler-utils \
      tesseract-ocr \
      tesseract-ocr-data-eng \
      python3 \
      ttf-dejavu \
      libstdc++ \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn-v1.22.22

COPY --from=python-dependencies /opt/python-packages /opt/python-packages
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY frontend ./frontend
RUN mkdir -p /app/data /app/frontend/uploads/ads \
 && chown -R node:node /app
WORKDIR /app/backend
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
 CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","src/server.js"]
