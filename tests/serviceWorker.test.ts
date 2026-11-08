import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function worker() {
  const handlers = new Map<string, (event: unknown) => void>();
  const shown: { title: string; options: { data: { url: string }; tag: string } }[] = [];
  const opened: string[] = [];
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    URL,
    self: {
      location: { origin: "https://laundry.example" },
      addEventListener: (name: string, callback: (event: unknown) => void) => handlers.set(name, callback),
      registration: { showNotification: async (title: string, options: typeof shown[number]["options"]) => { shown.push({ title, options }); } },
      clients: { matchAll: async () => [], openWindow: async (url: string) => { opened.push(url); } },
    },
  });
  return { handlers, shown, opened };
}

test("service worker displays the push with a stable tag and machine destination", async () => {
  const w = worker();
  let task: Promise<unknown> = Promise.resolve();
  w.handlers.get("push")!({
    data: { json: () => ({ title: "Washer 1 (demo) is done", body: "Demo notification", url: "/m/washer-1", tag: "cycle-123" }) },
    waitUntil: (promise: Promise<unknown>) => { task = promise; },
  });
  await task;
  assert.equal(w.shown[0].title, "Washer 1 (demo) is done");
  assert.equal(w.shown[0].options.tag, "cycle-123");
  assert.equal(w.shown[0].options.data.url, "/m/washer-1");
});

test("notification taps open the machine and reject external navigation", async () => {
  const w = worker();
  for (const url of ["/m/washer-1", "https://unrelated.example/"]) {
    let task: Promise<unknown> = Promise.resolve();
    w.handlers.get("notificationclick")!({
      notification: { close() {}, data: { url } },
      waitUntil: (promise: Promise<unknown>) => { task = promise; },
    });
    await task;
  }
  assert.deepEqual(w.opened, ["https://laundry.example/m/washer-1", "https://laundry.example"]);
});
