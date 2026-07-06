# Deploying Zippy on Benedict

Zippy runs as a Next.js server (SSR + API routes) behind **Tailscale Funnel**, on
its own funnel port so it sits alongside Hypatia (which owns `:443`).

- Public URL: **`https://benedict.tail2ac91c.ts.net:8443`**
- Local listen: `127.0.0.1:3000` (systemd service `zippy.service`)
- Funnel: `:8443` → `127.0.0.1:3000`

## First-time setup

```bash
# 1. Clone (public repo, HTTPS — no auth needed)
git clone https://github.com/PaulClavet/zippy.git /home/paul/zippy
cd /home/paul/zippy

# 2. Install deps + build the EVE star map + build the app
pnpm install --frozen-lockfile
pnpm sde:build            # downloads the SDE, writes lib/sde/data/starmap.json
pnpm build

# 3. Environment (secrets — NOT in git)
cat > .env.local <<EOF
SESSION_SECRET=$(openssl rand -base64 32)
ZIPPY_CONTACT=paulsimer@gmail.com
EVE_CALLBACK_URL=https://benedict.tail2ac91c.ts.net:8443/api/auth/callback
# Fill these after registering the EVE app (see below):
EVE_CLIENT_ID=
EVE_CLIENT_SECRET=
EOF
chmod 600 .env.local

# 4. systemd service
sudo cp deploy/zippy.service /etc/systemd/system/zippy.service
sudo systemctl daemon-reload
sudo systemctl enable --now zippy
curl -s localhost:3000/api/meta          # sanity check

# 5. Expose via Tailscale Funnel (Funnel already enabled on this node)
tailscale funnel --bg --https=8443 http://127.0.0.1:3000
tailscale funnel status
curl -s https://benedict.tail2ac91c.ts.net:8443/api/meta
```

## EVE SSO

Register an app at <https://developers.eveonline.com/> (confidential web app):

- **Callback URL:** `https://benedict.tail2ac91c.ts.net:8443/api/auth/callback`
- **Scopes:** `esi-location.read_location.v1`, `esi-ui.write_waypoint.v1`

Put the `EVE_CLIENT_ID` / `EVE_CLIENT_SECRET` into `.env.local`, then
`sudo systemctl restart zippy`.

## Redeploy / update

```bash
cd /home/paul/zippy
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build                # add `pnpm sde:build` to refresh the SDE
sudo systemctl restart zippy
```

Logs: `journalctl -u zippy -f`
