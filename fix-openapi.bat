@echo off
echo Fixing OpenAPI dynamic URL issue...
echo.

echo 1. Building middleware TypeScript...
cd middleware
call npm run build
if %errorlevel% neq 0 (
    echo Failed to build middleware
    pause
    exit /b 1
)

echo.
echo 2. Starting Data API server on port 3000...
cd ..\data
start "Data API" cmd /k "npm start"

echo.
echo 3. Starting Middleware server on port 3000...
cd ..\middleware  
start "Middleware" cmd /k "npm start"

echo.
echo ✅ Both servers should be starting!
echo ✅ Data API: http://localhost:3001 (if you want to test it separately)
echo ✅ Middleware: http://localhost:3000 (main server with dynamic OpenAPI)
echo.
echo Test the fix:
echo curl http://localhost:3000/openapi.json
echo.
echo Then test with ngrok:
echo ngrok http 3000
echo curl https://your-ngrok-url.ngrok-free.app/openapi.json
echo.
pause
