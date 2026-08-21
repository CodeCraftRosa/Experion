const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Allow media autoplay with sound for fMRI stimulus videos.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createMainWindow() {
  const win = new BrowserWindow({
    title: 'CRETA fMRI Paradigm',
    fullscreen: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'renderer/html/mainWindow.html'));
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function getOutputBaseDir() {
  try {
    const desktop = app.getPath('desktop');
    if (desktop) {
      return path.join(desktop, 'Experion Output');
    }
  } catch (_err) {
    // Fallback below.
  }
  return path.join(app.getPath('userData'), 'Experion Output');
}

// Study data (config-file.txt, optseq/, data/) must stay editable after packaging,
// so read them from beside the executable rather than from inside app.asar.
function getExternalDataDir() {
  return app.isPackaged ? path.dirname(process.execPath) : __dirname;
}

function resolvePath(maybeAbsolutePath) {
  return path.isAbsolute(maybeAbsolutePath)
    ? maybeAbsolutePath
    : path.join(__dirname, maybeAbsolutePath);
}

ipcMain.handle('get-project-root', async () => {
  return __dirname;
});

ipcMain.handle('get-output-base-dir', async () => {
  const outDir = getOutputBaseDir();
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
});

ipcMain.handle('read-json', async (_event, relativeFilePath) => {
  const filePath = path.join(getExternalDataDir(), relativeFilePath);
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
});

ipcMain.handle('read-text', async (_event, relativeFilePath) => {
  const filePath = path.join(getExternalDataDir(), relativeFilePath);
  return fs.readFileSync(filePath, 'utf8');
});

ipcMain.handle('ensure-dir', async (_event, relativeDirPath) => {
  const dirPath = resolvePath(relativeDirPath);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
});

ipcMain.handle('save-text', async (_event, relativeFilePath, content) => {
  const filePath = resolvePath(relativeFilePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
});

ipcMain.on('ensure-dir-sync', (event, relativeDirPath) => {
  try {
    const dirPath = resolvePath(relativeDirPath);
    fs.mkdirSync(dirPath, { recursive: true });
    event.returnValue = { ok: true, dirPath };
  } catch (err) {
    event.returnValue = { ok: false, error: err.message };
  }
});

ipcMain.on('save-text-sync', (event, relativeFilePath, content) => {
  try {
    const filePath = resolvePath(relativeFilePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    event.returnValue = { ok: true, filePath };
  } catch (err) {
    event.returnValue = { ok: false, error: err.message };
  }
});
