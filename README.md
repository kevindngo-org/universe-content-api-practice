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
| `GET /api/highlights?topic=<name>` | Same envelope, filtered by case-insensitive topic name; `count` is the filtered count |
| `GET /api/topics` | `{ topics: [{ name, slug, count }] }` in first-seen topic order |
| `GET /api/highlights/:id` | One highlight, or `404` |

Omit `topic` to return all six sample highlights. Unknown or empty topic names return `200` with `count: 0` and `highlights: []`, preserving `event`. Send the topic **name**, not its slug; slugs are metadata for frontend identifiers.

```sh
curl 'http://localhost:3001/api/topics'
curl 'http://localhost:3001/api/highlights?topic=Agentic%20software%20development'
```

The topics are `The modern GitHub experience` (3), `Open source maintainers` (1), and `Agentic software development` (2). Filtering preserves every existing highlight field and the original order.

Demo run of show and reset instructions: [demo/DEMO.md](demo/DEMO.md).
