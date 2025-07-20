#!/bin/bash
echo "🔧 Rebuilding middleware with dynamic OpenAPI fix..."

cd middleware

echo "1. Cleaning old build..."
rm -rf dist/*

echo "2. Installing dependencies..."
npm install

echo "3. Building TypeScript..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ TypeScript build successful!"
    
    echo "4. Rebuilding Docker container..."
    cd ..
    docker-compose down
    docker-compose build --no-cache middleware
    docker-compose up -d
    
    echo "✅ All done! Testing the fix..."
    sleep 5
    
    echo "Local test:"
    curl -s http://localhost:3000/openapi.json | grep -A2 '"servers"'
    
    echo ""
    echo "🎯 Now test with your ngrok URL!"
    echo "curl https://your-ngrok-url.ngrok-free.app/openapi.json | grep -A2 '\"servers\"'"
else
    echo "❌ TypeScript build failed!"
    exit 1
fi
