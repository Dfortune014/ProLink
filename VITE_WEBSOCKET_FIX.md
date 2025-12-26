# Vite WebSocket Connection Error - Fixed

## Problem
```
WebSocket connection to 'ws://localhost:8081/?token=...' failed
WebSocket connection to 'ws://localhost:8080/?token=...' failed
[vite] failed to connect to websocket.
```

## Root Cause
The browser was accessing the app on a different port (8081) than the Vite dev server (8080), causing the HMR (Hot Module Replacement) WebSocket to fail.

## Solution Applied

### Updated `vite.config.ts`
- Set explicit `host: "localhost"` (instead of `"::"`)
- Added explicit HMR configuration:
  ```typescript
  hmr: {
    host: "localhost",
    port: 8080,
    protocol: "ws",
  }
  ```

This ensures:
1. The dev server runs on `localhost:8080`
2. The HMR WebSocket connects to `ws://localhost:8080`
3. Both browser and server use the same port

## How to Fix

1. **Restart the dev server** after the config change:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Access the app on the correct port**:
   - Use: `http://localhost:8080`
   - Not: `http://localhost:8081`

3. **If you need to use port 8081**, update the config:
   ```typescript
   server: {
     host: "localhost",
     port: 8081,  // Change this
     hmr: {
       host: "localhost",
       port: 8081,  // And this
       protocol: "ws",
     },
   }
   ```

## Why This Happens

Vite's HMR uses WebSockets for hot module replacement. When:
- Browser accesses: `http://localhost:8081`
- Server runs on: `http://localhost:8080`
- WebSocket tries to connect but fails due to port mismatch

The fix ensures both use the same port and host.

## Note

This is a **development-only** issue. It doesn't affect:
- Production builds
- OAuth functionality
- API calls
- Application functionality

It only affects hot module replacement (auto-refresh on code changes).

