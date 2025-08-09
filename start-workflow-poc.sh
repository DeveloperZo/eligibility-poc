#!/bin/bash

echo "🚀 Starting Governed Workflow POC..."
echo "=================================="
echo ""

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start all services
echo "🏗️ Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo ""
echo "✅ Checking service status..."
echo ""

# Check Camunda
if curl -s http://localhost:8080/camunda > /dev/null; then
    echo "✅ Camunda is running at http://localhost:8080/camunda"
    echo "   Login: demo/demo"
else
    echo "❌ Camunda is not responding"
fi

# Check Middleware
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Middleware API is running at http://localhost:3000"
else
    echo "⚠️  Middleware API is starting..."
fi

# Check Data API
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Data API is running at http://localhost:3001"
else
    echo "⚠️  Data API is starting..."
fi

# Check PostgreSQL
if docker exec camunda-postgres pg_isready > /dev/null 2>&1; then
    echo "✅ PostgreSQL is running on port 5432"
else
    echo "❌ PostgreSQL is not responding"
fi

# Check Retool
echo "⏳ Waiting for Retool to start (this takes a moment)..."
sleep 20

if curl -s http://localhost:3100 > /dev/null 2>&1; then
    echo "✅ Retool is running at http://localhost:3100"
    echo "   Create your admin account on first visit"
else
    echo "⚠️  Retool is still starting, visit http://localhost:3100 in a minute"
fi

echo ""
echo "=================================="
echo "🎉 POC Environment Ready!"
echo ""
echo "Access points:"
echo "  • Retool: http://localhost:3100"
echo "  • Camunda: http://localhost:8080/camunda (demo/demo)"
echo "  • API: http://localhost:3000/api"
echo ""
echo "Next steps:"
echo "  1. Visit http://localhost:3100 to set up Retool"
echo "  2. Create admin account"
echo "  3. Add REST API resource pointing to: http://host.docker.internal:3000/api"
echo "  4. Import the Retool app configuration"
echo ""
echo "To see logs: docker-compose logs -f"
echo "To stop: docker-compose down"
