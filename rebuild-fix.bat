@echo off
echo 🔧 Rebuilding middleware with dynamic OpenAPI fix...
echo.

cd middleware

echo 1. Cleaning old build...
if exist dist rmdir /s /q dist

echo.
echo 2. Installing dependencies...
call npm install

echo.
echo 3. Building TypeScript...
call npm run build

if %errorlevel% equ 0 (
    echo ✅ TypeScript build successful!
    echo.
    
    echo 4. Rebuilding Docker container...
    cd ..
    call docker-compose down
    call docker-compose build --no-cache middleware
    call docker-compose up -d
    
    echo.
    echo ✅ All done! Testing the fix...
    timeout /t 5 /nobreak > nul
    
    echo.
    echo Local test:
    curl -s http://localhost:3000/openapi.json | findstr "servers"
    
    echo.
    echo 🎯 Now test with your ngrok URL!
    echo curl https://your-ngrok-url.ngrok-free.app/openapi.json
    echo.
) else (
    echo ❌ TypeScript build failed!
    pause
    exit /b 1
)

echo.
echo Press any key to exit...
pause > nul
