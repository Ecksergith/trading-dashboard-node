@echo off
echo ==========================================
echo   Trading Dashboard - Cloudflare Tunnel
echo ==========================================
echo.
echo Verificando se cloudflared esta instalado...
cloudflared --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] cloudflared nao encontrado!
    echo.
    echo Instale em: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    echo.
    echo Ou baixe direto:
    echo   winget install Cloudflare.cloudflared
    echo.
    pause
    exit /b 1
)

echo.
echo Iniciando tunnel para localhost:5000...
echo Anote a URL gerada abaixo e use no Railway como MT5_BRIDGE_URL
echo.
cloudflared tunnel --url http://localhost:5000
