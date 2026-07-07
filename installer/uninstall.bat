@echo off
title Desinstalador Ukulo Trade
echo ========================================
echo   Ukulo Trade - Desinstalador
echo ========================================
echo.
echo   Ukulo Digital Comercio e Prestacao de Servicos, LDA
echo   NIF: 5002885131
echo.
echo ========================================
echo.

set "INSTALL_DIR=%USERPROFILE%\AppData\Local\UkuloTrade"

echo Tem certeza que deseja desinstalar o Ukulo Trade?
echo.
set /p "CONFIRMAR=Digite S para confirmar: "
if /I not "%CONFIRMAR%"=="S" (
    echo Desinstalacao cancelada.
    pause
    exit /b 0
)

echo.
echo [1/4] Removendo atalho da area de trabalho...
if exist "%USERPROFILE%\Desktop\Ukulo Trade.lnk" del "%USERPROFILE%\Desktop\Ukulo Trade.lnk"

echo [2/4] Removendo menu iniciar...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Ukulo Trade" rmdir /S /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Ukulo Trade"

echo [3/4] Parando processos em execicao...
taskkill /F /FI "WINDOWTITLE eq Trading Dashboard*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Trading-Server" >nul 2>&1

echo [4/4] Removendo arquivos...
if exist "%INSTALL_DIR%" (
    rmdir /S /Q "%INSTALL_DIR%"
    echo Arquivos removidos com sucesso.
) else (
    echo Diretorio de instalacao nao encontrado.
)

echo.
echo ========================================
echo   Desinstalacao concluida!
echo ========================================
echo.
echo   Ukulo Digital Comercio e Prestacao de Servicos, LDA
echo   NIF: 5002885131
echo.
echo ========================================
echo.
pause
