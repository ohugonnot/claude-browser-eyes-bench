# Official Playwright image, pinned by tag and digest (browsers for 1.64.1 are preinstalled).
FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579

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
