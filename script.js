/* ===== GLOBAL STATE ===== */
let zTop = 200;
const taskbarItems = {}; // id -> { el, label, minimized }
const windowStates = {}; // id -> { width, height, left, top } (pre-maximize)

function bringToFront(win) {
  zTop++;
  win.style.zIndex = zTop;
  // update title bar active/inactive for all windows
  document.querySelectorAll('.xp-window').forEach(w => {
    const tb = w.querySelector('.xp-titlebar');
    if (tb) {
      tb.classList.toggle('active', w === win);
      tb.classList.toggle('inactive', w !== win);
    }
  });
}

/* ===== DRAGGING ===== */
function makeDraggable(win, handle) {
  handle = handle || win.querySelector('.xp-titlebar');
  if (!handle) return;
  let dragging = false, ox = 0, oy = 0;

  handle.addEventListener('mousedown', e => {
    if (e.target.closest('.xp-titlebar-btns') || e.target.closest('.xp-tb-btn')) return;
    if (win.classList.contains('maximized')) return;
    dragging = true;
    ox = e.clientX - win.offsetLeft;
    oy = e.clientY - win.offsetTop;
    bringToFront(win);
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let nx = e.clientX - ox;
    let ny = e.clientY - oy;
    // Clamp so titlebar stays visible
    nx = Math.max(-win.offsetWidth + 60, Math.min(window.innerWidth - 60, nx));
    ny = Math.max(0, Math.min(window.innerHeight - 36 - 10, ny));
    win.style.left = nx + 'px';
    win.style.top = ny + 'px';
  });

  document.addEventListener('mouseup', () => { dragging = false; });

  win.addEventListener('mousedown', () => bringToFront(win));
}

/* ===== RESIZE ===== */
function makeResizable(win) {
  const handle = win.querySelector('.xp-resize-handle');
  if (!handle) return;
  let resizing = false, sx = 0, sy = 0, sw = 0, sh = 0;
  let ghost = null;

  handle.addEventListener('mousedown', e => {
    if (win.classList.contains('maximized')) return;
    resizing = true;
    sx = e.clientX; sy = e.clientY;
    sw = win.offsetWidth; sh = win.offsetHeight;
    ghost = document.createElement('div');
    ghost.className = 'resize-ghost';
    ghost.style.cssText = `left:${win.offsetLeft}px;top:${win.offsetTop}px;width:${sw}px;height:${sh}px`;
    document.getElementById('desktop').appendChild(ghost);
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', e => {
    if (!resizing) return;
    const nw = Math.max(400, sw + e.clientX - sx);
    const nh = Math.max(380, sh + e.clientY - sy);
    ghost.style.width = nw + 'px';
    ghost.style.height = nh + 'px';
  });

  document.addEventListener('mouseup', e => {
    if (!resizing) return;
    resizing = false;
    if (ghost) {
      win.style.width = ghost.style.width;
      win.style.height = ghost.style.height;
      ghost.remove();
      ghost = null;
    }
  });
}

/* ===== MAXIMIZE ===== */
function toggleMaximize(win) {
  const taskbarH = 36;
  if (win.classList.contains('maximized')) {
    // Restore
    const st = windowStates[win.id] || {};
    win.style.left = (st.left || 100) + 'px';
    win.style.top = (st.top || 40) + 'px';
    win.style.width = (st.width || 560) + 'px';
    win.style.height = (st.height || 660) + 'px';
    win.classList.remove('maximized');
    win.style.borderRadius = '';
  } else {
    windowStates[win.id] = {
      left: win.offsetLeft, top: win.offsetTop,
      width: win.offsetWidth, height: win.offsetHeight
    };
    win.style.left = '0';
    win.style.top = '0';
    win.style.width = window.innerWidth + 'px';
    win.style.height = (window.innerHeight - taskbarH) + 'px';
    win.classList.add('maximized');
    win.style.borderRadius = '0';
  }
  bringToFront(win);
}

/* ===== MINIMIZE / RESTORE ===== */
function minimizeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.style.display = 'none';
  if (taskbarItems[id]) taskbarItems[id].el.classList.add('minimized');
}

function restoreWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.style.display = 'flex';
  if (taskbarItems[id]) taskbarItems[id].el.classList.remove('minimized');
  bringToFront(win);
}

function toggleWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  if (win.style.display === 'none') {
    restoreWindow(id);
  } else if (parseInt(win.style.zIndex || 0) === zTop) {
    minimizeWindow(id);
  } else {
    bringToFront(win);
  }
}

/* ===== TASKBAR ===== */
function registerTaskbar(id, label, icon) {
  const items = document.getElementById('taskbar-items');
  const el = document.createElement('button');
  el.className = 'taskbar-item';
  el.textContent = (icon ? icon + ' ' : '') + label;
  el.title = label;
  el.addEventListener('click', () => toggleWindow(id));
  items.appendChild(el);
  taskbarItems[id] = { el, label };
}

function removeTaskbar(id) {
  if (taskbarItems[id]) {
    taskbarItems[id].el.remove();
    delete taskbarItems[id];
  }
}

/* ===== CLOCK ===== */
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = h + ':' + m;
}

/* ===== TITLE BAR EVENT DELEGATION ===== */
document.addEventListener('click', e => {
  const btn = e.target.closest('.xp-tb-btn');
  if (!btn) return;

  const action = btn.dataset.action;
  const winId = btn.dataset.win;

  if (btn.classList.contains('xp-tb-min') && winId) {
    minimizeWindow(winId);
    return;
  }

  if (btn.classList.contains('xp-tb-max') && winId) {
    const win = document.getElementById(winId);
    if (win) toggleMaximize(win);
    return;
  }

  if (btn.classList.contains('xp-tb-close')) {
    if (action === 'ooo-close') {
      showErrorDialog('Out of Office Generator', 'Cannot close. You are still employed.');
      return;
    }
    if (winId) {
      const win = document.getElementById(winId);
      if (win) {
        win.style.display = 'none';
        removeTaskbar(winId);
        // readme-window persists in the DOM; dynamic windows are removed entirely
        if (winId !== 'readme-window') {
          win.remove();
        }
      }
    }
    // Generic close for dialogs/dynamic windows
    const win = btn.closest('.xp-window');
    if (win && win.classList.contains('xp-dialog')) {
      win.remove();
    }
    return;
  }
});

/* ===== MENU SYSTEM ===== */
let openMenu = null;

document.getElementById('ooo-menubar').addEventListener('click', e => {
  const root = e.target.closest('.xp-menu-root');
  if (!root) return;

  if (openMenu && openMenu !== root) {
    openMenu.classList.remove('open');
  }

  if (root.classList.contains('open')) {
    root.classList.remove('open');
    openMenu = null;
  } else {
    root.classList.add('open');
    openMenu = root;
  }
  e.stopPropagation();
});

document.addEventListener('click', e => {
  if (openMenu && !e.target.closest('.xp-menu-root')) {
    openMenu.classList.remove('open');
    openMenu = null;
  }
});

function closeMenus() {
  if (openMenu) { openMenu.classList.remove('open'); openMenu = null; }
}

function bindMenuItem(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => { closeMenus(); fn(); });
}

/* ===== MENU ACTIONS ===== */
function menuNew() {
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value = '';
  document.getElementById('reason').value = '';
  setDrama(5);
  document.getElementById('ooo-output').value = '';
  document.getElementById('copy-btn-row').classList.add('hidden');
}

function menuPrint() {
  const d = createPrintDialog();
  setTimeout(() => d.remove(), 2000);
}

function menuExit() {
  showErrorDialog('Access Denied', '🔒 Access denied. Please complete your timesheet first.');
}

function menuSelectAll() {
  const ta = document.getElementById('ooo-output');
  ta.focus();
  ta.select();
}

function menuClearFields() {
  menuNew();
}

function setDrama(v) {
  const s = document.getElementById('drama-slider');
  s.value = v;
  document.getElementById('drama-value').textContent = v;
  updateSliderFill(s);
}

function menuDramaMax()    { setDrama(10); }
function menuDramaMin()    { setDrama(1); }
function menuDramaRandom() { setDrama(Math.floor(Math.random() * 10) + 1); }

function menuAbout() {
  openReadme();
}

/* ===== BIND MENU ITEMS ===== */
bindMenuItem('mi-new', menuNew);
bindMenuItem('mi-print', menuPrint);
bindMenuItem('mi-exit', menuExit);
bindMenuItem('mi-selectall', menuSelectAll);
bindMenuItem('mi-clearfields', menuClearFields);
bindMenuItem('mi-dramamax', menuDramaMax);
bindMenuItem('mi-dramamin', menuDramaMin);
bindMenuItem('mi-dramarand', menuDramaRandom);
bindMenuItem('mi-about', menuAbout);

