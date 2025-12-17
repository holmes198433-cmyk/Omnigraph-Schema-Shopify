# OmniGraph System: Professional Edition
**Version:** 1.0.4-Stable  
**Lead Architect:** Nate  

## 🌐 Project Philosophy
OmniGraph is built to bridge the gap between complex data visualization and high-speed e-commerce storefronts. By utilizing the proprietary **DSI (Dynamic Sync Integration)** engine, we ensure that data is not just displayed, but synchronized in real-time across the entire stack.

## 🛠 Technical Stack
- **Frontend:** React 18+ with Tailwind CSS for the Admin UI.
- **Backend:** Node.js, Express, and Socket.io for DSI pulse-streaming.
- **Integration:** Shopify-compatible Liquid templating and vanilla JS injection.
- **Security:** Helmet.js, JWT handshaking, and DSI-X-Signature headers.

## 📂 Directory Structure
- `/admin` - Contains `OmniGraphApp.jsx` and UI assets.
- `/server` - Core DSI Engine logic (`server.js`).
- `/templates` - Liquid loader for storefronts.
- `/docs` - API Specs and Brand definitions.

## 🚀 Detailed Deployment
1. **Server Setup:**
   - Navigate to `/server`.
   - Create a `.env` file (see `dsi_api_spec.md` for required keys).
   - Run `npm install && npm start`.
2. **UI Initialization:**
   - Navigate to `/admin`.
   - Run `npm install && npm run build`.
   - Point the `VITE_DSI_ENDPOINT` to your server URL.

## 🛡 Security Protocol
All transactions between the Admin UI and the DSI Engine are encrypted. The engine uses a "Quiet-Fail" system where if a node loses sync, the frontend preserves the last known good state to prevent storefront breakage.
