// Packages RetroChess into a standalone Windows folder containing RetroChess.exe.
// Run with: npm run dist
const fs = require('fs');
const path = require('path');
const { packager } = require('@electron/packager');

const root = __dirname;
const enginePath = path.join(root, 'stockfish', 'stockfish-windows-x86-64.exe');
const iconPath = path.join(root, 'icon.ico');

if (!fs.existsSync(iconPath)) {
  console.error('Missing icon.ico. Generate it with: node tools/make-icon.js');
  process.exit(1);
}

// The engine is not committed to the repo (it is a 114 MB GPLv3 binary), so a fresh
// clone will not have it. Fail loudly here rather than shipping a build that cannot play.
if (!fs.existsSync(enginePath)) {
  console.error('Missing engine: stockfish/stockfish-windows-x86-64.exe');
  console.error('Download the Windows x86-64 build from:');
  console.error('  https://github.com/official-stockfish/Stockfish/releases/tag/sf_18');
  console.error('and place the .exe in the stockfish/ folder under exactly that name.');
  process.exit(1);
}

// Previous distribution folders live in the project root and are ~28 MB each. Without
// this they get swept into the new build, which then contains copies of itself.
const ignore = [
  /^\/dist($|\/)/,
  /^\/RetroChess-Share($|\/)/,
  /^\/RetroChess-win32-x64($|\/)/,
  /^\/COMPLETE RetroChess-Share($|\/)/,
  /^\/\.git($|\/)/,
  /^\/build\.js$/,
  /^\/README\.md$/
];

packager({
  dir: root,
  name: 'RetroChess',
  platform: 'win32',
  arch: 'x64',
  out: path.join(root, 'dist'),
  overwrite: true,
  prune: true,
  ignore,
  // Puts the knight on RetroChess.exe itself, in Explorer and in the taskbar.
  // Regenerate with `node tools/make-icon.js` after changing the sprite art.
  icon: iconPath,
  // The engine must stay a real file on disk -- spawn() cannot run a binary from inside
  // an asar archive. main.js redirects to the unpacked copy.
  asar: { unpack: '**/stockfish/**' }
})
  .then(([outPath]) => {
    const exe = path.join(outPath, 'RetroChess.exe');
    if (!fs.existsSync(exe)) {
      console.error('Packaging finished but RetroChess.exe is missing from ' + outPath);
      console.error('If this keeps happening, antivirus is quarantining the executable.');
      process.exit(1);
    }
    // A build whose engine ended up inside the asar looks fine but cannot play a move.
    const packedEngine = path.join(
      outPath, 'resources', 'app.asar.unpacked', 'stockfish', 'stockfish-windows-x86-64.exe'
    );
    if (!fs.existsSync(packedEngine)) {
      console.error('Engine was not unpacked to ' + packedEngine);
      console.error('The build would start but never make a move.');
      process.exit(1);
    }
    // Distributing this folder redistributes Stockfish, so the GPLv3 text has to travel
    // with it. It does -- Copying.txt rides along in the unpacked engine folder -- but
    // buried three levels down next to Electron's own LICENSE, which is a different
    // licence for a different thing. Surface our terms at the top level so whoever
    // unzips this can actually find them without opening the asar.
    for (const [src, dest] of [['LICENSE', 'LICENSE.RetroChess.txt'], ['NOTICE', 'NOTICE.txt']]) {
      const from = path.join(root, src);
      if (!fs.existsSync(from)) {
        console.error('Missing ' + src + ', which must ship with the build.');
        process.exit(1);
      }
      fs.copyFileSync(from, path.join(outPath, dest));
    }
    console.log('Built ' + exe);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