/* ===== DRAMA SLIDER ===== */
function updateSliderFill(slider) {
  const min = Number(slider.min) || 1;
  const max = Number(slider.max) || 10;
  const val = Number(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty('--fill-pct', pct + '%');
}

const dramaSlider = document.getElementById('drama-slider');
dramaSlider.addEventListener('input', function() {
  document.getElementById('drama-value').textContent = this.value;
  updateSliderFill(this);
});

/* ===== GENERATE OOO ===== */
document.getElementById('generate-btn').addEventListener('click', generateOOO);

const recentArchetypes = [];
const RECENT_ARCHETYPES_MAX = 5;

async function generateOOO() {
  const fromDate = document.getElementById('date-from').value;
  const toDate = document.getElementById('date-to').value;
  const reason = document.getElementById('reason').value.trim();
  const drama = document.getElementById('drama-slider').value;

  if (!reason) {
    showErrorDialog('Missing Information', '⚠ Please enter a reason for absence.');
    return;
  }

  const loadingDialog = createLoadingDialog();
  const bar = loadingDialog.querySelector('.xp-progress-bar');

  // Trigger CSS transition
  setTimeout(() => { bar.style.width = '100%'; }, 50);

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDate, toDate, reason, dramaLevel: drama, recentArchetypes })
    });

    if (!response.ok) throw new Error('Server error: ' + response.status);
    const data = await response.json();

    // Wait for progress bar animation
    await new Promise(resolve => setTimeout(resolve, 1500));
    loadingDialog.remove();

    if (data.text) {
      const ta = document.getElementById('ooo-output');
      ta.value = data.text;
      ta.style.fontStyle = 'normal';
      document.getElementById('copy-btn-row').classList.remove('hidden');

      if (typeof data.archetypeIndex === 'number') {
        recentArchetypes.push(data.archetypeIndex);
        if (recentArchetypes.length > RECENT_ARCHETYPES_MAX) recentArchetypes.shift();
      }
    } else if (data.error) {
      throw new Error(data.error);
    }
  } catch (err) {
    loadingDialog.remove();
    showErrorDialog('Error', '❌ Failed to generate: ' + err.message);
  }
}

/* ===== COPY TO CLIPBOARD ===== */
document.getElementById('copy-btn').addEventListener('click', copyOutput);

async function copyOutput() {
  const ta = document.getElementById('ooo-output');
  try {
    await navigator.clipboard.writeText(ta.value);
    const btn = document.getElementById('copy-btn');
    btn.textContent = '\u2713 Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  } catch {
    ta.select();
    document.execCommand('copy');
  }
}

/* ===== START MENU ===== */
function toggleStartMenu() {
  document.getElementById('start-menu').classList.toggle('hidden');
}

document.addEventListener('click', e => {
  const sm = document.getElementById('start-menu');
  if (!sm.classList.contains('hidden') &&
      !e.target.closest('#start-menu') &&
      !e.target.closest('#start-btn')) {
    sm.classList.add('hidden');
  }
});

/* ===== DIALOG HELPERS ===== */
function centeredPos(w, h) {
  const dw = window.innerWidth, dh = window.innerHeight - 36;
  return {
    left: Math.max(20, (dw - w) / 2),
    top: Math.max(20, (dh - h) / 2)
  };
}

function createBaseWindow(opts) {
  // opts: { id, title, icon, width, classes, titleExtra }
  const id = opts.id || ('win-' + Date.now());
  const w = opts.width || 400;
  const pos = centeredPos(w, 200);
  const win = document.createElement('div');
  win.className = 'xp-window' + (opts.classes ? ' ' + opts.classes : '');
  win.id = id;
  win.style.cssText = `left:${pos.left}px;top:${pos.top}px;width:${w}px;z-index:${++zTop}`;

  const closeAction = opts.closeAction || '';
  const closeWin = opts.closeWin ? `data-win="${opts.closeWin}"` : '';

  win.innerHTML = `
    <div class="xp-titlebar active">
      <div class="xp-titlebar-left">
        ${opts.icon ? `<div class="titlebar-icon">${opts.icon}</div>` : ''}
        <span class="titlebar-text">${opts.title}</span>
      </div>
      <div class="xp-titlebar-btns">
        ${opts.minimizable ? `<button class="xp-tb-btn xp-tb-min" data-win="${id}" data-label="${opts.label || opts.title}">−</button>` : ''}
        ${opts.maximizable ? `<button class="xp-tb-btn xp-tb-max" data-win="${id}">□</button>` : ''}
        <button class="xp-tb-btn xp-tb-close" ${closeAction ? `data-action="${closeAction}"` : ''} ${closeWin}>✕</button>
      </div>
    </div>
  `;

  document.getElementById('desktop').appendChild(win);
  makeDraggable(win);
  return win;
}

