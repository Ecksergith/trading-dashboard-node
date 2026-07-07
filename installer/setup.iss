; Inno Setup Script - Ukulo Trade Trading Dashboard
; Ukulo Digital Comércio e Prestação de Serviços, LDA
; NIF: 5002885131

#define MyAppName "Ukulo Trade"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Ukulo Digital Comércio e Prestação de Serviços, LDA"
#define MyAppURL "https://ukulodigital.co.ao"
#define MyAppExeName "Trading Dashboard.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppName} {#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
LicenseFile=terms.txt
OutputDir=installer\output
OutputBaseFilename=UkuloTrade_Setup_{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName={#MyAppName} {#MyAppVersion}
UninstallDisplayIcon={app}\ukulotrade.ico
SetupIconFile=ukulotrade.ico
WizardImageFile=wizard_image.bmp
WizardSmallImageFile=wizard_small.bmp

[Languages]
Name: "portuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Server files
Source: "server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs
; Built frontend files
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
; Configuration files
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
; Start scripts
Source: "start.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "start-tunnel.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "Trading Dashboard.vbs"; DestDir: "{app}"; Flags: ignoreversion
; Icon file
Source: "ukulotrade.ico"; DestDir: "{app}"; Flags: ignoreversion
; Terms and conditions
Source: "installer\terms.txt"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Dirs]
Name: "{app}\server\data"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\start.bat"; IconFilename: "{app}\ukulotrade.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\start.bat"; IconFilename: "{app}\ukulotrade.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\start.bat"; Description: "Iniciar Ukulo Trade agora"; Flags: postinstall nowait skipifsilent

[Code]
// Check if Node.js is installed
function IsNodeInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c node --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

// Check if Python is installed (optional for MT5 Bridge)
function IsPythonInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c python --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

// Initialize installation
function InitializeSetup: Boolean;
begin
  Result := True;
  
  // Check for Node.js
  if not IsNodeInstalled then
  begin
    if MsgBox('Node.js não está instalado. O Ukulo Trade requer Node.js para funcionar. Deseja continuar a instalação?', 
              mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
    end;
  end;
end;

// Post-install message
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    MsgBox('Ukulo Trade foi instalado com sucesso!' + #13#10#13#10 +
           'Para iniciar o aplicativo:' + #13#10 +
           '1. Execute o atalho "Ukulo Trade" na área de trabalho, ou' + #13#10 +
           '2. Execute "Trading Dashboard.exe" na pasta de instalação' + #13#10#13#10 +
           'Nota: Certifique-se de que o MetaTrader 5 está aberto e o MT5 Bridge está a funcionar.' + #13#10#13#10 +
           'Ukulo Digital Comércio e Prestação de Serviços, LDA' + #13#10 +
           'NIF: 5002885131', 
           mbInformation, MB_OK);
  end;
end;

// Uninstall confirmation
function InitializeUninstall: Boolean;
begin
  Result := MsgBox('Tem certeza que deseja desinstalar o Ukulo Trade?', 
                    mbConfirmation, MB_YESNO) = IDYES;
end;

// Post-uninstall message
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    MsgBox('Ukulo Trade foi desinstalado com sucesso.' + #13#10#13#10 +
           'Os dados de configuração podem ter sido preservados na pasta de instalação.' + #13#10 +
           'Se desejar remover todos os dados, remova manualmente a pasta de instalação.' + #13#10#13#10 +
           'Ukulo Digital Comércio e Prestação de Serviços, LDA' + #13#10 +
           'NIF: 5002885131', 
           mbInformation, MB_OK);
  end;
end;
