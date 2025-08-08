# PowerShell script to apply database schema
# Run from project root: .\scripts\apply-schema.ps1

Write-Host "📦 Applying orchestration schema to PostgreSQL..." -ForegroundColor Cyan

# Check if container is running
$container = docker ps --filter "name=eligibility-poc-postgres-1" --format "{{.Names}}"
if (-not $container) {
    Write-Host "❌ PostgreSQL container is not running. Start it with: docker-compose up -d postgres" -ForegroundColor Red
    exit 1
}

# Apply the schema
try {
    Get-Content data\orchestration-schema.sql | docker exec -i eligibility-poc-postgres-1 psql -U postgres -d postgres
    
    Write-Host "✅ Schema applied successfully!" -ForegroundColor Green
    
    # Verify tables were created
    Write-Host "`n📋 Verifying tables..." -ForegroundColor Cyan
    docker exec eligibility-poc-postgres-1 psql -U postgres -d postgres -c "\dt orchestration_*"
    
    Write-Host "`n📊 Checking views..." -ForegroundColor Cyan
    docker exec eligibility-poc-postgres-1 psql -U postgres -d postgres -c "\dv"
    
} catch {
    Write-Host "❌ Failed to apply schema: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Database setup complete!" -ForegroundColor Green
