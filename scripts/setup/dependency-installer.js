const fs = require('fs');
const path = require('path');

console.log('Installing dependencies for each service...\n');

// Services that need individual npm install
const services = [
    { name: 'Middleware', path: './middleware' },
    { name: 'Data API', path: './data' },
    { name: 'Tests', path: './tests' }
];

function installForService(serviceName, servicePath) {
    console.log(`\n=== Installing dependencies for ${serviceName} ===`);
    
    // Check if package.json exists
    const packageJsonPath = path.join(servicePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        console.log(`❌ No package.json found in ${servicePath}`);
        return false;
    }
    
    // Read and display dependency info
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = Object.keys(packageJson.dependencies || {});
        const devDeps = Object.keys(packageJson.devDependencies || {});
        
        console.log(`📦 Dependencies to install:`);
        console.log(`   Production: ${deps.length} packages`);
        console.log(`   Development: ${devDeps.length} packages`);
        
        if (deps.length > 0) {
            console.log(`   Prod deps: ${deps.slice(0, 5).join(', ')}${deps.length > 5 ? '...' : ''}`);
        }
        if (devDeps.length > 0) {
            console.log(`   Dev deps: ${devDeps.slice(0, 5).join(', ')}${devDeps.length > 5 ? '...' : ''}`);
        }
        
        return true;
    } catch (error) {
        console.log(`❌ Error reading package.json: ${error.message}`);
        return false;
    }
}

// Check current status
console.log('Current dependency status:');
for (const service of services) {
    const nodeModulesPath = path.join(service.path, 'node_modules');
    const hasNodeModules = fs.existsSync(nodeModulesPath);
    
    console.log(`${service.name}: ${hasNodeModules ? '✅ installed' : '❌ missing'}`);
    
    if (!hasNodeModules) {
        installForService(service.name, service.path);
    }
}

console.log('\n📋 Installation Commands Needed:');
console.log('Run these commands to install dependencies:');
console.log('');
for (const service of services) {
    const nodeModulesPath = path.join(service.path, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        console.log(`cd ${service.path} && npm install`);
    }
}

console.log('\nOr run the root workspace install:');
console.log('npm install --workspaces');
