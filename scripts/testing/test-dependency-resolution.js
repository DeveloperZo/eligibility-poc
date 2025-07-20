#!/usr/bin/env node
/**
 * Dependency Resolution Test
 * Tests if all dependencies can be resolved from each service
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function testDependencyResolution(serviceName, servicePath, dependencies) {
    log(`\n${'='.repeat(50)}`, colors.bold);
    log(`Testing dependency resolution for ${serviceName}`, colors.blue);
    log(`${'='.repeat(50)}`, colors.bold);
    
    const fullPath = path.resolve(servicePath);
    const results = {
        total: 0,
        resolved: 0,
        failed: []
    };
    
    for (const [depName, version] of Object.entries(dependencies)) {
        results.total++;
        
        try {
            // Try to resolve the dependency from the service directory
            const resolved = Module._resolveFilename(depName, {
                id: path.join(fullPath, 'package.json'),
                filename: path.join(fullPath, 'package.json'),
                paths: Module._nodeModulePaths(fullPath)
            });
            
            log(`✅ ${depName} -> ${resolved}`, colors.green);
            results.resolved++;
        } catch (error) {
            log(`❌ ${depName} -> Not resolvable`, colors.red);
            results.failed.push({ name: depName, error: error.message });
        }
    }
    
    // Summary
    log(`\n📊 Resolution Summary for ${serviceName}:`, colors.bold);
    log(`   Total dependencies: ${results.total}`);
    log(`   Successfully resolved: ${results.resolved}`, colors.green);
    log(`   Failed to resolve: ${results.failed.length}`, results.failed.length > 0 ? colors.red : colors.green);
    
    if (results.failed.length > 0) {
        log(`\n⚠️  Failed dependencies:`, colors.yellow);
        results.failed.forEach(dep => {
            log(`   - ${dep.name}: ${dep.error}`);
        });
    }
    
    return results.failed.length === 0;
}

function checkWorkspaceHoisting() {
    log('🔍 Checking workspace dependency hoisting...', colors.bold);
    
    const rootNodeModules = path.join(process.cwd(), 'node_modules');
    const hasRootNodeModules = fs.existsSync(rootNodeModules);
    
    log(`Root node_modules exists: ${hasRootNodeModules ? '✅' : '❌'}`, hasRootNodeModules ? colors.green : colors.red);
    
    if (hasRootNodeModules) {
        const packages = fs.readdirSync(rootNodeModules)
            .filter(item => !item.startsWith('.'))
            .length;
        log(`Packages in root node_modules: ${packages}`, colors.green);
    }
    
    return hasRootNodeModules;
}

function main() {
    log('🚀 Starting dependency resolution test...', colors.bold);
    
    // Ensure we're in the correct directory
    if (!process.cwd().includes('CamundaRetool')) {
        process.chdir('C:/Repos/CamundaRetool');
    }
    
    log(`Working directory: ${process.cwd()}`, colors.yellow);
    
    // Check workspace hoisting
    if (!checkWorkspaceHoisting()) {
        log('❌ Root node_modules not found. Please run npm install first.', colors.red);
        process.exit(1);
    }
    
    const services = [
        {
            name: 'Middleware',
            path: './middleware',
            packageJsonPath: './middleware/package.json'
        },
        {
            name: 'Data API',
            path: './data',
            packageJsonPath: './data/package.json'
        },
        {
            name: 'Tests',
            path: './tests',
            packageJsonPath: './tests/package.json'
        }
    ];
    
    let allResolved = true;
    
    for (const service of services) {
        try {
            // Read package.json
            const packageJson = JSON.parse(fs.readFileSync(service.packageJsonPath, 'utf8'));
            const allDeps = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };
            
            if (Object.keys(allDeps).length === 0) {
                log(`⚠️  ${service.name} has no dependencies to test`, colors.yellow);
                continue;
            }
            
            const success = testDependencyResolution(service.name, service.path, allDeps);
            if (!success) {
                allResolved = false;
            }
            
        } catch (error) {
            log(`❌ Error processing ${service.name}: ${error.message}`, colors.red);
            allResolved = false;
        }
    }
    
    // Final summary
    log(`\n${'='.repeat(60)}`, colors.bold);
    log('DEPENDENCY RESOLUTION SUMMARY', colors.bold);
    log(`${'='.repeat(60)}`, colors.bold);
    
    if (allResolved) {
        log('🎉 All dependencies can be resolved successfully!', colors.green);
        log('✅ Dependency validation PASSED', colors.green);
    } else {
        log('💥 Some dependencies cannot be resolved!', colors.red);
        log('❌ Dependency validation FAILED', colors.red);
        log('\nRecommended actions:');
        log('1. Run npm install in service directories with failed dependencies');
        log('2. Check if package versions are compatible');
        log('3. Verify workspace configuration in root package.json');
    }
    
    return allResolved;
}

// Export for use in other scripts
module.exports = { testDependencyResolution, checkWorkspaceHoisting };

// Run if called directly
if (require.main === module) {
    const success = main();
    process.exit(success ? 0 : 1);
}
