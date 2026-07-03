@echo off
title LabIA - Iniciador
echo.
echo  LabIA - subindo site e worker...
echo.
cd /d "%~dp0"

start "LabIA - Site (nao feche)" cmd /k "npm run dev"
start "LabIA - Worker (nao feche)" cmd /k "npx dotenv-cli -e .env.local -- npm run worker"

echo  Duas janelas foram abertas:
echo    1. Site    - http://localhost:3000
echo    2. Worker  - processa as geracoes de imagem
echo.
echo  Aguarde ~15 segundos e abra:  http://localhost:3000
echo  Para desligar: feche as duas janelas.
echo.
timeout /t 20 >nul
start http://localhost:3000
exit
