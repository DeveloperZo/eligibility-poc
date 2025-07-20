#!/usr/bin/env node

/**
 * Dependency Validation Script
 * Validates and installs npm dependencies across all services
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function logStep(step, message) {
    log(`\n${colors.bold}[${step}]${colors.reset} ${message}`, colors.blue);
}

function logSuccess(message) {
    log(`✅ ${message}`, colors.green);
}

function logError(message) {
    log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
    log(`⚠️  ${message}`, colors.yellow);
}

// Service directories to validate
const services = [
    { name: 'Root', path: '.', hasTypeScript: false },
    { name: 'Middleware', path: './middleware', hasTypeScript: true },
    { name: 'Data API', path: './data', hasTypeScript: false },
    { name: 'Tests', path: './tests', hasTypeScript: false }
];

function checkNodeModules(servicePath) {
    const nodeModulesPath = path.join(servicePath, 'node_modules');
    return fs.existsSync(nodeModulesPath);
}

function runNpmInstall(servicePath, serviceName) {
    logStep('INSTALL', `Installing dependencies for ${serviceName}...`);
    
    try {
        const result = execSync('npm install', { 
            cwd: servicePath, 
            stdio: 'pipe',
            encoding: 'utf8'
        });
        
        logSuccess(`${serviceName} dependencies installed successfully`);
        return true;
    } catch (error) {
        logError(`Failed to install ${serviceName} dependencies: ${error.message}`);
        if (error.stdout) {
            console.log('STDOUT:', error.stdout);
        }
        if (error.stderr) {
            console.log('STDERR:', error.stderr);
        }
        return false;
    }
}

function runNpmAudit(servicePath, serviceName) {
    logStep('AUDIT', `Running npm audit for ${serviceName}...`);
    
    try {
        const result = execSync('npm audit --audit-level=moderate', { 
            cwd: servicePath, 
            stdio: 'pipe',
            encoding: 'utf8'
        });
        
        logSuccess(`${serviceName} audit passed - no vulnerabilities found`);
        return true;
    } catch (error) {
        if (error.status === 1) {
            logWarning(`${serviceName} has vulnerabilities that should be reviewed`);
            console.log(error.stdout || error.stderr);
        } else {
            logError(`Failed to run audit for ${serviceName}: ${error.message}`);
        }
        return false;
    }
}

function checkTypeScriptTypes(servicePath, serviceName) {
    logStep('TYPES', `Checking TypeScript types for ${serviceName}...`);
    
    try {
        const result = execSync('npx tsc --noEmit', { 
            cwd: servicePath, 
            stdio: 'pipe',
            encoding: 'utf8'
        });
        
        logSuccess(`${serviceName} TypeScript types are valid`);
        return true;
    } catch (error) {
        logError(`TypeScript type errors in ${serviceName}:`);
        console.log(error.stdout || error.stderr);
        return false;
    }
}

function verifyImports(servicePath, serviceName) {
    logStep('IMPORTS', `Verifying module imports for ${serviceName}...`);
    
    try {
        // Check if package.json exists
        const packageJsonPath = path.join(servicePath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            logWarning(`No package.json found for ${serviceName}`);
            return false;
        }
        
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        // Check if node_modules contains required packages
        const nodeModulesPath = path.join(servicePath, 'node_modules');
        let missingPackages = [];
        
        for (const dep of Object.keys(dependencies)) {
            const depPath = path.join(nodeModulesPath, dep);
            if (!fs.existsSync(depPath)) {
                missingPackages.push(dep);
            }
        }
        
        if (missingPackages.length > 0) {
            logError(`Missing packages in ${serviceName}: ${missingPackages.join(', ')}`);
            return false;
        }
        
        logSuccess(`All imports available for ${serviceName}`);
        return true;
    } catch (error) {
        logError(`Failed to verify imports for ${serviceName}: ${error.message}`);
        return false;
    }
}

async function validateService(service) {
    log(`\n${'='.repeat(60)}`, colors.bold);
    log(`Validating ${service.name.toUpperCase()} Service`, colors.bold);
    log(`${'='.repeat(60)}`, colors.bold);
    
    const servicePath = path.resolve(service.path);
    let success = true;
    
    // Check if node_modules exists
    if (!checkNodeModules(servicePath)) {
        logWarning(`${service.name} node_modules not found`);
        
        // Install dependencies
        if (!runNpmInstall(servicePath, service.name)) {
            return false;
        }
    } else {
        logSuccess(`${service.name} node_modules already exists`);
    }
    
    // Verify imports
    if (!verifyImports(servicePath, service.name)) {
        success = false;
    }
    
    // Run npm audit
    runNpmAudit(servicePath, service.name);
    
    // Check TypeScript if applicable
    if (service.hasTypeScript) {
        if (!checkTypeScriptTypes(servicePath, service.name)) {
            success = false;
        }
    }
    
    return success;
}

async function main() {
    log('🚀 Starting Dependency Validation Process...', colors.bold);
    
    let overallSuccess = true;
    const results = [];
    
    for (const service of services) {
        const success = await validateService(service);
        results.push({ service: service.name, success });
        
        if (!success) {
            overallSuccess = false;
        }
    }
    
    // Summary
    log(`\n${'='.repeat(60)}`, colors.bold);
    log('VALIDATION SUMMARY', colors.bold);
    log(`${'='.repeat(60)}`, colors.bold);
    
    for (const result of results) {
        if (result.success) {
            logSuccess(`${result.service}: All dependencies validated`);
        } else {
            logError(`${result.service}: Issues found`);
        }
    }
    
    if (overallSuccess) {
        log('\n🎉 All dependencies are properly installed and validated!', colors.green);
        process.exit(0);
    } else {
        log('\n💥 Some dependencies have issues that need to be resolved.', colors.red);
        process.exit(1);
    }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
    logError(`Uncaught exception: ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logError(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});

// Run the validation
main().catch(error => {
    logError(`Validation failed: ${error.message}`);
    process.exit(1);
});
