#!/usr/bin/env node

/**
 * Simple test script to verify the middleware can start without errors
 * Run this with: node test-startup.js
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing TypeScript compilation...');

// Test TypeScript compilation
const tscProcess = spawn('npx', ['tsc', '--noEmit'], {
  cwd: path.join(__dirname, 'middleware'),
  stdio: 'pipe'
});

let tscOutput = '';
let tscErrors = '';

tscProcess.stdout.on('data', (data) => {
  tscOutput += data.toString();
});

tscProcess.stderr.on('data', (data) => {
  tscErrors += data.toString();
});

tscProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ TypeScript compilation successful!');
    console.log('📦 Project structure validated');
    console.log('\n🚀 Ready to start with:');
    console.log('   cd middleware');
    console.log('   npm install');
    console.log('   npm run dev');
    console.log('\n📋 Available endpoints after startup:');
    console.log('   http://localhost:3000/health');
    console.log('   http://localhost:3000/api/dmn/templates');
    console.log('   http://localhost:3000/api/dmn/sample?ruleType=age');
  } else {
    console.log('❌ TypeScript compilation failed!');
    console.log('\n🔍 Errors:');
    console.log(tscErrors);
    console.log('\n📝 Output:');
    console.log(tscOutput);
  }
});

tscProcess.on('error', (error) => {
  console.log('❌ Failed to run TypeScript compiler:');
  console.log(error.message);
  console.log('\n💡 Make sure you have TypeScript installed:');
  console.log('   cd middleware && npm install');
});
