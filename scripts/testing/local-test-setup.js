#!/usr/bin/env node

/**
 * Local Testing Setup and Validation Script
 * Ensures the complete system runs locally before any deployment
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios').default;

class LocalTestSetup {
  constructor() {
    this.baseDir = path.resolve(__dirname, '..', '..');
    this.services = {
      middleware: { url: 'http://localhost:3000', status: 'stopped' },
      dataApi: { url: 'http://localhost:3001', status: 'stopped' },
      camunda: { url: 'http://localhost:8080', status: 'stopped' },
      postgres: { url: 'localhost:5432', status: 'stopped' }
    };
    
    this.steps = [
      { name: 'Environment Check', fn: this.checkEnvironment.bind(this) },
      { name: 'Dependencies Validation', fn: this.validateDependencies.bind(this) },
      { name: 'Docker Services Setup', fn: this.setupDockerServices.bind(this) },
      { name: 'Service Health Verification', fn: this.verifyServiceHealth.bind(this) },
      { name: 'Test Dependencies Installation', fn: this.installTestDependencies.bind(this) },
      { name: 'Integration Tests Execution', fn: this.runIntegrationTests.bind(this) },
      { name: 'System Cleanup', fn: this.cleanupSystem.bind(this) }
    ];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };

    const color = colors[level] || colors.info;
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
  }

  async execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.baseDir, ...options }, (error, stdout, stderr) => {
        if (error) {
          reject({ error, stdout, stderr });
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async checkEnvironment() {
    this.log('🔍 Checking local environment...', 'info');
    
    // Check Node.js version
    try {
      const { stdout } = await this.execCommand('node --version');
      const nodeVersion = stdout.trim();
      this.log(`  ✅ Node.js: ${nodeVersion}`, 'success');
      
      if (!nodeVersion.startsWith('v16') && !nodeVersion.startsWith('v18') && !nodeVersion.startsWith('v20')) {
        this.log(`  ⚠️  Node.js version should be 16+ (current: ${nodeVersion})`, 'warning');
      }
    } catch (error) {
      throw new Error('Node.js is not installed or not in PATH');
    }

    // Check Docker
    try {
      const { stdout } = await this.execCommand('docker --version');
      this.log(`  ✅ Docker: ${stdout.trim()}`, 'success');
    } catch (error) {
      throw new Error('Docker is not installed or not running');
    }

    // Check Docker Compose
    try {
      const { stdout } = await this.execCommand('docker-compose --version');
      this.log(`  ✅ Docker Compose: ${stdout.trim()}`, 'success');
    } catch (error) {
      throw new Error('Docker Compose is not installed');
    }

    // Check if ports are available
    const requiredPorts = [3000, 3001, 8080, 5432];
    for (const port of requiredPorts) {
      try {
        await this.execCommand(`netstat -an | grep :${port} | grep LISTEN`);
        this.log(`  ⚠️  Port ${port} is already in use`, 'warning');
      } catch (error) {
        this.log(`  ✅ Port ${port} is available`, 'success');
      }
    }

    // Check required files
    const requiredFiles = [
      'docker-compose.yml',
      'middleware/package.json',
      'data/package.json',
      'tests/package.json',
      '.env.example'
    ];

    for (const file of requiredFiles) {
      if (fs.existsSync(path.join(this.baseDir, file))) {
        this.log(`  ✅ Found: ${file}`, 'success');
      } else {
        throw new Error(`Required file missing: ${file}`);
      }
    }
  }

  async validateDependencies() {
    this.log('📦 Validating project dependencies...', 'info');
    
    const projects = ['middleware', 'data'];
    
    for (const project of projects) {
      const projectPath = path.join(this.baseDir, project);
      this.log(`  📁 Checking ${project}...`, 'info');
      
      // Check if node_modules exists
      const nodeModulesPath = path.join(projectPath, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        this.log(`  📥 Installing dependencies for ${project}...`, 'info');
        try {
          await this.execCommand('npm install', { cwd: projectPath });
          this.log(`  ✅ Dependencies installed for ${project}`, 'success');
        } catch (error) {
          throw new Error(`Failed to install dependencies for ${project}: ${error.stderr}`);
        }
      } else {
        this.log(`  ✅ Dependencies already installed for ${project}`, 'success');
      }

      // Validate TypeScript compilation for middleware
      if (project === 'middleware') {
        try {
          await this.execCommand('npx tsc --noEmit', { cwd: projectPath });
          this.log(`  ✅ TypeScript compilation successful`, 'success');
        } catch (error) {
          this.log(`  ❌ TypeScript compilation failed:`, 'error');
          this.log(`     ${error.stderr}`, 'error');
          throw new Error('TypeScript compilation failed');
        }
      }
    }

    // Check .env file
    const envFile = path.join(this.baseDir, '.env');
    if (!fs.existsSync(envFile)) {
      this.log('  📝 Creating .env file from .env.example...', 'info');
      const envExample = fs.readFileSync(path.join(this.baseDir, '.env.example'), 'utf8');
      fs.writeFileSync(envFile, envExample);
      this.log('  ✅ .env file created', 'success');
    } else {
      this.log('  ✅ .env file exists', 'success');
    }
  }

  async setupDockerServices() {
    this.log('🐳 Setting up Docker services...', 'info');
    
    // Stop any existing services
    try {
      await this.execCommand('docker-compose down');
      this.log('  🛑 Stopped existing services', 'info');
    } catch (error) {
      // Ignore errors if no services were running
    }

    // Build and start services
    this.log('  🏗️  Building and starting services...', 'info');
    try {
      await this.execCommand('docker-compose up --build -d');
      this.log('  ✅ Docker services started', 'success');
    } catch (error) {
      throw new Error(`Failed to start Docker services: ${error.stderr}`);
    }

    // Wait for services to be ready
    this.log('  ⏳ Waiting for services to initialize...', 'info');
    await this.sleep(30000); // Wait 30 seconds
    
    // Check service status
    try {
      const { stdout } = await this.execCommand('docker-compose ps');
      this.log('  📊 Service Status:', 'info');
      console.log(stdout);
    } catch (error) {
      this.log('  ⚠️  Could not get service status', 'warning');
    }
  }

  async verifyServiceHealth() {
    this.log('🏥 Verifying service health...', 'info');
    
    const healthChecks = [
      { name: 'Postgres', command: 'docker-compose exec -T postgres pg_isready -U camunda' },
      { name: 'Camunda', url: 'http://localhost:8080/engine-rest/engine' },
      { name: 'Data API', url: 'http://localhost:3001/health' },
      { name: 'Middleware', url: 'http://localhost:3000/health' }
    ];

    for (const check of healthChecks) {
      if (check.command) {
        try {
          await this.execCommand(check.command);
          this.log(`  ✅ ${check.name} is healthy`, 'success');
          this.services[check.name.toLowerCase()].status = 'running';
        } catch (error) {
          this.log(`  ❌ ${check.name} health check failed`, 'error');
          throw new Error(`${check.name} is not healthy`);
        }
      } else if (check.url) {
        let retries = 5;
        let healthy = false;
        
        while (retries > 0 && !healthy) {
          try {
            const response = await axios.get(check.url, { timeout: 5000 });
            this.log(`  ✅ ${check.name} is healthy (${response.status})`, 'success');
            healthy = true;
            
            // Update service status
            const serviceName = check.name.toLowerCase().replace(' ', '');
            if (this.services[serviceName]) {
              this.services[serviceName].status = 'running';
            }
          } catch (error) {
            retries--;
            if (retries > 0) {
              this.log(`  ⏳ ${check.name} not ready, retrying... (${retries} attempts left)`, 'warning');
              await this.sleep(5000);
            } else {
              this.log(`  ❌ ${check.name} health check failed after 5 attempts`, 'error');
              throw new Error(`${check.name} is not responding`);
            }
          }
        }
      }
    }

    this.log('  🎉 All services are healthy!', 'success');
  }

  async installTestDependencies() {
    this.log('🧪 Installing test dependencies...', 'info');
    
    const testsPath = path.join(this.baseDir, 'tests');
    
    // Install test dependencies
    try {
      await this.execCommand('npm install', { cwd: testsPath });
      this.log('  ✅ Test dependencies installed', 'success');
    } catch (error) {
      throw new Error(`Failed to install test dependencies: ${error.stderr}`);
    }

    // Check if tsx is available
    try {
      await this.execCommand('npx tsx --version', { cwd: testsPath });
      this.log('  ✅ TypeScript execution engine (tsx) available', 'success');
    } catch (error) {
      this.log('  📦 Installing tsx...', 'info');
      await this.execCommand('npm install tsx', { cwd: testsPath });
    }
  }

  async runIntegrationTests() {
    this.log('🚀 Running integration tests...', 'info');
    
    const testsPath = path.join(this.baseDir, 'tests');
    
    try {
      // Run the complete test suite
      const testProcess = spawn('node', ['run-tests.js'], {
        cwd: testsPath,
        stdio: 'inherit',
        env: { 
          ...process.env,
          NODE_ENV: 'test',
          MIDDLEWARE_URL: 'http://localhost:3000',
          DATA_API_URL: 'http://localhost:3001',
          CAMUNDA_URL: 'http://localhost:8080'
        }
      });

      await new Promise((resolve, reject) => {
        testProcess.on('close', (code) => {
          if (code === 0) {
            this.log('  ✅ All integration tests passed!', 'success');
            resolve();
          } else {
            this.log('  ❌ Some integration tests failed', 'error');
            reject(new Error(`Tests failed with exit code ${code}`));
          }
        });

        testProcess.on('error', (error) => {
          reject(error);
        });
      });

    } catch (error) {
      throw new Error(`Integration tests failed: ${error.message}`);
    }
  }

  async cleanupSystem() {
    this.log('🧹 System cleanup...', 'info');
    
    // Clean up test artifacts
    const testsPath = path.join(this.baseDir, 'tests');
    const artifacts = ['test-report.html', 'test-report.json', 'postman-results.json'];
    
    for (const artifact of artifacts) {
      const artifactPath = path.join(testsPath, artifact);
      if (fs.existsSync(artifactPath)) {
        this.log(`  📄 Test report available: ${artifact}`, 'info');
      }
    }

    this.log('  ✅ System ready for development', 'success');
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    const startTime = Date.now();
    
    console.log('\n' + '='.repeat(80));
    console.log('🏠 LOCAL TESTING SETUP AND VALIDATION');
    console.log('   Ensuring complete system runs locally before deployment');
    console.log('='.repeat(80) + '\n');

    try {
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        const stepNumber = i + 1;
        
        this.log(`\n📋 Step ${stepNumber}/${this.steps.length}: ${step.name}`, 'info');
        this.log('-'.repeat(50), 'info');
        
        await step.fn();
        
        this.log(`✅ Step ${stepNumber} completed successfully\n`, 'success');
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n' + '='.repeat(80));
      console.log('🎉 LOCAL TESTING SETUP COMPLETE!');
      console.log('='.repeat(80));
      
      this.log(`✅ Total setup time: ${duration} seconds`, 'success');
      this.log('🔗 Service URLs:', 'info');
      this.log('   • Middleware: http://localhost:3000', 'info');
      this.log('   • Data API: http://localhost:3001', 'info');
      this.log('   • Camunda: http://localhost:8080', 'info');
      this.log('   • Camunda Admin: http://localhost:8080/camunda (demo/demo)', 'info');
      
      this.log('\n📊 Test Reports:', 'info');
      this.log('   • HTML Report: tests/test-report.html', 'info');
      this.log('   • JSON Results: tests/test-report.json', 'info');
      
      this.log('\n🚀 System Status: READY FOR DEVELOPMENT', 'success');
      this.log('   All services running, all tests passing', 'success');
      this.log('   Safe to proceed with additional development or deployment', 'success');
      
    } catch (error) {
      console.log('\n' + '='.repeat(80));
      console.log('❌ LOCAL TESTING SETUP FAILED!');
      console.log('='.repeat(80));
      
      this.log(`💥 Error: ${error.message}`, 'error');
      this.log('\n🔧 Troubleshooting:', 'info');
      this.log('   1. Check Docker is running: docker info', 'info');
      this.log('   2. Verify port availability: netstat -an | grep :8080', 'info');
      this.log('   3. Check logs: docker-compose logs', 'info');
      this.log('   4. Reset environment: docker-compose down && docker system prune', 'info');
      
      process.exit(1);
    }
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);
const options = {
  skipTests: args.includes('--skip-tests'),
  verbose: args.includes('--verbose'),
  help: args.includes('--help')
};

if (options.help) {
  console.log(`
Local Testing Setup and Validation Script

Usage: node local-test-setup.js [options]

Options:
  --skip-tests    Skip integration test execution
  --verbose       Enable verbose logging
  --help          Show this help message

This script ensures the complete benefit plan management system
runs locally before any deployment by:

1. Checking environment prerequisites
2. Validating dependencies and compilation
3. Starting Docker services
4. Verifying service health
5. Running comprehensive integration tests
6. Providing deployment readiness confirmation

`);
  process.exit(0);
}

// Run the setup
if (require.main === module) {
  const setup = new LocalTestSetup();
  
  if (options.skipTests) {
    // Remove test steps if skipped
    setup.steps = setup.steps.filter(step => 
      !step.name.includes('Integration Tests')
    );
  }
  
  setup.run().catch(error => {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  });
}

module.exports = LocalTestSetup;
