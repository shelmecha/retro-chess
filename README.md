# Retro Chess

A 256×310 always-on-top desktop chess board with pixel-art pieces, playing against
Stockfish 18. Electron app, borderless window, no menus — it sits in the corner of your
screen and you play a game.

Built by 9 Days Wonder.

## Download

**[Download RetroChess-win32-x64.zip](https://github.com/shelmecha/retro-chess/releases/latest)**
— Windows x64, 175 MB, engine included. Unzip it and run `RetroChess.exe` **from inside the
unzipped folder**; the executable needs its siblings and will not run on its own.

The build is unsigned, so SmartScreen shows *"Windows protected your PC"* — click **More
info → Run anyway**. There is no installer; delete the folder to uninstall.

Everything below is for running or building from source instead.

## What's in it

- Full legal move generation (castling, en passant, auto-queen promotion) written from
  scratch on a 0x88 board, used to drive the UI.
- Stockfish 18 as the opponent, driven over UCI as a child process.
- Four difficulty levels, mapped to Stockfish's Skill Level and a move-time budget.
- A live evaluation bar, undo, three board themes, and synthesised move sounds.
- Runs entirely offline. The Content-Security-Policy blocks every network origin.

## Requirements

- Node.js 18 or newer (developed on 22).
- Windows x64. `main.js` spawns a Windows Stockfish build; other platforms need the
  engine filename in `main.js` changed to match.

## Getting the engine

**The engine is not in this repo** — it is a ~114 MB GPLv3 binary. Download it yourself:

1. Go to the [Stockfish 18 release](https://github.com/official-stockfish/Stockfish/releases/tag/sf_18).
2. Download `stockfish-windows-x86-64.zip`.
3. Extract `stockfish-windows-x86-64.exe` into the `stockfish/` folder, keeping that
   exact filename — `main.js` looks for `stockfish/stockfish-windows-x86-64.exe`.

If the engine is missing the app still opens, but the evaluation bar reads
`ENGINE ERROR` and the board is locked.

## Running

```sh
npm install
npm start
```

## Building RetroChess.exe

```sh
npm run dist
```

Output lands in `dist/RetroChess-win32-x64/RetroChess.exe`. The whole folder is the
application — the `.exe` needs its siblings, so move or zip the folder, not the file
alone.

The build fails fast if the Stockfish binary is missing, and again if the engine did not
get unpacked out of the asar archive (a binary inside an asar cannot be executed, so
such a build would launch fine and then never make a move).

### If the .exe disappears after building

Some antivirus software quarantines freshly built, unsigned executables. If
`RetroChess.exe` vanishes shortly after a successful build, add the project folder as an
exclusion in Windows Security → Virus & threat protection → Exclusions.

## Controls

| Input | Action |
|---|---|
| Click a piece, then a target | Move (you play White) |
| `N` | New game |
| `U` | Undo your last move and the engine's reply |
| `F` | Flip the board |
| `Esc` | Deselect the current piece |
| Drag the title bar or eval bar | Move the window |

Buttons across the top: `RESET`, `UNDO`, `SOUND`, theme, `MENU`, `EXIT`.

## Layout

| Path | What it is |
|---|---|
| `main.js` | Electron main process; owns the window and the Stockfish subprocess |
| `chess.html` | The entire renderer — CSS, chess engine, sprites, and UI |
| `build.js` | Packaging script behind `npm run dist` |
| `tools/make-icon.js` | Regenerates `icon.ico` from the knight sprite in `chess.html` |
| `stockfish/` | Where the engine binary goes; holds its GPLv3 licence text |

The pieces are 16×16 four-tone sprites defined in `chess.html` and drawn to a canvas at
load time — there are no image files. Tone order is outline, fill, shadow, highlight, and
each piece is a different height so they stay apart by silhouette alone. Change a sprite
and rerun `node tools/make-icon.js` to keep the app icon in sync.

`chess.html` also carries a small built-in fallback engine used when the page is opened
in a plain browser instead of Electron. Under Electron it never runs.

## Licence

The Retro Chess application code is MIT licensed — see `LICENSE`. Third-party components
and their terms are listed in `NOTICE`.

Stockfish is a separate program, licensed under the **GNU General Public License v3**
(`stockfish/Copying.txt`). It is not bundled in this repository. Retro Chess talks to it
over the standard UCI protocol across a process boundary. If you distribute a packaged
build that includes the engine binary, you are redistributing Stockfish and must comply
with the GPLv3 — including shipping its licence text and offering its source.
