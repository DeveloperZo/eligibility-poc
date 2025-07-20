#!/usr/bin/env node

/**
 * Integration Test Execution Script
 * This script orchestrates the complete integration test execution
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

console.log('🚀 Starting Integration Test Execution');
console.log('=====================================');

// Environment configuration
const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL || 'http://localhost:3000';
const DATA_API_URL = process.env.DATA_API_URL || 'http://localhost:3001';
const CAMUNDA_URL = process.env.CAMUNDA_URL || 'http://localhost:8080';

async function checkServiceHealth(serviceName, url) {
  try {
    console.log(`🔍 Checking ${serviceName} health at ${url}...`);
    const response = await axios.get(url, { timeout: 5000 });
    console.log(`✅ ${serviceName} is healthy (${response.status})`);
    return true;
  } catch (error) {
    console.log(`❌ ${serviceName} is not available: ${error.message}`);
    return false;
  }
}

async function checkSystemReady() {
  console.log('\n🏥 Checking system health before running tests...');
  
  const healthChecks = [
    { name: 'Middleware', url: `${MIDDLEWARE_URL}/health` },
    { name: 'Data API', url: `${DATA_API_URL}/health` },
    { name: 'Camunda', url: `${CAMUNDA_URL}/engine-rest/engine` }
  ];
  
  let allHealthy = true;
  
  for (const check of healthChecks) {
    const healthy = await checkServiceHealth(check.name, check.url);
    if (!healthy) {
      allHealthy = false;
    }
  }
  
  return allHealthy;
}

async function startDockerServices() {
  console.log('\n🐳 Starting Docker services...');
  
  return new Promise((resolve, reject) => {
    const dockerProcess = spawn('docker-compose', ['up', '-d'], {
      cwd: path.join(__dirname),
      stdio: 'pipe'
    });
    
    let output = '';
    
    dockerProcess.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    dockerProcess.stderr.on('data', (data) => {
      output += data.toString();
      process.stderr.write(data);
    });
    
    dockerProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Docker services started successfully');
        resolve(true);
      } else {
        console.log('❌ Failed to start Docker services');
        reject(new Error(`Docker compose failed with exit code ${code}`));
      }
    });
  });
}

async function waitForServices(maxWaitTime = 120000) {
  console.log('\n⏳ Waiting for services to be ready...');
  
  const startTime = Date.now();
  const checkInterval = 5000; // Check every 5 seconds
  
  while (Date.now() - startTime < maxWaitTime) {
    const systemReady = await checkSystemReady();
    if (systemReady) {
      console.log('✅ All services are ready!');
      return true;
    }
    
    console.log(`⏳ Services not ready yet, waiting ${checkInterval/1000}s...`);
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.log('❌ Services did not become ready within the timeout period');
  return false;
}

async function runIntegrationTests() {
  console.log('\n🧪 Running integration tests...');
  
  return new Promise((resolve) => {
    const testProcess = spawn('npm', ['run', 'test:integration'], {
      cwd: path.join(__dirname, 'tests'),
      stdio: 'inherit',
      env: {
        ...process.env,
        MIDDLEWARE_URL,
        DATA_API_URL,
        NODE_ENV: 'test'
      }
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Integration tests completed successfully');
      } else {
        console.log('❌ Integration tests failed');
      }
      resolve(code === 0);
    });
  });
}

async function runTestRunner() {
  console.log('\n🏃 Running comprehensive test runner...');
  
  return new Promise((resolve) => {
    const testProcess = spawn('node', ['run-tests.js'], {
      cwd: path.join(__dirname, 'tests'),
      stdio: 'inherit',
      env: {
        ...process.env,
        MIDDLEWARE_URL,
        DATA_API_URL
      }
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Test runner completed successfully');
      } else {
        console.log('❌ Test runner failed');
      }
      resolve(code === 0);
    });
  });
}

async function main() {
  try {
    // Step 1: Check if services are already running
    const systemReady = await checkSystemReady();
    
    if (!systemReady) {
      console.log('\n📋 Services not ready, attempting to start Docker containers...');
      
      // Step 2: Start Docker services if not running
      try {
        await startDockerServices();
        
        // Step 3: Wait for services to be ready
        const servicesReady = await waitForServices();
        if (!servicesReady) {
          throw new Error('Services failed to start within timeout period');
        }
      } catch (error) {
        console.log('⚠️  Failed to start Docker services automatically.');
        console.log('Please ensure Docker is running and execute:');
        console.log('  docker-compose up -d');
        console.log('Then re-run this script.');
        process.exit(1);
      }
    }
    
    // Step 4: Run the integration tests
    console.log('\n🎯 System is ready - executing integration tests...');
    
    // Try TypeScript integration tests first
    const tsTestsPassed = await runIntegrationTests();
    
    // Also run the comprehensive test runner
    const testRunnerPassed = await runTestRunner();
    
    // Final summary
    console.log('\n📊 INTEGRATION TEST EXECUTION SUMMARY');
    console.log('=====================================');
    console.log(`TypeScript Integration Tests: ${tsTestsPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Comprehensive Test Runner: ${testRunnerPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (tsTestsPassed && testRunnerPassed) {
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('The complete end-to-end workflow is working correctly.');
      console.log('System is ready for production deployment.');
    } else {
      console.log('\n⚠️  SOME INTEGRATION TESTS FAILED!');
      console.log('Please review the test output above and fix any issues.');
    }
    
    console.log('\n📄 Check tests/test-report.html for detailed results');
    
  } catch (error) {
    console.error('❌ Integration test execution failed:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
