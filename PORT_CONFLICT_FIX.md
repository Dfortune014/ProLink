# Port 8080 Conflict - Fixed

## Problem
```
Error: listen EACCES: permission denied ::1:8080
```

## Root Cause
Port 8080 is already in use by a Java process (PID 3512):
```
Process: java.exe (C:\Program Files\Java\jdk-25\bin\java.exe)
Port: 8080
```

## Solution Applied

### Changed Vite Dev Server Port
Updated `vite.config.ts` to use port **3000** instead of 8080:
- Port 3000 is already configured in Cognito callback URLs
- Port 3000 is commonly used for frontend dev servers
- No need to kill the Java process

### Configuration
```typescript
server: {
  host: "127.0.0.1", // IPv4 to avoid IPv6 issues
  port: 3000,        // Changed from 8080
  strictPort: false, // Allows fallback if port is taken
  hmr: {
    host: "127.0.0.1",
    port: 3000,      // Match server port
    protocol: "ws",
  },
}
```

## Next Steps

1. **Restart the dev server**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Access the app**:
   - URL: `http://localhost:3000`
   - OAuth callbacks will work (already configured in Cognito)

## Alternative: Use Port 8080

If you want to use port 8080 for Vite:

### Option 1: Stop the Java Process
```powershell
# Find what's using port 8080
netstat -ano | findstr :8080

# Kill the process (replace 3512 with actual PID)
taskkill /PID 3512 /F
```

### Option 2: Change Java Process Port
If the Java process is something you control, change its port instead.

## Cognito Configuration

Your Cognito is already configured for both ports:
- ✅ `http://localhost:3000/auth/callback` (now active)
- ✅ `http://localhost:8080/auth/callback` (available if needed)

The OAuth redirect URI auto-detection will use port 3000 now, which matches Cognito's configuration.

