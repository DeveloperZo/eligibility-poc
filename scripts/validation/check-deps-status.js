const fs = require('fs');
const path = require('path');

console.log('🔍 Checking dependency status across all services...\n');

const services = [
    { name: 'Root', path: 'C:/Repos/CamundaRetool' },
    { name: 'Middleware', path: 'C:/Repos/CamundaRetool/middleware' },
    { name: 'Data API', path: 'C:/Repos/CamundaRetool/data' },
    { name: 'Tests', path: 'C:/Repos/CamundaRetool/tests' }
];

for (const service of services) {
    console.log(`\n--- ${service.name} ---`);
    
    // Check if package.json exists
    const packageJsonPath = path.join(service.path, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        console.log('✅ package.json exists');
        
        // Read package.json to show dependencies
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const deps = packageJson.dependencies || {};
            const devDeps = packageJson.devDependencies || {};
            const totalDeps = Object.keys(deps).length + Object.keys(devDeps).length;
            console.log(`📦 ${totalDeps} total dependencies (${Object.keys(deps).length} prod, ${Object.keys(devDeps).length} dev)`);
        } catch (error) {
            console.log('❌ Error reading package.json');
        }
    } else {
        console.log('❌ package.json not found');
    }
    
    // Check if node_modules exists
    const nodeModulesPath = path.join(service.path, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        console.log('✅ node_modules exists');
        
        // Count installed packages
        try {
            const items = fs.readdirSync(nodeModulesPath);
            // Filter out .bin and other non-package directories
            const packages = items.filter(item => !item.startsWith('.') && item !== '.bin');
            console.log(`📁 ${packages.length} packages installed`);
        } catch (error) {
            console.log('❌ Error reading node_modules');
        }
    } else {
        console.log('❌ node_modules NOT FOUND - needs npm install');
    }
    
    // Check if package-lock.json exists
    const lockPath = path.join(service.path, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
        console.log('✅ package-lock.json exists');
    } else {
        console.log('⚠️  package-lock.json not found');
    }
}

console.log('\n🎯 Summary: Services needing npm install:');
for (const service of services) {
    const nodeModulesPath = path.join(service.path, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        console.log(`   - ${service.name} (${service.path})`);
    }
}
