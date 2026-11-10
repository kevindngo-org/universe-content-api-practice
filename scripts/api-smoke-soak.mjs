import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createApp } from "../src/server.mjs";
import { verifyApi } from "./api-smoke.mjs";

const server = createApp();
server.listen(0, "127.0.0.1");
await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;
console.log(`Sandbox API ready at ${baseUrl}`);

const durationMs = 300_000;
const intervalMs = 5000;
const started = performance.now();
let nextCheck = started;
let rounds = 0;
let checks = 0;
let failures = 0;

function report() {
    console.log(`elapsed=${((performance.now() - started) / 1000).toFixed(3)}s rounds=${rounds} checks=${checks} failures=${failures}`);
}

const progress = setInterval(report, 30_000);
try {
    report();
    while (true) {
        await delay(Math.max(0, nextCheck - performance.now()));
        rounds += 1;
        try {
            await verifyApi(baseUrl, {
                timeoutMs: 2000,
                onCheck: ({ ok }) => {
                    checks += 1;
                    if (!ok) failures += 1;
                },
            });
        } catch (error) {
            console.error(`Round ${rounds}: ${error.message}`);
        }
        const now = performance.now();
        if (now - started >= durationMs) break;
        nextCheck += intervalMs;
    }
    report();
    if (failures > 0) process.exitCode = 1;
} finally {
    clearInterval(progress);
    await new Promise((done, reject) => {
        server.close((error) => error ? reject(error) : done());
        server.closeAllConnections();
    });
    console.log("Temporary sandbox API stopped");
}
