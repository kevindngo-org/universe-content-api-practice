import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "Usage: node scripts/api-smoke.mjs <http(s)://api-base-url>";

function requireShape(condition, message) {
    if (!condition) throw new Error(message);
}

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isText(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function validateHighlight(item) {
    requireShape(isObject(item), "expected a highlight object");
    for (const field of ["id", "topic", "title", "summary", "tryIt"]) {
        requireShape(isText(item[field]), `highlight.${field} must be a non-empty string`);
    }
    requireShape(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id), "highlight.id must be a lowercase slug");
}

function parseBaseUrl(value) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`Invalid API base URL: ${value}. ${USAGE}`);
    }
    requireShape(["http:", "https:"].includes(url.protocol), "API base URL must use http or https");
    requireShape(!url.username && !url.password, "API base URL must not contain credentials");
    requireShape(!url.search && !url.hash, "API base URL must not contain a query or fragment");
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url;
}

export async function verifyApi(baseUrl, { timeoutMs = 5000, onCheck = () => {} } = {}) {
    const base = parseBaseUrl(baseUrl);
    requireShape(Number.isInteger(timeoutMs) && timeoutMs > 0, "timeoutMs must be a positive integer");
    let checks = 0;

    async function check(path, expectedStatus, validate) {
        const url = new URL(path, base);
        let body;
        try {
            const response = await fetch(url, {
                headers: { Accept: "application/json" },
                redirect: "error",
                signal: AbortSignal.timeout(timeoutMs),
            });
            requireShape(response.status === expectedStatus,
                `expected HTTP ${expectedStatus}, received HTTP ${response.status}`);
            requireShape(/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? ""),
                "expected Content-Type application/json");
            try {
                body = await response.json();
            } catch (error) {
                throw new Error(`could not read JSON response: ${error.message}`, { cause: error });
            }
            validate(body);
        } catch (error) {
            const detail = error.name === "TimeoutError"
                ? `request exceeded ${timeoutMs}ms timeout`
                : error.message;
            const failure = new Error(`GET ${url}: ${detail}`, { cause: error });
            onCheck({ path: url.pathname, ok: false, error: failure.message });
            throw failure;
        }
        checks += 1;
        onCheck({ path: url.pathname, ok: true, status: expectedStatus });
        return body;
    }

    await check("health", 200, (body) => {
        requireShape(isObject(body) && body.ok === true, "expected { ok: true }");
    });

    const listing = await check("api/highlights", 200, (body) => {
        requireShape(isObject(body), "expected a highlights response object");
        requireShape(isText(body.event), "event must be a non-empty string");
        requireShape(Array.isArray(body.highlights) && body.highlights.length > 0,
            "highlights must be a non-empty array to verify an individual highlight");
        requireShape(Number.isInteger(body.count) && body.count === body.highlights.length,
            "count must be an integer matching highlights.length");
        body.highlights.forEach(validateHighlight);
        requireShape(new Set(body.highlights.map((item) => item.id)).size === body.highlights.length,
            "highlight ids must be unique");
    });

    const selected = listing.highlights[0];
    await check(`api/highlights/${encodeURIComponent(selected.id)}`, 200, (body) => {
        validateHighlight(body);
        requireShape(isDeepStrictEqual(body, selected),
            `individual highlight must match listing entry ${selected.id}`);
    });

    let missingId;
    do {
        missingId = `smoke-missing-${randomUUID()}`;
    } while (listing.highlights.some((item) => item.id === missingId));
    await check(`api/highlights/${missingId}`, 404, (body) => {
        requireShape(isObject(body) && isText(body.error), "expected { error: <non-empty string> }");
    });

    return { checks };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.length === 3 && process.argv[2] === "--help") {
        console.log(USAGE);
    } else if (process.argv.length !== 3) {
        console.error(USAGE);
        process.exitCode = 1;
    } else {
        try {
            const result = await verifyApi(process.argv[2], {
                onCheck: ({ path, ok, status }) => {
                    if (ok) console.log(`PASS GET ${path} (${status})`);
                },
            });
            console.log(`PASS ${result.checks} API checks`);
        } catch (error) {
            console.error(`FAIL ${error.message}`);
            process.exitCode = 1;
        }
    }
}
