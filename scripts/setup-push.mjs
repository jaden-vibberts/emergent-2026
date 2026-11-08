import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import * as webpush from "web-push";

const path = new URL("../.env.local", import.meta.url);
let source = readFileSync(path, "utf8");
const env = parseEnv(source);
if (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  console.log("Existing VAPID key pair preserved. Copy it from .env.local into Vercel.");
} else if (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || env.VAPID_PRIVATE_KEY) {
  throw new Error("Only one VAPID key exists. Restore its matching key; do not silently rotate an existing key pair.");
} else {
  const keys = webpush.generateVAPIDKeys();
  for (const [name, value] of Object.entries({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey })) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    source = pattern.test(source) ? source.replace(pattern, `${name}=${value}`) : `${source.trimEnd()}\n${name}=${value}\n`;
  }
  writeFileSync(path, source, { mode: 0o600 });
  console.log("VAPID key pair generated and saved in .env.local. Keys were not printed.");
}
if (!env.VAPID_SUBJECT) console.log("Set VAPID_SUBJECT to mailto:your-real-email, then copy all three VAPID variables into Vercel Production and redeploy.");
