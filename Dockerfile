FROM node:22.23.4-alpine3.23 AS dependencies
WORKDIR /app/backend

# Compile any native Node modules against the same musl-based runtime.
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22.23.4-alpine3.23 AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app

# Keep the runtime on a minimal, patched Alpine base and install only the
# document-processing tools the application actually invokes. The runtime uses an
# isolated venv, so remove Alpine's older system pip/setuptools copies afterward.
RUN apk upgrade --no-cache \
 && apk add --no-cache \
      ca-certificates \
      ghostscript \
      poppler-utils \
      tesseract-ocr \
      tesseract-ocr-data-eng \
      python3 \
      py3-pip \
      ttf-dejavu \
      libstdc++ \
 && python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir --upgrade pip pypdf \
 && /opt/venv/bin/pip uninstall --yes setuptools \
 && if /opt/venv/bin/pip show setuptools >/dev/null 2>&1; then echo "setuptools must not ship in the production image"; exit 1; fi \
 && apk del py3-pip py3-setuptools \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn-v1.22.22

ENV PATH="/opt/venv/bin:$PATH"
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
