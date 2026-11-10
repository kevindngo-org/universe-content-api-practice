# universe-content-api

Read-only content API for the GitHub Universe '26 landing page in [kevindngo-org/virtual-universe-26](https://github.com/kevindngo-org/virtual-universe-26). It is the second repository in the multi-repo Copilot Project demo.

```sh
npm start   # http://localhost:3001 (set PORT to change)
npm test
```

| Endpoint | Returns |
| --- | --- |
| `GET /health` | `{ "ok": true }` |
| `GET /api/highlights` | `{ event, count, highlights: [{ id, topic, title, summary, tryIt }] }`; optional `?topic=<topic>` filters by topic name, case-insensitively |
| `GET /api/highlights/:id` | One highlight, or `404` |
| `GET /api/topics` | `{ topics: [{ name, slug, count }] }` in first-seen data order |

Example requests:

```sh
curl 'http://localhost:3001/api/highlights?topic=agentic%20software%20development'
curl http://localhost:3001/api/topics
```

Demo run of show and reset instructions: [demo/DEMO.md](demo/DEMO.md).
