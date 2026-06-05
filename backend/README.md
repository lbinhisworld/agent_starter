# backend

## Local one-command start (Windows / PowerShell)

See **`scripts/README-local.md`**. Common commands:

```powershell
# repo root
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/start-local-backend.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/status-local-backend.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/stop-local-backend.ps1
```

Set **`backend/.env`** first. At minimum provide `DATABASE_URL`. `PORT` is optional and defaults to `3000`. If that port is occupied, the start script will use the next available port automatically.

---

This directory is reserved for the upcoming Smart CTO backend service.

Suggested next steps:

1. Initialize the backend project here
2. Add database access layer
3. Implement problem case, analysis, tool knowledge, and AI orchestration APIs