function showErrorDialog(title, message) {
  const pos = centeredPos(380, 160);
  const d = document.createElement('div');
  d.className = 'xp-window xp-dialog';
  d.style.cssText = `left:${pos.left}px;top:${pos.top}px;width:400px;z-index:${++zTop}`;
  d.innerHTML = `
    <div class="xp-titlebar active">
      <div class="xp-titlebar-left">
        <div class="titlebar-icon">❌</div>
        <span class="titlebar-text">${title}</span>
      </div>
      <div class="xp-titlebar-btns">
        <button class="xp-tb-btn xp-tb-close">✕</button>
      </div>
    </div>
    <div class="dialog-body">
      <div class="dialog-content">
        <span class="dialog-icon">❌</span>
        <span class="dialog-message">${message}</span>
      </div>
      <div class="dialog-buttons">
        <button class="xp-btn" style="min-width:75px">OK</button>
      </div>
    </div>
  `;
  document.getElementById('desktop').appendChild(d);
  d.querySelector('.dialog-buttons .xp-btn').addEventListener('click', () => d.remove());
  d.querySelector('.xp-tb-close').addEventListener('click', () => d.remove());
  makeDraggable(d);
  bringToFront(d);
  return d;
}

function showInfoDialog(title, icon, message, buttons) {
  const pos = centeredPos(380, 160);
  const d = document.createElement('div');
  d.className = 'xp-window xp-dialog';
  d.style.cssText = `left:${pos.left}px;top:${pos.top}px;width:420px;z-index:${++zTop}`;
  d.innerHTML = `
    <div class="xp-titlebar active">
      <div class="xp-titlebar-left">
        <div class="titlebar-icon">${icon}</div>
        <span class="titlebar-text">${title}</span>
      </div>
      <div class="xp-titlebar-btns">
        <button class="xp-tb-btn xp-tb-close">✕</button>
      </div>
    </div>
    <div class="dialog-body" id="info-dialog-body">
      <div class="dialog-content">
        <span class="dialog-icon">${icon}</span>
        <span class="dialog-message"></span>
      </div>
      <div class="dialog-buttons"></div>
    </div>
  `;
  d.querySelector('.dialog-message').textContent = message;
  const btnContainer = d.querySelector('.dialog-buttons');
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'xp-btn';
    btn.textContent = b.label;
    btn.style.minWidth = '80px';
    btn.addEventListener('click', () => b.action(d));
    btnContainer.appendChild(btn);
  });
  d.querySelector('.xp-tb-close').addEventListener('click', () => d.remove());
  document.getElementById('desktop').appendChild(d);
  makeDraggable(d);
  bringToFront(d);
  return d;
}

