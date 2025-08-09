#!/usr/bin/env node

/**
 * Complete setup script for the stateless orchestration system
 * OS-agnostic - works on Windows, Mac, and Linux
 * Uses 3-database architecture: Retool, Camunda, Aidbox
 * Run: node scripts/setup-orchestration.js
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, options = {}) {
  try {
    log(`  Running: ${command}`, 'yellow');
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result;
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

async function checkPrerequisites() {
  log('\n🔍 Checking prerequisites...', 'cyan');
  
  const checks = [
    {
      name: 'Docker',
      command: 'docker --version',
      error: 'Docker is not installed. Please install Docker Desktop.'
    },
    {
      name: 'Docker Compose',
      command: 'docker compose version || docker-compose --version',
      error: 'Docker Compose is not installed.'
    },
    {
      name: 'Node.js',
      command: 'node --version',
      error: 'Node.js is not installed.'
    },
    {
      name: 'npm',
      command: 'npm --version',
      error: 'npm is not installed.'
    }
  ];

  for (const check of checks) {
    try {
      const version = runCommand(check.command, { silent: true });
      log(`  ✅ ${check.name}: ${version.trim()}`, 'green');
    } catch (error) {
      log(`  ❌ ${check.name}: ${check.error}`, 'red');
      return false;
    }
  }
  
  return true;
}

async function startDocker() {
  log('\n🐳 Starting Docker services...', 'cyan');
  
  // Check if services are already running
  const running = runCommand('docker ps --format "{{.Names}}"', { silent: true });
  
  if (running.includes('eligibility-poc-postgres-1') && 
      running.includes('eligibility-poc-camunda-1')) {
    log('  ✅ Services already running', 'green');
    return true;
  }
  
  // Start services (try both docker compose v2 and docker-compose v1)
  log('  Starting PostgreSQL and Camunda...', 'yellow');
  try {
    runCommand('docker compose up -d postgres camunda');
  } catch (error) {
    log('  Trying docker-compose v1 syntax...', 'yellow');
    runCommand('docker-compose up -d postgres camunda');
  }
  
  // Wait for services to be ready
  log('  Waiting for services to be ready...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
  
  return true;
}

async function applyDatabaseSchema() {
  log('\n💾 Applying database schema...', 'cyan');
  
  const schemaPath = path.join(__dirname, '..', 'data', 'orchestration-schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    log(`  ❌ Schema file not found: ${schemaPath}`, 'red');
    return false;
  }
  
  try {
    // Use the apply-schema script
    runCommand('node scripts/apply-schema.js');
    return true;
  } catch (error) {
    log('  ❌ Failed to apply schema', 'red');
    return false;
  }
}

async function buildMiddleware() {
  log('\n🔨 Building middleware...', 'cyan');
  
  const middlewarePath = path.join(__dirname, '..', 'middleware');
  
  if (!fs.existsSync(middlewarePath)) {
    log('  ❌ Middleware directory not found', 'red');
    return false;
  }
  
  try {
    // Install dependencies if needed
    const nodeModules = path.join(middlewarePath, 'node_modules');
    if (!fs.existsSync(nodeModules)) {
      log('  Installing dependencies...', 'yellow');
      runCommand('npm install', { cwd: middlewarePath });
    }
    
    // Build TypeScript
    log('  Compiling TypeScript...', 'yellow');
    runCommand('npm run build', { cwd: middlewarePath });
    
    log('  ✅ Middleware built successfully', 'green');
    return true;
  } catch (error) {
    log('  ❌ Failed to build middleware', 'red');
    console.error(error.message);
    return false;
  }
}

async function startServices() {
  log('\n🚀 Starting services...', 'cyan');
  
  // Start data API
  log('  Starting Data API service...', 'yellow');
  try {
    runCommand('docker compose up -d data-api');
  } catch (error) {
    runCommand('docker-compose up -d data-api');
  }
  
  log('  ✅ All Docker services started', 'green');
  return true;
}

async function runHealthChecks() {
  log('\n❤️  Running health checks...', 'cyan');
  
  // Wait a moment for services to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const services = [
    { name: 'PostgreSQL', url: 'http://localhost:5432', command: 'docker exec eligibility-poc-postgres-1 pg_isready -U postgres' },
    { name: 'Camunda', url: 'http://localhost:8080/camunda', check: 'http' },
    { name: 'Data API', url: 'http://localhost:3001/health', check: 'http' }
  ];
  
  for (const service of services) {
    try {
      if (service.command) {
        runCommand(service.command, { silent: true });
        log(`  ✅ ${service.name}: Healthy`, 'green');
      } else if (service.check === 'http') {
        // For HTTP services, we'll just note the URL
        log(`  ℹ️  ${service.name}: ${service.url}`, 'cyan');
      }
    } catch (error) {
      log(`  ⚠️  ${service.name}: Not responding (may still be starting)`, 'yellow');
    }
  }
  
  return true;
}

async function showInstructions() {
  log('\n' + '='.repeat(60), 'magenta');
  log('🎉 Setup Complete!', 'green');
  log('='.repeat(60), 'magenta');
  
  log('\n📚 Quick Start Guide:', 'cyan');
  log('\n1. Start the middleware:', 'bright');
  log('   cd middleware');
  log('   npm start');
  
  log('\n2. Test the API:', 'bright');
  log('   node scripts/testing/test-orchestration-api.js');
  
  log('\n3. Access services:', 'bright');
  log('   • Camunda:    http://localhost:8080 (admin/admin)');
  log('   • Middleware: http://localhost:3000');
  log('   • Data API:   http://localhost:3001');
  log('   • API Docs:   http://localhost:3000/api-docs');
  
  log('\n4. View logs:', 'bright');
  log('   docker-compose logs -f [service-name]');
  
  log('\n5. Stop services:', 'bright');
  log('   docker-compose down');
  
  log('\n💡 Tips:', 'yellow');
  log('   • Check service health: http://localhost:3000/health');
  log('   • View orchestration API: http://localhost:3000/api/health');
  log('   • PostgreSQL is at localhost:5432 (postgres/postgres)');
  
  log('\n📖 Documentation:', 'cyan');
  log('   • Implementation Plan: docs/CRAWL_IMPLEMENTATION_PLAN.md');
  log('   • Architecture:        docs/ARCHITECTURE.md');
  log('   • Testing Guide:       docs/testing-guide.md');
  
  log('\n' + '='.repeat(60), 'magenta');
}

async function main() {
  log('\n🚀 Orchestration System Setup', 'magenta');
  log('='.repeat(60), 'magenta');
  
  try {
    // Check prerequisites
    if (!await checkPrerequisites()) {
      log('\n❌ Prerequisites check failed. Please install missing components.', 'red');
      process.exit(1);
    }
    
    // Start Docker services
    if (!await startDocker()) {
      log('\n❌ Failed to start Docker services', 'red');
      process.exit(1);
    }
    
    // Apply database schema
    if (!await applyDatabaseSchema()) {
      log('\n❌ Failed to apply database schema', 'red');
      process.exit(1);
    }
    
    // Build middleware
    if (!await buildMiddleware()) {
      log('\n❌ Failed to build middleware', 'red');
      process.exit(1);
    }
    
    // Start additional services
    if (!await startServices()) {
      log('\n❌ Failed to start services', 'red');
      process.exit(1);
    }
    
    // Run health checks
    await runHealthChecks();
    
    // Show instructions
    await showInstructions();
    
  } catch (error) {
    log('\n❌ Setup failed:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\n👋 Setup interrupted by user', 'yellow');
  process.exit(0);
});

// Run the setup
main();
