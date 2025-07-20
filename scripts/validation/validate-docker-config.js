const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log("=== Docker Configuration Validation ===\n");

function validateDockerCompose() {
  console.log("1. Validating docker-compose.yml structure...");
  
  try {
    const dockerComposeContent = fs.readFileSync(path.join(__dirname, 'docker-compose.yml'), 'utf8');
    const dockerCompose = yaml.load(dockerComposeContent);
    
    // Check version
    if (!dockerCompose.version) {
      throw new Error("Missing 'version' field in docker-compose.yml");
    }
    console.log(`✓ Docker Compose version: ${dockerCompose.version}`);
    
    // Check services
    if (!dockerCompose.services) {
      throw new Error("Missing 'services' section in docker-compose.yml");
    }
    
    const requiredServices = ['camunda', 'postgres', 'middleware', 'data-api'];
    const definedServices = Object.keys(dockerCompose.services);
    
    console.log(`✓ Defined services: ${definedServices.join(', ')}`);
    
    for (const service of requiredServices) {
      if (!dockerCompose.services[service]) {
        throw new Error(`Missing required service: ${service}`);
      }
      console.log(`✓ Service '${service}' is defined`);
    }
    
    // Validate specific service configurations
    validateCamundaService(dockerCompose.services.camunda);
    validatePostgresService(dockerCompose.services.postgres);
    validateMiddlewareService(dockerCompose.services.middleware);
    validateDataApiService(dockerCompose.services['data-api']);
    
    // Check networks
    if (dockerCompose.networks) {
      console.log(`✓ Networks defined: ${Object.keys(dockerCompose.networks).join(', ')}`);
    }
    
    // Check volumes
    if (dockerCompose.volumes) {
      console.log(`✓ Volumes defined: ${Object.keys(dockerCompose.volumes).join(', ')}`);
    }
    
    console.log("✅ Docker Compose configuration is valid\n");
    
  } catch (error) {
    console.log(`❌ Docker Compose validation failed: ${error.message}`);
    return false;
  }
  
  return true;
}

function validateCamundaService(service) {
  console.log("  Validating Camunda service...");
  
  if (!service.image) {
    throw new Error("Camunda service missing 'image' field");
  }
  
  if (!service.ports || !service.ports.includes("8080:8080")) {
    throw new Error("Camunda service missing port 8080 mapping");
  }
  
  if (!service.environment) {
    throw new Error("Camunda service missing environment variables");
  }
  
  const requiredEnvVars = ['DB_DRIVER', 'DB_URL', 'DB_USERNAME', 'DB_PASSWORD'];
  for (const envVar of requiredEnvVars) {
    const hasVar = service.environment.some(env => env.startsWith(`${envVar}=`));
    if (!hasVar) {
      throw new Error(`Camunda service missing environment variable: ${envVar}`);
    }
  }
  
  console.log("  ✓ Camunda service configuration is valid");
}

function validatePostgresService(service) {
  console.log("  Validating PostgreSQL service...");
  
  if (!service.image) {
    throw new Error("PostgreSQL service missing 'image' field");
  }
  
  if (!service.environment) {
    throw new Error("PostgreSQL service missing environment variables");
  }
  
  const requiredEnvVars = ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
  for (const envVar of requiredEnvVars) {
    const hasVar = service.environment.some(env => env.startsWith(`${envVar}=`));
    if (!hasVar) {
      throw new Error(`PostgreSQL service missing environment variable: ${envVar}`);
    }
  }
  
  console.log("  ✓ PostgreSQL service configuration is valid");
}

function validateMiddlewareService(service) {
  console.log("  Validating Middleware service...");
  
  if (!service.build) {
    throw new Error("Middleware service missing 'build' configuration");
  }
  
  if (!service.build.context || service.build.context !== './middleware') {
    throw new Error("Middleware service build context should be './middleware'");
  }
  
  if (!service.ports || !service.ports.includes("3000:3000")) {
    throw new Error("Middleware service missing port 3000 mapping");
  }
  
  if (!service.environment) {
    throw new Error("Middleware service missing environment variables");
  }
  
  console.log("  ✓ Middleware service configuration is valid");
}

function validateDataApiService(service) {
  console.log("  Validating Data API service...");
  
  if (!service.build) {
    throw new Error("Data API service missing 'build' configuration");
  }
  
  if (!service.build.context || service.build.context !== './data') {
    throw new Error("Data API service build context should be './data'");
  }
  
  if (!service.ports || !service.ports.includes("3001:3001")) {
    throw new Error("Data API service missing port 3001 mapping");
  }
  
  console.log("  ✓ Data API service configuration is valid");
}

