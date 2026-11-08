# Step 4 — Installable app and Web Push

The app now has a manifest, 192/512px icons, an Apple touch icon, a service
worker, and an offline screen. It never caches machine status as though it were
live. The machine page asks for notification permission only when you tap
“Notify me when it’s done.” No user accounts are required.

On iPhone, Web Push requires iOS 16.4 or later, an HTTPS site, and opening the
app from the Home Screen. No paid Apple Developer account is needed.
Reference: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

## 1. Apply the database update

In Supabase → SQL Editor → New query, paste all of `supabase/step4.sql` and Run.
It extends the existing push_subscriptions table and adds the delivery queue
functions and cycle-completion trigger. It is safe to rerun. Do not rerun the
original schema.sql. There is no need to create a separate Supabase project.

The migration has been exercised against a local PostgreSQL test engine,
including repeated registration, stale state updates, queue claims, transaction
rollback, and denied anonymous access. Your live database still needs this SQL.

## 2. Copy the generated keys into Vercel

The key pair was generated and saved in the ignored `.env.local` file. The
supplied contact email was saved as VAPID_SUBJECT. Do not generate another pair
for Vercel: use exactly the same pair locally and in production.

Open `.env.local` privately in your editor. In Vercel → project → Settings →
Environment Variables, add these three rows, selecting **Production**:

| Key | Value |
| --- | --- |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | Copy the generated value from .env.local |
| VAPID_PRIVATE_KEY | Copy the generated private value from .env.local |
| VAPID_SUBJECT | Copy the mailto: contact value from .env.local |

No new service account is needed. The public key is intentionally available to
the browser; the private key is server-only. Keep the private key out of chat
and Git. Never rotate these casually: existing subscriptions depend on the pair.
The reusable `node scripts/setup-push.mjs` command generates missing keys while
preserving an existing pair, but you do not need to run it again now.

Also verify these existing Vercel Production values:

- SUPABASE_URL and SUPABASE_SECRET_KEY point to the database where step4.sql ran.
- DEVICE_INGEST_KEY matches the simulator/device.
- TIME_SCALE is 22.5 for the demo.
- NEXT_PUBLIC_APP_URL is your actual stable Vercel HTTPS production URL.

## 3. Push and deploy

From your project folder in Terminal:

```sh
cd /Users/jaden/Documents/ChatGPT/emergent-2026
git check-ignore .env.local
git add .
git commit -m "Add installable PWA and Web Push notifications"
git push
```

The first command must print `.env.local`. GitHub triggers a new Vercel deploy.
Wait for Ready. If you added the Vercel variables after the build started,
redeploy again: NEXT_PUBLIC_VAPID_PUBLIC_KEY must be present at build time.
Keep the build command `npm run build -- --webpack`.

## 4. Install on your iPhone

1. In Safari, visit your actual production HTTPS URL, then open Washer 1.
2. Tap Share → Add to Home Screen → Add. If offered, keep Open as Web App on.
3. Close Safari and open Laundry from its new Home Screen icon.
4. The installed app opens the machine list. Open Washer 1 again.
5. Confirm the installation instruction banner is gone.
6. Tap **Notify me when it’s done**, then **Allow** on the iPhone prompt.
7. Wait for **You’ll be notified the next time this machine finishes.**

This arms one notification for the next completion, including if you tap before
a cycle begins. After it is sent, tap again to arm a notification for another
load. Repeated taps while waiting do not create duplicate subscriptions. If you
tap after a machine is already DONE, you are subscribing for the NEXT cycle,
not requesting a retrospective notification for the cycle already finished.

For an additional check, Supabase → Table Editor → push_subscriptions should
show a row for washer-1 with delivery_status pending and notified_at empty.
Do not share subscription_json: it contains the browser's private endpoint.

## 5. Run the simulator against the deployment

Stop any real ESP32 or other simulator sending to washer-1 for this test.
In your local `.env.local`, set NEXT_PUBLIC_APP_URL to the SAME actual deployed
HTTPS URL and TIME_SCALE to 22.5. Keep DEVICE_INGEST_KEY equal to Vercel's value.
Then, in Terminal from this project folder:

```sh
npm run simulate -- washer-1
```

The simulator reads that URL directly; it does not require a local website to
be running. You can leave the installed app in the background or lock the phone.
After about two minutes, when the machine reaches DONE, expect a notification
saying Washer 1 (demo) is done. Tap it to reopen the matching machine page.
The notification explicitly identifies simulated/demo activity.

In Supabase, a successful push has delivery_status sent and notified_at filled.
The same completed cycle must not create another notification when quiet
readings continue. A successful push-service response means accepted by the
push service, not proof that the phone displayed it.

## Delivery behavior and failure checks

The cycle insertion and queue update happen in the SAME database transaction.
Each push is claimed atomically before sending. On success, it is marked sent
and notified_at is set. Later readings check for queued work even after the door
opens. Each request handles up to ten subscriptions in parallel; subsequent
readings drain larger queues. All queue state lives in Postgres.

Web Push cannot guarantee exactly-once arrival/display on a phone. The app
prevents duplicate send attempts. Failed or uncertain sends are logged and
not automatically retried, because retrying after an uncertain network outcome
could deliver twice. A process stopped after claiming but before completion can
leave a sending row. It is retained for inspection rather than blindly resent.
The service worker also gives each cycle/subscription notification a stable tag.

In Vercel → Logs, look for:

- **Push accepted by service**: the push provider accepted it.
- **Push delivery failed**: includes the subscription ID and HTTP status if known,
  but never prints endpoint credentials or VAPID keys.
- **Push queue claim failed: check step4.sql**: run the migration/check database.
- **Push delivery unavailable**: missing or invalid VAPID configuration.
- **Push accepted but notified_at could not be saved**: database update failed;
  the row stays claimed and will not resend automatically.

For failed sends, last_error in push_subscriptions contains a readable summary.
HTTP 404/410 usually indicates an expired subscription. Reopen the installed app
and re-enable notifications for a new cycle. Check iPhone Settings → Notifications
and Focus settings if the service accepted the push but you do not see an alert.

If the button is disabled, check that you opened the installed app over HTTPS,
not a local hotspot URL or a Safari tab, and that the public VAPID variable was
added before the deployment built. If permission was denied, change the app's
notification permission in iPhone Settings and try again.

Push is supported for Apple, Google/Chrome, Firefox, and Windows browser push
service endpoints. Unknown endpoint hosts are rejected instead of letting a
public subscription request make the server send requests to arbitrary sites.

Stop here after a notification arrives on your iPhone and confirm it works.
