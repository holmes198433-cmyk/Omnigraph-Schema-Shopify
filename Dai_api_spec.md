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
# DSI Engine: Full API Specification v1.0.4

### 4. omnigraph_definition.md (Extended Brand & Logic)
```markdown
# OmniGraph: Strategic Brand & Logic Definition

## 💎 Brand Vision
To define the gold standard for real-time data integration in the modern web. OmniGraph isn't just a tool; it's a visual nervous system for digital storefronts.

## 🎨 Visual Identity Standards
- **Color Palette:**
  - **DSI Blue:** `#38bdf8` (Primary Action)
  - **Engine Slate:** `#0f172a` (Background)
  - **Alert Crimson:** `#ef4444` (Sync Error)
- **UI Physics:** All graph transitions must use a 300ms cubic-bezier ease-in-out to maintain a "fluid" feel.

## ⚙️ DSI Logic Principles
The Dynamic Sync Integration (DSI) is built on three pillars:

1. **The Heartbeat:**
   The engine expects a "ping" from the storefront every 3000ms. If the ping fails twice, the loader enters "Stasis Mode."

2. **Node Validation:**
   Before any data is rendered, it is checked against a schema. If the data vector is malformed, the node is quarantined to prevent the UI from crashing.

3. **Atomic Updates:**
   Only the changed parts of the graph are transmitted. This keeps the performance high even on mobile devices.

## 📈 Scalability Goals
- Support up to 10,000 simultaneous data nodes.
- Maintain sub-50ms latency for global sync.
