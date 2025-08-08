#!/usr/bin/env node

/**
 * Comprehensive End-to-End Test Runner
 * Orchestrates all testing scenarios with performance monitoring and reporting
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class TestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        cwd: process.cwd()
      },
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      performance: {
        systemHealth: {},
        resourceUsage: {},
        responseTimeBenchmarks: {}
      }
    };

    this.baseUrls = {
      middleware: process.env.MIDDLEWARE_URL || 'http://localhost:3000',
      dataApi: process.env.DATA_API_URL || 'http://localhost:3001',
      camunda: process.env.CAMUNDA_URL || 'http://localhost:8080'
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m',   // red
      reset: '\x1b[0m'
    };

    const color = colors[level] || colors.info;
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
  }

  async checkSystemHealth() {
    this.log('🏥 Checking system health...', 'info');
    
    const healthChecks = [
      { name: 'Middleware', url: `${this.baseUrls.middleware}/health` },
      { name: 'Data API', url: `${this.baseUrls.dataApi}/health` },
      { name: 'Camunda', url: `${this.baseUrls.camunda}/engine-rest/engine` }
    ];

    const healthResults = {};
    let allHealthy = true;

    for (const check of healthChecks) {
      try {
        const start = Date.now();
        const response = await axios.get(check.url, { timeout: 10000 });
        const duration = Date.now() - start;
        
        healthResults[check.name] = {
          status: 'healthy',
          responseTime: duration,
          statusCode: response.status
        };
        
        this.log(`  ✅ ${check.name}: ${duration}ms`, 'success');
      } catch (error) {
        healthResults[check.name] = {
          status: 'unhealthy',
          error: error.message,
          responseTime: null
        };
        
        this.log(`  ❌ ${check.name}: ${error.message}`, 'error');
        allHealthy = false;
      }
    }

    this.results.performance.systemHealth = healthResults;
    return allHealthy;
  }

  async runTypeScriptTests() {
    this.log('🧪 Running TypeScript integration tests...', 'info');
    
    return new Promise((resolve) => {
      const testProcess = spawn('npx', ['tsx', 'integration-tests.ts'], {
        cwd: path.join(__dirname),
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stderr.write(data);
      });

      testProcess.on('close', (code) => {
        const testResult = {
          name: 'TypeScript Integration Tests',
          type: 'integration',
          status: code === 0 ? 'passed' : 'failed',
          exitCode: code,
          output: output,
          errorOutput: errorOutput,
          timestamp: new Date().toISOString()
        };

        this.results.tests.push(testResult);
        
        if (code === 0) {
          this.results.summary.passed++;
          this.log('  ✅ TypeScript tests passed', 'success');
        } else {
          this.results.summary.failed++;
          this.log('  ❌ TypeScript tests failed', 'error');
        }
        
        this.results.summary.total++;
        resolve(code === 0);
      });
    });
  }

  async runPerformanceBenchmarks() {
    this.log('⚡ Running performance benchmarks...', 'info');
    
    const benchmarks = [
      {
        name: 'Health Check Response Time',
        url: `${this.baseUrls.middleware}/health`,
        target: 1000 // 1 second target
      },
      {
        name: 'Rules List Response Time',
        url: `${this.baseUrls.middleware}/api/rules`,
        target: 2000 // 2 seconds target
      },
      {
        name: 'Employee Data Response Time',
        url: `${this.baseUrls.dataApi}/employees`,
        target: 1500 // 1.5 seconds target
      }
    ];

    const benchmarkResults = {};

    for (const benchmark of benchmarks) {
      const measurements = [];
      
      // Run 5 measurements for each benchmark
      for (let i = 0; i < 5; i++) {
        try {
          const start = Date.now();
          await axios.get(benchmark.url, { timeout: 10000 });
          const duration = Date.now() - start;
          measurements.push(duration);
        } catch (error) {
          this.log(`  ⚠️  Benchmark ${benchmark.name} failed: ${error.message}`, 'warning');
          measurements.push(null);
        }
      }

      const validMeasurements = measurements.filter(m => m !== null);
      if (validMeasurements.length > 0) {
        const avg = validMeasurements.reduce((a, b) => a + b, 0) / validMeasurements.length;
        const max = Math.max(...validMeasurements);
        const min = Math.min(...validMeasurements);
        
        benchmarkResults[benchmark.name] = {
          average: Math.round(avg),
          maximum: max,
          minimum: min,
          target: benchmark.target,
          passed: avg <= benchmark.target,
          measurements: measurements
        };

        const status = avg <= benchmark.target ? '✅' : '❌';
        this.log(`  ${status} ${benchmark.name}: ${Math.round(avg)}ms (target: ${benchmark.target}ms)`, 
          avg <= benchmark.target ? 'success' : 'warning');
      }
    }

    this.results.performance.responseTimeBenchmarks = benchmarkResults;
    
    // Count benchmark as test
    const benchmarksPassed = Object.values(benchmarkResults).filter(b => b.passed).length;
    const benchmarksTotal = Object.keys(benchmarkResults).length;
    
    this.results.tests.push({
      name: 'Performance Benchmarks',
      type: 'performance',
      status: benchmarksPassed === benchmarksTotal ? 'passed' : 'failed',
      details: benchmarkResults,
      timestamp: new Date().toISOString()
    });

    if (benchmarksPassed === benchmarksTotal) {
      this.results.summary.passed++;
      this.log('  ✅ All performance benchmarks passed', 'success');
    } else {
      this.results.summary.failed++;
      this.log(`  ⚠️  ${benchmarksPassed}/${benchmarksTotal} performance benchmarks passed`, 'warning');
    }
    
    this.results.summary.total++;
  }

  generateReport() {
    this.log('📊 Generating test report...', 'info');
    
    const reportData = {
      ...this.results,
      summary: {
        ...this.results.summary,
        successRate: this.results.summary.total > 0 
          ? Math.round((this.results.summary.passed / this.results.summary.total) * 100)
          : 0
      }
    };

    // Write JSON report
    const jsonReportPath = path.join(__dirname, 'test-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(reportData, null, 2));
    
    // Write HTML report
    const htmlReport = this.generateHtmlReport(reportData);
    const htmlReportPath = path.join(__dirname, 'test-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    this.log(`📄 Reports generated:`, 'info');
    this.log(`  - JSON: ${jsonReportPath}`, 'info');
    this.log(`  - HTML: ${htmlReportPath}`, 'info');
  }

  generateHtmlReport(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8fafc; border-radius: 6px; padding: 15px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .passed { color: #10b981; }
        .failed { color: #ef4444; }
        .test-item { border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 10px; padding: 15px; }
        .test-status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status-passed { background: #10b981; }
        .status-failed { background: #ef4444; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 End-to-End Integration Test Report</h1>
            <p>Generated: ${data.timestamp}</p>
        </div>
        
        <div class="content">
            <div class="summary">
                <div class="metric">
                    <div class="metric-value passed">${data.summary.passed}</div>
                    <div>Tests Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value failed">${data.summary.failed}</div>
                    <div>Tests Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${data.summary.successRate}%</div>
                    <div>Success Rate</div>
                </div>
            </div>

            <h2>📋 Test Results</h2>
            ${data.tests.map(test => `
                <div class="test-item">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600;">${test.name}</span>
                        <span class="test-status status-${test.status}">${test.status.toUpperCase()}</span>
                    </div>
                    <div style="margin-top: 10px; color: #64748b;">
                        Type: ${test.type} | Time: ${test.timestamp}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  async run() {
    const startTime = Date.now();
    
    this.log('🚀 Starting comprehensive test suite...', 'info');
    this.log('=' .repeat(70), 'info');

    try {
      // Step 1: Check system health
      const systemHealthy = await this.checkSystemHealth();
      if (!systemHealthy) {
        this.log('⚠️  System health check failed. Some tests may fail.', 'warning');
      }

      // Step 2: Run TypeScript integration tests
      await this.runTypeScriptTests();

      // Step 3: Run performance benchmarks
      await this.runPerformanceBenchmarks();

      // Calculate total duration
      this.results.summary.duration = Date.now() - startTime;

      // Generate final report
      this.generateReport();

      // Print summary
      this.printFinalSummary();

    } catch (error) {
      this.log(`❌ Test suite failed with error: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  printFinalSummary() {
    this.log('', 'info');
    this.log('=' .repeat(70), 'info');
    this.log('🏁 TEST SUITE COMPLETE', 'info');
    this.log('=' .repeat(70), 'info');
    
    const { summary } = this.results;
    
    this.log(`📊 Results Summary:`, 'info');
    this.log(`   Total Tests: ${summary.total}`, 'info');
    this.log(`   Passed: ${summary.passed}`, summary.passed > 0 ? 'success' : 'info');
    this.log(`   Failed: ${summary.failed}`, summary.failed > 0 ? 'error' : 'info');
    this.log(`   Success Rate: ${summary.successRate}%`, summary.successRate >= 80 ? 'success' : 'warning');
    this.log(`   Duration: ${Math.round(summary.duration / 1000)}s`, 'info');
    
    if (summary.failed === 0) {
      this.log('', 'info');
      this.log('🎉 ALL TESTS PASSED!', 'success');
      this.log('   The benefit plan management system is ready for production.', 'success');
      this.log('   Complete workflow validated: Retool → DMN → Camunda → Evaluation', 'success');
    } else {
      this.log('', 'info');
      this.log('⚠️  SOME TESTS FAILED!', 'warning');
      this.log(`   Please review the ${summary.failed} failed test(s) before deployment.`, 'warning');
      this.log('   Check test-report.html for detailed failure information.', 'warning');
    }
    
    this.log('', 'info');
    this.log('📄 Detailed reports available:', 'info');
    this.log('   - test-report.html (comprehensive visual report)', 'info');
    this.log('   - test-report.json (machine-readable results)', 'info');
    this.log('', 'info');
  }
}

// Run the test suite
if (require.main === module) {
  const testRunner = new TestRunner();
  
  testRunner.run().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;