function validateDockerfiles() {
  console.log("2. Validating Dockerfiles...");
  
  // Validate middleware Dockerfile
  console.log("  Checking middleware Dockerfile...");
  const middlewareDockerfile = fs.readFileSync(path.join(__dirname, 'middleware/Dockerfile'), 'utf8');
  
  if (!middlewareDockerfile.includes('FROM node:')) {
    throw new Error("Middleware Dockerfile should use Node.js base image");
  }
  
  if (!middlewareDockerfile.includes('npm run build')) {
    throw new Error("Middleware Dockerfile should build TypeScript");
  }
  
  if (!middlewareDockerfile.includes('HEALTHCHECK')) {
    throw new Error("Middleware Dockerfile should include health check");
  }
  
  console.log("  ✓ Middleware Dockerfile is valid");
  
  // Validate data API Dockerfile
  console.log("  Checking data API Dockerfile...");
  const dataDockerfile = fs.readFileSync(path.join(__dirname, 'data/Dockerfile'), 'utf8');
  
  if (!dataDockerfile.includes('FROM node:')) {
    throw new Error("Data API Dockerfile should use Node.js base image");
  }
  
  if (!dataDockerfile.includes('HEALTHCHECK')) {
    throw new Error("Data API Dockerfile should include health check");
  }
  
  console.log("  ✓ Data API Dockerfile is valid");
  console.log("✅ All Dockerfiles are valid\n");
}

function validateServiceDependencies() {
  console.log("3. Validating service dependencies...");
  
  // Check package.json files
  const middlewarePackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'middleware/package.json'), 'utf8'));
  const dataPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/package.json'), 'utf8'));
  
  // Validate middleware dependencies
  console.log("  Checking middleware dependencies...");
  const requiredMiddlewareDeps = ['express', 'typescript'];
  for (const dep of requiredMiddlewareDeps) {
    if (!middlewarePackage.dependencies || !middlewarePackage.devDependencies || 
        (!middlewarePackage.dependencies[dep] && !middlewarePackage.devDependencies[dep])) {
      throw new Error(`Middleware missing required dependency: ${dep}`);
    }
  }
  console.log("  ✓ Middleware dependencies are valid");
  
  // Validate data API dependencies
  console.log("  Checking data API dependencies...");
  if (!dataPackage.dependencies || !dataPackage.dependencies.express) {
    throw new Error("Data API missing required dependency: express");
  }
  console.log("  ✓ Data API dependencies are valid");
  
  console.log("✅ All service dependencies are valid\n");
}

function validateNetworkConfiguration() {
  console.log("4. Validating network configuration...");
  
  const dockerComposeContent = fs.readFileSync(path.join(__dirname, 'docker-compose.yml'), 'utf8');
  const dockerCompose = yaml.load(dockerComposeContent);
  
  // Check if all services are on the same network
  const networkName = 'camunda-network';
  
  for (const [serviceName, serviceConfig] of Object.entries(dockerCompose.services)) {
    if (!serviceConfig.networks || !serviceConfig.networks.includes(networkName)) {
      throw new Error(`Service '${serviceName}' not connected to '${networkName}' network`);
    }
  }
  
  console.log(`✓ All services connected to '${networkName}' network`);
  console.log("✅ Network configuration is valid\n");
}

function generateDockerCommands() {
  console.log("5. Generated Docker commands for testing:");
  console.log("   # Clean up any existing containers");
  console.log("   docker-compose down --volumes --remove-orphans");
  console.log("");
  console.log("   # Build all images");
  console.log("   docker-compose build --no-cache");
  console.log("");
  console.log("   # Start all services");
  console.log("   docker-compose up -d");
  console.log("");
  console.log("   # Check service status");
  console.log("   docker-compose ps");
  console.log("");
  console.log("   # View logs");
  console.log("   docker-compose logs middleware");
  console.log("   docker-compose logs data-api");
  console.log("   docker-compose logs camunda");
  console.log("");
  console.log("   # Test health endpoints");
  console.log("   curl http://localhost:3000/health");
  console.log("   curl http://localhost:3001/health");
  console.log("   curl http://localhost:8080/engine-rest/engine");
  console.log("");
}

