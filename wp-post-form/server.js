import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import { marked } from 'marked';
import { CATEGORY_MAP, STATUS_OPTIONS } from './config.js';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

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
        <span class="badge">Markdown editor</span>
        <span id="saveStatus" class="badge muted">Not saved</span>
      </div>
      <div class="right">
        <button type="button" id="clearBtn">Clear</button>
        <button class="primary" type="submit" id="submitBtn">Create</button>
      </div>
    </div>

    <div class="editor-wrap">
      <div class="panel">
        <div class="panel-header"><strong>Editor</strong><span class="hint">CodeMirror</span></div>
        <div class="panel-body"><div id="editor"></div></div>
      </div>

      <div class="panel">
        <div class="panel-header"><strong>Preview</strong><span class="hint">Live</span></div>
        <div class="panel-body"><div id="preview"></div></div>
      </div>
    </div>

    <input type="hidden" name="body" id="body" />

    <div id="dropzone">Drag & drop an image here to upload to WordPress Media and insert into the post (or click: <input type="file" id="fileInput" accept="image/*" />)</div>
    <div class="hint">Images upload to WordPress and are inserted as Markdown: <code>![](url)</code></div>
  </form>
  </div>

  <script type="module">
    import { EditorState } from 'https://esm.sh/@codemirror/state@6.4.1';
    import { EditorView, keymap, lineNumbers } from 'https://esm.sh/@codemirror/view@6.26.3';
    import { defaultKeymap, history, historyKeymap } from 'https://esm.sh/@codemirror/commands@6.4.0';
    import { markdown } from 'https://esm.sh/@codemirror/lang-markdown@6.2.4';
    import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6.1.2';
    import { marked } from 'https://esm.sh/marked@12.0.2';

    const els = {
      title: document.getElementById('title'),
      category: document.getElementById('category'),
      status: document.getElementById('status'),
      tags: document.getElementById('tags'),
      bodyHidden: document.getElementById('body'),
      preview: document.getElementById('preview'),
      saveStatus: document.getElementById('saveStatus'),
      clearBtn: document.getElementById('clearBtn'),
      fileInput: document.getElementById('fileInput'),
      dropzone: document.getElementById('dropzone'),
      form: document.getElementById('postForm'),
    };

    const STORAGE_KEY = 'wp-post-form:draft:v1';
    const THEME_KEY = 'wp-post-form:theme:v1';
    let saveTimer = null;

    function applyTheme(theme) {
      if (theme === 'light') {
        document.documentElement.dataset.theme = 'light';
      } else {
        delete document.documentElement.dataset.theme;
      }
    }

    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);
    document.getElementById('themeBtn').addEventListener('click', () => {
      const cur = localStorage.getItem(THEME_KEY) || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });

    function setSaveStatus(text) {
      els.saveStatus.textContent = text;
    }

    function renderPreview(md) {
      els.preview.innerHTML = marked.parse(md || '');
    }

    function scheduleSave(getBody) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const payload = {
          title: els.title.value,
          category: els.category.value,
          status: els.status.value,
          tags: els.tags.value,
          body: getBody(),
          savedAt: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const d = new Date(payload.savedAt);
        setSaveStatus('Saved ' + d.toLocaleTimeString());
      }, 400);
      setSaveStatus('Saving…');
    }

    function loadDraft() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }

    function insertAtCursor(view, text) {
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      view.focus();
    }

    const initial = loadDraft();

    if (initial) {
      els.title.value = initial.title || '';
      els.category.value = initial.category || els.category.value;
      els.status.value = initial.status || els.status.value;
      els.tags.value = initial.tags || '';
      setSaveStatus('Restored draft');
    }

    const startDoc = (initial && initial.body) ? initial.body : '';

    const state = EditorState.create({
      doc: startDoc,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        oneDark,
        EditorView.updateListener.of((v) => {
          if (v.docChanged) {
            const md = v.state.doc.toString();
            renderPreview(md);
            scheduleSave(() => md);
          }
        })
      ]
    });

    const view = new EditorView({ state, parent: document.getElementById('editor') });
    renderPreview(startDoc);

    // Save on other field changes too
    ['input','change'].forEach(evt => {
      els.title.addEventListener(evt, () => scheduleSave(() => view.state.doc.toString()));
      els.category.addEventListener(evt, () => scheduleSave(() => view.state.doc.toString()));
      els.status.addEventListener(evt, () => scheduleSave(() => view.state.doc.toString()));
      els.tags.addEventListener(evt, () => scheduleSave(() => view.state.doc.toString()));
    });

    els.clearBtn.addEventListener('click', () => {
      if (!confirm('Clear the editor and local draft?')) return;
      localStorage.removeItem(STORAGE_KEY);
      els.title.value = '';
      els.tags.value = '';
      els.status.value = 'draft';
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
      renderPreview('');
      setSaveStatus('Cleared');
    });

    // On submit: sync hidden body field
    els.form.addEventListener('submit', () => {
      els.bodyHidden.value = view.state.doc.toString();
    });

    async function uploadFile(file) {
      const form = new FormData();
      form.append('file', file, file.name);
      const r = await fetch('/upload', { method: 'POST', body: form });
      if (!r.ok) throw new Error('Upload failed: ' + (await r.text()));
      return await r.json();
    }

    async function handleFiles(files) {
      const file = files && files[0];
      if (!file) return;
      setSaveStatus('Uploading image…');
      try {
        const { url } = await uploadFile(file);
        insertAtCursor(view, "\n\n![](" + url + ")\n\n");
        setSaveStatus('Image inserted');
      } catch (e) {
        alert(String(e));
        setSaveStatus('Upload failed');
      }
    }

    els.fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    els.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      els.dropzone.classList.add('dragover');
    });
    els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('dragover'));
    els.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      els.dropzone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    // Initial autosave marker if we loaded something
    if (startDoc || (initial && (initial.title || initial.tags))) {
      scheduleSave(() => view.state.doc.toString());
    }

  </script>
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
    const categoryKey = (req.body.category || '').trim();
    const status = (req.body.status || 'draft').trim();
    const tagsRaw = (req.body.tags || '').trim();

    if (!title || !bodyMd) return res.status(400).send('Missing title/body');
    if (!CATEGORY_MAP[categoryKey]) return res.status(400).send('Invalid category');
    if (!['draft', 'publish'].includes(status)) return res.status(400).send('Invalid status');

    const html = marked.parse(bodyMd);
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
