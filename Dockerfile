# Official Playwright image, pinned by tag and digest (browsers for 1.64.1 are preinstalled).
FROM mcr.microsoft.com/playwright:v1.65.0-noble@sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d

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
