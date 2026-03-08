@echo off
setlocal enabledelayedexpansion
echo ========================================
echo   OGBO - OTA One-Click Deploy
echo ========================================
echo.

REM Require version argument
if "%1"=="" (
    echo Usage: ota-deploy.bat ^<version^>
    echo.
    echo Example: ota-deploy.bat 1.0.2
    echo.
    echo This script will:
    echo   1. Build Next.js static export
    echo   2. Create ota-bundle-VERSION.zip
    echo   3. Upload bundle to Supabase Storage
    echo   4. Update ota-manifest.json
    echo.
    echo All automatic, no manual steps needed.
    echo.
    pause
    exit /b 1
)

set VERSION=%1

REM ── Load env vars from project root .env ──
set ENV_FILE=%~dp0..\.env
if not exist "!ENV_FILE!" (
    echo [ERROR] .env file not found at: !ENV_FILE!
    echo Please create it with SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL
    pause
    exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("!ENV_FILE!") do (
    set "LINE=%%A"
    if not "!LINE:~0,1!"=="#" (
        if not "%%B"=="" (
            set "%%A=%%B"
        )
    )
)

if "!SUPABASE_SERVICE_ROLE_KEY!"=="" (
    echo [ERROR] SUPABASE_SERVICE_ROLE_KEY not found in .env
    pause
    exit /b 1
)
if "!SUPABASE_URL!"=="" (
    echo [ERROR] SUPABASE_URL not found in .env
    pause
    exit /b 1
)

echo [INFO] Deploying OTA bundle version: %VERSION%
echo [INFO] Supabase URL: !SUPABASE_URL!
echo.

REM ── Step 1: Verify ota-version.ts ──
echo [1/4] Checking ota-version.ts...
findstr /C:"BUNDLE_VERSION = \"%VERSION%\"" lib\ota-version.ts >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ota-version.ts does not contain BUNDLE_VERSION = "%VERSION%"
    echo        Please update lib\ota-version.ts first.
    pause
    exit /b 1
)
echo [OK] ota-version.ts matches version %VERSION%
echo.

REM ── Step 2: Build Next.js ──
echo [2/4] Building Next.js...
call pnpm build
if %errorlevel% neq 0 (
    echo [ERROR] Next.js build failed.
    pause
    exit /b 1
)
echo [OK] Build complete.
echo.

REM ── Step 3: Create zip ──
echo [3/4] Creating OTA bundle zip...
if exist "ota-bundle-%VERSION%.zip" del "ota-bundle-%VERSION%.zip"
powershell -Command "Compress-Archive -Path 'out\*' -DestinationPath 'ota-bundle-%VERSION%.zip' -Force"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create zip bundle.
    pause
    exit /b 1
)
echo [OK] Bundle created: ota-bundle-%VERSION%.zip
echo.

REM ── Step 4: Upload to Supabase Storage ──
echo [4/4] Uploading to Supabase Storage...

REM Upload bundle zip
echo   Uploading bundle...
curl -s -f -X POST "!SUPABASE_URL!/storage/v1/object/ota-updates/bundles/bundle-%VERSION%.zip" ^
  -H "Authorization: Bearer !SUPABASE_SERVICE_ROLE_KEY!" ^
  -H "Content-Type: application/zip" ^
  --data-binary @"ota-bundle-%VERSION%.zip" >nul 2>&1

if %errorlevel% neq 0 (
    echo   Bundle already exists, updating...
    curl -s -f -X PUT "!SUPABASE_URL!/storage/v1/object/ota-updates/bundles/bundle-%VERSION%.zip" ^
      -H "Authorization: Bearer !SUPABASE_SERVICE_ROLE_KEY!" ^
      -H "Content-Type: application/zip" ^
      --data-binary @"ota-bundle-%VERSION%.zip" >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to upload bundle.
        pause
        exit /b 1
    )
)
echo   [OK] Bundle uploaded.

REM Update manifest
echo   Updating manifest...
curl -s -f -X PUT "!SUPABASE_URL!/storage/v1/object/ota-updates/ota-manifest.json" ^
  -H "Authorization: Bearer !SUPABASE_SERVICE_ROLE_KEY!" ^
  -H "Content-Type: application/json" ^
  -d "{\"version\":\"%VERSION%\",\"url\":\"!SUPABASE_URL!/storage/v1/object/public/ota-updates/bundles/bundle-%VERSION%.zip\"}" >nul 2>&1

if %errorlevel% neq 0 (
    echo [ERROR] Failed to update manifest.
    pause
    exit /b 1
)
echo   [OK] Manifest updated.
echo.

REM ── Verify ──
echo [Verify] Reading manifest...
curl -s "!SUPABASE_URL!/storage/v1/object/public/ota-updates/ota-manifest.json?t=%RANDOM%"
echo.
echo.

echo ========================================
echo   OTA v%VERSION% DEPLOYED SUCCESSFULLY
echo ========================================
echo.
echo Users will receive the update on next app launch.
echo.
pause
