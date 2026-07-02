@echo off
title Trading Dashboard
echo ========================================
echo   Iniciando Trading Dashboard...
echo ========================================

cd /d "%~dp0"

set "PYTHON_PATH=C:\Users\Windows\Desktop\ppteste\appai\Scripts\python.exe"
set "BRIDGE_PATH=C:\Users\Windows\Desktop\ppteste\bridge.py"

REM Verificar e iniciar Bridge Python (porta 5000)
netstat -an | findstr ":5000.*LISTENING" >nul 2>&1
if %ERRORLEVEL%==0 goto bridge_ok

echo [*] Iniciando Bridge Python (porta 5000)...
start "MT5-Bridge" /min "%PYTHON_PATH%" "%BRIDGE_PATH%"
goto bridge_done

:bridge_ok
echo [OK] Bridge Python ja esta rodando na porta 5000

:bridge_done
REM Iniciar Node Server (porta 5001)
echo [*] Iniciando Node Server (porta 5001)...
start "Trading-Server" cmd /c "cd /d %~dp0 && node server\index.js"

REM Iniciar Vite Client (porta 3000)
echo [*] Iniciando Vite Client (porta 3000)...
start "Trading-Client" cmd /c "cd /d %~dp0 && node node_modules\vite\bin\vite.js"

echo.
echo ========================================
echo   Todos os servicos iniciados!
echo   Bridge:     http://127.0.0.1:5000
echo   Server:     http://127.0.0.1:5001
echo   Dashboard:  http://localhost:3000
echo ========================================
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
