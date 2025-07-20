#!/usr/bin/env node
/**
 * Complete Dependency Validation Report
 * Comprehensive check of all npm dependencies across the project
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function createSection(title, char = '=') {
    const line = char.repeat(60);
    log(`\n${line}`, colors.bold);
    log(title.toUpperCase(), colors.bold);
    log(`${line}`, colors.bold);
}

function validateService(serviceName, servicePath) {
    log(`\n--- ${serviceName} Service ---`, colors.cyan);
    
    const results = {
        hasPackageJson: false,
        hasNodeModules: false,
        hasPackageLock: false,
        dependencyCount: 0,
        devDependencyCount: 0,
        totalDependencies: 0,
        dependencies: [],
        devDependencies: [],
        issues: []
    };
    
    // Check package.json
    const packageJsonPath = path.join(servicePath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        results.hasPackageJson = true;
        log('✅ package.json exists', colors.green);
        
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const deps = packageJson.dependencies || {};
            const devDeps = packageJson.devDependencies || {};
            
            results.dependencies = Object.keys(deps);
            results.devDependencies = Object.keys(devDeps);
            results.dependencyCount = results.dependencies.length;
            results.devDependencyCount = results.devDependencies.length;
            results.totalDependencies = results.dependencyCount + results.devDependencyCount;
            
            log(`📦 Production dependencies: ${results.dependencyCount}`, colors.blue);
            log(`🔧 Development dependencies: ${results.devDependencyCount}`, colors.blue);
            log(`📊 Total dependencies: ${results.totalDependencies}`, colors.bold);
            
            // Show key dependencies
            if (results.dependencies.length > 0) {
                const keyDeps = results.dependencies.slice(0, 5);
                log(`   Key deps: ${keyDeps.join(', ')}${results.dependencies.length > 5 ? '...' : ''}`, colors.cyan);
            }
            
        } catch (error) {
            results.issues.push(`Error reading package.json: ${error.message}`);
            log(`❌ Error reading package.json: ${error.message}`, colors.red);
        }
    } else {
        results.issues.push('package.json not found');
        log('❌ package.json NOT FOUND', colors.red);
    }
    
    // Check node_modules
    const nodeModulesPath = path.join(servicePath, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        results.hasNodeModules = true;
        log('✅ node_modules directory exists', colors.green);
        
        try {
            const items = fs.readdirSync(nodeModulesPath);
            const packages = items.filter(item => !item.startsWith('.') && item !== '.bin');
            log(`📁 Installed packages: ${packages.length}`, colors.green);
        } catch (error) {
            results.issues.push(`Error reading node_modules: ${error.message}`);
        }
    } else {
        // Check if using workspace hoisting
        const rootNodeModules = path.join(process.cwd(), 'node_modules');
        if (fs.existsSync(rootNodeModules)) {
            log('📁 No local node_modules (using workspace hoisting)', colors.yellow);
        } else {
            results.issues.push('node_modules not found and no workspace hoisting');
            log('❌ node_modules NOT FOUND', colors.red);
        }
    }
    
    // Check package-lock.json
    const packageLockPath = path.join(servicePath, 'package-lock.json');
    if (fs.existsSync(packageLockPath)) {
        results.hasPackageLock = true;
        log('✅ package-lock.json exists', colors.green);
    } else {
        log('⚠️  No local package-lock.json (may use root lock)', colors.yellow);
    }
    
    return results;
}

function checkRootDependencies() {
    createSection('Root Workspace Analysis');
    
    // Check root package.json
    const rootPackageJson = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(rootPackageJson)) {
        const packageJson = JSON.parse(fs.readFileSync(rootPackageJson, 'utf8'));
        
        log('📋 Root Package Information:', colors.bold);
        log(`   Name: ${packageJson.name}`);
        log(`   Version: ${packageJson.version}`);
        
        if (packageJson.workspaces) {
            log(`✅ Workspace configuration found`, colors.green);
            log(`   Workspaces: ${packageJson.workspaces.join(', ')}`);
        } else {
            log(`⚠️  No workspace configuration`, colors.yellow);
        }
        
        const rootDeps = Object.keys(packageJson.dependencies || {});
        const rootDevDeps = Object.keys(packageJson.devDependencies || {});
        
        log(`📦 Root dependencies: ${rootDeps.length} production, ${rootDevDeps.length} development`);
    }
    
    // Check root node_modules
    const rootNodeModules = path.join(process.cwd(), 'node_modules');
    if (fs.existsSync(rootNodeModules)) {
        const packages = fs.readdirSync(rootNodeModules)
            .filter(item => !item.startsWith('.'))
            .length;
        log(`✅ Root node_modules: ${packages} packages installed`, colors.green);
    } else {
        log(`❌ Root node_modules not found`, colors.red);
    }
}

function checkCriticalDependencies() {
    createSection('Critical Dependency Check');
    
    const rootNodeModules = path.join(process.cwd(), 'node_modules');
    
    const criticalDeps = [
        'express',
        'typescript',
        'axios',
        'cors',
        'camunda-external-task-client-js',
        'dmn-moddle',
        'winston',
        'pg',
        'jest',
        'ts-node-dev'
    ];
    
    log('Checking for critical dependencies in root node_modules:', colors.bold);
    
    let foundCount = 0;
    for (const dep of criticalDeps) {
        const depPath = path.join(rootNodeModules, dep);
        if (fs.existsSync(depPath)) {
            log(`✅ ${dep}`, colors.green);
            foundCount++;
        } else {
            log(`❌ ${dep} - MISSING`, colors.red);
        }
    }
    
    log(`\n📊 Critical dependencies: ${foundCount}/${criticalDeps.length} found`, 
        foundCount === criticalDeps.length ? colors.green : colors.red);
}

function generateSummaryReport(serviceResults) {
    createSection('Summary Report');
    
    let totalIssues = 0;
    let servicesReady = 0;
    
    log('Service Status Overview:', colors.bold);
    
    for (const [serviceName, results] of Object.entries(serviceResults)) {
        const hasIssues = results.issues.length > 0;
        const status = hasIssues ? '❌ Issues Found' : '✅ Ready';
        const statusColor = hasIssues ? colors.red : colors.green;
        
        log(`\n${serviceName}:`, colors.cyan);
        log(`   Status: ${status}`, statusColor);
        log(`   Dependencies: ${results.totalDependencies} total`);
        
        if (hasIssues) {
            totalIssues += results.issues.length;
            log(`   Issues (${results.issues.length}):`, colors.red);
            results.issues.forEach(issue => {
                log(`     - ${issue}`, colors.red);
            });
        } else {
            servicesReady++;
        }
    }
    
    log(`\n📊 Overall Status:`, colors.bold);
    log(`   Services ready: ${servicesReady}/${Object.keys(serviceResults).length}`);
    log(`   Total issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
        log(`\n🎉 ALL DEPENDENCIES VALIDATED SUCCESSFULLY!`, colors.green);
        log(`✅ All services are ready for development`, colors.green);
        return true;
    } else {
        log(`\n⚠️  DEPENDENCY ISSUES FOUND`, colors.red);
        log(`💡 Recommended actions:`, colors.yellow);
        log(`   1. Run npm install in the root directory`);
        log(`   2. For services with missing node_modules: cd <service> && npm install`);
        log(`   3. Check workspace configuration in root package.json`);
        return false;
    }
}

function main() {
    log('🚀 COMPREHENSIVE DEPENDENCY VALIDATION', colors.bold);
    log('=======================================', colors.bold);
    
    // Ensure we're in the correct directory
    if (!process.cwd().includes('CamundaRetool')) {
        process.chdir('C:/Repos/CamundaRetool');
    }
    
    log(`Working directory: ${process.cwd()}`, colors.yellow);
    
    // Check root dependencies
    checkRootDependencies();
    
    // Check critical dependencies
    checkCriticalDependencies();
    
    // Validate each service
    createSection('Service Dependency Analysis');
    
    const services = [
        { name: 'Middleware', path: './middleware' },
        { name: 'Data API', path: './data' },
        { name: 'Tests', path: './tests' }
    ];
    
    const serviceResults = {};
    
    for (const service of services) {
        const results = validateService(service.name, service.path);
        serviceResults[service.name] = results;
    }
    
    // Generate final report
    const success = generateSummaryReport(serviceResults);
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
}

// Run the validation
main();
