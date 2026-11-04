# Compila el APK de Android (ARM64) con Tauri. Necesita JDK 17, el SDK y el NDK de Android y el objetivo
# aarch64-linux-android de Rust; reutiliza por defecto la caja de herramientas de MesaNexoNativo.
param([string]$Tools=(Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'MesaNexoNativo/.tools'),[switch]$Release,[string]$ServerUrl='',[string]$ProviderName='',[string]$PrivacyEmail='',[string]$Keys=(Join-Path $env:USERPROFILE '.culinary-firma'))
$ErrorActionPreference='Stop'
$env:VITE_SERVER_URL=$ServerUrl
# Quien responde por los datos, para el aviso de privacidad de la app.
$env:VITE_PROVIDER_NAME=$ProviderName;$env:VITE_PRIVACY_EMAIL=$PrivacyEmail
$root=Split-Path $PSScriptRoot -Parent
if(Test-Path (Join-Path $Tools 'cargo/bin/cargo.exe')){$env:CARGO_HOME=Join-Path $Tools 'cargo';$env:RUSTUP_HOME=Join-Path $Tools 'rustup';$env:PATH="$env:CARGO_HOME\bin;$env:PATH"}
if(-not $env:JAVA_HOME){$env:JAVA_HOME=(Get-ChildItem 'C:\Program Files\Microsoft\jdk-17*' -Directory | Select-Object -First 1).FullName}
if(-not $env:ANDROID_HOME){$env:ANDROID_HOME=Join-Path $env:LOCALAPPDATA 'Android\Sdk'}
if(-not $env:NDK_HOME){$env:NDK_HOME=(Get-ChildItem (Join-Path $env:ANDROID_HOME 'ndk') -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName}
foreach($v in 'JAVA_HOME','ANDROID_HOME','NDK_HOME'){if(-not (Test-Path ([Environment]::GetEnvironmentVariable($v)))){throw "Falta $v"}}
Push-Location $root
try{
    if(-not(Test-Path 'node_modules')){& npm.cmd ci --no-audit --no-fund;if($LASTEXITCODE){throw 'No se pudieron instalar las dependencias.'}}
    if(-not(Test-Path 'src-tauri/gen/android')){& npm.cmd run tauri -- android init --ci;if($LASTEXITCODE){throw 'Falló android init.'}}
    $profile=if($Release){'release'}else{'debug'}
    $args=@('run','tauri','--','android','build','--apk','--target','aarch64')
    if(-not $Release){$args+='--debug'}
    & npm.cmd @args
    if($LASTEXITCODE){
        # Without Windows developer mode Tauri cannot symlink the native library; copy it and let Gradle package it.
        $lib="src-tauri/target/aarch64-linux-android/$profile/libculinary_dueno_lib.so"
        if(-not(Test-Path $lib)){throw 'Falló la compilación de Rust para Android.'}
        $jni='src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a'
        New-Item -ItemType Directory -Force $jni | Out-Null
        Copy-Item $lib $jni -Force
        $variant=if($Release){'Release'}else{'Debug'}
        Push-Location 'src-tauri/gen/android'
        try{& .\gradlew.bat "assembleArm64$variant" -x "rustBuildArm64$variant";if($LASTEXITCODE){throw 'Falló Gradle.'}}finally{Pop-Location}
    }
    if($Release){
        # Signed with the Culinary key (MesaNexoNativo/tools/New-SigningKeys.ps1), kept outside the repository.
        $bt=Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory | Sort-Object Name -Descending | Select-Object -First 1
        $keys=$Keys
        New-Item -ItemType Directory -Force 'dist-android' | Out-Null
        $pass=(Get-Content (Join-Path $keys 'android.pass') -Raw).Trim()
        $unsigned=Get-ChildItem 'src-tauri/gen/android/app/build/outputs/apk' -Recurse -Filter '*release-unsigned.apk' | Select-Object -First 1
        & (Join-Path $bt.FullName 'zipalign.exe') -f -p 4 $unsigned.FullName 'dist-android/aligned.apk'
        & (Join-Path $bt.FullName 'apksigner.bat') sign --ks (Join-Path $keys 'culinary-android.jks') --ks-key-alias culinary --ks-pass "pass:$pass" --out 'dist-android/CulinaryDueno-arm64.apk' 'dist-android/aligned.apk'
        if($LASTEXITCODE){throw 'No se pudo firmar el APK.'}
        Remove-Item 'dist-android/aligned.apk'
        "APK firmado: $(Resolve-Path 'dist-android/CulinaryDueno-arm64.apk')"
    } else { Get-ChildItem 'src-tauri/gen/android/app/build/outputs/apk' -Recurse -Filter *.apk | ForEach-Object { "APK: $($_.FullName)" } }
}finally{Pop-Location}
