#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 Checking TypeScript compilation...\n');

// Check middleware TypeScript compilation
console.log('📂 Checking middleware service...');
const middlewarePath = path.join(__dirname, 'middleware');

try {
  process.chdir(middlewarePath);
  
  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    console.log('⚠️  No node_modules found. Running npm install...');
    execSync('npm install', { stdio: 'inherit' });
  }
  
  // Run TypeScript compilation
  console.log('🔨 Compiling TypeScript...');
  const result = execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: 'pipe' });
  console.log('✅ Middleware TypeScript compilation successful!');
  
} catch (error) {
  console.log('❌ Middleware TypeScript compilation failed:');
  console.log(error.stdout || error.message);
  process.exit(1);
}

// Check integration tests TypeScript compilation
console.log('\n📂 Checking integration tests...');
const testsPath = path.join(__dirname, 'tests');

try {
  process.chdir(testsPath);
  
  // Check if package.json exists
  if (fs.existsSync('package.json')) {
    // Check if node_modules exists
    if (!fs.existsSync('node_modules')) {
      console.log('⚠️  No node_modules found. Running npm install...');
      execSync('npm install', { stdio: 'inherit' });
    }
  }
  
  // Check TypeScript compilation for integration tests
  console.log('🔨 Checking integration tests TypeScript...');
  const result = execSync('npx tsx --check integration-tests.ts', { encoding: 'utf8', stdio: 'pipe' });
  console.log('✅ Integration tests TypeScript check successful!');
  
} catch (error) {
  console.log('❌ Integration tests TypeScript check failed:');
  console.log(error.stdout || error.message);
  process.exit(1);
}

console.log('\n🎉 All TypeScript compilation checks passed!');
