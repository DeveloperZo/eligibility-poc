#!/usr/bin/env node

/**
 * Rule Management REST API Test Script
 * Tests all the newly implemented endpoints
 */

const axios = require('axios');
const chalk = require('chalk');

const BASE_URL = process.env.MIDDLEWARE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

class APITester {
  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    switch (type) {
      case 'success':
        console.log(chalk.green(`[${timestamp}] ✓ ${message}`));
        break;
      case 'error':
        console.log(chalk.red(`[${timestamp}] ✗ ${message}`));
        break;
      case 'info':
        console.log(chalk.blue(`[${timestamp}] ℹ ${message}`));
        break;
      case 'warning':
        console.log(chalk.yellow(`[${timestamp}] ⚠ ${message}`));
        break;
    }
  }

  async runTest(testName, testFunction) {
    this.testResults.total++;
    this.log(`Running test: ${testName}`);
    
    try {
      await testFunction();
      this.testResults.passed++;
      this.log(`Test passed: ${testName}`, 'success');
    } catch (error) {
      this.testResults.failed++;
      this.log(`Test failed: ${testName} - ${error.message}`, 'error');
      if (error.response) {
        this.log(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
      }
    }
  }

  async testHealthCheck() {
    const response = await this.client.get('/../../health');
    if (response.data.success !== true) {
      throw new Error('Health check failed');
    }
    this.log('Health check response:', 'info');
    console.log(JSON.stringify(response.data, null, 2));
  }

  async testCreateRule() {
    const ruleData = {
      ruleId: 'TEST_AGE_001',
      ruleName: 'Test Age Rule - Minimum 21',
      ruleType: 'age',
      configuration: {
        ageThreshold: 21,
        operator: '>='
      },
      metadata: {
        description: 'Test rule for API validation',
        createdBy: 'api-test-script'
      }
    };

    const response = await this.client.post('/rules/create', ruleData);
    if (response.data.success !== true) {
      throw new Error('Create rule failed');
    }
    
    this.log(`Rule created: ${response.data.data.ruleId} (Deployment: ${response.data.data.deploymentId})`);
    return response.data.data;
  }

  async testListRules() {
    const response = await this.client.get('/rules');
    if (response.data.success !== true) {
      throw new Error('List rules failed');
    }
    this.log(`Found ${response.data.data.total} rules in system`);
    return response.data.data.rules;
  }

  async testEvaluateEmployee() {
    const evaluationData = {
      employeeId: 'EMP-001',
      context: {
        testMode: true
      }
    };

    const response = await this.client.post('/evaluate', evaluationData);
    if (response.data.success !== true) {
      throw new Error('Employee evaluation failed');
    }
    
    this.log(`Employee evaluation: eligible=${response.data.data.eligible}, rules executed=${response.data.data.executedRules.length}`);
    return response.data.data;
  }

  async runAllTests() {
    console.log(chalk.blue('\n=== Rule Management REST API Test Suite ===\n'));
    
    try {
      await this.runTest('Health Check', () => this.testHealthCheck());
      await this.runTest('List Rules', () => this.testListRules());
      await this.runTest('Create Rule', () => this.testCreateRule());
      await this.runTest('Evaluate Employee', () => this.testEvaluateEmployee());
      
    } catch (error) {
      this.log(`Unexpected error: ${error.message}`, 'error');
    }
    
    // Print results
    console.log('\n' + chalk.blue('=== Test Results ==='));
    console.log(chalk.green(`Passed: ${this.testResults.passed}`));
    console.log(chalk.red(`Failed: ${this.testResults.failed}`));
    console.log(chalk.blue(`Total: ${this.testResults.total}`));
    
    const successRate = (this.testResults.passed / this.testResults.total * 100).toFixed(1);
    console.log(chalk.blue(`Success Rate: ${successRate}%`));
    
    if (this.testResults.failed === 0) {
      console.log(chalk.green('\n🎉 All tests passed! API is working correctly.'));
    } else {
      console.log(chalk.red('\n❌ Some tests failed. Please check the implementation.'));
    }
  }
}

if (require.main === module) {
  const tester = new APITester();
  tester.runAllTests().catch(error => {
    console.error(chalk.red('Test suite failed:'), error);
    process.exit(1);
  });
}

module.exports = APITester;
