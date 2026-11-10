import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { promisify } from "node:util";
import test from "node:test";
import { verifyApi } from "../scripts/api-smoke.mjs";

const execFileAsync = promisify(execFile);
const client = new URL("../scripts/api-smoke.mjs", import.meta.url);
const highlight = {
    id: "sample-highlight",
    topic: "Sample topic",
    title: "Sample highlight",
    summary: "Sample summary",
    tryIt: "Try the sample",
};

function responseFor(path) {
    if (path === "/health") return [200, { ok: true }];
    if (path === "/api/highlights") {
        return [200, { event: "Sample event", count: 1, highlights: [highlight] }];
    }
    if (path === `/api/highlights/${highlight.id}`) return [200, highlight];
    return [404, { error: "Highlight not found" }];
}

async function withServer(run, override = () => undefined) {
    const paths = [];
    const server = createServer((req, res) => {
        paths.push(req.url);
        const replacement = override(req.url, req);
        if (replacement === null) return;
        const [status, body, contentType = "application/json"] = replacement ?? responseFor(req.url);
        res.writeHead(status, { "Content-Type": contentType });
        res.end(typeof body === "string" ? body : JSON.stringify(body));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
        await run(`http://127.0.0.1:${server.address().port}`, paths);
    } finally {
        await new Promise((done, reject) => {
            server.close((error) => error ? reject(error) : done());
            server.closeAllConnections();
        });
    }
}

test("verifies all four endpoints without relying on fixed sample data", () => withServer(async (base, paths) => {
    const results = [];
    assert.deepEqual(await verifyApi(`${base}/`, { onCheck: (result) => results.push(result) }), { checks: 4 });
    assert.deepEqual(paths.slice(0, 3), ["/health", "/api/highlights", "/api/highlights/sample-highlight"]);
    assert.match(paths[3], /^\/api\/highlights\/smoke-missing-[a-f0-9-]+$/);
    assert.equal(results.length, 4);
    assert.ok(results.every((result) => result.ok));
}));

const invalidResponses = [
    ["health status", "/health", [503, { ok: true }], /expected HTTP 200, received HTTP 503/],
    ["health shape", "/health", [200, { ok: false }], /expected \{ ok: true \}/],
    ["content type", "/health", [200, { ok: true }, "text/plain"], /Content-Type application\/json/],
    ["malformed JSON", "/health", [200, "{"], /could not read JSON response/],
    ["event", "/api/highlights", [200, { event: "", count: 1, highlights: [highlight] }], /event must/],
    ["count", "/api/highlights", [200, { event: "Event", count: 2, highlights: [highlight] }], /count must/],
    ["empty listing", "/api/highlights", [200, { event: "Event", count: 0, highlights: [] }], /non-empty array/],
    ["missing field", "/api/highlights", [200, { event: "Event", count: 1, highlights: [{ ...highlight, tryIt: null }] }], /highlight.tryIt/],
    ["unsafe id", "/api/highlights", [200, { event: "Event", count: 1, highlights: [{ ...highlight, id: "../health" }] }], /lowercase slug/],
    ["duplicate ids", "/api/highlights", [200, { event: "Event", count: 2, highlights: [highlight, highlight] }], /ids must be unique/],
    ["individual status", "/api/highlights/sample-highlight", [404, { error: "Missing" }], /expected HTTP 200, received HTTP 404/],
    ["individual mismatch", "/api/highlights/sample-highlight", [200, { ...highlight, summary: "Different" }], /must match listing entry/],
    ["unknown status", "unknown", [200, { error: "Missing" }], /expected HTTP 404, received HTTP 200/],
    ["unknown shape", "unknown", [404, {}], /expected \{ error:/],
];

for (const [name, path, replacement, expectedError] of invalidResponses) {
    test(`rejects invalid ${name} with endpoint context`, () => withServer(async (base) => {
        const results = [];
        await assert.rejects(verifyApi(base, { onCheck: (result) => results.push(result) }), (error) => {
            assert.match(error.message, /^GET http:\/\/127\.0\.0\.1:\d+\//);
            assert.match(error.message, expectedError);
            return true;
        });
        assert.equal(results.at(-1).ok, false);
    }, (actualPath) => (path === "unknown"
        ? actualPath.startsWith("/api/highlights/smoke-missing-")
        : actualPath === path) ? replacement : undefined));
}

test("times out an unresponsive endpoint with an actionable error", () => withServer(async (base) => {
    await assert.rejects(verifyApi(base, { timeoutMs: 50 }), /GET .*\/health: request exceeded 50ms timeout/);
}, () => null));

test("reports connection failures with endpoint context", () => withServer(async (base) => {
    await assert.rejects(verifyApi(base), /GET .*\/health: fetch failed/);
}, (path, req) => {
    req.socket.destroy();
    return null;
}));

test("rejects invalid base URLs before making requests", async () => {
    for (const base of ["not-a-url", "file:///tmp/api", "https://user:password@example.com", "https://example.com?topic=x"]) {
        await assert.rejects(verifyApi(base), /API base URL/);
    }
});

test("CLI prints success and exits zero", () => withServer(async (base) => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [client.pathname, base]);
    assert.match(stdout, /PASS 4 API checks/);
    assert.equal(stderr, "");
}));

test("CLI exits nonzero and prints the failing endpoint", () => withServer(async (base) => {
    await assert.rejects(execFileAsync(process.execPath, [client.pathname, base]), (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /FAIL GET .*\/health: expected HTTP 200, received HTTP 503/);
        return true;
    });
}, () => [503, { error: "Unavailable" }]));

test("CLI rejects a missing base URL and supports help", async () => {
    await assert.rejects(execFileAsync(process.execPath, [client.pathname]), (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /Usage:/);
        return true;
    });
    const { stdout } = await execFileAsync(process.execPath, [client.pathname, "--help"]);
    assert.match(stdout, /Usage:/);
});
