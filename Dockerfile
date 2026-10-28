# Official Playwright image, pinned by tag and digest (browsers for 1.64.1 are preinstalled).
FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea

WORKDIR /app
RUN chown pwuser:pwuser /app
USER pwuser

COPY --chown=pwuser:pwuser package.json package-lock.json ./
# The browsers come with the image: do not download any.
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts --no-audit --no-fund

COPY --chown=pwuser:pwuser audit ./audit
COPY --chown=pwuser:pwuser bench ./bench
COPY --chown=pwuser:pwuser site ./site
COPY --chown=pwuser:pwuser site-fixed ./site-fixed

CMD ["npm", "run", "bench"]
