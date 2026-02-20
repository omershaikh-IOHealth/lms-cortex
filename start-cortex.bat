@echo off
pm2 delete all
cd /d C:\Users\OmerShaikh\Desktop\cortex-lms\backend
pm2 start server.js --name cortex-backend
start "Cortex Frontend" cmd /k "cd /d C:\Users\OmerShaikh\Desktop\cortex-lms\frontend && node node_modules\next\dist\bin\next start"
timeout /t 5 /nobreak
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:3000"