# Laxmi

Personal finance management

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

## Installation

To install the dependencies for both the main process and the renderer process, follow these steps:

1. **Install root dependencies (Electron and main process):**

```bash
npm install
```

2. **Install renderer dependencies (React frontend):**

```bash
cd renderer
npm install
```

## Development

To run the application in development mode:

```bash
npm run dev
```

This command uses `concurrently` to start:
- The React development server (Vite) via `npm run dev:react`
- The TypeScript compiler in watch mode for the main process and Electron via `npm run dev:electron`

The application will wait for the Vite dev server to be ready on `http://localhost:5173` before launching the Electron window.

## Project Structure

- `main.ts`: Electron main process entry point.
- `preload.ts`: Electron preload script.
- `renderer/`: React frontend application (Vite + TypeScript).
- `dist/`: Compiled TypeScript files from the main process.

## Available Scripts

### Root Directory
- `npm run dev`: Starts both React and Electron in development mode.
- `npm run dev:react`: Starts only the React dev server.
- `npm run dev:electron`: Starts the TypeScript compiler (watch) and Electron.
- `npm run build:electron`: Compiles the main process TypeScript files once.

### Renderer Directory (`/renderer`)
- `npm run dev`: Starts the Vite development server.
- `npm run build`: Builds the React application for production.
- `npm run lint`: Runs ESLint for the React code.
- `npm run preview`: Previews the production build of the React application.
