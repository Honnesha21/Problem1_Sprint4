# Conseal - Start All Services
# Run this from the project root: .\start.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  CONSEAL - Document Redaction Pipeline" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Starting all services..." -ForegroundColor Yellow
Write-Host ""

# 1. Python FastAPI engine (port 8000)
Write-Host "  [1/3] Python FastAPI engine    -> http://localhost:8000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\python-engine'; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

Start-Sleep -Seconds 1

# 2. Node.js detection server (port 4000)
Write-Host "  [2/3] Node.js detection server -> http://localhost:4000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; node server.js"

Start-Sleep -Seconds 1

# 3. React/Vite client (port 5173)
Write-Host "  [3/3] React client (Vite)      -> http://localhost:5173" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\client'; npm run dev"

Write-Host ""
Write-Host "  All services launched in separate windows." -ForegroundColor Yellow
Write-Host "  Open http://localhost:5173 in your browser." -ForegroundColor Cyan
Write-Host ""
