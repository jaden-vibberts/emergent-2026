# Step 3.5 — Debug page and Vercel deployment

No SQL changes are needed. `/debug` updates every two seconds, showing each
machine's latest 20 readings, current saved state, time in state, and time since
its last reading. Machines with no readings or a last reading over 30 seconds
old are outlined in red. Charts use actual sample timestamps; the dashed line
is RUN_THRESHOLD from `lib/machine-config.ts`. Change that file and restart or
redeploy when tuning it. A line between samples does not prove activity during
a missing-data interval. A stopped simulator will correctly turn red.

The latest 20 samples cover about 40 seconds at the real device's two-second
reporting interval, or a shorter window with the fast demo simulator. This is
a recent-signal view, not a full historical cycle chart. All times are UTC.
Demo machine labels remain visible on the debug page. Like the status pages,
the debug page has no login and is publicly readable after deployment. It does
not expose device keys, Supabase credentials, or push subscriptions.

## 1. Check locally

Restart the dev server after stopping it with Control+C:

```sh
cd /Users/jaden/Documents/ChatGPT/emergent-2026
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Visit http://localhost:3000/debug. In another Terminal tab in the same folder,
run this single-reading test. The Node command reads the existing key from
.env.local and pipes the header directly into curl, without printing the key
or placing its value in your command history:

```sh
node --env-file=.env.local -e 'const key=process.env.DEVICE_INGEST_KEY; if (!key) process.exit(1); process.stdout.write("x-device-key: "+key+"\n")' | curl --fail-with-body -i \
  http://localhost:3000/api/readings \
  --header @- \
  --header 'Content-Type: application/json' \
  --header 'x-demo-data: true' \
  --data '{"device":"washer-1","rms":0.42,"door_open":false}'
```

Expect HTTP 200 and JSON containing machine and state. A row with rms 0.42 and
door_open false should appear on /debug within a few seconds. A single reading
usually does NOT change the state to IN_USE: sustained readings are required.
The x-demo-data header ensures the destination machine has demo labels.

## 2. Push the project to GitHub

The workspace already has Git set up on branch main with this remote:
https://github.com/jaden-vibberts/emergent-2026

No new GitHub repository is needed. Sign into the GitHub account that owns or
can write to that repository if asked. Run in your project folder:

```sh
cd /Users/jaden/Documents/ChatGPT/emergent-2026
git check-ignore .env.local
git status --short
```

The first command should print `.env.local`, confirming it is excluded. The
status list must not include `.env.local`. Then run:

```sh
git add .
git commit -m "Build laundry monitor with live status and debug pages"
git push -u origin main
```

If Git opens a sign-in window, complete GitHub sign-in there. If Terminal asks
for a GitHub password or reports an authentication error, stop and share only
the error message; GitHub account passwords do not work for Git pushes. Do not
paste keys or tokens in chat. If push is rejected because remote work exists,
do not force push; share the error so we can preserve that work.

Open the repository on GitHub and confirm app/debug/page.tsx is present and
.env.local is absent. There is no need to upload node_modules or .next.

## 3. Create a Vercel account and import the repository

1. Visit https://vercel.com/signup. Create a Vercel account using GitHub.
2. Choose the Hobby plan for this personal hackathon project.
3. Choose Add New → Project, then import `emergent-2026` from GitHub.
4. If asked, allow the Vercel GitHub integration to access this repository.
5. Keep the framework preset as Next.js and Root Directory as `./`.
6. Use Node.js 22.x or a newer supported LTS version.
7. Set the Build Command override to `npm run build -- --webpack`, the production
   build verified locally. Keep the default install command and output directory.

Reference: https://vercel.com/docs/projects/managing-projects

## 4. Add environment variables

Under Environment Variables, add the following for **Production** before
clicking Deploy. Copy private values from your local `.env.local`; do not
upload that file or place the keys in source code.

| Name | Value |
| --- | --- |
| SUPABASE_URL | Your existing Supabase project URL |
| SUPABASE_SECRET_KEY | Your existing server-only sb_secret_ key |
| DEVICE_INGEST_KEY | The SAME value used by your local simulator and curl commands |
| TIME_SCALE | 22.5 for the two-minute demo; 1 for real timing |

No new Supabase project, API key, or database password is needed. Leave
NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT unset until
the notifications step.

Click Deploy. When it succeeds, find the stable production domain under
Project → Settings → Domains, such as `https://your-project.vercel.app`.
Use this production domain rather than a preview deployment URL.

Then open Project → Settings → Environment Variables and add for Production:

```dotenv
NEXT_PUBLIC_APP_URL=https://YOUR-ACTUAL-PRODUCTION-DOMAIN.vercel.app
```

Use the actual domain Vercel assigned. Open Deployments, choose the latest
production deployment, and select Redeploy so the new variable takes effect.
Before this update, QR links fall back to localhost; after redeploy, regenerate
labels at /qr. Keep your local .env.local app URL unchanged if you still want
local/hotspot testing. The deployed environment is configured separately.

Reference: https://vercel.com/docs/environment-variables

## 5. Send one fake reading to the deployed server

Open `https://YOUR-ACTUAL-PRODUCTION-DOMAIN.vercel.app/debug` in your browser.
In Terminal, run from your local project folder. Replace only the URL below
with your actual production domain:

```sh
node --env-file=.env.local -e 'const key=process.env.DEVICE_INGEST_KEY; if (!key) process.exit(1); process.stdout.write("x-device-key: "+key+"\n")' | curl --fail-with-body -i \
  https://YOUR-ACTUAL-PRODUCTION-DOMAIN.vercel.app/api/readings \
  --header @- \
  --header 'Content-Type: application/json' \
  --header 'x-demo-data: true' \
  --data '{"device":"washer-1","rms":0.43,"door_open":false}'
```

Expected result: HTTP 200, plus JSON containing `machine`, `state`,
`state_since`, and `time_scale`. The new 0.43 reading should appear on deployed
/debug automatically within a few seconds. Its age starts near zero, and the
machine turns red again after 30 seconds without another reading. Local and
deployed apps use the same Supabase project, so both will show the new row.
Stop any simulator on washer-1 if you want to inspect this one reading clearly.

Optional authentication check (no secret):

```sh
curl -i https://YOUR-ACTUAL-PRODUCTION-DOMAIN.vercel.app/api/readings \
  --header 'Content-Type: application/json' \
  --data '{"device":"washer-1","rms":0.43,"door_open":false}'
```

Expect HTTP 401 with `Invalid device key.` and no inserted reading.

Troubleshooting:

- 401 JSON `Invalid device key.`: the local DEVICE_INGEST_KEY and Vercel's
  Production value differ. Correct the value and redeploy.
- An HTML login page or redirect instead of our JSON: confirm you used the
  production domain, not a protected preview URL. The device header cannot
  bypass Vercel Deployment Protection. Share the response/status before
  changing protection settings.
- 503 JSON: check the production environment variables and Vercel function logs.
  The same database must already have schema.sql, seed.sql, and step2.sql applied.
- 404 JSON: the chosen machine needs a machines row and machine_state row.
- 400 about demo labels: use the seeded demo machine with its demo name/location.
- Deploy succeeded but pages fail: check Production variables, redeploy after
  changes, and confirm you copied the sb_secret_ key rather than a publishable key.

Done when the deployed POST returns 200 and the reading appears on deployed
/debug. Stop here and confirm that result before the next step.
