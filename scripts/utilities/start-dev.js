#!/usr/bin/env node

/**
 * Development startup script
 * Checks prerequisites and provides startup commands
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🚀 benefit plan Management System - Development Startup');
console.log('='.repeat(60));

async function checkPrerequisites() {
  console.log('\n📋 Checking prerequisites...');
  
  // Check Node.js version
  console.log(`  Node.js: ${process.version}`);
  
  // Check if Docker is available
  return new Promise((resolve) => {
    exec('docker --version', (error, stdout) => {
      if (error) {
        console.log('  ❌ Docker not available');
        console.log('     Please install Docker Desktop');
        resolve(false);
      } else {
        console.log(`  ✅ ${stdout.trim()}`);
        
        // Check Docker Compose
        exec('docker-compose --version', (error2, stdout2) => {
          if (error2) {
            console.log('  ❌ Docker Compose not available');
            resolve(false);
          } else {
            console.log(`  ✅ ${stdout2.trim()}`);
            resolve(true);
          }
        });
      }
    });
  });
}

async function main() {
  const dockerAvailable = await checkPrerequisites();
  
  console.log('\n🛠️  Development Setup Instructions');
  console.log('='.repeat(60));
  
  console.log('\n1. 📦 Install Dependencies:');
  console.log('   cd middleware && npm install');
  console.log('   cd ../data && npm install');
  
  if (dockerAvailable) {
    console.log('\n2. 🐳 Start Docker Services:');
    console.log('   docker-compose up -d');
    console.log('   # Starts Camunda (port 8080) and PostgreSQL (port 5432)');
  } else {
    console.log('\n2. ⚠️  Install Docker first, then start services');
  }
  
  console.log('\n3. 🔧 Start Development Services:');
  console.log('   # Terminal 1:');
  console.log('   cd data && npm start');
  console.log('   # Starts data API on port 3001');
  console.log('');
  console.log('   # Terminal 2:');
  console.log('   cd middleware && npm run dev');
  console.log('   # Starts middleware on port 3000 with hot reload');
  
  console.log('\n4. ✅ Verify Setup:');
  console.log('   curl http://localhost:3000/health');
  console.log('   curl http://localhost:3001/health');
  console.log('   # Browser: http://localhost:8080/camunda (demo/demo)');
  
  console.log('\n🧪 Test API Endpoints:');
  console.log('   # Get DMN templates');
  console.log('   curl http://localhost:3000/api/dmn/templates');
  console.log('');
  console.log('   # Generate sample age rule');
  console.log('   curl http://localhost:3000/api/dmn/sample?ruleType=age');
  console.log('');
  console.log('   # Get employee data');
  console.log('   curl http://localhost:3001/api/employees/EMP001');
  
  console.log('\n📚 More Information:');
  console.log('   • README.md - Complete documentation');
  console.log('   • npm run validate - Run system validation');
  console.log('   • data/README.md - Data API documentation');
  
  console.log('\n🎯 Current System Status:');
  console.log('   ✅ Project structure complete');
  console.log('   ✅ TypeScript middleware foundation');
  console.log('   ✅ External data simulation');
  console.log('   ✅ DMN XML generation engine');
  console.log('   🔄 Next: Rule Management REST API');
  
  console.log('\n='.repeat(60));
  console.log('Ready for development! 🎉');
}

main().catch(console.error);
