#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Rebuilding middleware with dynamic OpenAPI fix...\n');

// Change to middleware directory
process.chdir(path.join(__dirname, 'middleware'));

// Step 1: Clean dist folder
console.log('1. Cleaning old build...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

// Step 2: Install dependencies
console.log('2. Installing dependencies...');
exec('npm install', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ npm install failed:', error);
    return;
  }
  console.log(stdout);
  
  // Step 3: Build TypeScript
  console.log('3. Building TypeScript...');
  exec('npm run build', (buildError, buildStdout, buildStderr) => {
    if (buildError) {
      console.error('❌ TypeScript build failed:', buildError);
      return;
    }
    console.log(buildStdout);
    console.log('✅ TypeScript build successful!\n');
    
    // Change back to project root
    process.chdir('..');
    
    // Step 4: Rebuild Docker container
    console.log('4. Rebuilding Docker container...');
    exec('docker-compose down', (downError) => {
      if (downError) console.log('Warning: docker-compose down had issues:', downError.message);
      
      exec('docker-compose build --no-cache middleware', (buildDockerError, dockerStdout) => {
        if (buildDockerError) {
          console.error('❌ Docker build failed:', buildDockerError);
          return;
        }
        console.log(dockerStdout);
        
        exec('docker-compose up -d', (upError, upStdout) => {
          if (upError) {
            console.error('❌ Docker up failed:', upError);
            return;
          }
          console.log(upStdout);
          console.log('✅ Docker containers started!\n');
          
          // Wait a moment for services to start
          setTimeout(() => {
            console.log('5. Testing the fix...\n');
            
            // Test local endpoint
            console.log('Testing local endpoint:');
            exec('curl -s http://localhost:3000/openapi.json', (curlError, curlStdout) => {
              if (curlError) {
                console.log('❌ Local test failed:', curlError.message);
              } else {
                try {
                  const spec = JSON.parse(curlStdout);
                  console.log('✅ Local test - Server URL:', spec.servers[0].url);
                  console.log('✅ Local test - Description:', spec.servers[0].description);
                } catch (e) {
                  console.log('Response:', curlStdout.substring(0, 200) + '...');
                }
              }
              
              console.log('\n🎯 Now testing ngrok endpoint...');
              exec('curl -s https://20f445bf2d03.ngrok-free.app/openapi.json', (ngrokError, ngrokStdout) => {
                if (ngrokError) {
                  console.log('❌ Ngrok test failed:', ngrokError.message);
                } else {
                  try {
                    const ngrokSpec = JSON.parse(ngrokStdout);
                    console.log('✅ Ngrok test - Server URL:', ngrokSpec.servers[0].url);
                    console.log('✅ Ngrok test - Description:', ngrokSpec.servers[0].description);
                    
                    if (ngrokSpec.servers[0].url.includes('ngrok-free.app')) {
                      console.log('\n🎉 SUCCESS! Dynamic URL detection is working!');
                      console.log('✅ Retool should now be able to import the OpenAPI spec!');
                    } else {
                      console.log('\n⚠️  Still showing localhost URL. Check if ngrok is running.');
                    }
                  } catch (e) {
                    console.log('Ngrok response:', ngrokStdout.substring(0, 200) + '...');
                  }
                }
                
                console.log('\n📋 Summary:');
                console.log('- TypeScript rebuilt with dynamic OpenAPI');
                console.log('- Docker container rebuilt and started');
                console.log('- Your ngrok URL: https://20f445bf2d03.ngrok-free.app/');
                console.log('- Test in Retool with: https://20f445bf2d03.ngrok-free.app/openapi.json');
              });
            });
          }, 8000); // Wait 8 seconds for services to fully start
        });
      });
    });
  });
});
