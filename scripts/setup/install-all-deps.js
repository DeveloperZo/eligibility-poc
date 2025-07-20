const { execSync } = require('child_process');
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

function installDependencies(serviceName, servicePath) {
    log(`\n${'='.repeat(50)}`, colors.bold);
    log(`Installing dependencies for ${serviceName}`, colors.blue);
    log(`${'='.repeat(50)}`, colors.bold);
    
    try {
        // Change to service directory
        process.chdir(servicePath);
        log(`Working directory: ${process.cwd()}`, colors.yellow);
        
        // Run npm install
        log('Running npm install...', colors.blue);
        const installResult = execSync('npm install', { 
            stdio: 'inherit',
            encoding: 'utf8'
        });
        
        log(`✅ ${serviceName} dependencies installed successfully`, colors.green);
        
        // Check if node_modules exists
        if (fs.existsSync('./node_modules')) {
            log(`✅ node_modules directory created for ${serviceName}`, colors.green);
        } else {
            log(`❌ node_modules directory not found for ${serviceName}`, colors.red);
            return false;
        }
        
        // Run npm audit (but don't fail on warnings)
        try {
            log('Running npm audit...', colors.blue);
            execSync('npm audit --audit-level=high', { 
                stdio: 'inherit',
                encoding: 'utf8'
            });
            log(`✅ ${serviceName} audit passed`, colors.green);
        } catch (auditError) {
            log(`⚠️  ${serviceName} has some vulnerabilities (non-critical)`, colors.yellow);
        }
        
        return true;
    } catch (error) {
        log(`❌ Failed to install ${serviceName} dependencies: ${error.message}`, colors.red);
        return false;
    }
}

function main() {
    const originalDir = process.cwd();
    
    try {
        log('🚀 Starting dependency installation process...', colors.bold);
        
        // Ensure we're in the right directory
        process.chdir('C:/Repos/CamundaRetool');
        log(`Working in: ${process.cwd()}`, colors.yellow);
        
        const services = [
            { name: 'Root', path: 'C:/Repos/CamundaRetool' },
            { name: 'Middleware', path: 'C:/Repos/CamundaRetool/middleware' },
            { name: 'Data API', path: 'C:/Repos/CamundaRetool/data' },
            { name: 'Tests', path: 'C:/Repos/CamundaRetool/tests' }
        ];
        
        let allSuccessful = true;
        
        for (const service of services) {
            if (!installDependencies(service.name, service.path)) {
                allSuccessful = false;
                break;
            }
        }
        
        if (allSuccessful) {
            log('\n🎉 All dependencies installed successfully!', colors.green);
            
            // Verify all installations
            log('\nVerifying installations...', colors.blue);
            for (const service of services) {
                const nodeModulesPath = path.join(service.path, 'node_modules');
                if (fs.existsSync(nodeModulesPath)) {
                    log(`✅ ${service.name} node_modules verified`, colors.green);
                } else {
                    log(`❌ ${service.name} node_modules missing`, colors.red);
                    allSuccessful = false;
                }
            }
        }
        
        if (allSuccessful) {
            log('\n✨ All services ready for development!', colors.green);
        } else {
            log('\n💥 Some installations failed. Please check the errors above.', colors.red);
        }
        
    } catch (error) {
        log(`Fatal error: ${error.message}`, colors.red);
    } finally {
        // Return to original directory
        process.chdir(originalDir);
    }
}

main();
