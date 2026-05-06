# ─────────────────────────────────────────────────────────────────
# EventHub frontend — static HTML/CSS/JS served by nginx.
# nginx also reverse-proxies /api → backend service so the frontend
# code can use same-origin URLs and avoid CORS in production.
# ─────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Drop nginx's default conf and use ours
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the entire static site. Public/ holds all the user-facing pages,
# and the top-level index.html is the marketing landing page.
COPY index.html /usr/share/nginx/html/index.html
COPY Public/    /usr/share/nginx/html/Public/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://localhost:80/ >/dev/null 2>&1 || exit 1
