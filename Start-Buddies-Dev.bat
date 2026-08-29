@echo off
cd /d "%~dp0"
set PORT=5000
set BASE_PATH=/
pnpm.cmd --filter @workspace/buddies-worldwide run dev > vite-dev.log 2>&1
