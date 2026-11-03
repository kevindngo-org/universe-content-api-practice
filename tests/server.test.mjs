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
    const data = loadHighlights();
    assert.equal(data.highlights.length, 6);
    assert.deepEqual(body, { event: data.event, count: 6, highlights: data.highlights });
}));

test("GET /api/highlights?topic filters by topic name and preserves the envelope", () => withServer(async (base) => {
    const data = loadHighlights();
    for (const [topic, count] of [
        ["The modern GitHub experience", 3],
        ["Open source maintainers", 1],
        ["Agentic software development", 2],
    ]) {
        const response = await fetch(`${base}/api/highlights?topic=${encodeURIComponent(topic)}`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("access-control-allow-origin"), "*");
        assert.deepEqual(await response.json(), {
            event: data.event, count, highlights: data.highlights.filter((item) => item.topic === topic),
        });
    }
}));

test("topic filtering is case-insensitive", () => withServer(async (base) => {
    const response = await fetch(`${base}/api/highlights?topic=${encodeURIComponent("aGeNtIc SoFtWaRe DeVeLoPmEnT")}`);
    assert.equal(response.status, 200);
    const data = loadHighlights();
    assert.deepEqual(await response.json(), {
        event: data.event, count: 2, highlights: data.highlights.filter((item) => item.topic === "Agentic software development"),
    });
}));

test("unknown, empty, and slug topic queries return 200 with an empty list", () => withServer(async (base) => {
    for (const topic of ["unknown", "", "agentic-software-development"]) {
        const response = await fetch(`${base}/api/highlights?topic=${encodeURIComponent(topic)}`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { event: loadHighlights().event, count: 0, highlights: [] });
    }
}));

test("GET /api/topics returns names, slugs, and counts in first-seen order with CORS", () => withServer(async (base) => {
    const response = await fetch(`${base}/api/topics`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await response.json(), { topics: [
        { name: "The modern GitHub experience", slug: "the-modern-github-experience", count: 3 },
        { name: "Open source maintainers", slug: "open-source-maintainers", count: 1 },
        { name: "Agentic software development", slug: "agentic-software-development", count: 2 },
    ] });
}));

test("GET /api/highlights/:id returns one highlight or 404", () => withServer(async (base) => {
    const found = await fetch(`${base}/api/highlights/stacked-pull-requests`);
    assert.equal((await found.json()).tryIt, "gh stack");
    assert.equal((await fetch(`${base}/api/highlights/nope`)).status, 404);
}));
