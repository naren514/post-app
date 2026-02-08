import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import { marked } from 'marked';
import { CATEGORY_MAP, STATUS_OPTIONS } from './config.js';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

// Static assets (client JS/CSS)
app.use('/assets', express.static(new URL('./assets', import.meta.url).pathname));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const WP_BASE_URL = (process.env.WP_BASE_URL || '').replace(/\/$/, '');
const WP_USERNAME = process.env.WP_USERNAME || '';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || '';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);

function mustHaveEnv() {
  if (!WP_BASE_URL) throw new Error('WP_BASE_URL missing');
  if (!WP_USERNAME) throw new Error('WP_USERNAME missing');
  if (!WP_APP_PASSWORD) throw new Error('WP_APP_PASSWORD missing');
}

function authHeader() {
  // Basic auth: base64(username:appPassword)
  const token = Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function requireAccessToken(req, res, next) {
  if (!ACCESS_TOKEN) return next();
  const got = req.get('X-Access-Token') || req.query.token || '';
  if (got !== ACCESS_TOKEN) return res.status(401).send('Unauthorized');
  return next();
}

app.get('/', requireAccessToken, (req, res) => {
  const categoryOptions = Object.entries(CATEGORY_MAP)
    .map(([key, v]) => `<option value="${key}">${escapeHtml(v.label)}</option>`)
    .join('');

  const statusOptions = STATUS_OPTIONS
    .map((s) => `<option value="${s.value}" ${s.value === 'draft' ? 'selected' : ''}>${escapeHtml(s.label)}</option>`)
    .join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New Post</title>
  <style>
    :root {
      --bg: #0b0f19;
      --surface: rgba(255,255,255,0.06);
      --surface-2: rgba(255,255,255,0.08);
      --border: rgba(255,255,255,0.10);
      --text: rgba(255,255,255,0.92);
      --muted: rgba(255,255,255,0.65);
      --shadow: 0 16px 40px rgba(0,0,0,0.35);
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --accent: #7c3aed;
      --accent2: #22c55e;
    }

    :root[data-theme="light"] {
      --bg: #f7f7fb;
      --surface: rgba(255,255,255,0.85);
      --surface-2: rgba(255,255,255,0.95);
      --border: rgba(17,24,39,0.12);
      --text: rgba(17,24,39,0.92);
      --muted: rgba(17,24,39,0.60);
      --shadow: 0 16px 40px rgba(17,24,39,0.12);
      --accent: #6d28d9;
      --accent2: #16a34a;
    }

    * { box-sizing: border-box; }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(1200px 600px at 10% 10%, rgba(124,58,237,0.25), transparent 60%),
        radial-gradient(1200px 600px at 90% 30%, rgba(34,197,94,0.18), transparent 55%),
        var(--bg);
    }

    .page { max-width: 1160px; margin: 0 auto; padding: 22px; }

    .topbar {
      display:flex;
      align-items:center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: linear-gradient(180deg, var(--surface-2), var(--surface));
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    h1 { margin: 0; font-size: 16px; letter-spacing: 0.2px; font-weight: 650; }
    .sub { color: var(--muted); font-size: 12.5px; margin-top: 2px; }

    label { display:block; font-weight: 650; margin-top: 14px; font-size: 13px; color: var(--muted); }

    input[type=text], select {
      width: 100%;
      padding: 11px 12px;
      font-size: 15px;
      color: var(--text);
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 12px;
      outline: none;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
    }
    input[type=text]:focus, select:focus { border-color: rgba(124,58,237,0.55); box-shadow: 0 0 0 4px rgba(124,58,237,0.18); }

    .row { display:flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
    .row > div { flex: 1; min-width: 240px; }

    .hint { color: var(--muted); font-size: 12.5px; margin-top:6px; }

    .toolbar {
      display:flex;
      gap: 10px;
      align-items:center;
      justify-content: space-between;
      margin: 14px 0 12px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: linear-gradient(180deg, var(--surface-2), var(--surface));
    }
    .toolbar .left { display:flex; gap:10px; align-items:center; flex-wrap: wrap; }
    .toolbar .right { display:flex; gap:10px; align-items:center; }

    .segmented {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255,255,255,0.04);
    }
    .segbtn {
      padding: 7px 10px;
      font-size: 13px;
      font-weight: 650;
      border: 0;
      border-right: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
    }
    .segbtn:last-child { border-right: 0; }
    .segbtn.active { color: var(--text); background: rgba(255,255,255,0.10); }

    .rt-editor {
      height: 560px;
      padding: 14px 16px;
      outline: none;
      overflow: auto;
      color: var(--text);
      font-size: 15px;
      line-height: 1.6;
    }
    .rt-editor .ProseMirror { outline: none; }
    .rt-editor .ProseMirror p { margin: 0 0 0.9em; }
    .rt-editor .ProseMirror h2 { margin: 1.1em 0 0.6em; }
    .rt-editor .ProseMirror h3 { margin: 1.0em 0 0.6em; }
    .rt-editor .ProseMirror ul, .rt-editor .ProseMirror ol { padding-left: 1.2em; }
    .rt-editor .ProseMirror img { max-width: 100%; border-radius: 12px; border: 1px solid var(--border); }

    .badge {
      font-size: 12px;
      padding: 5px 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--text);
      background: rgba(255,255,255,0.04);
    }
    .badge.muted { color: var(--muted); }

    button {
      padding: 10px 14px;
      font-size: 14px;
      font-weight: 650;
      cursor: pointer;
      border-radius: 12px;
      border: 1px solid var(--border);
      color: var(--text);
      background: rgba(255,255,255,0.06);
    }
    button:hover { background: rgba(255,255,255,0.10); }
    button:active { transform: translateY(1px); }

    .toolbtn {
      padding: 7px 10px;
      font-size: 13px;
      font-weight: 650;
      border-radius: 10px;
      line-height: 1;
      user-select: none;
    }
    .toolbtn kbd {
      font-family: var(--mono);
      font-size: 11px;
      opacity: 0.7;
      margin-left: 6px;
    }

    button.primary {
      border-color: rgba(124,58,237,0.55);
      background: linear-gradient(135deg, rgba(124,58,237,0.85), rgba(34,197,94,0.55));
      box-shadow: 0 10px 30px rgba(124,58,237,0.22);
    }
    button.primary:hover { filter: brightness(1.05); }

    .editor-wrap { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .panel {
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      background: linear-gradient(180deg, var(--surface-2), var(--surface));
      min-height: 440px;
      box-shadow: 0 10px 28px rgba(0,0,0,0.14);
    }

    .panel-header {
      display:flex;
      align-items:center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,0.04);
    }

    .panel-header strong { font-size: 12.5px; color: var(--muted); letter-spacing: 0.4px; text-transform: uppercase; }

    .panel-body { padding: 0; }

    #editor { height: 560px; }
    #preview { padding: 14px 16px; height: 560px; overflow:auto; }

    #dropzone {
      border: 1px dashed var(--border);
      border-radius: 16px;
      padding: 12px 14px;
      margin-top: 14px;
      color: var(--muted);
      background: rgba(255,255,255,0.04);
    }
    #dropzone.dragover { border-color: rgba(124,58,237,0.7); color: var(--text); background: rgba(124,58,237,0.10); }
    input[type=file] { color: var(--muted); }

    @media (max-width: 980px) {
      .editor-wrap { grid-template-columns: 1fr; }
      #editor, #preview { height: 440px; }
      .page { padding: 16px; }
    }

    /* Preview typography */
    #preview h1, #preview h2, #preview h3 { margin-top: 1em; }
    #preview pre { background:#0b1020; color:#e5e7eb; padding: 12px; border-radius: 12px; overflow:auto; border: 1px solid rgba(255,255,255,0.08); }
    :root[data-theme="light"] #preview pre { background:#111827; }
    #preview code { font-family: var(--mono); }
    #preview a { color: var(--text); text-decoration: underline; text-underline-offset: 2px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div>
        <h1>New WordPress Post</h1>
        <div class="sub">Minimal, fast, and now a bit glossy.</div>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <button type="button" id="themeBtn" title="Toggle theme">Theme</button>
      </div>
    </div>

    <form id="postForm" method="post" action="/create">
    <label>Title</label>
    <input id="title" type="text" name="title" required />

    <div class="row">
      <div>
        <label>Category</label>
        <select id="category" name="category" required>
          ${categoryOptions}
        </select>
      </div>
      <div>
        <label>Status</label>
        <select id="status" name="status" required>
          ${statusOptions}
        </select>
      </div>
      <div>
        <label>Tags (comma-separated)</label>
        <input id="tags" type="text" name="tags" />
      </div>
    </div>

    <div class="toolbar">
      <div class="left">
        <span class="badge">Editor</span>

        <div class="segmented" role="tablist" aria-label="Editor mode">
          <button type="button" class="segbtn" id="modeRichBtn" role="tab" aria-selected="true">Rich text</button>
          <button type="button" class="segbtn" id="modeMdBtn" role="tab" aria-selected="false">Markdown</button>
        </div>

        <span id="rtTools" style="display:none; gap:8px; align-items:center;">
          <button type="button" class="toolbtn" data-rtcmd="bold" title="Bold"><strong>B</strong></button>
          <button type="button" class="toolbtn" data-rtcmd="italic" title="Italic"><em>I</em></button>
          <button type="button" class="toolbtn" data-rtcmd="h2" title="Heading">H2</button>
          <button type="button" class="toolbtn" data-rtcmd="h3" title="Heading">H3</button>
          <button type="button" class="toolbtn" data-rtcmd="ul" title="Bulleted list">• List</button>
          <button type="button" class="toolbtn" data-rtcmd="ol" title="Numbered list">1. List</button>
          <button type="button" class="toolbtn" data-rtcmd="link" title="Link">Link</button>
        </span>

        <span id="mdTools" style="display:none; gap:8px; align-items:center;">
          <button type="button" class="toolbtn" data-cmd="bold" title="Bold (Cmd/Ctrl+B)"><strong>B</strong><kbd>⌘B</kbd></button>
          <button type="button" class="toolbtn" data-cmd="italic" title="Italic (Cmd/Ctrl+I)"><em>I</em><kbd>⌘I</kbd></button>
          <button type="button" class="toolbtn" data-cmd="strike" title="Strikethrough">S</button>
          <button type="button" class="toolbtn" data-cmd="h2" title="Heading">H2</button>
          <button type="button" class="toolbtn" data-cmd="h3" title="Heading">H3</button>
          <button type="button" class="toolbtn" data-cmd="quote" title="Blockquote">❝</button>
          <button type="button" class="toolbtn" data-cmd="ul" title="Bulleted list">• List</button>
          <button type="button" class="toolbtn" data-cmd="ol" title="Numbered list">1. List</button>
          <button type="button" class="toolbtn" data-cmd="code" title="Inline code">&#96;code&#96;</button>
          <button type="button" class="toolbtn" data-cmd="codeblock" title="Code block">&#96;&#96;&#96;</button>
          <button type="button" class="toolbtn" data-cmd="link" title="Link (Cmd/Ctrl+K)">Link<kbd>⌘K</kbd></button>
        </span>

        <span id="saveStatus" class="badge muted">Not saved</span>
      </div>
      <div class="right">
        <button type="button" id="clearBtn">Clear</button>
        <button class="primary" type="submit" id="submitBtn">Create</button>
      </div>
    </div>

    <input type="hidden" id="contentHtml" name="contentHtml" value="" />

    <div class="editor-wrap">
      <div class="panel">
        <div class="panel-header"><strong>Editor</strong><span id="modeHint" class="hint">Rich</span></div>
        <div class="panel-body">
          <div id="rtEditor" class="rt-editor" style="display:none;"></div>
          <textarea id="bodyArea" name="body" placeholder="Write Markdown here…" style="width:100%;height:560px;resize:none;padding:14px 16px;border:0;outline:none;background:transparent;color:var(--text);font-family:var(--mono);font-size:14px;line-height:1.5;"></textarea>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><strong>Preview</strong><span class="hint">Live</span></div>
        <div class="panel-body"><div id="preview"></div></div>
      </div>
    </div>

    <div id="dropzone">Drag & drop an image here to upload to WordPress Media and insert into the post (or click: <input type="file" id="fileInput" accept="image/*" />)</div>
    <div class="hint">Images upload to WordPress and are inserted into the active editor (Rich text inserts an <code>&lt;img src="..." /&gt;</code>; Markdown inserts <code>![](url)</code>).</div>
  </form>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/turndown/dist/turndown.js"></script>
  <script type="module" src="/assets/app.js"></script>
</body>
</html>`);
});

app.post('/upload', requireAccessToken, upload.single('file'), async (req, res) => {
  try {
    mustHaveEnv();
    if (!req.file) return res.status(400).send('Missing file');

    const filename = req.file.originalname || 'upload';
    const contentType = req.file.mimetype || 'application/octet-stream';

    const r = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(),
        'Content-Disposition': `attachment; filename="${filename.replaceAll('"', '')}"`,
        'Content-Type': contentType,
        'Accept': 'application/json'
      },
      body: req.file.buffer,
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(500).send(`WordPress media error (${r.status}):\n${text}`);
    }

    const created = JSON.parse(text);
    return res.json({ id: created.id, url: created.source_url, title: created.title?.rendered });
  } catch (err) {
    return res.status(500).send(String(err?.stack || err));
  }
});