function createLoadingDialog() {
  const pos = centeredPos(360, 140);
  const d = document.createElement('div');
  d.className = 'xp-window xp-dialog';
  d.style.cssText = `left:${pos.left}px;top:${pos.top}px;width:360px;z-index:${++zTop}`;
  d.innerHTML = `
    <div class="xp-titlebar active">
      <div class="xp-titlebar-left">
        <div class="titlebar-icon">⌛</div>
        <span class="titlebar-text">Please wait...</span>
      </div>
      <div class="xp-titlebar-btns">
        <button class="xp-tb-btn xp-tb-disabled">✕</button>
      </div>
    </div>
    <div class="dialog-body">
      <div class="dialog-content" style="flex-direction:column;gap:10px;width:100%">
        <span class="dialog-message">Contacting server... please wait</span>
        <div class="xp-progress-track" style="width:100%">
          <div class="xp-progress-bar"></div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('desktop').appendChild(d);
  makeDraggable(d);
  bringToFront(d);
  return d;
}

function createPrintDialog() {
  const pos = centeredPos(420, 300);
  const d = document.createElement('div');
  d.className = 'xp-window xp-dialog';
  d.style.cssText = `left:${pos.left}px;top:${pos.top}px;width:420px;z-index:${++zTop}`;
  d.innerHTML = `
    <div class="xp-titlebar active">
      <div class="xp-titlebar-left">
        <div class="titlebar-icon">🖶</div>
        <span class="titlebar-text">Print</span>
      </div>
      <div class="xp-titlebar-btns">
        <button class="xp-tb-btn xp-tb-disabled">✕</button>
      </div>
    </div>
    <div class="print-dialog-body">
      <div class="print-section">
        <div class="print-section-title">Select Printer</div>
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <span style="font-size:20px">🖶</span>
          <div>
            <div style="font-weight:bold">HP LaserJet 1020</div>
            <div style="font-size:10px;color:#888">Status: Offline · Documents waiting: 0</div>
          </div>
        </div>
      </div>
      <div class="print-section">
        <div class="print-section-title">Print Range</div>
        <div style="display:flex;flex-direction:column;gap:4px;padding:4px 0;font-size:11px">
          <label><input type="radio" checked> All pages</label>
          <label><input type="radio"> Selection</label>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:8px">
        <button class="xp-btn" style="min-width:75px">Print</button>
        <button class="xp-btn" style="min-width:75px">Cancel</button>
      </div>
      <div style="margin-top:8px;font-size:10px;color:#666;text-align:center">
        Sending job to printer...
        <div class="xp-progress-track" style="margin-top:6px">
          <div class="xp-progress-bar" id="print-bar"></div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('desktop').appendChild(d);
  makeDraggable(d);
  bringToFront(d);
  setTimeout(() => {
    const bar = d.querySelector('#print-bar');
    if (bar) bar.style.width = '100%';
  }, 50);
  return d;
}

/* ===== README WINDOW ===== */
function openReadme() {
  const win = document.getElementById('readme-window');
  win.style.display = 'flex';
  if (!taskbarItems['readme-window']) {
    registerTaskbar('readme-window', 'README.txt', '📄');
  } else {
    taskbarItems['readme-window'].el.classList.remove('minimized');
  }
  bringToFront(win);
}

/* ===== RECYCLE BIN ===== */
function openRecycleBin() {
  // If already exists, just show/focus it
  let win = document.getElementById('recycle-window');
  if (win) {
    win.style.display = 'flex';
    bringToFront(win);
    if (taskbarItems['recycle-window']) taskbarItems['recycle-window'].el.classList.remove('minimized');
    return;
  }

  const pos = centeredPos(520, 320);
  win = document.createElement('div');
  win.className = 'xp-window';
  win.id = 'recycle-window';
  win.style.cssText = `left:${pos.left}px;top:${pos.top}px;width:520px;height:320px;z-index:${++zTop}`;
  win.innerHTML = `
    <div class="xp-titlebar active">
      <div class="xp-titlebar-left">
        <div class="titlebar-icon">♻</div>
        <span class="titlebar-text">Recycle Bin</span>
      </div>
      <div class="xp-titlebar-btns">
        <button class="xp-tb-btn xp-tb-min" data-win="recycle-window" data-label="Recycle Bin">−</button>
        <button class="xp-tb-btn xp-tb-max" data-win="recycle-window">□</button>
        <button class="xp-tb-btn xp-tb-close" data-win="recycle-window">✕</button>
      </div>
    </div>
    <div class="xp-window-body recycle-window-body" style="flex:1;display:flex;flex-direction:column;">
      <div class="recycle-toolbar">
        <button class="xp-btn" id="empty-recycle-btn">🗑 Empty Recycle Bin</button>
      </div>
      <div class="file-list-header">
        <span>Name</span>
        <span>Date Deleted</span>
        <span>Size</span>
      </div>
      <div style="flex:1;overflow-y:auto;background:white;">
        <div class="file-item" data-file="will_to_work">
          <span>📄 will_to_work.doc</span>
          <span>14/04/2003</span>
          <span>4 KB</span>
        </div>
        <div class="file-item" data-file="monday_motivation">
          <span>📊 monday_motivation.ppt</span>
          <span>03/09/2001</span>
          <span>2 KB</span>
        </div>
        <div class="file-item" data-file="work_life_balance">
          <span>📄 work_life_balance.txt</span>
          <span>Deleted continuously</span>
          <span>1 KB</span>
        </div>
      </div>
    </div>
  `;
  document.getElementById('desktop').appendChild(win);
  makeDraggable(win);

  // Double-click files
  win.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('dblclick', () => openRecycleFile(item.dataset.file));
  });

  win.querySelector('#empty-recycle-btn').addEventListener('click', emptyRecycleBin);

  registerTaskbar('recycle-window', 'Recycle Bin', '♻');
}

