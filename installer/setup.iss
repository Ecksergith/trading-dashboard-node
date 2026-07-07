; Inno Setup Script - Ukulo Trade Trading Dashboard
; Ukulo Digital Comércio e Prestação de Serviços, LDA
; NIF: 5002885131

#define MyAppName "Ukulo Trade"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Ukulo Digital Comércio e Prestação de Serviços, LDA"
#define MyAppURL "https://ukulodigital.co.ao"

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
OutputDir=output
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
SetupIconFile=..\ukulotrade.ico

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Server files - excluding locked database files
Source: "..\server\index.js"; DestDir: "{app}\server"; Flags: ignoreversion
Source: "..\server\lib\*"; DestDir: "{app}\server\lib"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\server\scripts\*"; DestDir: "{app}\server\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\server\data\*.json"; DestDir: "{app}\server\data"; Flags: ignoreversion
; Built frontend files
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
; Configuration files
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
; Start scripts
Source: "..\start.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\start-tunnel.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Trading Dashboard.vbs"; DestDir: "{app}"; Flags: ignoreversion
; Icon file
Source: "..\ukulotrade.ico"; DestDir: "{app}"; Flags: ignoreversion
; Terms and conditions
Source: "terms.txt"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Dirs]
Name: "{app}\server\data"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\start.bat"; IconFilename: "{app}\ukulotrade.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\start.bat"; IconFilename: "{app}\ukulotrade.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\start.bat"; Description: "Iniciar Ukulo Trade agora"; Flags: postinstall nowait skipifsilent

[Code]
function IsNodeInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c node --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  if not IsNodeInstalled then
  begin
    if MsgBox('Node.js nao esta instalado. O Ukulo Trade requer Node.js para funcionar. Deseja continuar a instalacao?', 
              mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    MsgBox('Ukulo Trade foi instalado com sucesso!' + #13#10#13#10 +
           'Para iniciar o aplicativo:' + #13#10 +
           '1. Execute o atalho "Ukulo Trade" na area de trabalho, ou' + #13#10 +
           '2. Execute "start.bat" na pasta de instalacao' + #13#10#13#10 +
           'Ukulo Digital Comercio e Prestacao de Servicos, LDA' + #13#10 +
           'NIF: 5002885131', 
           mbInformation, MB_OK);
  end;
end;
