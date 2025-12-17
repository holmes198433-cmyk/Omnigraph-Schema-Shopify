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

2. Node Transmission (Upsert)
'POST /api/v1/graph/node-update'
- **Description:** Sends new data from the Admin UI to the DSI Engine.
- **Payload Requirements:**
node_id (String): Unique identifier for the graph node.
data_vector (Array): Numerical values for visualization.
visual_config (Object): Color, scale, and animation overrides.
3. Storefront Stream
GET /api/v1/graph/stream
Protocol: Server-Sent Events (SSE)
Use Case: Real-time updates to the omnigraph-loader.liquid component.
⚠️ Error Handling Matrix
Code Meaning Action Required
401 Invalid DSI Key Re-authenticate Admin UI
409 Node Collision Conflict resolution required
503 Sync Lag Reduce pulse frequency