// Main validation function
async function main() {
  try {
    const isValid = validateDockerCompose();
    if (!isValid) {
      process.exit(1);
    }
    
    validateDockerfiles();
    validateServiceDependencies();
    validateNetworkConfiguration();
    
    console.log("🎉 All Docker configuration validations passed!");
    console.log("🐳 The multi-service orchestration is properly configured.\n");
    
    generateDockerCommands();
    
  } catch (error) {
    console.log(`❌ Validation failed: ${error.message}`);
    process.exit(1);
  }
}

// Add js-yaml as a mock since we can't install it in this environment
const yaml = {
  load: (content) => {
    // Simple YAML parsing for docker-compose format
    // This is a simplified parser for validation purposes
    try {
      // Convert YAML to JSON-like structure
      const lines = content.split('\n');
      const result = {};
      let currentSection = null;
      let currentService = null;
      let indent = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const currentIndent = line.length - line.trimLeft().length;
        
        if (trimmed.includes('version:')) {
          result.version = trimmed.split(':')[1].trim().replace(/['"]/g, '');
        } else if (trimmed === 'services:') {
          result.services = {};
          currentSection = 'services';
        } else if (trimmed === 'networks:') {
          result.networks = {};
          currentSection = 'networks';
        } else if (trimmed === 'volumes:') {
          result.volumes = {};
          currentSection = 'volumes';
        } else if (currentSection === 'services' && currentIndent === 2 && trimmed.endsWith(':')) {
          currentService = trimmed.slice(0, -1);
          result.services[currentService] = {};
        } else if (currentService && trimmed.includes(':')) {
          const [key, value] = trimmed.split(':');
          const cleanKey = key.trim();
          const cleanValue = value ? value.trim() : '';
          
          if (cleanKey === 'environment') {
            result.services[currentService].environment = [];
          } else if (cleanKey === 'ports') {
            result.services[currentService].ports = [];
          } else if (cleanKey === 'networks') {
            result.services[currentService].networks = [];
          } else if (cleanValue.startsWith('-')) {
            // Handle arrays
            if (cleanKey === 'environment' || cleanKey === 'ports' || cleanKey === 'networks') {
              if (!result.services[currentService][cleanKey]) {
                result.services[currentService][cleanKey] = [];
              }
            }
          } else if (cleanValue) {
            result.services[currentService][cleanKey] = cleanValue.replace(/['"]/g, '');
          } else {
            // Handle nested objects like build
            result.services[currentService][cleanKey] = {};
          }
        } else if (currentService && trimmed.startsWith('- ')) {
          const value = trimmed.slice(2).trim().replace(/['"]/g, '');
          // Find the parent key
          const prevLines = lines.slice(0, lines.indexOf(line));
          for (let i = prevLines.length - 1; i >= 0; i--) {
            const prevLine = prevLines[i];
            const prevTrimmed = prevLine.trim();
            const prevIndent = prevLine.length - prevLine.trimLeft().length;
            
            if (prevIndent < currentIndent && prevTrimmed.endsWith(':')) {
              const parentKey = prevTrimmed.slice(0, -1);
              if (!result.services[currentService][parentKey]) {
                result.services[currentService][parentKey] = [];
              }
              result.services[currentService][parentKey].push(value);
              break;
            }
          }
        } else if (currentService && currentIndent > 2 && trimmed.includes(':')) {
          // Handle nested properties like build.context
          const [key, value] = trimmed.split(':');
          const cleanKey = key.trim();
          const cleanValue = value ? value.trim().replace(/['"]/g, '') : '';
          
          // Find the parent key
          const prevLines = lines.slice(0, lines.indexOf(line));
          for (let i = prevLines.length - 1; i >= 0; i--) {
            const prevLine = prevLines[i];
            const prevTrimmed = prevLine.trim();
            const prevIndent = prevLine.length - prevLine.trimLeft().length;
            
            if (prevIndent < currentIndent && prevTrimmed.endsWith(':') && !prevTrimmed.startsWith('-')) {
              const parentKey = prevTrimmed.slice(0, -1);
              if (!result.services[currentService][parentKey]) {
                result.services[currentService][parentKey] = {};
              }
              result.services[currentService][parentKey][cleanKey] = cleanValue;
              break;
            }
          }
        }
      }
      
      return result;
    } catch (error) {
      throw new Error('Failed to parse YAML: ' + error.message);
    }
  }
};

main();
