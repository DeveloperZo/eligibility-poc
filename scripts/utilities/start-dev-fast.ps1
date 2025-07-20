# PowerShell Development Environment Script
# Fast development startup with hot reload

Write-Host "🚀 Starting Eligibility Rule Management - Development Environment" -ForegroundColor Green
Write-Host ""

# Change to project root
Set-Location $PSScriptRoot\..\..\

try {
    Write-Host "🔧 Starting development environment with hot reload..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Services starting:" -ForegroundColor Cyan
    Write-Host "  • PostgreSQL (port 5432)" -ForegroundColor White
    Write-Host "  • Camunda Platform (port 8080)" -ForegroundColor White
    Write-Host "  • Data API (port 4000)" -ForegroundColor White
    Write-Host "  • Middleware with Hot Reload (port 3000)" -ForegroundColor White
    Write-Host ""
    Write-Host "🔥 Hot reload enabled - changes will be reflected immediately!" -ForegroundColor Green
    Write-Host ""
    
    # Start development environment
    docker-compose -f docker-compose.dev.yml up --build
    
} catch {
    Write-Host "❌ Failed to start development environment: $_" -ForegroundColor Red
    exit 1
}

# Cleanup on exit
trap {
    Write-Host "`n🛑 Shutting down development environment..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml down
    Write-Host "✅ Development environment stopped" -ForegroundColor Green
}
