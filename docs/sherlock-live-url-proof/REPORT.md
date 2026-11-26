# Sherlock live URL proof (app)

The app already read `VITE_SHERLOCK_URL` (`audit-ui/src/adapter/sherlock-url.ts`; default is empty, which shows a "no address" message, not localhost). No code change was needed, so no new tests. Suite: 636 passed. tsc clean. Build clean.

Built with `VITE_SHERLOCK_URL=https://sherlock-search-nwx7.onrender.com` (the URL is in the built bundle), served by `vite preview` on 127.0.0.1:5173 (an allowed CORS origin), driven by headless Chrome with `docs/sherlock-search-service-proof/sherlock-shot.mjs`.

Result (`shot-report.json`): overview 29 rows, nouns 114 rows, graph 33 nodes / 72 edges, one question gave 5 hits; first is K-0104, authority 8 of 9. 1920 shots are in this folder; the answer shot is `sherlock-answer-1920.png`.