function openRecycleFile(file) {
  if (file === 'will_to_work') openWillToWork();
  else if (file === 'monday_motivation') openMondayMotivation();
  else if (file === 'work_life_balance') openWorkLifeBalance();
}

function openWillToWork() {
  const id = 'will-to-work-window';
  let win = document.getElementById(id);
  if (win) { win.style.display = 'flex'; bringToFront(win); return; }

  const pos = centeredPos(420, 340);
  win = document.createElement('div');
  win.className = 'xp-window';
  win.id = id;
  win.style.cssText = `left:${pos.left}px;top:${pos.top}px;width:420px;height:340px;z-index:${++zTop}`;

  const ascii = `
       O
      /|\\    zZzZz...
      / \\

  ________________
 |                |
 |   [ laptop ]   |
 |   ____________ |
 |  |            ||
 |  |____________||
 |________________|


  Final draft. Never submitted.`.trim();

  win.innerHTML = `
    <div class="xp-titlebar active">
      <div class="xp-titlebar-left">
        <div class="titlebar-icon">📄</div>
        <span class="titlebar-text">will_to_work.doc - Notepad</span>
      </div>
      <div class="xp-titlebar-btns">
        <button class="xp-tb-btn xp-tb-min" data-win="${id}" data-label="will_to_work.doc">−</button>
        <button class="xp-tb-btn xp-tb-max xp-tb-disabled">□</button>
        <button class="xp-tb-btn xp-tb-close" data-win="${id}">✕</button>
      </div>
    </div>
    <div class="xp-menubar-np">
      <span class="np-menu-item">File</span>
      <span class="np-menu-item">Edit</span>
      <span class="np-menu-item">Format</span>
    </div>
    <div class="xp-window-body notepad-body" style="flex:1;">
      <pre class="notepad-pre" style="user-select:text">${ascii}</pre>
    </div>
  `;
  document.getElementById('desktop').appendChild(win);
  makeDraggable(win);
  registerTaskbar(id, 'will_to_work.doc', '📄');
}

function openMondayMotivation() {
  const id = 'monday-motivation-window';
  let win = document.getElementById(id);
  if (win) { win.style.display = 'flex'; bringToFront(win); return; }

  const pos = centeredPos(540, 420);
  win = document.createElement('div');
  win.className = 'xp-window';
  win.id = id;
  win.style.cssText = `left:${pos.left}px;top:${pos.top}px;width:560px;height:440px;z-index:${++zTop}`;
  win.innerHTML = `
    <div class="xp-titlebar active" style="background:linear-gradient(180deg,#c0783c 0%,#a05828 4%,#804018 50%,#6a300a 51%,#804018 100%)">
      <div class="xp-titlebar-left">
        <div class="titlebar-icon">📊</div>
        <span class="titlebar-text">Monday_motivation.ppt - Microsoft PowerPoint</span>
      </div>
      <div class="xp-titlebar-btns">
        <button class="xp-tb-btn xp-tb-min" data-win="${id}" data-label="monday_motivation.ppt" style="background:linear-gradient(180deg,#d09060 0%,#a06030 100%)">−</button>
        <button class="xp-tb-btn xp-tb-max" data-win="${id}" style="background:linear-gradient(180deg,#d09060 0%,#a06030 100%)">□</button>
        <button class="xp-tb-btn xp-tb-close" data-win="${id}" style="background:linear-gradient(180deg,#e06060 0%,#b02020 100%)">✕</button>
      </div>
    </div>
    <div style="background:#d4d0c8;padding:4px 6px;border-bottom:1px solid #a0a0a0;font-size:11px;display:flex;gap:12px;">
      <span style="cursor:default">File</span><span style="cursor:default">Edit</span>
      <span style="cursor:default">View</span><span style="cursor:default">Insert</span>
      <span style="cursor:default">Format</span><span style="cursor:default">Help</span>
    </div>
    <div class="xp-window-body ppt-window-body" style="flex:1;position:relative">
      <div class="ppt-slide">
        <div style="text-align:center">
          <div style="font-size:14px;color:#888;margin-bottom:16px">Monday Motivation.ppt</div>
          <div style="font-size:72px;font-weight:bold;color:#c00000">No.</div>
        </div>
      </div>
      <div class="ppt-slide-no">Slide 1 of 1</div>
    </div>
  `;
  document.getElementById('desktop').appendChild(win);
  makeDraggable(win);
  registerTaskbar(id, 'monday_motivation.ppt', '📊');
}

