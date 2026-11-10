# Independent API smoke verification

Requires Node.js 20 or newer. No packages, GitHub Actions, or server changes are
needed. Run from the repository root against an already-running API:

```sh
node scripts/api-smoke.mjs https://your-api.example
```

The standalone client uses only built-in Node.js modules and `fetch`. It checks:

- `GET /health`: HTTP 200 and `{ "ok": true }`.
- `GET /api/highlights`: HTTP 200, a non-empty event, a matching integer count,
  and non-empty highlights with unique slug ids and the existing string fields.
- `GET /api/highlights/:id`: HTTP 200 and the same object as the listing entry.
- An unknown highlight: HTTP 404 and a non-empty error string.

The individual id is discovered from the listing; the missing id is generated
without colliding with that listing. Extra response fields are allowed. An empty
listing fails because an individual highlight cannot then be verified.

Successful checks print `PASS`. The first failure prints the request URL and a
specific status, shape, JSON, or network error, and exits nonzero. Requests time
out after five seconds and redirects are rejected. The base URL must use HTTP or
HTTPS with no embedded credentials, query, or fragment; an optional path prefix
is preserved.

```sh
node --test tests/api-smoke.test.mjs
npm test
```

## Five-minute sandbox soak

```sh
node scripts/api-smoke-soak.mjs
```

This foreground runner starts the unchanged API from this checkout on an
OS-assigned loopback port, runs the same four smoke checks every five seconds for
at least 300 elapsed seconds, and prints elapsed time, rounds, checks, and
failures about every 30 seconds. Each request has a two-second timeout during the
soak. It reports errors, continues checking, and exits nonzero if any check
failed. Only its own temporary server is stopped afterward.

Use the baseline `main` checkout to verify the existing API contract; the client
does not call `/api/topics` or rely on feature-branch behavior.
