const fs = require('fs');
const path = require('path');

console.log("=== Docker Configuration Pre-Flight Check ===\n");

// Check if all required files exist
const requiredFiles = [
  'docker-compose.yml',
  'middleware/Dockerfile',
  'middleware/package.json',
  'middleware/tsconfig.json',
  'middleware/healthcheck.js',
  'data/Dockerfile',
  'data/package.json',
  'data/api-server.js'
];

let allFilesExist = true;

console.log("1. Checking required files...");
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`✓ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.log("\n❌ Some required files are missing. Please check the project structure.");
  process.exit(1);
}

console.log("\n2. Validating Docker Compose configuration...");
try {
  const dockerCompose = fs.readFileSync(path.join(__dirname, 'docker-compose.yml'), 'utf8');
  
  // Basic validation
  const requiredServices = ['camunda', 'postgres', 'middleware', 'data-api'];
  const missingServices = [];
  
  for (const service of requiredServices) {
    if (!dockerCompose.includes(`${service}:`)) {
      missingServices.push(service);
    }
  }
  
  if (missingServices.length > 0) {
    console.log(`❌ Missing services in docker-compose.yml: ${missingServices.join(', ')}`);
    process.exit(1);
  }
  
  console.log("✓ All required services found in docker-compose.yml");
  
  // Check for common configuration issues
  if (!dockerCompose.includes('networks:')) {
    console.log("⚠️  Warning: No custom networks defined");
  } else {
    console.log("✓ Custom networks defined");
  }
  
  if (!dockerCompose.includes('volumes:')) {
    console.log("⚠️  Warning: No named volumes defined");
  } else {
    console.log("✓ Named volumes defined");
  }
  
} catch (error) {
  console.log(`❌ Error reading docker-compose.yml: ${error.message}`);
  process.exit(1);
}

console.log("\n3. Validating middleware configuration...");
try {
  const middlewarePackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'middleware/package.json'), 'utf8'));
  
  // Check required scripts
  const requiredScripts = ['start', 'build'];
  for (const script of requiredScripts) {
    if (!middlewarePackage.scripts || !middlewarePackage.scripts[script]) {
      console.log(`❌ Missing script '${script}' in middleware package.json`);
      process.exit(1);
    }
  }
  console.log("✓ Required scripts found in middleware package.json");
  
  // Check TypeScript config
  const tsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'middleware/tsconfig.json'), 'utf8'));
  if (!tsConfig.compilerOptions || !tsConfig.compilerOptions.outDir) {
    console.log("❌ Invalid TypeScript configuration");
    process.exit(1);
  }
  console.log("✓ TypeScript configuration is valid");
  
} catch (error) {
  console.log(`❌ Error validating middleware configuration: ${error.message}`);
  process.exit(1);
}

console.log("\n4. Validating data API configuration...");
try {
  const dataPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/package.json'), 'utf8'));
  
  if (!dataPackage.scripts || !dataPackage.scripts.start) {
    console.log("❌ Missing 'start' script in data package.json");
    process.exit(1);
  }
  console.log("✓ Data API package.json is valid");
  
  // Check if main entry file exists
  const mainFile = dataPackage.main || 'api-server.js';
  if (!fs.existsSync(path.join(__dirname, 'data', mainFile))) {
    console.log(`❌ Main entry file '${mainFile}' not found in data directory`);
    process.exit(1);
  }
  console.log(`✓ Main entry file '${mainFile}' found`);
  
} catch (error) {
  console.log(`❌ Error validating data API configuration: ${error.message}`);
  process.exit(1);
}

console.log("\n5. Checking middleware source files...");
const middlewareSrcPath = path.join(__dirname, 'middleware/src');
if (!fs.existsSync(middlewareSrcPath)) {
  console.log("❌ Middleware src directory not found");
  process.exit(1);
}

const requiredMiddlewareFiles = ['index.ts', 'app.ts'];
for (const file of requiredMiddlewareFiles) {
  const filePath = path.join(middlewareSrcPath, file);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Required middleware file '${file}' not found`);
    process.exit(1);
  }
}
console.log("✓ Required middleware source files found");

console.log("\n✅ Pre-flight check completed successfully!");
console.log("\nNext steps:");
console.log("1. Run 'docker-compose build' to build the images");
console.log("2. Run 'docker-compose up -d' to start the services");
console.log("3. Check service status with 'docker-compose ps'");
console.log("4. Test endpoints with health checks");

console.log("\nService endpoints after startup:");
console.log("- Camunda: http://localhost:8080");
console.log("- Middleware: http://localhost:3000");
console.log("- Data API: http://localhost:3001");
console.log("- PostgreSQL: localhost:5432");
