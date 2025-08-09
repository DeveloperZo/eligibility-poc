#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function restart() {
  console.log('🔄 Restarting platform with updated configuration...\n');
  
  try {
    console.log('📦 Stopping existing containers...');
    await execAsync('docker-compose down');
    
    console.log('🗑️  Removing Retool container to force rebuild...');
    await execAsync('docker rm -f retool-app 2>/dev/null || true');
    
    console.log('🚀 Starting services with updated configuration...');
    await execAsync('docker-compose up -d');
    
    console.log('\n✅ Services restarted!');
    console.log('\n📍 Access points:');
    console.log('  • Retool:   http://localhost:3333');
    console.log('  • Camunda:  http://localhost:8080/camunda (demo/demo)');
    console.log('  • API:      http://localhost:3000');
    console.log('\n💡 Note: Retool may take 30-60 seconds to fully start');
    console.log('   Check logs with: docker-compose logs -f retool');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

restart();
