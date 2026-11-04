# universe-content-api

Read-only content API for the GitHub Universe '26 landing page in [kevindngo-org/virtual-universe-26](https://github.com/kevindngo-org/virtual-universe-26). It is the second repository in the multi-repo Copilot Project demo.

```sh
npm start   # http://localhost:3001 (set PORT to change)
npm test
```

| Endpoint | Returns |
| --- | --- |
| `GET /health` | `{ "ok": true }` |
| `GET /api/highlights` | `{ event, count, highlights: [{ id, topic, title, summary, tryIt }] }` |
| `GET /api/highlights?topic=agentic%20software%20development` | Same envelope, filtered by case-insensitive topic **name**; unknown names return `200` with `count: 0` and `highlights: []` |
| `GET /api/topics` | `{ topics: [{ name, slug, count }] }` in the order topics first appear in the data |
| `GET /api/highlights/:id` | One highlight, or `404` |

For example:

```sh
curl 'http://localhost:3001/api/highlights?topic=agentic%20software%20development'
curl http://localhost:3001/api/topics
```

Omit `topic` to return all six sample highlights. Use a topic's `name` as the filter value, not its `slug`; an empty name also returns no matches. Existing highlight fields and title-derived ids are unchanged. Public read-only responses allow cross-origin requests from the landing page.

Demo run of show and reset instructions: [demo/DEMO.md](demo/DEMO.md).
