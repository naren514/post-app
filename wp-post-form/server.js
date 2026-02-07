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
  <script type="module">
    import { Editor } from 'https://esm.sh/@tiptap/core@2.11.5';
    import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.11.5';
    import Link from 'https://esm.sh/@tiptap/extension-link@2.11.5';
    import Image from 'https://esm.sh/@tiptap/extension-image@2.11.5';

    const els = {
      title: document.getElementById('title'),
      category: document.getElementById('category'),
      status: document.getElementById('status'),
      tags: document.getElementById('tags'),
      bodyArea: document.getElementById('bodyArea'),
      rtEditorEl: document.getElementById('rtEditor'),
      preview: document.getElementById('preview'),
      saveStatus: document.getElementById('saveStatus'),
      clearBtn: document.getElementById('clearBtn'),
      fileInput: document.getElementById('fileInput'),
      dropzone: document.getElementById('dropzone'),
      form: document.getElementById('postForm'),
      contentHtml: document.getElementById('contentHtml'),
      modeRichBtn: document.getElementById('modeRichBtn'),
      modeMdBtn: document.getElementById('modeMdBtn'),
      mdTools: document.getElementById('mdTools'),
      rtTools: document.getElementById('rtTools'),
      modeHint: document.getElementById('modeHint'),
    };

    const STORAGE_KEY = 'wp-post-form:draft:v2';
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

    function renderPreviewFromHtml(html) {
      els.preview.innerHTML = html || '';
    }

    function mdToHtml(md) {
      const m = window.marked;
      if (!m || typeof m.parse !== 'function') return (md || '').replaceAll('<', '&lt;');
      return m.parse(md || '');
    }

    let mode = 'markdown'; // 'rich' | 'markdown'
    let editor = null;
    let richAvailable = false;

    function getRichHtml() {
      try { return editor ? editor.getHTML() : ''; } catch { return ''; }
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const payload = {
          title: els.title.value,
          category: els.category.value,
          status: els.status.value,
          tags: els.tags.value,
          mode,
          markdown: els.bodyArea.value,
          html: getRichHtml(),
          savedAt: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        const d = new Date(payload.savedAt);
        setSaveStatus('Saved ' + d.toLocaleTimeString());
      }, 300);
      setSaveStatus('Saving…');
    }

    function loadDraft() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }

    function insertAtCursor(text) {
      const el = els.bodyArea;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      el.setRangeText(text, start, end, 'end');
      el.focus();
    }

    function wrapSelection({ before = '', after = '', placeholder = '' } = {}) {
      const el = els.bodyArea;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const selected = el.value.slice(start, end);
      const inner = selected || placeholder;
      const next = before + inner + after;
      el.setRangeText(next, start, end, 'end');
      el.focus();

      // If nothing was selected, select the placeholder text so it's easy to overwrite.
      if (!selected && placeholder) {
        const cursor = start + before.length;
        el.setSelectionRange(cursor, cursor + placeholder.length);
      }
    }

    function prefixLines(prefix) {
      const el = els.bodyArea;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;

      // Expand to full lines
      const value = el.value;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', end);
      if (lineEnd === -1) lineEnd = value.length;

      const block = value.slice(lineStart, lineEnd);
      const out = block
        .split(/\n/)
        .map(l => (l.trim().length ? (l.startsWith(prefix) ? l : prefix + l) : l))
        .join('\n');

      el.setRangeText(out, lineStart, lineEnd, 'end');
      el.focus();
    }

    function makeList(kind) {
      // kind: 'ul' | 'ol'
      const el = els.bodyArea;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const value = el.value;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', end);
      if (lineEnd === -1) lineEnd = value.length;
      const block = value.slice(lineStart, lineEnd);
      const lines = block.split(/\n/);

      const out = lines.map((l, idx) => {
        if (!l.trim()) return l;
        if (kind === 'ul') {
          return l.startsWith('- ') || l.startsWith('* ') ? l : ('- ' + l);
        }
        // ol
        return /^\d+\.\s/.test(l) ? l : ((idx + 1) + '. ' + l);
      }).join('\n');

      el.setRangeText(out, lineStart, lineEnd, 'end');
      el.focus();
    }

    function runCmd(cmd) {
      switch (cmd) {
        case 'bold': return wrapSelection({ before: '**', after: '**', placeholder: 'bold text' });
        case 'italic': return wrapSelection({ before: '*', after: '*', placeholder: 'italic text' });
        case 'strike': return wrapSelection({ before: '~~', after: '~~', placeholder: 'struck text' });
        case 'h2': return prefixLines('## ');
        case 'h3': return prefixLines('### ');
        case 'quote': return prefixLines('> ');
        case 'ul': return makeList('ul');
        case 'ol': return makeList('ol');
        case 'code': return wrapSelection({ before: '\`', after: '\`', placeholder: 'code' });
        case 'codeblock':
          return wrapSelection({ before: '\n\`\`\`\n', after: '\n\`\`\`\n', placeholder: 'code here' });
        case 'link': {
          const url = prompt('Link URL:');
          if (!url) return;
          return wrapSelection({ before: '[', after: '](' + url + ')', placeholder: 'link text' });
        }
        default:
          return;
      }
    }

    function setMode(next) {
      mode = next;
      const isRich = mode === 'rich';

      els.modeRichBtn.classList.toggle('active', isRich);
      els.modeMdBtn.classList.toggle('active', !isRich);
      els.modeRichBtn.setAttribute('aria-selected', String(isRich));
      els.modeMdBtn.setAttribute('aria-selected', String(!isRich));

      els.rtEditorEl.style.display = isRich ? 'block' : 'none';
      els.bodyArea.style.display = isRich ? 'none' : 'block';
      els.rtTools.style.display = isRich ? 'inline-flex' : 'none';
      els.mdTools.style.display = isRich ? 'none' : 'inline-flex';
      els.modeHint.textContent = isRich ? 'Rich' : 'Markdown';

      if (isRich) {
        renderPreviewFromHtml(getRichHtml());
      } else {
        renderPreviewFromHtml(mdToHtml(els.bodyArea.value));
      }
      scheduleSave();
    }

    function mdFromHtml(html) {
      const TurndownService = window.TurndownService;
      if (!TurndownService) return '';
      const td = new TurndownService({ codeBlockStyle: 'fenced', emDelimiter: '*', strongDelimiter: '**' });
      return td.turndown(html || '');
    }

    // Init TipTap (rich text). If it fails (offline/CDN blocked), fall back to Markdown.
    try {
      editor = new Editor({
        element: els.rtEditorEl,
        extensions: [
          StarterKit,
          Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
          Image.configure({ inline: false }),
        ],
        content: '<p></p>',
        onUpdate: () => {
          if (mode !== 'rich') return;
          renderPreviewFromHtml(getRichHtml());
          scheduleSave();
        }
      });
      richAvailable = true;
    } catch (e) {
      richAvailable = false;
      console.error('TipTap failed to load; falling back to Markdown:', e);
    }

    function runRtCmd(cmd) {
      const chain = editor.chain().focus();
      switch (cmd) {
        case 'bold': chain.toggleBold().run(); break;
        case 'italic': chain.toggleItalic().run(); break;
        case 'h2': chain.toggleHeading({ level: 2 }).run(); break;
        case 'h3': chain.toggleHeading({ level: 3 }).run(); break;
        case 'ul': chain.toggleBulletList().run(); break;
        case 'ol': chain.toggleOrderedList().run(); break;
        case 'link': {
          const prev = editor.getAttributes('link').href || '';
          const url = prompt('Link URL:', prev);
          if (url === null) break;
          if (!url) { chain.unsetLink().run(); break; }
          chain.extendMarkRange('link').setLink({ href: url }).run();
          break;
        }
        default: break;
      }
      renderPreviewFromHtml(getRichHtml());
      scheduleSave();
    }

    if (richAvailable) {
      document.querySelectorAll('[data-rtcmd]').forEach((btn) => {
        btn.addEventListener('click', () => runRtCmd(btn.dataset.rtcmd));
      });
    }

    // Load draft
    const initial = loadDraft();
    if (initial) {
      els.title.value = initial.title || '';
      els.category.value = initial.category || els.category.value;
      els.status.value = initial.status || els.status.value;
      els.tags.value = initial.tags || '';

      if (initial.markdown && typeof initial.markdown === 'string') {
        els.bodyArea.value = initial.markdown;
      }

      // Only touch rich editor content if TipTap loaded.
      if (richAvailable) {
        if (initial.html && typeof initial.html === 'string') {
          editor.commands.setContent(initial.html, false);
        } else if (els.bodyArea.value) {
          editor.commands.setContent(mdToHtml(els.bodyArea.value), false);
        }
      }

      const wanted = initial.mode === 'rich' ? 'rich' : 'markdown';
      mode = (wanted === 'rich' && richAvailable) ? 'rich' : 'markdown';
      setSaveStatus('Restored draft');
    } else {
      // No draft: if rich is available, default to rich.
      mode = richAvailable ? 'rich' : 'markdown';
    }

    // Mode buttons
    els.modeRichBtn.addEventListener('click', () => {
      if (!richAvailable) {
        alert('Rich editor is unavailable (TipTap failed to load). Check your internet connection and refresh.');
        return;
      }
      // If coming from markdown, convert to HTML and load into rich editor.
      if (mode === 'markdown') {
        editor.commands.setContent(mdToHtml(els.bodyArea.value), false);
      }
      setMode('rich');
    });
    els.modeMdBtn.addEventListener('click', () => {
      // If coming from rich, convert to markdown for the textarea.
      if (mode === 'rich' && richAvailable) {
        els.bodyArea.value = mdFromHtml(getRichHtml());
      }
      setMode('markdown');
    });

    // Default mode
    setMode(mode);

    // Markdown formatting toolbar
    document.querySelectorAll('[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (mode !== 'markdown') return;
        runCmd(btn.dataset.cmd);
        renderPreviewFromHtml(mdToHtml(els.bodyArea.value));
        scheduleSave();
      });
    });

    // Keyboard shortcuts (markdown)
    els.bodyArea.addEventListener('keydown', (e) => {
      if (mode !== 'markdown') return;
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      const k = String(e.key || '').toLowerCase();
      if (k === 'b') { e.preventDefault(); runCmd('bold'); renderPreviewFromHtml(mdToHtml(els.bodyArea.value)); scheduleSave(); }
      if (k === 'i') { e.preventDefault(); runCmd('italic'); renderPreviewFromHtml(mdToHtml(els.bodyArea.value)); scheduleSave(); }
      if (k === 'k') { e.preventDefault(); runCmd('link'); renderPreviewFromHtml(mdToHtml(els.bodyArea.value)); scheduleSave(); }
    });

    // Live preview + autosave (markdown)
    els.bodyArea.addEventListener('input', () => {
      if (mode !== 'markdown') return;
      renderPreviewFromHtml(mdToHtml(els.bodyArea.value));
      scheduleSave();
    });

    // Save on other field changes too
    ['input','change'].forEach(evt => {
      els.title.addEventListener(evt, () => scheduleSave());
      els.category.addEventListener(evt, () => scheduleSave());
      els.status.addEventListener(evt, () => scheduleSave());
      els.tags.addEventListener(evt, () => scheduleSave());
    });

    els.clearBtn.addEventListener('click', () => {
      if (!confirm('Clear the editor and local draft?')) return;
      localStorage.removeItem(STORAGE_KEY);
      els.title.value = '';
      els.tags.value = '';
      els.status.value = 'draft';
      els.bodyArea.value = '';
      if (richAvailable) editor.commands.setContent('<p></p>', false);
      renderPreviewFromHtml('');
      setSaveStatus('Cleared');
    });

    // Ensure we always submit HTML to the server
    els.form.addEventListener('submit', () => {
      if (mode === 'rich') {
        els.contentHtml.value = getRichHtml();
      } else {
        els.contentHtml.value = mdToHtml(els.bodyArea.value);
      }
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
        if (mode === 'rich' && richAvailable) {
          editor.chain().focus().setImage({ src: url }).run();
          renderPreviewFromHtml(getRichHtml());
        } else {
          insertAtCursor("\n\n![](" + url + ")\n\n");
          renderPreviewFromHtml(mdToHtml(els.bodyArea.value));
        }
        scheduleSave();
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
    if (getRichHtml() || els.bodyArea.value || (initial && (initial.title || initial.tags))) {
      scheduleSave();
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
