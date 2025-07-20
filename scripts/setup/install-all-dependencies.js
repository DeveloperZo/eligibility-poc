#!/usr/bin/env node
/**
 * Manual dependency installation for all services
 * This script will ensure all services have their dependencies properly installed
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');

// Store original directory
const originalDir = process.cwd();

function executeCommand(command, workingDir, serviceName) {
    return new Promise((resolve, reject) => {
        console.log(`\n🔧 Running: ${command}`);
        console.log(`📁 Directory: ${workingDir}`);
        
        try {
            // Change to the service directory
            process.chdir(workingDir);
            
            // Execute the command synchronously for better output control
            const result = execSync(command, {
                stdio: 'inherit',
                encoding: 'utf8',
                timeout: 300000 // 5 minute timeout
            });
            
            console.log(`✅ ${serviceName} - Command completed successfully`);
            resolve(result);
        } catch (error) {
            console.log(`❌ ${serviceName} - Command failed:`, error.message);
            reject(error);
        } finally {
            // Always return to original directory
            process.chdir(originalDir);
        }
    });
}

async function installDependenciesForService(serviceName, servicePath) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Installing dependencies for ${serviceName}`);
    console.log(`${'='.repeat(60)}`);
    
    const fullPath = path.resolve(servicePath);
    
    // Check if service directory exists
    if (!fs.existsSync(fullPath)) {
        console.log(`❌ Service directory not found: ${fullPath}`);
        return false;
    }
    
    // Check if package.json exists
    const packageJsonPath = path.join(fullPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        console.log(`❌ No package.json found in ${fullPath}`);
        return false;
    }
    
    try {
        // Show package info
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log(`📋 Package: ${packageJson.name || 'unknown'}`);
        console.log(`📄 Version: ${packageJson.version || 'unknown'}`);
        
        const deps = Object.keys(packageJson.dependencies || {});
        const devDeps = Object.keys(packageJson.devDependencies || {});
        console.log(`📦 Total dependencies: ${deps.length + devDeps.length} (${deps.length} prod + ${devDeps.length} dev)`);
        
        // Install dependencies
        await executeCommand('npm install', fullPath, serviceName);
        
        // Verify installation
        const nodeModulesPath = path.join(fullPath, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
            const installedPackages = fs.readdirSync(nodeModulesPath)
                .filter(item => !item.startsWith('.'))
                .length;
            console.log(`✅ ${serviceName} - ${installedPackages} packages installed successfully`);
            
            // Run npm audit (but don't fail on warnings)
            try {
                await executeCommand('npm audit --audit-level=high', fullPath, serviceName);
                console.log(`🔒 ${serviceName} - Security audit passed`);
            } catch (auditError) {
                console.log(`⚠️  ${serviceName} - Has some security warnings (non-critical)`);
            }
            
            return true;
        } else {
            console.log(`❌ ${serviceName} - node_modules not created`);
            return false;
        }
        
    } catch (error) {
        console.log(`❌ ${serviceName} - Installation failed:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting comprehensive dependency installation...\n');
    
    // Ensure we're in the correct directory
    const expectedPath = 'C:\\Repos\\CamundaRetool';
    if (!process.cwd().includes('CamundaRetool')) {
        try {
            process.chdir(expectedPath);
            console.log(`📁 Changed to project directory: ${process.cwd()}`);
        } catch (error) {
            console.log(`❌ Could not change to project directory: ${error.message}`);
            process.exit(1);
        }
    }
    
    const services = [
        { name: 'Middleware Service', path: './middleware' },
        { name: 'Data API Service', path: './data' },
        { name: 'Test Suite', path: './tests' }
    ];
    
    let allSuccessful = true;
    const results = [];
    
    for (const service of services) {
        try {
            const success = await installDependenciesForService(service.name, service.path);
            results.push({ name: service.name, success });
            
            if (!success) {
                allSuccessful = false;
            }
        } catch (error) {
            console.log(`💥 Fatal error installing ${service.name}:`, error.message);
            results.push({ name: service.name, success: false });
            allSuccessful = false;
        }
    }
    
    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 INSTALLATION SUMMARY');
    console.log(`${'='.repeat(60)}`);
    
    for (const result of results) {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`${result.name}: ${status}`);
    }
    
    if (allSuccessful) {
        console.log('\n🎉 All dependencies installed successfully!');
        console.log('🚀 System is ready for development');
        
        // Final verification
        console.log('\n🔍 Final verification:');
        for (const service of services) {
            const nodeModulesPath = path.join(service.path, 'node_modules');
            const exists = fs.existsSync(nodeModulesPath);
            console.log(`${service.name}: ${exists ? '✅ Ready' : '❌ Missing'}`);
        }
        
    } else {
        console.log('\n💥 Some installations failed!');
        console.log('Please check the errors above and retry the failed services.');
        process.exit(1);
    }
}

// Run the installation
main().catch(error => {
    console.log('\n💥 Installation process failed:', error.message);
    process.exit(1);
});
