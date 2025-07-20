#!/bin/bash

# Dependency Installation Script
echo "🚀 Installing dependencies across all services..."

# Function to run npm install and check result
install_deps() {
    local service_name=$1
    local service_path=$2
    
    echo ""
    echo "=============================================="
    echo "Installing dependencies for $service_name"
    echo "=============================================="
    
    cd "$service_path" || exit 1
    
    if npm install; then
        echo "✅ $service_name dependencies installed successfully"
        
        # Run npm audit
        echo "Running npm audit for $service_name..."
        if npm audit --audit-level=moderate; then
            echo "✅ $service_name audit passed"
        else
            echo "⚠️  $service_name has some vulnerabilities"
        fi
    else
        echo "❌ Failed to install $service_name dependencies"
        exit 1
    fi
    
    cd - > /dev/null
}

# Install root dependencies
echo "Installing root dependencies..."
if npm install; then
    echo "✅ Root dependencies installed"
else
    echo "❌ Failed to install root dependencies"
    exit 1
fi

# Install middleware dependencies
install_deps "Middleware" "./middleware"

# Install data API dependencies  
install_deps "Data API" "./data"

# Install test dependencies
install_deps "Tests" "./tests"

echo ""
echo "🎉 All dependencies installed successfully!"
echo ""
echo "Verifying installations..."

# Check if all node_modules directories exist
for dir in "." "./middleware" "./data" "./tests"; do
    if [ -d "$dir/node_modules" ]; then
        echo "✅ $dir/node_modules exists"
    else
        echo "❌ $dir/node_modules missing"
    fi
done

echo ""
echo "✨ Dependency installation complete!"
