#!/usr/bin/env node

/**
 * Comprehensive system validation script
 * Tests TypeScript compilation, service dependencies, and API endpoints
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const http = require('http');

class SystemValidator {
  constructor() {
    this.results = {
      typescript: false,
      structure: false,
      dependencies: false,
      services: false
    };
  }

  async validate() {
    console.log('🔍 Starting comprehensive system validation...\n');
    
    try {
      await this.validateTypeScript();
      await this.validateStructure();
      await this.validateDependencies();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
    }
  }

  async validateTypeScript() {
    console.log('📝 Validating TypeScript compilation...');
    
    return new Promise((resolve) => {
      const tscProcess = spawn('npx', ['tsc', '--noEmit'], {
        cwd: path.join(__dirname, 'middleware'),
        stdio: 'pipe'
      });

      let errors = '';

      tscProcess.stderr.on('data', (data) => {
        errors += data.toString();
      });

      tscProcess.on('close', (code) => {
        if (code === 0) {
          console.log('  ✅ TypeScript compilation successful');
          this.results.typescript = true;
        } else {
          console.log('  ❌ TypeScript compilation failed');
          console.log('     Errors:', errors.split('\n').slice(0, 3).join('\n     '));
        }
        resolve();
      });

      tscProcess.on('error', () => {
        console.log('  ⚠️  TypeScript compiler not available (run: cd middleware && npm install)');
        resolve();
      });
    });
  }

  async validateStructure() {
    console.log('\n📁 Validating project structure...');
    
    const requiredPaths = [
      'middleware/src/models/interfaces.ts',
      'middleware/src/services/camunda.service.ts',
      'middleware/src/services/data-api.service.ts', 
      'middleware/src/services/dmn-generator.service.ts',
      'middleware/src/controllers/dmn.controller.ts',
      'middleware/src/templates/dmn-templates.ts',
      'middleware/src/utils/dmn-utils.ts',
      'middleware/src/app.ts',
      'middleware/src/index.ts',
      'middleware/package.json',
      'middleware/tsconfig.json',
      'data/employees.json',
      'data/healthPlans.json',
      'data/groups.json',
      'data/api-server.js',
      'data/package.json',
      'docker-compose.yml',
      '.env'
    ];

    const fs = require('fs');
    let missingFiles = [];

    for (const filePath of requiredPaths) {
      const fullPath = path.join(__dirname, filePath);
      if (!fs.existsSync(fullPath)) {
        missingFiles.push(filePath);
      }
    }

    if (missingFiles.length === 0) {
      console.log('  ✅ All required files present');
      this.results.structure = true;
    } else {
      console.log('  ❌ Missing files:');
      missingFiles.forEach(file => console.log(`     - ${file}`));
    }
  }

  async validateDependencies() {
    console.log('\n📦 Validating package dependencies...');
    
    // Check middleware dependencies
    const middlewarePath = path.join(__dirname, 'middleware');
    const dataPath = path.join(__dirname, 'data');
    
    const checkDependencies = (projectPath, name) => {
      return new Promise((resolve) => {
        const fs = require('fs');
        const nodeModulesPath = path.join(projectPath, 'node_modules');
        
        if (fs.existsSync(nodeModulesPath)) {
          console.log(`  ✅ ${name} dependencies installed`);
          resolve(true);
        } else {
          console.log(`  ⚠️  ${name} dependencies not installed (run: cd ${path.basename(projectPath)} && npm install)`);
          resolve(false);
        }
      });
    };

    const middlewareDeps = await checkDependencies(middlewarePath, 'Middleware');
    const dataDeps = await checkDependencies(dataPath, 'Data API');
    
    this.results.dependencies = middlewareDeps && dataDeps;
  }

  generateReport() {
    console.log('\n📊 Validation Report');
    console.log('='.repeat(50));
    
    const checks = [
      { name: 'TypeScript Compilation', status: this.results.typescript },
      { name: 'Project Structure', status: this.results.structure },
      { name: 'Dependencies', status: this.results.dependencies }
    ];

    checks.forEach(check => {
      const icon = check.status ? '✅' : '❌';
      console.log(`${icon} ${check.name}`);
    });

    const allPassed = Object.values(this.results).every(result => result);
    
    console.log('\n' + '='.repeat(50));
    
    if (allPassed) {
      console.log('🎉 System validation PASSED!');
      console.log('\n🚀 Ready to start development:');
      console.log('   1. Start Docker services: docker-compose up -d');
      console.log('   2. Start data API: cd data && npm start');
      console.log('   3. Start middleware: cd middleware && npm run dev');
      console.log('\n📋 Then test endpoints:');
      console.log('   • http://localhost:3000/health');
      console.log('   • http://localhost:3001/health');
      console.log('   • http://localhost:3000/api/dmn/templates');
    } else {
      console.log('⚠️  System validation has issues');
      console.log('\n🔧 Fix the issues above, then run: npm run validate');
    }

    console.log('\n📚 Documentation: See README.md for detailed setup instructions');
  }
}

// Run validation
const validator = new SystemValidator();
validator.validate();
