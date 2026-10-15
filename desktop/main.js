// UNIBLE SALE 데스크톱 셸 — 서버(웹앱) 화면을 앱 창으로 보여준다. 비밀키·DB 접속정보는 앱에 넣지 않는다(서버가 가진다).
const { app, BrowserWindow, Menu, shell, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const PRESETS = {
  '운영 서버 (unible-sale.vercel.app)': 'https://unible-sale.vercel.app',
  '이 컴퓨터 (localhost:3300)': 'http://localhost:3300',
  '이 컴퓨터 (localhost:3000)': 'http://localhost:3000'
};
const DEFAULT_URL = PRESETS['운영 서버 (unible-sale.vercel.app)'];

const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
function readCfg() { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch { return {}; } }
function writeCfg(c) { try { fs.mkdirSync(path.dirname(cfgPath()), { recursive: true }); fs.writeFileSync(cfgPath(), JSON.stringify(c, null, 2)); } catch {} }
const serverUrl = () => process.env.UNIBLE_SALE_URL || readCfg().serverUrl || DEFAULT_URL;
function normalizeUrl(u) {
  let s = String(u || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = (/^(localhost|127\.|192\.168\.|10\.)/.test(s) ? 'http://' : 'https://') + s;
  try { return new URL(s).origin; } catch { return null; }
}

let win = null;
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function createWindow() {
  const cfg = readCfg();
  const b = cfg.bounds && screen.getAllDisplays().some(d => {
    const r = d.workArea; return cfg.bounds.x >= r.x - 50 && cfg.bounds.y >= r.y - 50 && cfg.bounds.x < r.x + r.width && cfg.bounds.y < r.y + r.height;
  }) ? cfg.bounds : { width: 1480, height: 920 };
  win = new BrowserWindow({
    ...b, minWidth: 1100, minHeight: 700, show: false, backgroundColor: '#f8fafc',
    title: 'UNIBLE SALE (유니블 세일)',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  if (cfg.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => {
    const c = readCfg(); c.maximized = win.isMaximized(); if (!win.isMaximized()) c.bounds = win.getBounds(); writeCfg(c);
  });
  win.on('closed', () => { win = null; });

  const origin = () => { try { return new URL(serverUrl()).origin; } catch { return DEFAULT_URL; } };
  // 같은 서버 주소는 앱 안에서 열고(인쇄·PDF 창 포함), 그 밖의 주소는 기본 브라우저로 보낸다.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url.startsWith(origin())) return { action: 'allow' };
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file://') || url.startsWith(origin())) return;
    e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = 사용자가 이동을 취소한 경우
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: serverUrl(), reason: `${desc} (${code})` } });
  });
  win.loadURL(serverUrl());
}

function openSettings() {
  const w = new BrowserWindow({
    width: 560, height: 420, parent: win || undefined, modal: !!win, resizable: false, minimizable: false, maximizable: false,
    title: '서버 주소 설정', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  w.setMenuBarVisibility(false);
  w.loadFile(path.join(__dirname, 'settings.html'), { query: { current: serverUrl(), presets: JSON.stringify(PRESETS) } });
}

ipcMain.handle('unible:get-url', () => serverUrl());
ipcMain.handle('unible:set-url', (_e, raw) => {
  const u = normalizeUrl(raw);
  if (!u) return { ok: false, error: '주소 형식이 올바르지 않습니다. 예) https://unible-sale.vercel.app' };
  const c = readCfg(); c.serverUrl = u; writeCfg(c);
  if (win) win.loadURL(u);
  return { ok: true, url: u };
});
ipcMain.handle('unible:retry', () => { if (win) win.loadURL(serverUrl()); });
ipcMain.handle('unible:open-settings', () => openSettings());

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const tpl = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about', label: 'UNIBLE SALE 정보' }, { type: 'separator' }, { role: 'hide', label: '숨기기' }, { role: 'hideOthers', label: '다른 앱 숨기기' }, { role: 'unhide', label: '모두 보기' }, { type: 'separator' }, { role: 'quit', label: '종료' }] }] : []),
    { label: '파일', submenu: [
      { label: '서버 주소 설정…', accelerator: 'CmdOrCtrl+,', click: openSettings },
      { label: '새로고침', accelerator: 'CmdOrCtrl+R', click: () => win && win.webContents.reload() },
      { label: '처음 화면으로', accelerator: 'CmdOrCtrl+Shift+H', click: () => win && win.loadURL(serverUrl()) },
      { type: 'separator' },
      isMac ? { role: 'close', label: '창 닫기' } : { role: 'quit', label: '종료' }
    ] },
    { label: '편집', submenu: [{ role: 'undo', label: '실행 취소' }, { role: 'redo', label: '다시 실행' }, { type: 'separator' }, { role: 'cut', label: '잘라내기' }, { role: 'copy', label: '복사' }, { role: 'paste', label: '붙여넣기' }, { role: 'selectAll', label: '모두 선택' }] },
    { label: '보기', submenu: [{ role: 'resetZoom', label: '실제 크기' }, { role: 'zoomIn', label: '확대' }, { role: 'zoomOut', label: '축소' }, { type: 'separator' }, { role: 'togglefullscreen', label: '전체 화면' }] },
    { label: '도움말', submenu: [
      { label: '버전 정보', click: () => dialog.showMessageBox(win, { type: 'info', title: 'UNIBLE SALE', message: `UNIBLE SALE 데스크톱 ${app.getVersion()}`, detail: `서버: ${serverUrl()}\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome}`, buttons: ['확인'] }) },
      { label: '개발자 도구', accelerator: 'F12', click: () => win && win.webContents.toggleDevTools() }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

app.whenReady().then(() => {
  buildMenu(); createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
