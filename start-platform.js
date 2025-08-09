#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkService(name, url, expectedStatus = 200) {
  try {
    const response = await fetch(url);
    if (response.status === expectedStatus || response.ok) {
      log(`✅ ${name} is running at ${url}`, colors.green);
      return true;
    }
  } catch (error) {
    // Service not ready yet
  }
  return false;
}

async function waitForService(name, url, maxAttempts = 30, delay = 2000) {
  log(`⏳ Waiting for ${name}...`, colors.yellow);
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkService(name, url)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  log(`⚠️  ${name} is taking longer than expected to start`, colors.yellow);
  return false;
}

async function main() {
  log('\n🚀 Starting Governed Workflow Platform', colors.bright + colors.cyan);
  log('=====================================\n', colors.cyan);

  try {
    // Stop existing containers
    log('🛑 Stopping existing containers...', colors.yellow);
    await execAsync('docker-compose down');
    
    // Start all services
    log('🏗️  Starting all services...', colors.yellow);
    await execAsync('docker-compose up -d');
    
    log('\n⏳ Waiting for services to initialize...\n', colors.yellow);
    
    // Wait a bit for containers to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check each service
    const services = [
      { name: 'PostgreSQL (Workflow)', check: async () => {
        const { stdout } = await execAsync('docker exec workflow-postgres pg_isready');
        if (stdout.includes('accepting connections')) {
          log('✅ PostgreSQL (Workflow) is running on port 5432', colors.green);
          return true;
        }
        return false;
      }},
      { name: 'PostgreSQL (Retool)', check: async () => {
        const { stdout } = await execAsync('docker exec retool-postgres pg_isready');
        if (stdout.includes('accepting connections')) {
          log('✅ PostgreSQL (Retool) is running', colors.green);
          return true;
        }
        return false;
      }},
      { name: 'Camunda', url: 'http://localhost:8080/camunda' },
      { name: 'Middleware API', url: 'http://localhost:3000/health' },
      { name: 'Data API', url: 'http://localhost:3001/health' },
      { name: 'Retool', url: 'http://localhost:3333' }
    ];
    
    // Check database services first
    for (const service of services.filter(s => s.check)) {
      try {
        await service.check();
      } catch (error) {
        log(`⚠️  ${service.name} is not ready yet`, colors.yellow);
      }
    }
    
    // Check HTTP services
    for (const service of services.filter(s => s.url)) {
      await waitForService(service.name, service.url);
    }
    
    // Success message
    log('\n=====================================', colors.cyan);
    log('🎉 Platform is Ready!', colors.bright + colors.green);
    log('=====================================\n', colors.cyan);
    
    log('Access points:', colors.bright);
    log('  📊 Retool:    http://localhost:3333', colors.cyan);
    log('  🔄 Camunda:   http://localhost:8080/camunda (demo/demo)', colors.cyan);
    log('  🔌 API:       http://localhost:3000', colors.cyan);
    log('  📦 Data API:  http://localhost:3001', colors.cyan);
    
    log('\nNext steps:', colors.bright);
    log('  1. Visit http://localhost:3333 to set up Retool admin account');
    log('  2. In Retool, create a REST API resource:');
    log('     • Base URL: http://host.docker.internal:3000');
    log('  3. Import the Retool app from the /retool directory');
    
    log('\n📝 License Info:', colors.bright);
    log('  • Using Retool free self-hosted tier (up to 5 users)');
    log('  • No license key required for POC/development');
    log('  • For production with >5 users, visit: retool.com/pricing');
    
    log('\nUseful commands:', colors.bright);
    log('  • View logs:  docker-compose logs -f [service]');
    log('  • Stop all:   docker-compose down');
    log('  • Restart:    docker-compose restart [service]');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    log('\nTroubleshooting:', colors.yellow);
    log('  1. Make sure Docker is running');
    log('  2. Check for port conflicts (3000, 3001, 3333, 5432, 8080)');
    log('  3. Try: docker-compose down -v && docker-compose up -d');
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});
