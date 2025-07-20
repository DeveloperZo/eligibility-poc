const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function validateDockerConfiguration() {
  console.log("=== Docker Configuration Validation ===\n");
  
  try {
    // 1. Check Docker availability
    console.log("1. Testing Docker availability...");
    const dockerVersion = await execAsync('docker --version');
    console.log("✓ Docker is available:", dockerVersion.stdout.trim());
    
    // 2. Check Docker daemon
    console.log("\n2. Testing Docker daemon...");
    const dockerInfo = await execAsync('docker info --format "{{.ServerVersion}}"');
    console.log("✓ Docker daemon is running, version:", dockerInfo.stdout.trim());
    
    // 3. Check Docker Compose
    console.log("\n3. Testing Docker Compose...");
    const composeVersion = await execAsync('docker-compose --version');
    console.log("✓ Docker Compose is available:", composeVersion.stdout.trim());
    
    // 4. Clean up any existing containers
    console.log("\n4. Cleaning up existing containers...");
    try {
      await execAsync('docker-compose down', { cwd: __dirname });
      console.log("✓ Cleaned up existing containers");
    } catch (err) {
      console.log("ℹ No existing containers to clean up");
    }
    
    // 5. Build Docker images
    console.log("\n5. Building Docker images...");
    const buildResult = await execAsync('docker-compose build', { 
      cwd: __dirname,
      timeout: 300000 // 5 minutes timeout
    });
    console.log("✓ Docker images built successfully");
    console.log("Build output:", buildResult.stdout);
    
    // 6. Start services
    console.log("\n6. Starting services...");
    const startResult = await execAsync('docker-compose up -d', { 
      cwd: __dirname,
      timeout: 120000 // 2 minutes timeout
    });
    console.log("✓ Services started successfully");
    console.log("Start output:", startResult.stdout);
    
    // 7. Wait for services to be ready
    console.log("\n7. Waiting for services to be ready...");
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    
    // 8. Check service status
    console.log("\n8. Checking service status...");
    const statusResult = await execAsync('docker-compose ps', { cwd: __dirname });
    console.log("Service status:");
    console.log(statusResult.stdout);
    
    // 9. Check container logs
    console.log("\n9. Checking middleware container logs...");
    try {
      const middlewareLogs = await execAsync('docker-compose logs middleware --tail=20', { cwd: __dirname });
      console.log("Middleware logs:");
      console.log(middlewareLogs.stdout);
    } catch (err) {
      console.log("❌ Error getting middleware logs:", err.message);
    }
    
    // 10. Test service endpoints
    console.log("\n10. Testing service endpoints...");
    
    // Test middleware health
    try {
      const middlewareHealth = await execAsync('curl -f http://localhost:3000/health', { timeout: 5000 });
      console.log("✓ Middleware health endpoint responding");
    } catch (err) {
      console.log("❌ Middleware health endpoint not responding:", err.message);
    }
    
    // Test data API health
    try {
      const dataApiHealth = await execAsync('curl -f http://localhost:3001/health', { timeout: 5000 });
      console.log("✓ Data API health endpoint responding");
    } catch (err) {
      console.log("❌ Data API health endpoint not responding:", err.message);
    }
    
    // Test Camunda
    try {
      const camundaHealth = await execAsync('curl -f http://localhost:8080/engine-rest/engine', { timeout: 10000 });
      console.log("✓ Camunda engine responding");
    } catch (err) {
      console.log("❌ Camunda engine not responding:", err.message);
    }
    
    console.log("\n=== Docker Validation Complete ===");
    
  } catch (error) {
    console.error("❌ Docker validation failed:", error.message);
    console.error("Full error:", error);
    
    // Try to get more info about the failure
    try {
      const logs = await execAsync('docker-compose logs', { cwd: __dirname });
      console.log("\nContainer logs:");
      console.log(logs.stdout);
    } catch (logError) {
      console.log("Could not retrieve container logs");
    }
    
    process.exit(1);
  }
}

// Run the validation
validateDockerConfiguration().catch(console.error);
