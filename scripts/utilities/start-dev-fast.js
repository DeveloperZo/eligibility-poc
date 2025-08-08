#!/usr/bin/env node

/**
 * Development Environment Startup Script
 * 
 * This script starts the development environment with hot reload enabled.
 * It uses docker-compose.dev.yml for faster development cycles.
 */

const { exec, spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Eligibility Rule Management - Development Environment');
console.log('');

// Set working directory to project root
process.chdir(path.join(__dirname, '..', '..'));

// Function to execute commands
function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`📋 Running: ${command}`);
    
    const child = spawn(command, [], {
      shell: true,
      stdio: 'inherit',
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

async function startDevelopment() {
  try {
    console.log('🔧 Starting development environment with hot reload...');
    console.log('');
    
    // Start development environment
    await runCommand('docker-compose -f docker-compose.dev.yml up --build');
    
  } catch (error) {
    console.error('❌ Failed to start development environment:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development environment...');
  runCommand('docker-compose -f docker-compose.dev.yml down')
    .then(() => {
      console.log('✅ Development environment stopped');
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
});

// Start the development environment
startDevelopment();
