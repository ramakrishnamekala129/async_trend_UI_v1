$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidRoot = Join-Path $projectRoot "android"

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
$env:ANDROID_HOME = "C:\Users\ramak\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_USER_HOME = "D:\h\.android"
$env:GRADLE_USER_HOME = "D:\g"
$env:NODE_ENV = "production"
$env:TMP = "D:\t"
$env:TEMP = "D:\t"
$env:GRADLE_OPTS = "-Dorg.gradle.vfs.watch=false -Duser.home=D:\h -Djava.io.tmpdir=D:\t"
$env:Path = "$($env:JAVA_HOME)\bin;C:\Program Files\nodejs;$($env:ANDROID_HOME)\platform-tools;$($env:ANDROID_HOME)\cmdline-tools\latest\bin;$($env:Path)"

New-Item -ItemType Directory -Path $env:ANDROID_USER_HOME -Force | Out-Null
New-Item -ItemType Directory -Path "D:\t" -Force | Out-Null

Push-Location $androidRoot
try {
    cmd /c "gradlew.bat bundleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a"
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Release bundle created:"
Write-Host "  $androidRoot\app\build\outputs\bundle\release\app-release.aab"

