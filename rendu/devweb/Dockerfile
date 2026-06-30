FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine

# Défaut GÉNÉRIQUE (Ollama local) — l'URL réelle est fournie à l'exécution via
# le .env (docker-compose env_file), jamais codée en dur ni dans l'image.
ENV INFERENCE_URL=http://localhost:11434
ENV NGINX_ENVSUBST_FILTER=INFERENCE_URL

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
