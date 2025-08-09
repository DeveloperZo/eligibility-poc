#!/usr/bin/env node

/**
 * Test Runner for Stateless Orchestration Integration Tests
 * 
 * This script runs the comprehensive integration tests for the stateless workflow.
 * It can be run with Jest or as a standalone Node.js script.
 */

const path = require('path');
const { spawn } = require('child_process');

// Test configuration
const TEST_CONFIG = {
  MIDDLEWARE_URL: process.env.MIDDLEWARE_URL || 'http://localhost:3000',
  CAMUNDA_URL: process.env.CAMUNDA_URL || 'http://localhost:8080/engine-rest',
  RETOOL_DB_URL: process.env.RETOOL_DB_URL || 'http://localhost:3002',
  AIDBOX_URL: process.env.AIDBOX_URL || 'http://localhost:8888',
  USE_JEST: process.env.USE_JEST === 'true',
  VERBOSE: process.env.VERBOSE === 'true'
};

/**
 * Check if services are running
 */
async function checkServices() {
  const axios = require('axios');
  const services = [
    { name: 'Middleware', url: `${TEST_CONFIG.MIDDLEWARE_URL}/api/health` },
    { name: 'Camunda', url: `${TEST_CONFIG.CAMUNDA_URL}/engine` },
  ];

  console.log('🔍 Checking service availability...\n');
  
  for (const service of services) {
    try {
      await axios.get(service.url, { timeout: 5000 });
      console.log(`✅ ${service.name}: Available`);
    } catch (error) {
      console.log(`❌ ${service.name}: Not available at ${service.url}`);
      console.log(`   Please ensure ${service.name} is running before running tests.`);
      return false;
    }
  }
  
  console.log('');
  return true;
}

/**
 * Run tests with Jest
 */
function runWithJest() {
  console.log('🧪 Running tests with Jest...\n');
  
  const jest = spawn('npx', [
    'jest',
    'stateless-orchestration.test.ts',
    '--config', 'jest.config.js',
    '--runInBand',
    '--verbose'
  ], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, ...TEST_CONFIG }
  });

  jest.on('close', (code) => {
    process.exit(code);
  });
}

/**
 * Run tests with tsx (TypeScript execution)
 */
function runWithTsx() {
  console.log('🧪 Running tests with tsx...\n');
  
  const tsx = spawn('npx', [
    'tsx',
    path.join(__dirname, 'stateless-orchestration.test.ts')
  ], {
    stdio: 'inherit',
    env: { ...process.env, ...TEST_CONFIG }
  });

  tsx.on('close', (code) => {
    process.exit(code);
  });
}

/**
 * Run tests with Node.js (requires compilation)
 */
function runWithNode() {
  console.log('🧪 Compiling and running tests...\n');
  
  // First compile TypeScript
  const tsc = spawn('npx', [
    'tsc',
    'stateless-orchestration.test.ts',
    '--target', 'es2020',
    '--module', 'commonjs',
    '--esModuleInterop',
    '--resolveJsonModule',
    '--outDir', './dist'
  ], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  tsc.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ TypeScript compilation failed');
      process.exit(code);
    }

    // Run compiled JavaScript
    const node = spawn('node', [
      path.join(__dirname, 'dist', 'stateless-orchestration.test.js')
    ], {
      stdio: 'inherit',
      env: { ...process.env, ...TEST_CONFIG }
    });

    node.on('close', (code) => {
      process.exit(code);
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('=' .repeat(80));
  console.log('🚀 STATELESS ORCHESTRATION INTEGRATION TEST RUNNER');
  console.log('=' .repeat(80));
  console.log('');
  console.log('Configuration:');
  console.log(`  Middleware URL: ${TEST_CONFIG.MIDDLEWARE_URL}`);
  console.log(`  Camunda URL: ${TEST_CONFIG.CAMUNDA_URL}`);
  console.log(`  Retool DB URL: ${TEST_CONFIG.RETOOL_DB_URL}`);
  console.log(`  Aidbox URL: ${TEST_CONFIG.AIDBOX_URL}`);
  console.log('');

  // Check if services are available
  const servicesAvailable = await checkServices();
  
  if (!servicesAvailable) {
    console.log('\n⚠️  Some services are not available.');
    console.log('Please start all required services and try again.\n');
    console.log('You can start services with: docker-compose up -d\n');
    process.exit(1);
  }

  // Determine which runner to use
  const args = process.argv.slice(2);
  
  if (args.includes('--jest') || TEST_CONFIG.USE_JEST) {
    runWithJest();
  } else if (args.includes('--node')) {
    runWithNode();
  } else {
    // Default to tsx for TypeScript execution
    runWithTsx();
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { checkServices, main };
