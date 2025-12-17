# OmniGraph System 

## Project Overview
OmniGraph is a high-performance data visualization framework powered by the **DSI (Dynamic Sync Integration) Engine**. This repository contains the core administrative interface, the backend synchronization server, and the storefront integration assets.

## System Components
- **Admin UI (`OmniGraphApp.jsx`):** A React-based dashboard for monitoring node health and system telemetry.
- **Backend (`server.js`):** The Node.js DSI Engine that manages real-time data streaming and API requests.
- **Storefront (`omnigraph-loader.liquid`):** A lightweight loader for embedding OmniGraph visuals into e-commerce environments.

## Quick Start
1. **Environment:** Ensure Node.js v16+ is installed on your system.
2. **Installation:** Run `npm install` to gather dependencies (Express, Cors, Helmet, etc.).
3. **Execution:** Start the engine using `node server.js`.
4. **Build:** For the Admin UI, use `npm run build` to generate the production React bundle.

## Technical Architecture
The system utilizes a "Pulse-Sync" architecture where data nodes are validated against the master DSI definition before being rendered in the storefront loader.


