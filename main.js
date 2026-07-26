const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let stockfish = null;
let quitting = false;

// This stops Electron from trying to build the GPU cache that was crashing the app
app.disableHardwareAcceleration();

function createWindow () {
  const win = new BrowserWindow({
    width: 256,
    height: 310,
    useContentSize: true,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
      // webSecurity stays on: under Electron the renderer talks to the real engine
      // over IPC, so the blob Web Worker fallback never runs and nothing needs it off.
    }
  });

  win.loadFile(path.join(__dirname, 'chess.html'));

  // The renderer has no listeners attached until the page finishes loading, so
  // anything sent before then is dropped -- including the uci handshake and, more
  // importantly, any engine startup error. Buffer until the page is up.
  let rendererReady = false;
  let pending = [];
  function toRenderer (line) {
    if (win.isDestroyed()) return;
    if (rendererReady) win.webContents.send('stockfish-output', line);
    else pending.push(line);
  }
  win.webContents.on('did-finish-load', () => {
    rendererReady = true;
    for (const line of pending) win.webContents.send('stockfish-output', line);
    pending = [];
  });

  // Packaged builds put app code inside app.asar, but a binary has to be a real file on
  // disk to be spawnable, so build.js unpacks it. Retarget the path to the unpacked copy.
  // No-op when running unpackaged.
  const enginePath = path
    .join(__dirname, 'stockfish', 'stockfish-windows-x86-64.exe')
    .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
  try {
    stockfish = spawn(enginePath, [], { windowsHide: true });
  } catch (error) {
    toRenderer('engineerror ' + error.message);
    return;
  }

  let outputBuffer = '';
  stockfish.stdout.on('data', data => {
    outputBuffer += data.toString();
    const lines = outputBuffer.split(/\r?\n/);
    outputBuffer = lines.pop();
    for (const line of lines) {
      if (line) toRenderer(line);
    }
  });

  stockfish.stderr.on('data', data => {
    const text = data.toString().trim();
    if (text) toRenderer('engineerror ' + text);
  });

  stockfish.on('error', error => {
    toRenderer('engineerror ' + error.message);
  });

  stockfish.on('exit', (code, signal) => {
    if (!quitting) toRenderer('engineerror engine stopped (' + (code !== null ? code : signal) + ')');
  });

  // spawn() surfaces a missing binary asynchronously, so the handshake writes below
  // land on a stream that is already failing. Without this the EPIPE is unhandled
  // and takes the whole app down instead of showing an error.
  stockfish.stdin.on('error', error => {
    toRenderer('engineerror ' + error.message);
  });

  function sendToEngine (command) {
    if (!stockfish || stockfish.killed || !stockfish.stdin.writable) return;
    stockfish.stdin.write(command + '\n');
  }

  sendToEngine('uci');
  sendToEngine('setoption name Threads value 2');
  sendToEngine('setoption name Hash value 128');
  sendToEngine('isready');

  ipcMain.removeAllListeners('stockfish-command');
  ipcMain.on('stockfish-command', (_event, command) => sendToEngine(command));
}

function stopEngine () {
  quitting = true;
  if (stockfish && !stockfish.killed) stockfish.kill();
  stockfish = null;
}

app.whenReady().then(createWindow);

// window-all-closed alone misses the quit-from-menu path, which would leave a
// stray stockfish.exe running after the app is gone.
app.on('before-quit', stopEngine);

app.on('window-all-closed', () => {
  stopEngine();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
