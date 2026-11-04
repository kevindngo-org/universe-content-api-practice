import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/server.mjs";
import { loadHighlights, slugify } from "../src/highlights.mjs";

async function withServer(fn) {
    const server = createApp().listen(0);
    await new Promise((done) => server.once("listening", done));
    try {
        await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
        server.close();
    }
}

test("slugify produces stable ids", () => {
    assert.equal(slugify("Media in issues from the CLI"), "media-in-issues-from-the-cli");
});

test("every highlight has a unique id and the landing page fields", () => {
    const { highlights } = loadHighlights();
    assert.equal(new Set(highlights.map((item) => item.id)).size, highlights.length);
    for (const item of highlights) {
        for (const field of ["id", "topic", "title", "summary", "tryIt"]) assert.equal(typeof item[field], "string");
    }
});

test("GET /api/highlights returns all highlights with CORS", () => withServer(async (base) => {
    const response = await fetch(`${base}/api/highlights`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const body = await response.json();
    assert.equal(body.count, 6);
    assert.deepEqual(body, { ...loadHighlights(), count: 6 });
}));

test("GET /api/highlights filters each topic by name without changing items", () => withServer(async (base) => {
    const data = loadHighlights();
    for (const topic of new Set(data.highlights.map((item) => item.topic))) {
        const response = await fetch(`${base}/api/highlights?${new URLSearchParams({ topic })}`);
        assert.equal(response.status, 200);
        const expected = data.highlights.filter((item) => item.topic === topic);
        assert.deepEqual(await response.json(), { event: data.event, count: expected.length, highlights: expected });
    }
}));

test("GET /api/highlights topic matching is case-insensitive", () => withServer(async (base) => {
    const response = await fetch(`${base}/api/highlights?${new URLSearchParams({ topic: "aGeNtIc SoFtWaRe DeVeLoPmEnT" })}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.count, 2);
    assert.deepEqual(body.highlights, loadHighlights().highlights.filter((item) => item.topic === "Agentic software development"));
}));

test("GET /api/highlights returns an empty success for unknown names, slugs, and empty names", () => withServer(async (base) => {
    for (const topic of ["Unknown topic", "agentic-software-development", ""]) {
        const response = await fetch(`${base}/api/highlights?${new URLSearchParams({ topic })}`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { event: loadHighlights().event, count: 0, highlights: [] });
    }
}));

test("GET /api/topics returns names, slugs, and counts in first-seen order with CORS", () => withServer(async (base) => {
    const response = await fetch(`${base}/api/topics`, { headers: { Origin: "http://127.0.0.1:8000" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await response.json(), {
        topics: [
            { name: "The modern GitHub experience", slug: "the-modern-github-experience", count: 3 },
            { name: "Open source maintainers", slug: "open-source-maintainers", count: 1 },
            { name: "Agentic software development", slug: "agentic-software-development", count: 2 },
        ],
    });
}));

test("GET /api/highlights/:id returns one highlight or 404", () => withServer(async (base) => {
    const found = await fetch(`${base}/api/highlights/stacked-pull-requests`);
    assert.equal((await found.json()).tryIt, "gh stack");
    assert.equal((await fetch(`${base}/api/highlights/nope`)).status, 404);
}));
