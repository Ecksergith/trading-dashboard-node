@echo off
title Build Ukulo Trade Installer
echo ========================================
echo   Construindo Instalador Ukulo Trade
echo ========================================

cd /d "%~dp0"

REM Verificar se o Inno Setup está instalado
where iscc >nul 2>&1
if %ERRORLEVEL%==0 goto build

REM Tentar caminhos comuns do Inno Setup
set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "%ISCC_PATH%" goto build_with_path

set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"
if exist "%ISCC_PATH%" goto build_with_path

set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 5\ISCC.exe"
if exist "%ISCC_PATH%" goto build_with_path

echo [ERRO] Inno Setup não encontrado!
echo.
echo Por favor, instale o Inno Setup 6:
echo https://jrsoftware.org/isinfo.php
echo.
echo Ou especifique o caminho do ISCC.exe
pause
exit /b 1

:build_with_path
"%ISCC_PATH%" "setup.iss"
goto check_result

:build
iscc "setup.iss"

:check_result
if %ERRORLEVEL%==0 (
    echo.
    echo ========================================
    echo   Instalador construído com sucesso!
    echo ========================================
    echo.
    echo Arquivo: installer\output\UkuloTrade_Setup_1.0.0.exe
    echo.
    dir "output\*.exe" /b 2>nul
) else (
    echo.
    echo [ERRO] Falha ao construir instalador
)

pause
