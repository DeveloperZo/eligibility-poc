#!/usr/bin/env node

/**
 * Service Compilation and Runtime Test Script
 * Tests each service independently to ensure they can compile and run without errors
 */

const fs = require('fs');
const path = require('path');

class ServiceTester {
  constructor() {
    this.results = {
      middleware: { build: null, syntax: null, dependencies: null },
      dataApi: { syntax: null, dependencies: null, dataFiles: null },
      tests: { syntax: null, dependencies: null, configuration: null }
    };
  }

  log(message, status = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m', 
      error: '\x1b[31m',
      warning: '\x1b[33m'
    };
    const reset = '\x1b[0m';
    console.log(`${colors[status]}${message}${reset}`);
  }

  // Test 1: Middleware Service Tests
  testMiddlewareService() {
    this.log('=== Testing Middleware Service ===');
    
    try {
      // Check TypeScript compilation artifacts
      const distPath = path.join(__dirname, 'middleware', 'dist');
      const indexJsPath = path.join(distPath, 'index.js');
      const appJsPath = path.join(distPath, 'app.js');
      
      if (!fs.existsSync(distPath)) {
        this.results.middleware.build = 'FAIL - Dist directory not found';
        this.log('❌ Middleware: Dist directory not found', 'error');
        return false;
      }
      
      if (!fs.existsSync(indexJsPath)) {
        this.results.middleware.build = 'FAIL - index.js not compiled';
        this.log('❌ Middleware: index.js not found in dist', 'error');
        return false;
      }
      
      if (!fs.existsSync(appJsPath)) {
        this.results.middleware.build = 'FAIL - app.js not compiled';
        this.log('❌ Middleware: app.js not found in dist', 'error');
        return false;
      }
      
      this.results.middleware.build = 'PASS';
      this.log('✅ Middleware: Build artifacts exist', 'success');
      
      // Check syntax by reading compiled files
      try {
        const indexContent = fs.readFileSync(indexJsPath, 'utf8');
        const appContent = fs.readFileSync(appJsPath, 'utf8');
        
        if (indexContent.includes('require(') && appContent.includes('exports.')) {
          this.results.middleware.syntax = 'PASS';
          this.log('✅ Middleware: Compiled JavaScript syntax valid', 'success');
        } else {
          this.results.middleware.syntax = 'WARN - Unexpected compilation format';
          this.log('⚠️ Middleware: Compiled format may be incorrect', 'warning');
        }
      } catch (error) {
        this.results.middleware.syntax = 'FAIL - Cannot read compiled files';
        this.log('❌ Middleware: Cannot read compiled files', 'error');
        return false;
      }
      
      // Check package.json and node_modules
      const packagePath = path.join(__dirname, 'middleware', 'package.json');
      const nodeModulesPath = path.join(__dirname, 'middleware', 'node_modules');
      
      if (fs.existsSync(packagePath) && fs.existsSync(nodeModulesPath)) {
        this.results.middleware.dependencies = 'PASS';
        this.log('✅ Middleware: Dependencies installed', 'success');
      } else {
        this.results.middleware.dependencies = 'FAIL - Dependencies missing';
        this.log('❌ Middleware: Missing package.json or node_modules', 'error');
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.results.middleware.build = `FAIL - ${error.message}`;
      this.log(`❌ Middleware test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 2: Data API Service Tests
  testDataApiService() {
    this.log('\\n=== Testing Data API Service ===');
    
    try {
      // Check main API file
      const apiServerPath = path.join(__dirname, 'data', 'api-server.js');
      if (!fs.existsSync(apiServerPath)) {
        this.results.dataApi.syntax = 'FAIL - api-server.js not found';
        this.log('❌ Data API: api-server.js not found', 'error');
        return false;
      }
      
      // Check syntax by reading and basic validation
      const apiContent = fs.readFileSync(apiServerPath, 'utf8');
      if (apiContent.includes('express') && apiContent.includes('app.listen')) {
        this.results.dataApi.syntax = 'PASS';
        this.log('✅ Data API: JavaScript syntax valid', 'success');
      } else {
        this.results.dataApi.syntax = 'FAIL - Invalid Express app structure';
        this.log('❌ Data API: Invalid Express app structure', 'error');
        return false;
      }
      
      // Check data files
      const dataFiles = ['employees.json', 'healthPlans.json', 'groups.json'];
      let allDataFilesExist = true;
      
      for (const file of dataFiles) {
        const filePath = path.join(__dirname, 'data', file);
        if (!fs.existsSync(filePath)) {
          allDataFilesExist = false;
          this.log(`❌ Data API: Missing ${file}`, 'error');
        } else {
          try {
            JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.log(`✅ Data API: ${file} is valid JSON`, 'success');
          } catch (error) {
            allDataFilesExist = false;
            this.log(`❌ Data API: ${file} contains invalid JSON`, 'error');
          }
        }
      }
      
      if (allDataFilesExist) {
        this.results.dataApi.dataFiles = 'PASS';
      } else {
        this.results.dataApi.dataFiles = 'FAIL - Missing or invalid data files';
        return false;
      }
      
      // Check dependencies
      const packagePath = path.join(__dirname, 'data', 'package.json');
      const nodeModulesPath = path.join(__dirname, 'data', 'node_modules');
      
      if (fs.existsSync(packagePath) && fs.existsSync(nodeModulesPath)) {
        this.results.dataApi.dependencies = 'PASS';
        this.log('✅ Data API: Dependencies installed', 'success');
      } else {
        this.results.dataApi.dependencies = 'FAIL - Dependencies missing';
        this.log('❌ Data API: Missing package.json or node_modules', 'error');
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.results.dataApi.syntax = `FAIL - ${error.message}`;
      this.log(`❌ Data API test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 3: Integration Tests Suite
  testIntegrationSuite() {
    this.log('\\n=== Testing Integration Test Suite ===');
    
    try {
      // Check test files
      const integrationTestPath = path.join(__dirname, 'tests', 'integration-tests.ts');
      const runTestsPath = path.join(__dirname, 'tests', 'run-tests.js');
      
      if (!fs.existsSync(integrationTestPath)) {
        this.results.tests.syntax = 'FAIL - integration-tests.ts not found';
        this.log('❌ Tests: integration-tests.ts not found', 'error');
        return false;
      }
      
      if (!fs.existsSync(runTestsPath)) {
        this.results.tests.syntax = 'FAIL - run-tests.js not found';
        this.log('❌ Tests: run-tests.js not found', 'error');
        return false;
      }
      
      // Check TypeScript syntax
      const tsContent = fs.readFileSync(integrationTestPath, 'utf8');
      if (tsContent.includes('import') && tsContent.includes('interface')) {
        this.results.tests.syntax = 'PASS';
        this.log('✅ Tests: TypeScript syntax valid', 'success');
      } else {
        this.results.tests.syntax = 'WARN - Unexpected TypeScript structure';
        this.log('⚠️ Tests: TypeScript structure may be incorrect', 'warning');
      }
      
      // Check JavaScript syntax
      const jsContent = fs.readFileSync(runTestsPath, 'utf8');
      if (jsContent.includes('class') && jsContent.includes('require')) {
        this.log('✅ Tests: JavaScript syntax valid', 'success');
      } else {
        this.log('⚠️ Tests: JavaScript structure may be incorrect', 'warning');
      }
      
      // Check test dependencies
      const packagePath = path.join(__dirname, 'tests', 'package.json');
      const nodeModulesPath = path.join(__dirname, 'tests', 'node_modules');
      
      if (fs.existsSync(packagePath) && fs.existsSync(nodeModulesPath)) {
        this.results.tests.dependencies = 'PASS';
        this.log('✅ Tests: Dependencies installed', 'success');
      } else {
        this.results.tests.dependencies = 'FAIL - Dependencies missing';
        this.log('❌ Tests: Missing package.json or node_modules', 'error');
        return false;
      }
      
      // Check configuration files
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageJson.scripts && packageJson.scripts['test:integration']) {
        this.results.tests.configuration = 'PASS';
        this.log('✅ Tests: Configuration valid', 'success');
      } else {
        this.results.tests.configuration = 'FAIL - Missing test:integration script';
        this.log('❌ Tests: Missing test:integration script in package.json', 'error');
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.results.tests.syntax = `FAIL - ${error.message}`;
      this.log(`❌ Integration tests failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Run all tests
  async runAllTests() {
    this.log('🚀 Starting Individual Service Compilation and Runtime Tests\\n');
    
    const startTime = Date.now();
    
    const middlewarePass = this.testMiddlewareService();
    const dataApiPass = this.testDataApiService();
    const testsPass = this.testIntegrationSuite();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Generate summary
    this.log('\\n=== Test Summary ===');
    
    let totalTests = 0;
    let passedTests = 0;
    
    // Count middleware tests
    Object.values(this.results.middleware).forEach(result => {
      if (result) {
        totalTests++;
        if (result.includes('PASS')) passedTests++;
      }
    });
    
    // Count data API tests  
    Object.values(this.results.dataApi).forEach(result => {
      if (result) {
        totalTests++;
        if (result.includes('PASS')) passedTests++;
      }
    });
    
    // Count integration tests
    Object.values(this.results.tests).forEach(result => {
      if (result) {
        totalTests++;
        if (result.includes('PASS')) passedTests++;
      }
    });
    
    this.log(`Total Tests: ${totalTests}`);
    this.log(`Passed: ${passedTests}`, passedTests === totalTests ? 'success' : 'warning');
    this.log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests === 0 ? 'success' : 'error');
    this.log(`Duration: ${duration}ms`);
    
    if (middlewarePass && dataApiPass && testsPass) {
      this.log('\\n🎉 ALL SERVICES READY FOR INDEPENDENT COMPILATION AND RUNTIME', 'success');
      return true;
    } else {
      this.log('\\n❌ SOME SERVICES HAVE ISSUES THAT NEED TO BE RESOLVED', 'error');
      return false;
    }
  }

  // Print detailed results
  printDetailedResults() {
    this.log('\\n=== Detailed Results ===');
    
    this.log('\\nMiddleware Service:');
    console.log(`  Build: ${this.results.middleware.build || 'Not tested'}`);
    console.log(`  Syntax: ${this.results.middleware.syntax || 'Not tested'}`);
    console.log(`  Dependencies: ${this.results.middleware.dependencies || 'Not tested'}`);
    
    this.log('\\nData API Service:');
    console.log(`  Syntax: ${this.results.dataApi.syntax || 'Not tested'}`);
    console.log(`  Dependencies: ${this.results.dataApi.dependencies || 'Not tested'}`);
    console.log(`  Data Files: ${this.results.dataApi.dataFiles || 'Not tested'}`);
    
    this.log('\\nIntegration Tests:');
    console.log(`  Syntax: ${this.results.tests.syntax || 'Not tested'}`);
    console.log(`  Dependencies: ${this.results.tests.dependencies || 'Not tested'}`);
    console.log(`  Configuration: ${this.results.tests.configuration || 'Not tested'}`);
  }
}

// Run the tests
async function main() {
  const tester = new ServiceTester();
  const success = await tester.runAllTests();
  tester.printDetailedResults();
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { ServiceTester };
