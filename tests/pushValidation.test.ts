import test from "node:test";
import assert from "node:assert/strict";
import { validateSubscription } from "../lib/pushValidation.ts";

const subscription = { endpoint: "https://web.push.apple.com/QExample", keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) } };
test("allows known HTTPS browser push services with correctly shaped keys", () => {
  for (const host of ["web.push.apple.com", "fcm.googleapis.com", "updates.push.services.mozilla.com", "wns2.notify.windows.com"]) {
    assert.equal(validateSubscription({ ...subscription, endpoint: `https://${host}/push/example` }), null);
  }
});
test("rejects arbitrary hosts, credentials, ports, local URLs and malformed keys", () => {
  for (const endpoint of ["http://web.push.apple.com/push", "https://127.0.0.1/", "https://web.push.apple.com.attacker.test/x", "https://attacker.test/x", "https://user:pass@web.push.apple.com/x", "https://web.push.apple.com:8443/x"]) {
    assert.notEqual(validateSubscription({ ...subscription, endpoint }), null);
  }
  assert.notEqual(validateSubscription({ ...subscription, keys: { auth: "wrong", p256dh: "wrong" } }), null);
  assert.notEqual(validateSubscription(null), null);
});
