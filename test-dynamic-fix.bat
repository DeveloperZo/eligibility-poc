@echo off
echo 🧪 Testing Dynamic OpenAPI Fix
echo ==============================
echo.

echo Step 1: Rebuilding Docker containers...
docker-compose down
docker-compose build --no-cache middleware
docker-compose up -d

echo.
echo Step 2: Waiting for services to start...
timeout /t 10 /nobreak > nul

echo.
echo Step 3: Testing local endpoint...
echo URL: http://localhost:3000/openapi.json
echo.
curl -s "http://localhost:3000/openapi.json" > local_test.json
if %errorlevel% equ 0 (
    echo ✅ Local endpoint accessible
    type local_test.json | findstr /C:"servers" /A:2
    echo.
    powershell -Command "Get-Content local_test.json | ConvertFrom-Json | ForEach-Object { $_.servers[0] }"
) else (
    echo ❌ Local endpoint failed
)

echo.
echo Step 4: Testing ngrok endpoint...
echo URL: https://20f445bf2d03.ngrok-free.app/openapi.json
echo.
curl -s "https://20f445bf2d03.ngrok-free.app/openapi.json" > ngrok_test.json
if %errorlevel% equ 0 (
    echo ✅ Ngrok endpoint accessible
    type ngrok_test.json | findstr /C:"servers" /A:2
    echo.
    powershell -Command "Get-Content ngrok_test.json | ConvertFrom-Json | ForEach-Object { $_.servers[0] }"
) else (
    echo ❌ Ngrok endpoint failed
)

echo.
echo Step 5: Comparison...
echo.
echo LOCAL RESULT:
powershell -Command "if (Test-Path local_test.json) { (Get-Content local_test.json | ConvertFrom-Json).servers[0].url } else { 'File not found' }"

echo.
echo NGROK RESULT:
powershell -Command "if (Test-Path ngrok_test.json) { (Get-Content ngrok_test.json | ConvertFrom-Json).servers[0].url } else { 'File not found' }"

echo.
echo ==============================
echo 🎯 EXPECTED RESULTS:
echo - Local should show: http://localhost:3000
echo - Ngrok should show: https://20f445bf2d03.ngrok-free.app
echo.
echo If both show correct URLs:
echo ✅ SUCCESS! Import this URL to Retool:
echo    https://20f445bf2d03.ngrok-free.app/openapi.json
echo.

echo Cleaning up test files...
del local_test.json 2>nul
del ngrok_test.json 2>nul

echo.
echo Press any key to exit...
pause > nul
