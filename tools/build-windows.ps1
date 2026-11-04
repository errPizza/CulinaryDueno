# Compila el instalador de Windows (NSIS) con Rust y MSVC locales. Reutiliza por defecto la caja de herramientas
# de MesaNexoNativo (.tools: cargo, rustup, SDK de Windows y encabezados de MSVC).
param([string]$Tools=(Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'MesaNexoNativo/.tools'),[string]$ServerUrl='',[string]$ProviderName='',[string]$PrivacyEmail='',[string]$Keys=(Join-Path $env:USERPROFILE '.culinary-firma'))
$ErrorActionPreference='Stop'
$env:VITE_SERVER_URL=$ServerUrl
# Quien responde por los datos, para el aviso de privacidad de la app.
$env:VITE_PROVIDER_NAME=$ProviderName;$env:VITE_PRIVACY_EMAIL=$PrivacyEmail
$root=Split-Path $PSScriptRoot -Parent
if(Test-Path (Join-Path $Tools 'cargo/bin/cargo.exe')){$env:CARGO_HOME=Join-Path $Tools 'cargo';$env:RUSTUP_HOME=Join-Path $Tools 'rustup';$env:PATH="$env:CARGO_HOME\bin;$env:PATH"}
if(-not(Get-Command cargo -ErrorAction SilentlyContinue)){throw 'Instala Rust (rustup) o indica -Tools con la carpeta que lo contiene.'}
$sdk=Join-Path $Tools 'windows-sdk'
$compiler=Get-ChildItem 'C:/Program Files/Microsoft Visual Studio/*/*/VC/Tools/MSVC/*/bin/Hostx64/x64/link.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if($compiler -and (Test-Path (Join-Path $sdk 'microsoft.windows.sdk.cpp.x64/c/um/x64/kernel32.lib'))){
    $msvc=Split-Path (Split-Path (Split-Path (Split-Path $compiler.FullName -Parent) -Parent) -Parent) -Parent
    $env:PATH="$($compiler.DirectoryName);$sdk\microsoft.windows.sdk.cpp\c\bin\10.0.26100.0\x64;$env:PATH"
    $env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER=$compiler.FullName
    $env:CXX=Join-Path $compiler.DirectoryName 'cl.exe'
    $env:LIB="$msvc\lib\onecore\x64;$sdk\microsoft.windows.sdk.cpp.x64\c\um\x64;$sdk\microsoft.windows.sdk.cpp.x64\c\ucrt\x64"
    $headers=Resolve-Path (Join-Path $Tools 'msvc-headers/Contents/VC/Tools/MSVC/*/include') -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path
    $env:INCLUDE="$headers;$sdk\microsoft.windows.sdk.cpp\c\Include\10.0.26100.0\um;$sdk\microsoft.windows.sdk.cpp\c\Include\10.0.26100.0\shared;$sdk\microsoft.windows.sdk.cpp\c\Include\10.0.26100.0\ucrt"
}
Push-Location $root
try{
    if(-not(Test-Path 'node_modules')){& npm.cmd ci --no-audit --no-fund;if($LASTEXITCODE){throw 'No se pudieron instalar las dependencias.'}}
    # Firma con las llaves de Culinary (MesaNexoNativo/tools/New-SigningKeys.ps1).
    $config=Join-Path $root 'src-tauri/target/firma.json'
    $sign=@{bundle=@{windows=@{signCommand=@{cmd='powershell';args=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path (Split-Path $root -Parent) 'MesaNexoNativo/tools/Sign-Package.ps1'),'%1','-Directory',$Keys)}}}} | ConvertTo-Json -Depth 6
    New-Item -ItemType Directory -Force (Split-Path $config) | Out-Null
    [IO.File]::WriteAllText($config,$sign)
    & npm.cmd run tauri -- build --config $config
    if($LASTEXITCODE){throw 'Falló la compilación de Tauri.'}
    Get-ChildItem 'src-tauri/target/release/bundle/nsis/*.exe' | ForEach-Object { "Instalador: $($_.FullName)" }
}finally{Pop-Location}
