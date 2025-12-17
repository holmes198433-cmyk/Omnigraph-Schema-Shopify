# DSI Engine: Full API Specification v1.0.4

## 🔐 Security & Authentication
All requests must include a valid Bearer Token.
`Authorization: Bearer <DSI_MASTER_KEY>`

## 📡 Dynamic Sync Endpoints

### 1. System Pulse Check
`GET /api/v1/dsi/pulse`
- **Description:** Verifies the engine is capable of handling new node requests.
- **Header:** `X-DSI-Priority: High`
- **Response:** `200 OK`
- **Payload:**
```json
{
  "status": "synchronized",
  "latency_ms": 12,
  "active_nodes": 1240,
  "engine_load": 0.45
}

