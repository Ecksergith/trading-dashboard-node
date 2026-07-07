@echo off
title Instalador Ukulo Trade
echo ========================================
echo   Ukulo Trade - Instalador
echo ========================================
echo.
echo   Ukulo Digital Comercio e Prestacao de Servicos, LDA
echo   NIF: 5002885131
echo.
echo ========================================
echo.

REM Definir diretorio de instalacao
set "INSTALL_DIR=%USERPROFILE%\AppData\Local\UkuloTrade"

echo [1/5] Criando diretorio de instalacao...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [2/5] Copiando arquivos...
xcopy /E /I /Y "%~dp0server" "%INSTALL_DIR%\server"
xcopy /E /I /Y "%~dp0dist" "%INSTALL_DIR%\dist"
copy /Y "%~dp0package.json" "%INSTALL_DIR%\"
copy /Y "%~dp0package-lock.json" "%INSTALL_DIR%\"
copy /Y "%~dp0start.bat" "%INSTALL_DIR%\"
copy /Y "%~dp0start-tunnel.bat" "%INSTALL_DIR%\"
copy /Y "%~dp0Trading Dashboard.vbs" "%INSTALL_DIR%\"
copy /Y "%~dp0ukulotrade.ico" "%INSTALL_DIR%\"

echo [3/5] Instalando dependencias...
cd /d "%INSTALL_DIR%"
call npm install --production

echo [4/5] Criando atalho na area de trabalho...
echo Set oWS = WScript.CreateObject^("WScript.Shell"^) > "%TEMP%\create_shortcut.vbs"
echo Set oLink = oWS.CreateShortcut^("%USERPROFILE%\Desktop\Ukulo Trade.lnk"^) >> "%TEMP%\create_shortcut.vbs"
echo oLink.TargetPath = "%INSTALL_DIR%\start.bat" >> "%TEMP%\create_shortcut.vbs"
echo oLink.IconLocation = "%INSTALL_DIR%\ukulotrade.ico, 0" >> "%TEMP%\create_shortcut.vbs"
echo oLink.Description = "Ukulo Trade - Trading Dashboard" >> "%TEMP%\create_shortcut.vbs"
echo oLink.WorkingDirectory = "%INSTALL_DIR%" >> "%TEMP%\create_shortcut.vbs"
cscript //nologo "%TEMP%\create_shortcut.vbs"
del "%TEMP%\create_shortcut.vbs"

echo [5/5] Criando menu iniciar...
if not exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Ukulo Trade" mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Ukulo Trade"
echo Set oWS = WScript.CreateObject^("WScript.Shell"^) > "%TEMP%\create_shortcut2.vbs"
echo Set oLink = oWS.CreateShortcut^("%APPDATA%\Microsoft\Windows\Start Menu\Programs\Ukulo Trade\Ukulo Trade.lnk"^) >> "%TEMP%\create_shortcut2.vbs"
echo oLink.TargetPath = "%INSTALL_DIR%\start.bat" >> "%TEMP%\create_shortcut2.vbs"
echo oLink.IconLocation = "%INSTALL_DIR%\ukulotrade.ico, 0" >> "%TEMP%\create_shortcut2.vbs"
echo oLink.Description = "Ukulo Trade - Trading Dashboard" >> "%TEMP%\create_shortcut2.vbs"
echo oLink.WorkingDirectory = "%INSTALL_DIR%" >> "%TEMP%\create_shortcut2.vbs"
cscript //nologo "%TEMP%\create_shortcut2.vbs"
del "%TEMP%\create_shortcut2.vbs"

echo.
echo ========================================
echo   Instalacao concluida!
echo ========================================
echo.
echo   Localizacao: %INSTALL_DIR%
echo   Atalho: Area de Trabalho
echo.
echo   Para iniciar: Clique no atalho "Ukulo Trade"
echo.
echo   Ukulo Digital Comercio e Prestacao de Servicos, LDA
echo   NIF: 5002885131
echo.
echo ========================================
echo.

set /p "START_NOW=Deseja iniciar o Ukulo Trade agora? (S/N): "
if /I "%START_NOW%"=="S" (
    start "" "%INSTALL_DIR%\start.bat"
)

pause
