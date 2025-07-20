#!/usr/bin/env node

/**
 * Deployment Readiness Checker
 * Ensures local testing has been completed before any deployment
 */

const fs = require('fs');
const path = require('path');

class DeploymentReadinessChecker {
  constructor() {
    this.baseDir = path.resolve(__dirname);
    this.testsDir = path.join(this.baseDir, 'tests');
  }

  log(message, level = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };

    const color = colors[level] || colors.info;
    console.log(`${color}${message}${colors.reset}`);
  }

  checkTestReports() {
    const reportFiles = [
      'test-report.json',
      'test-report.html'
    ];

    const reports = {};
    let hasReports = true;

    for (const reportFile of reportFiles) {
      const reportPath = path.join(this.testsDir, reportFile);
      if (fs.existsSync(reportPath)) {
        const stats = fs.statSync(reportPath);
        reports[reportFile] = {
          exists: true,
          lastModified: stats.mtime,
          size: stats.size
        };
      } else {
        reports[reportFile] = { exists: false };
        hasReports = false;
      }
    }

    return { hasReports, reports };
  }

  analyzeTestResults() {
    const jsonReportPath = path.join(this.testsDir, 'test-report.json');
    
    if (!fs.existsSync(jsonReportPath)) {
      return { valid: false, reason: 'No test report found' };
    }

    try {
      const reportData = JSON.parse(fs.readFileSync(jsonReportPath, 'utf8'));
      
      // Check if tests were recently run (within last 24 hours)
      const reportTime = new Date(reportData.timestamp);
      const now = new Date();
      const hoursSinceReport = (now - reportTime) / (1000 * 60 * 60);
      
      if (hoursSinceReport > 24) {
        return { 
          valid: false, 
          reason: `Test report is ${Math.round(hoursSinceReport)} hours old. Please run fresh tests.`,
          data: reportData
        };
      }

      // Check success rate
      const successRate = reportData.summary.successRate || 0;
      if (successRate < 90) {
        return {
          valid: false,
          reason: `Test success rate is ${successRate}%. Minimum 90% required for deployment.`,
          data: reportData
        };
      }

      // Check if any critical tests failed
      const failedTests = reportData.tests.filter(test => test.status === 'failed');
      if (failedTests.length > 0) {
        return {
          valid: false,
          reason: `${failedTests.length} test(s) failed. All tests must pass for deployment.`,
          data: reportData,
          failedTests
        };
      }

      return {
        valid: true,
        reason: 'All tests passed successfully',
        data: reportData
      };

    } catch (error) {
      return {
        valid: false,
        reason: `Could not parse test report: ${error.message}`
      };
    }
  }

  check() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 DEPLOYMENT READINESS CHECK');
    console.log('='.repeat(60));

    // Check if test reports exist
    const { hasReports, reports } = this.checkTestReports();
    
    if (!hasReports) {
      console.log('\n❌ DEPLOYMENT NOT READY');
      console.log('\nMissing test reports. Please run local testing first:');
      console.log('');
      console.log('  npm run test-local');
      console.log('');
      console.log('Missing files:');
      for (const [file, info] of Object.entries(reports)) {
        if (!info.exists) {
          console.log(`  ❌ ${file}`);
        }
      }
      return false;
    }

    this.log('\n📊 Test Report Status:', 'info');
    for (const [file, info] of Object.entries(reports)) {
      if (info.exists) {
        const ageHours = Math.round((Date.now() - info.lastModified) / (1000 * 60 * 60));
        this.log(`  ✅ ${file} (${ageHours}h old, ${Math.round(info.size/1024)}KB)`, 'success');
      }
    }

    // Analyze test results
    const analysis = this.analyzeTestResults();
    
    if (!analysis.valid) {
      console.log('\n❌ DEPLOYMENT NOT READY');
      console.log(`\nReason: ${analysis.reason}`);
      
      if (analysis.failedTests) {
        console.log('\nFailed Tests:');
        analysis.failedTests.forEach(test => {
          console.log(`  ❌ ${test.name} (${test.type})`);
        });
      }
      
      console.log('\nPlease fix issues and run tests again:');
      console.log('  npm run test-local');
      return false;
    }

    // Success case
    console.log('\n✅ DEPLOYMENT READY!');
    console.log(`\nTest Results Summary:`);
    console.log(`  📊 Success Rate: ${analysis.data.summary.successRate}%`);
    console.log(`  ✅ Tests Passed: ${analysis.data.summary.passed}`);
    console.log(`  ❌ Tests Failed: ${analysis.data.summary.failed}`);
    console.log(`  ⏱️  Last Run: ${new Date(analysis.data.timestamp).toLocaleString()}`);
    
    console.log(`\n🚀 System validated and ready for deployment!`);
    console.log(`\nTest Reports Available:`);
    console.log(`  📄 HTML Report: tests/test-report.html`);
    console.log(`  📋 JSON Report: tests/test-report.json`);
    
    return true;
  }

  printInstructions() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 PRE-DEPLOYMENT CHECKLIST');
    console.log('='.repeat(60));
    
    console.log('\n1. ✅ Run Local Testing:');
    console.log('   npm run test-local');
    
    console.log('\n2. ✅ Verify Deployment Readiness:');
    console.log('   npm run check-deployment');
    
    console.log('\n3. ✅ Review Test Reports:');
    console.log('   open tests/test-report.html');
    
    console.log('\n4. ✅ Only Then Proceed with Deployment');
    
    console.log('\n⚠️  DO NOT DEPLOY without completing steps 1-3!');
  }
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Deployment Readiness Checker

Usage: node check-deployment-readiness.js [options]

Options:
  --help, -h        Show this help message
  --instructions    Show pre-deployment instructions

This script verifies that local testing has been completed
successfully before allowing deployment to proceed.

`);
  process.exit(0);
}

if (args.includes('--instructions')) {
  const checker = new DeploymentReadinessChecker();
  checker.printInstructions();
  process.exit(0);
}

// Run the check
const checker = new DeploymentReadinessChecker();
const isReady = checker.check();

console.log('\n' + '='.repeat(60) + '\n');

process.exit(isReady ? 0 : 1);
