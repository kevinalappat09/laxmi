# Laxmi

Local-first personal finance management.

## Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 22 or later, below 26 (`node -v`)
- [npm](https://www.npmjs.com/) (included with Node.js)
- A C/C++ build toolchain, required to compile the native SQLite module (`better-sqlite3`)

On Debian and Ubuntu, the toolchain is typically `build-essential` and `python3`. On macOS, install the Xcode Command Line Tools. On Windows, install the [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload.

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/kevinalappat09/laxmi.git
cd laxmi
npm install
npm --prefix renderer install
```

`npm install` also rebuilds `better-sqlite3` for Electron.

Build the desktop application for your operating system. Installers are written to `releases/`.

**Linux** (AppImage and `.deb`):

```bash
npm run dist:linux
```

Run the AppImage directly:

```bash
chmod +x releases/Laxmi-1.0.2-x64.AppImage
./releases/Laxmi-1.0.2-x64.AppImage
```

Or install the Debian package, then launch **Laxmi** from the application menu:

```bash
sudo apt install ./releases/Laxmi-1.0.2-x64.deb
```

**Windows** (installer):

```bash
npm run dist:win
```

Run `releases/Laxmi-Setup-1.0.2.exe`. The installer lets you choose a directory and adds Desktop and Start menu shortcuts. Open **Laxmi** from either shortcut.

The `1.0.2` segment matches the `version` field in `package.json`. A later version produces the same file names with that version number.

## Releasing

Published installers are attached to [GitHub Releases](https://github.com/kevinalappat09/laxmi/releases). The local `releases/` directory is not committed.

1. Set `version` in `package.json` and commit that change.
2. Tag that commit `v` plus the same version, for example `v1.1.0`.
3. Push the tag:

```bash
git push origin v1.1.0
```

The Release workflow builds the Linux AppImage and `.deb` and the Windows installer, then publishes them on that tag. The tag must match `version` in `package.json`.

## Project Structure

- `main.ts`: Electron main process entry point.
- `preload.ts`: Electron preload script.
- `renderer/`: React frontend application (Vite + TypeScript).
- `dist/`: Compiled TypeScript files from the main process.
- `releases/`: Packaged installers produced by `npm run dist:linux` or `npm run dist:win`.

## Available Scripts

### Root directory

- `npm run dist:linux`: Builds the app and packages a Linux AppImage and `.deb`.
- `npm run dist:win`: Builds the app and packages a Windows installer.
- `npm run dist`: Builds the app and packages it for the current platform.
- `npm run build`: Builds the renderer and compiles the main process.
- `npm test`: Runs the test suite.
