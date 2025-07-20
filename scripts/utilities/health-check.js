#!/usr/bin/env node

/**
 * Simple System Health Check and Test Execution
 * Checks if services are running and executes integration tests
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Service endpoints to check
const services = [
  { name: 'Middleware', url: 'http://localhost:3000/health' },
  { name: 'Data API', url: 'http://localhost:3001/health' },
  { name: 'Camunda', url: 'http://localhost:8080/engine-rest/engine' }
];

async function checkService(service) {
  return new Promise((resolve) => {
    const url = new URL(service.url);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(service.url, { timeout: 5000 }, (res) => {
      console.log(`✅ ${service.name}: HTTP ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (error) => {
      console.log(`❌ ${service.name}: ${error.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log(`❌ ${service.name}: Timeout`);
      req.destroy();
      resolve(false);
    });
  });
}

async function checkSystemHealth() {
  console.log('🏥 Checking system health...\n');
  
  let allHealthy = true;
  
  for (const service of services) {
    const healthy = await checkService(service);
    if (!healthy) {
      allHealthy = false;
    }
  }
  
  return allHealthy;
}

async function main() {
  console.log('🚀 Integration Test Suite Health Check');
  console.log('=====================================\n');
  
  const systemHealthy = await checkSystemHealth();
  
  console.log('\n📊 Health Check Results:');
  console.log('========================');
  
  if (systemHealthy) {
    console.log('✅ All services are healthy and ready for testing!');
    console.log('\n🧪 System is ready for integration tests.');
    console.log('\nNext steps:');
    console.log('1. Navigate to tests directory: cd tests');
    console.log('2. Run integration tests: npm run test:integration');
    console.log('3. Or run full test suite: npm run test');
    
    // Return success code
    process.exit(0);
  } else {
    console.log('❌ Some services are not available.');
    console.log('\n🔧 To start services, run:');
    console.log('   docker-compose up -d');
    console.log('\n⏳ Wait 2-3 minutes for services to start, then re-run this check.');
    
    // Return error code
    process.exit(1);
  }
}

main();
