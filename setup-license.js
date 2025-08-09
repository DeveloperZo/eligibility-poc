#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔑 Retool License Key Setup\n');
console.log('Get your free license key at: https://retool.com/self-hosted/\n');

rl.question('Enter your license key (or press Enter to use trial mode): ', (licenseKey) => {
  const dockerComposePath = path.join(__dirname, 'docker-compose.yml');
  let dockerCompose = fs.readFileSync(dockerComposePath, 'utf8');
  
  if (licenseKey.trim()) {
    // Replace with actual license key
    dockerCompose = dockerCompose.replace(
      /LICENSE_KEY: .*/,
      `LICENSE_KEY: ${licenseKey.trim()}`
    );
    console.log('\n✅ License key updated!');
  } else {
    console.log('\n📝 Using trial mode (EXPIRED-LICENSE-KEY-TRIAL)');
  }
  
  fs.writeFileSync(dockerComposePath, dockerCompose);
  
  console.log('\nNext steps:');
  console.log('1. Run: npm restart');
  console.log('2. Visit: http://localhost:3333');
  console.log('3. Create your admin account\n');
  
  rl.close();
});
