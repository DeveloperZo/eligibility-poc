const { execSync } = require('child_process');
const path = require('path');

console.log('=== Testing Middleware Compilation ===');

try {
  // Change to middleware directory and run build
  const middlewareDir = path.join(__dirname, 'middleware');
  process.chdir(middlewareDir);
  
  console.log('Running: npm run build');
  const buildOutput = execSync('npm run build', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  console.log('✅ Middleware build successful');
  console.log('Build output:', buildOutput);
  
  // Check if dist directory and files were created
  const fs = require('fs');
  const distPath = path.join(middlewareDir, 'dist');
  
  if (fs.existsSync(distPath)) {
    console.log('✅ Dist directory created successfully');
    const distFiles = fs.readdirSync(distPath);
    console.log('Generated files:', distFiles);
  } else {
    console.log('❌ Dist directory not found');
  }
  
} catch (error) {
  console.log('❌ Middleware build failed');
  console.log('Error:', error.message);
  console.log('stderr:', error.stderr?.toString());
  console.log('stdout:', error.stdout?.toString());
}
