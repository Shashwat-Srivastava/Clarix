# Clarix - CPE Logs and Telemetry reports Analyser

Clarix is a desktop app for CPE engineers to ingest `.tgz` CPE archives, merge component logs chronologically, and inspect both generic logs and structured telemetry reports.


## Setup

'bootstrap-mac.sh' script checks and installs all dependencies and 'build-dmg.sh' builds the universal `.dmg` for macOS distribution. 

```bash
./scripts/bootstrap-mac.sh
./scripts/build-dmg.sh
```
Needs to be run only once during initial setup.

## Running the App

After the build completes, the distributable file will be available at:
```
release/Clarix-<version>-universal.dmg

Open the `.dmg` file and drag **Clarix** to your Applications folder to install it like any standard macOS app.
```
## Updating the app

Run these commands on project terminal to update app with latest changes
```bash
git pull origin main
./scripts/build-dmg.sh
```
 
## Contributing

Before submitting a contribution, verify your build by running the following checks:

### Development
```bash
npm run dev
```

### Unit Tests
```bash
npm test
```

### Build & Package
```bash
npm run build
```

Build output includes renderer assets and Electron bundles, then packages a macOS `.dmg` with product name `Clarix`.

## Ingestion Pipeline

1. Collect archive paths from folder picker, file picker, or drag/drop input.
2. Discover `.tgz`/`.tar.gz` files (folder scan up to 2 levels deep).
3. Extract each archive into `os.tmpdir()/cpe-log-analyser/<session-id>/extracted`.
4. Resolve archive log root (`single-inner-directory` handling).
5. Sort archives chronologically using filename timestamp (`YYYY-MM-DD-HH-MM-SS`), fallback to mtime.
6. Merge component files in order with merge markers.
7. Write merged files to `.../<session-id>/merged` and create component manifest.
8. Parse `telemetry2_0.txt` into report metadata and flattened fields.

## Project Structure

- `electron/main`:
  - `index.js` window/bootstrap
  - `ipc-handlers.js` IPC boundary
  - `ingestion/*` archive extraction, merge, session management
  - `readers/*` log chunk reader/search and telemetry parser
- `electron/preload/index.js` secure `contextBridge` API
- `src/`:
  - `shared/` JSDoc types + IPC constants
  - `store/` Zustand stores
  - `components/` app shell, ingestion, log viewer, telemetry viewer/table
  - `hooks/` timezone, log reader, telemetry data access
  - `pages/` Home, Log Viewer, Telemetry Viewer, Telemetry Table

## Notes

- `nodeIntegration` is disabled.
- `contextIsolation` is enabled.
- IPC calls are asynchronous and wrapped with preload-side timeout protection.
- Main-process ingestion can be superseded/cancelled when a new session starts.