app.post('/create', requireAccessToken, async (req, res) => {
  try {
    mustHaveEnv();

    const title = (req.body.title || '').trim();
    const bodyMd = (req.body.body || '').trim();
    const contentHtml = (req.body.contentHtml || '').trim();
    const categoryKey = (req.body.category || '').trim();
    const status = (req.body.status || 'draft').trim();
    const tagsRaw = (req.body.tags || '').trim();

    if (!title || (!contentHtml && !bodyMd)) return res.status(400).send('Missing title/body');
    if (!CATEGORY_MAP[categoryKey]) return res.status(400).send('Invalid category');
    if (!['draft', 'publish'].includes(status)) return res.status(400).send('Invalid status');

    const html = contentHtml || marked.parse(bodyMd);
    const categoryId = CATEGORY_MAP[categoryKey].id;

    // Resolve tag IDs (create missing tags)
    let tagIds = [];
    if (tagsRaw) {
      const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      tagIds = await ensureTags(tags);
    }

    const payload = {
      title,
      content: html,
      status,
      categories: [categoryId],
      ...(tagIds.length ? { tags: tagIds } : {}),
    };

    const r = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(500).send(`WordPress error (${r.status}):\n${escapeHtml(text)}`);
    }

    const created = JSON.parse(text);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Created</title></head><body style="font-family:-apple-system,system-ui,sans-serif;margin:24px;max-width:820px;">
      <h2>Created ${escapeHtml(created.status)} post</h2>
      <p><strong>Title:</strong> ${escapeHtml(created.title?.rendered || title)}</p>
      <p><a href="${escapeHtml(created.link)}" target="_blank" rel="noopener">Open post</a></p>
      <p><a href="${escapeHtml(WP_BASE_URL)}/wp-admin/post.php?post=${created.id}&action=edit" target="_blank" rel="noopener">Edit in wp-admin</a></p>
      <p><a href="/">Create another</a></p>
    </body></html>`);
  } catch (err) {
    res.status(500).send(String(err?.stack || err));
  }
});

async function ensureTags(tagNames) {
  // Creates missing tags and returns IDs.
  // Uses WP REST /wp/v2/tags
  const ids = [];
  for (const name of tagNames) {
    const existingId = await findTagIdByName(name);
    if (existingId) {
      ids.push(existingId);
    } else {
      const createdId = await createTag(name);
      if (createdId) ids.push(createdId);
    }
  }
  return ids;
}

async function findTagIdByName(name) {
  const q = encodeURIComponent(name);
  const r = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/tags?search=${q}&per_page=100`, {
    headers: { 'Authorization': authHeader(), 'Accept': 'application/json' }
  });
  if (!r.ok) return null;
  const items = await r.json();
  const exact = items.find(t => (t.name || '').toLowerCase() === name.toLowerCase());
  return exact ? exact.id : null;
}

async function createTag(name) {
  const r = await fetch(`${WP_BASE_URL}/wp-json/wp/v2/tags`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ name })
  });
  if (!r.ok) return null;
  const created = await r.json();
  return created.id;
}

app.listen(PORT, BIND_HOST, () => {
  console.log(`wp-post-form running on http://${BIND_HOST}:${PORT}`);
});