function openWorkLifeBalance() {
  const id = 'work-life-balance-window';
  let win = document.getElementById(id);
  if (win) { win.style.display = 'flex'; bringToFront(win); return; }

  const pos = centeredPos(380, 340);
  win = document.createElement('div');
  win.className = 'xp-window';
  win.id = id;
  win.style.cssText = `left:${pos.left}px;top:${pos.top}px;width:380px;height:340px;z-index:${++zTop}`;

  const blanks = '\n'.repeat(47);
  const content = `TODO: achieve this${blanks}TODO: achieve this`;

  win.innerHTML = `
    <div class="xp-titlebar active">
      <div class="xp-titlebar-left">
        <div class="titlebar-icon">📄</div>
        <span class="titlebar-text">work_life_balance.txt - Notepad</span>
      </div>
      <div class="xp-titlebar-btns">
        <button class="xp-tb-btn xp-tb-min" data-win="${id}" data-label="work_life_balance.txt">−</button>
        <button class="xp-tb-btn xp-tb-max xp-tb-disabled">□</button>
        <button class="xp-tb-btn xp-tb-close" data-win="${id}">✕</button>
      </div>
    </div>
    <div class="xp-menubar-np">
      <span class="np-menu-item">File</span>
      <span class="np-menu-item">Edit</span>
      <span class="np-menu-item">Format</span>
    </div>
    <div class="xp-window-body notepad-body" style="flex:1;overflow:auto;">
      <pre class="notepad-pre" style="user-select:text">${content}</pre>
    </div>
  `;
  document.getElementById('desktop').appendChild(win);
  makeDraggable(win);
  registerTaskbar(id, 'work_life_balance.txt', '📄');
}

function emptyRecycleBin() {
  showInfoDialog(
    'Confirm File Delete',
    '🗑',
    'Are you sure you want to permanently delete the remaining fragments of your enthusiasm?',
    [
      { label: 'Yes', action: d => {
        d.remove();
        showInfoDialog('Recycle Bin', '✅', 'Recycle Bin emptied. Nothing was lost.', [
          { label: 'OK', action: d2 => d2.remove() }
        ]);
      }},
      { label: 'No', action: d => d.remove() }
    ]
  );
}

/* ===== OOO WINDOW POSITION ===== */
function centerOOOWindow() {
  const win = document.getElementById('ooo-window');
  const w = 560, h = 660;
  const left = Math.max(0, (window.innerWidth - w) / 2);
  const top = Math.max(0, (window.innerHeight - 36 - h) / 2);
  win.style.left = left + 'px';
  win.style.top = top + 'px';
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  // Position OOO window center
  centerOOOWindow();

  // Initialize draggable windows
  makeDraggable(document.getElementById('readme-window'));
  makeDraggable(document.getElementById('ooo-window'));
  makeResizable(document.getElementById('ooo-window'));

  // Register taskbar items
  registerTaskbar('readme-window', 'README.txt', '📄');
  registerTaskbar('ooo-window', 'Out of Office Generator', '✉');

  // Set initial z-index
  bringToFront(document.getElementById('ooo-window'));

  // Initialise slider fill
  updateSliderFill(document.getElementById('drama-slider'));

  // Generate drama slider tick marks
  const ticksEl = document.querySelector('.slider-ticks');
  if (ticksEl) {
    for (let i = 0; i < 10; i++) {
      const t = document.createElement('span');
      t.className = 'slider-tick';
      ticksEl.appendChild(t);
    }
  }

  // Clock
  updateClock();
  setInterval(updateClock, 60000);
  // Also update every second to catch minute changes accurately
  setInterval(() => {
    const now = new Date();
    if (now.getSeconds() === 0) updateClock();
  }, 1000);
});
