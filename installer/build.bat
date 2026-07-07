@echo off
title Build Ukulo Trade Installer
echo ========================================
echo   Construindo Instalador Ukulo Trade
echo ========================================

cd /d "%~dp0"

REM Verificar se o Inno Setup está instalado
set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "%ISCC_PATH%" goto build

set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"
if exist "%ISCC_PATH%" goto build

set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 5\ISCC.exe"
if exist "%ISCC_PATH%" goto build

echo [ERRO] Inno Setup nao encontrado!
echo.
echo Instale o Inno Setup 6: https://jrsoftware.org/isinfo.php
pause
exit /b 1

:build
echo Compilando instalador...
"%ISCC_PATH%" setup.iss

if %ERRORLEVEL%==0 (
    echo.
    echo ========================================
    echo   Instalador construido com sucesso!
    echo ========================================
    echo.
    echo Arquivo: output\UkuloTrade_Setup_1.0.0.exe
) else (
    echo.
    echo [ERRO] Falha ao construir instalador
)

pause
