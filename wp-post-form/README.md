# wp-post-form

Local web form to create WordPress posts (draft or publish) via the WP REST API.

## Security model

- The server binds to **127.0.0.1** by default (local-only).
- For access from your phone, use **Tailscale** and bind to the Tailscale interface.
- Store credentials in environment variables (do **not** hardcode).

## Prereqs

- Node.js 18+
- A **WordPress Application Password** for your WP user.

## Setup

```bash
cd wp-post-form
npm install
cp .env.example .env
```

Edit `.env`:

- `WP_BASE_URL=https://your-site.com`
- `WP_USERNAME=...` (your WP username/email)
- `WP_APP_PASSWORD=...` (application password; spaces are OK)
- `BIND_HOST=127.0.0.1`
- `PORT=8787`
- `ACCESS_TOKEN=` (optional)

Run:

```bash
npm start
```

Open:

- http://127.0.0.1:8787

## Phone access (recommended: Tailscale)

1. Install Tailscale on Mac + phone, log in.
2. Set `BIND_HOST` to your Mac’s Tailscale IP (preferred) or `0.0.0.0`.
3. Allow the macOS firewall prompt if it appears.
4. On phone, open: `http://<mac-tailscale-ip>:8787`

## Category IDs (configured)

Update in `config.js` if needed.
