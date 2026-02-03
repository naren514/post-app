# wp-post-form (local)

Local web form to create WordPress posts (draft or publish) via the WP REST API.

## Security model
- The server binds to **127.0.0.1** by default (local-only).
- For access from your phone, use **Tailscale** and bind to the Tailscale interface.
- Store credentials in environment variables (do **not** hardcode).

## Prereqs
- Node.js 18+ (you have Node v24).
- A **WordPress Application Password** for your WP user.

## Setup

```bash
cd wp-post-form
npm install
```

Create an env file:

```bash
cp .env.example .env
```

Edit `.env`:
- `WP_BASE_URL=https://narenc.com`
- `WP_USERNAME=...` (your WP username/email)
- `WP_APP_PASSWORD=...` (application password, spaces allowed)
- `BIND_HOST=127.0.0.1`
- `PORT=8787`

Run:

```bash
npm start
```

Open:
- http://127.0.0.1:8787

## Phone access (recommended: Tailscale)
1. Install Tailscale on Mac + phone, log in.
2. Set `BIND_HOST=0.0.0.0` **or** your Mac’s Tailscale IP (preferred).
3. Allow macOS firewall prompt if it appears.
4. On phone, open: `http://<mac-tailscale-ip>:8787`

(If you bind to 0.0.0.0, anyone on your local network could hit it. Tailscale + binding to Tailscale IP is safer.)

## Category IDs (configured)
- Technology: 15
- Supply Chain: 14
- Thoughts: 16

Update in `config.js` if needed.
