// wp-post-form editor client
// TipTap rich editor + Markdown fallback
window.__appLoaded = true;

function $(id) { return document.getElementById(id); }

const els = {
  title: $('title'),
  category: $('category'),
  status: $('status'),
  tags: $('tags'),
  bodyArea: $('bodyArea'),
  rtEditorEl: $('rtEditor'),
  preview: $('preview'),
  saveStatus: $('saveStatus'),
  clearBtn: $('clearBtn'),
  fileInput: $('fileInput'),
  dropzone: $('dropzone'),
  form: $('postForm'),
  contentHtml: $('contentHtml'),
  modeRichBtn: $('modeRichBtn'),
  modeMdBtn: $('modeMdBtn'),
  mdTools: $('mdTools'),
  rtTools: $('rtTools'),
  modeHint: $('modeHint'),
};

const STORAGE_KEY = 'wp-post-form:draft:v2';
const THEME_KEY = 'wp-post-form:theme:v1';
let saveTimer = null;
let mode = 'markdown'; // 'rich' | 'markdown'
let editor = null;
let richAvailable = false;

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
}

const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
applyTheme(savedTheme);
$('themeBtn')?.addEventListener('click', () => {
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

function mdFromHtml(html) {
  const TurndownService = window.TurndownService;
  if (!TurndownService) return '';
  const td = new TurndownService({ codeBlockStyle: 'fenced', emDelimiter: '*', strongDelimiter: '**' });
  return td.turndown(html || '');
}

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
  if (!selected && placeholder) {
    const cursor = start + before.length;
    el.setSelectionRange(cursor, cursor + placeholder.length);
  }
}

function prefixLines(prefix) {
  const el = els.bodyArea;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
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
    if (kind === 'ul') return l.startsWith('- ') || l.startsWith('* ') ? l : ('- ' + l);
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
    case 'code': return wrapSelection({ before: '`', after: '`', placeholder: 'code' });
    case 'codeblock': return wrapSelection({ before: '\n```\n', after: '\n```\n', placeholder: 'code here' });
    case 'link': {
      const url = prompt('Link URL:');
      if (!url) return;
      return wrapSelection({ before: '[', after: '](' + url + ')', placeholder: 'link text' });
    }
    default: return;
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
  if (els.rtTools) els.rtTools.style.display = isRich ? 'inline-flex' : 'none';
  if (els.mdTools) els.mdTools.style.display = isRich ? 'none' : 'inline-flex';
  if (els.modeHint) els.modeHint.textContent = isRich ? 'Rich' : 'Markdown';

  if (isRich) renderPreviewFromHtml(getRichHtml());
  else renderPreviewFromHtml(mdToHtml(els.bodyArea.value));

  scheduleSave();
}

async function initTipTap() {
  try {
    const [{ Editor }, { default: StarterKit }, { default: Link }, { default: Image }] = await Promise.all([
      import('https://esm.sh/@tiptap/core@2.11.5'),
      import('https://esm.sh/@tiptap/starter-kit@2.11.5'),
      import('https://esm.sh/@tiptap/extension-link@2.11.5'),
      import('https://esm.sh/@tiptap/extension-image@2.11.5'),
    ]);

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

    document.querySelectorAll('[data-rtcmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.rtcmd;
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
      });
    });
  } catch (e) {
    richAvailable = false;
    console.warn('TipTap failed to load; staying in Markdown:', e);
  }
}

async function main() {
  // Markdown event wiring
  document.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (mode !== 'markdown') return;
      runCmd(btn.dataset.cmd);
      renderPreviewFromHtml(mdToHtml(els.bodyArea.value));
      scheduleSave();
    });
  });

  els.bodyArea.addEventListener('keydown', (e) => {
    if (mode !== 'markdown') return;
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;
    const k = String(e.key || '').toLowerCase();
    if (k === 'b') { e.preventDefault(); runCmd('bold'); renderPreviewFromHtml(mdToHtml(els.bodyArea.value)); scheduleSave(); }
    if (k === 'i') { e.preventDefault(); runCmd('italic'); renderPreviewFromHtml(mdToHtml(els.bodyArea.value)); scheduleSave(); }
    if (k === 'k') { e.preventDefault(); runCmd('link'); renderPreviewFromHtml(mdToHtml(els.bodyArea.value)); scheduleSave(); }
  });

  els.bodyArea.addEventListener('input', () => {
    if (mode !== 'markdown') return;
    renderPreviewFromHtml(mdToHtml(els.bodyArea.value));
    scheduleSave();
  });

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

  els.form.addEventListener('submit', () => {
    els.contentHtml.value = (mode === 'rich' && richAvailable)
      ? getRichHtml()
      : mdToHtml(els.bodyArea.value);
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
  els.dropzone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropzone.classList.add('dragover'); });
  els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('dragover'));
  els.dropzone.addEventListener('drop', (e) => { e.preventDefault(); els.dropzone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });

  // Init rich editor (async); markdown remains usable regardless.
  await initTipTap();

  const initial = loadDraft();
  if (initial) {
    els.title.value = initial.title || '';
    els.category.value = initial.category || els.category.value;
    els.status.value = initial.status || els.status.value;
    els.tags.value = initial.tags || '';
    if (initial.markdown && typeof initial.markdown === 'string') els.bodyArea.value = initial.markdown;
    if (richAvailable) {
      if (initial.html && typeof initial.html === 'string') editor.commands.setContent(initial.html, false);
      else if (els.bodyArea.value) editor.commands.setContent(mdToHtml(els.bodyArea.value), false);
    }
    const wanted = initial.mode === 'rich' ? 'rich' : 'markdown';
    mode = (wanted === 'rich' && richAvailable) ? 'rich' : 'markdown';
    setSaveStatus('Restored draft');
  } else {
    mode = richAvailable ? 'rich' : 'markdown';
  }

  els.modeRichBtn.addEventListener('click', () => {
    if (!richAvailable) { alert('Rich editor is unavailable (TipTap failed to load). Check internet and refresh.'); return; }
    if (mode === 'markdown') editor.commands.setContent(mdToHtml(els.bodyArea.value), false);
    setMode('rich');
  });
  els.modeMdBtn.addEventListener('click', () => {
    if (mode === 'rich' && richAvailable) els.bodyArea.value = mdFromHtml(getRichHtml());
    setMode('markdown');
  });

  setMode(mode);

  if (getRichHtml() || els.bodyArea.value || (initial && (initial.title || initial.tags))) scheduleSave();
}

main();
