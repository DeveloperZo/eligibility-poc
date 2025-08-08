#!/usr/bin/env tsx

/**
 * Comprehensive End-to-End Integration Test Suite
 * Tests the complete workflow from rule creation through DMN deployment to Camunda and eligibility evaluation
 */

import axios, { AxiosInstance } from 'axios';
import { performance } from 'perf_hooks';

// Type definitions
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  details?: any;
}

interface Employee {
  id: string;
  name: string;
  age: number;
  groupNumber: string;
  healthPlan: string;
  healthPlanStatus: string;
}

interface RuleConfiguration {
  ruleId: string;
  ruleName: string;
  ruleType: 'age' | 'healthPlan' | 'groupNumber';
  configuration: any;
  metadata: {
    description: string;
    createdBy: string;
  };
}

interface EligibilityResult {
  eligible: boolean;
  reasoning: string;
  executedRules: string[];
  evaluationTime: number;
}

class IntegrationTestSuite {
  private middlewareClient: AxiosInstance;
  private dataClient: AxiosInstance;
  private results: TestResult[] = [];
  private createdRules: string[] = [];
  
  constructor() {
    const middlewareUrl = process.env.MIDDLEWARE_URL || 'http://localhost:3000';
    const dataUrl = process.env.DATA_API_URL || 'http://localhost:3001';
    
    this.middlewareClient = axios.create({
      baseURL: middlewareUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    this.dataClient = axios.create({
      baseURL: dataUrl,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log(`🧪 Running: ${name}`);
      await testFn();
      const duration = performance.now() - startTime;
      
      this.results.push({
        name,
        status: 'PASS',
        duration: Math.round(duration)
      });
      
      console.log(`✅ PASS: ${name} (${Math.round(duration)}ms)`);
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.results.push({
        name,
        status: 'FAIL',
        duration: Math.round(duration),
        error: error instanceof Error ? error.message : String(error)
      });
      
      console.log(`❌ FAIL: ${name} (${Math.round(duration)}ms)`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Test 1: System Health and Connectivity
  private async testSystemHealth(): Promise<void> {
    // Test middleware health
    const middlewareHealth = await this.middlewareClient.get('/health');
    if (!middlewareHealth.data.success) {
      throw new Error('Middleware health check failed');
    }

    // Test data API health
    const dataHealth = await this.dataClient.get('/health');
    if (!dataHealth.data.success) {
      throw new Error('Data API health check failed');
    }

    // Test Camunda connectivity through middleware
    const camundaHealth = await this.middlewareClient.get('/api/camunda/health');
    if (!camundaHealth.data.success) {
      throw new Error('Camunda connectivity check failed');
    }
  }

  // Test 2: External Data Sources
  private async testExternalDataSources(): Promise<void> {
    // Test employee data
    const employees = await this.dataClient.get('/employees');
    if (!employees.data.success || !Array.isArray(employees.data.data) || employees.data.data.length === 0) {
      throw new Error('Employee data not available');
    }

    // Test health plans data
    const healthPlans = await this.dataClient.get('/health-plans');
    if (!healthPlans.data.success || !Array.isArray(healthPlans.data.data) || healthPlans.data.data.length === 0) {
      throw new Error('Health plans data not available');
    }

    // Test groups data
    const groups = await this.dataClient.get('/groups');
    if (!groups.data.success || !Array.isArray(groups.data.data) || groups.data.data.length === 0) {
      throw new Error('Groups data not available');
    }
  }

  // Test 3: Age Rule Creation and Deployment
  private async testAgeRuleWorkflow(): Promise<void> {
    const ruleConfig: RuleConfiguration = {
      ruleId: 'TEST_AGE_INTEGRATION_001',
      ruleName: 'Integration Test - Age 21 Minimum',
      ruleType: 'age',
      configuration: {
        ageThreshold: 21,
        operator: '>='
      },
      metadata: {
        description: 'Integration test for age validation workflow',
        createdBy: 'integration-test-suite'
      }
    };

    // Create rule
    const createResponse = await this.middlewareClient.post('/api/rules/create', ruleConfig);
    if (!createResponse.data.success) {
      throw new Error(`Rule creation failed: ${createResponse.data.message}`);
    }

    this.createdRules.push(ruleConfig.ruleId);

    // Verify rule exists in Camunda
    const deploymentId = createResponse.data.data.deploymentId;
    const camundaCheck = await this.middlewareClient.get(`/api/camunda/deployments/${deploymentId}`);
    if (!camundaCheck.data.success) {
      throw new Error('Rule not found in Camunda after deployment');
    }

    // Test with eligible employee (age >= 21)
    const eligibleTest = await this.middlewareClient.post('/api/evaluate', {
      employeeId: 'EMP-004', // Alice Johnson, age 28
      rules: [ruleConfig.ruleId],
      context: { testMode: true }
    });

    if (!eligibleTest.data.success || !eligibleTest.data.data.eligible) {
      throw new Error('Eligible employee failed age validation');
    }

    // Test with ineligible employee (age < 21)
    const ineligibleTest = await this.middlewareClient.post('/api/evaluate', {
      employeeId: 'EMP-006', // Grace Wilson, age 19
      rules: [ruleConfig.ruleId],
      context: { testMode: true }
    });

    if (!ineligibleTest.data.success || ineligibleTest.data.data.eligible) {
      throw new Error('Ineligible employee passed age validation');
    }
  }

  // Test 4: Health Plan Rule Creation and Deployment
  private async testHealthPlanRuleWorkflow(): Promise<void> {
    const ruleConfig: RuleConfiguration = {
      ruleId: 'TEST_HEALTH_INTEGRATION_001',
      ruleName: 'Integration Test - Premium Health Plans',
      ruleType: 'healthPlan',
      configuration: {
        allowedPlans: ['Premium PPO', 'Executive HMO'],
        requireActiveStatus: true
      },
      metadata: {
        description: 'Integration test for health plan validation workflow',
        createdBy: 'integration-test-suite'
      }
    };

    // Create rule
    const createResponse = await this.middlewareClient.post('/api/rules/create', ruleConfig);
    if (!createResponse.data.success) {
      throw new Error(`Health plan rule creation failed: ${createResponse.data.message}`);
    }

    this.createdRules.push(ruleConfig.ruleId);

    // Test with eligible employee (has Premium PPO)
    const eligibleTest = await this.middlewareClient.post('/api/evaluate', {
      employeeId: 'EMP-002', // Jane Smith, Premium PPO
      rules: [ruleConfig.ruleId],
      context: { testMode: true }
    });

    if (!eligibleTest.data.success || !eligibleTest.data.data.eligible) {
      throw new Error('Employee with Premium PPO failed health plan validation');
    }

    // Test with ineligible employee (has Basic HMO)
    const ineligibleTest = await this.middlewareClient.post('/api/evaluate', {
      employeeId: 'EMP-001', // John Doe, Basic HMO
      rules: [ruleConfig.ruleId],
      context: { testMode: true }
    });

    if (!ineligibleTest.data.success || ineligibleTest.data.data.eligible) {
      throw new Error('Employee with Basic HMO passed health plan validation');
    }
  }

  // Test 5: Group Number Rule Creation and Deployment
  private async testGroupNumberRuleWorkflow(): Promise<void> {
    const ruleConfig: RuleConfiguration = {
      ruleId: 'TEST_GROUP_INTEGRATION_001',
      ruleName: 'Integration Test - Executive Group',
      ruleType: 'groupNumber',
      configuration: {
        allowedGroups: ['12345'],
        exactMatch: true
      },
      metadata: {
        description: 'Integration test for group number validation workflow',
        createdBy: 'integration-test-suite'
      }
    };

    // Create rule
    const createResponse = await this.middlewareClient.post('/api/rules/create', ruleConfig);
    if (!createResponse.data.success) {
      throw new Error(`Group number rule creation failed: ${createResponse.data.message}`);
    }

    this.createdRules.push(ruleConfig.ruleId);

    // Test with eligible employee (in group 12345)
    const eligibleTest = await this.middlewareClient.post('/api/evaluate', {
      employeeId: 'EMP-001', // John Doe, group 12345
      rules: [ruleConfig.ruleId],
      context: { testMode: true }
    });

    if (!eligibleTest.data.success || !eligibleTest.data.data.eligible) {
      throw new Error('Employee in group 12345 failed group validation');
    }

    // Test with ineligible employee (in different group)
    const ineligibleTest = await this.middlewareClient.post('/api/evaluate', {
      employeeId: 'EMP-003', // Bob Johnson, group 67890
      rules: [ruleConfig.ruleId],
      context: { testMode: true }
    });

    if (!ineligibleTest.data.success || ineligibleTest.data.data.eligible) {
      throw new Error('Employee in wrong group passed group validation');
    }
  }

  // Test 6: Multi-Rule Evaluation
  private async testMultiRuleEvaluation(): Promise<void> {
    // Create a complex scenario with multiple rules
    const ageRuleId = 'TEST_MULTI_AGE_001';
    const healthRuleId = 'TEST_MULTI_HEALTH_001';

    // Create age rule (>= 25)
    await this.middlewareClient.post('/api/rules/create', {
      ruleId: ageRuleId,
      ruleName: 'Multi-Test Age 25+',
      ruleType: 'age',
      configuration: { ageThreshold: 25, operator: '>=' },
      metadata: { description: 'Multi-rule test - age component', createdBy: 'integration-test' }
    });

    // Create health plan rule
    await this.middlewareClient.post('/api/rules/create', {
      ruleId: healthRuleId,
      ruleName: 'Multi-Test Premium Plans',
      ruleType: 'healthPlan',
      configuration: { allowedPlans: ['Premium PPO'], requireActiveStatus: true },
      metadata: { description: 'Multi-rule test - health plan component', createdBy: 'integration-test' }
    });

    this.createdRules.push(ageRuleId, healthRuleId);

    // Test employee who meets all criteria
    const allEligibleTest = await this.middlewareClient.post('/api/evaluate', {
      employeeId: 'EMP-004', // Alice Johnson: age 28, Premium PPO
      rules: [ageRuleId, healthRuleId],
      context: { testMode: true }
    });

    if (!allEligibleTest.data.success || !allEligibleTest.data.data.eligible) {
      throw new Error('Employee meeting all criteria failed multi-rule evaluation');
    }

    // Test employee who fails age requirement
    const ageFailTest = await this.middlewareClient.post('/api/evaluate', {
      employeeId: 'EMP-006', // Grace Wilson: age 19, Basic HMO (fails both)
      rules: [ageRuleId, healthRuleId],
      context: { testMode: true }
    });

    if (!ageFailTest.data.success || ageFailTest.data.data.eligible) {
      throw new Error('Employee failing multiple criteria passed multi-rule evaluation');
    }
  }

  // Test 7: Performance Testing
  private async testPerformance(): Promise<void> {
    const iterations = 10;
    const evaluationTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      const response = await this.middlewareClient.post('/api/evaluate', {
        employeeId: 'EMP-001',
        rules: this.createdRules.slice(0, 3), // Use first 3 created rules
        context: { testMode: true }
      });

      const endTime = performance.now();
      evaluationTimes.push(endTime - startTime);

      if (!response.data.success) {
        throw new Error(`Performance test iteration ${i + 1} failed`);
      }
    }

    const avgTime = evaluationTimes.reduce((a, b) => a + b, 0) / evaluationTimes.length;
    const maxTime = Math.max(...evaluationTimes);

    console.log(`   Performance metrics: avg=${Math.round(avgTime)}ms, max=${Math.round(maxTime)}ms`);

    // Fail if average response time is too slow
    if (avgTime > 5000) { // 5 seconds
      throw new Error(`Average response time too slow: ${Math.round(avgTime)}ms > 5000ms`);
    }
  }

  // Test 8: Error Handling
  private async testErrorHandling(): Promise<void> {
    // Test invalid rule creation
    try {
      await this.middlewareClient.post('/api/rules/create', {
        ruleId: 'INVALID_RULE',
        ruleName: '', // Invalid: empty name
        ruleType: 'age',
        configuration: {},
        metadata: { description: 'Test', createdBy: 'test' }
      });
      throw new Error('Invalid rule creation should have failed');
    } catch (error: any) {
      if (error.message === 'Invalid rule creation should have failed') {
        throw error;
      }
      // Expected error - validation should catch this
    }

    // Test evaluation with non-existent employee
    try {
      await this.middlewareClient.post('/api/evaluate', {
        employeeId: 'NON_EXISTENT',
        rules: this.createdRules.slice(0, 1),
        context: { testMode: true }
      });
      throw new Error('Evaluation with non-existent employee should have failed');
    } catch (error: any) {
      if (error.message === 'Evaluation with non-existent employee should have failed') {
        throw error;
      }
      // Expected error
    }

    // Test evaluation with non-existent rule
    try {
      await this.middlewareClient.post('/api/evaluate', {
        employeeId: 'EMP-001',
        rules: ['NON_EXISTENT_RULE'],
        context: { testMode: true }
      });
      throw new Error('Evaluation with non-existent rule should have failed');
    } catch (error: any) {
      if (error.message === 'Evaluation with non-existent rule should have failed') {
        throw error;
      }
      // Expected error
    }
  }

  // Test 9: Data Consistency
  private async testDataConsistency(): Promise<void> {
    // List all rules
    const rulesResponse = await this.middlewareClient.get('/api/rules');
    if (!rulesResponse.data.success) {
      throw new Error('Failed to list rules');
    }

    const systemRules = rulesResponse.data.data.rules;
    const createdRulesInSystem = systemRules.filter((rule: any) => 
      this.createdRules.includes(rule.ruleId)
    );

    if (createdRulesInSystem.length !== this.createdRules.length) {
      throw new Error(`Rule count mismatch: created ${this.createdRules.length}, found ${createdRulesInSystem.length}`);
    }

    // Verify each rule has correct configuration
    for (const rule of createdRulesInSystem) {
      if (!rule.configuration || !rule.metadata) {
        throw new Error(`Rule ${rule.ruleId} missing configuration or metadata`);
      }

      if (rule.status !== 'active') {
        throw new Error(`Rule ${rule.ruleId} not in active status: ${rule.status}`);
      }
    }
  }

  // Test 10: Cleanup and Rule Deletion
  private async testRuleCleanup(): Promise<void> {
    let deletedCount = 0;

    for (const ruleId of this.createdRules) {
      try {
        const deleteResponse = await this.middlewareClient.delete(`/api/rules/${ruleId}`);
        if (deleteResponse.data.success) {
          deletedCount++;
        }
      } catch (error) {
        console.log(`   Warning: Failed to delete rule ${ruleId}`);
      }
    }

    // Verify rules are deleted
    const rulesResponse = await this.middlewareClient.get('/api/rules');
    const remainingRules = rulesResponse.data.data.rules.filter((rule: any) =>
      this.createdRules.includes(rule.ruleId)
    );

    if (remainingRules.length > 0) {
      throw new Error(`${remainingRules.length} rules still exist after deletion`);
    }

    console.log(`   Cleaned up ${deletedCount} test rules`);
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 END-TO-END INTEGRATION TEST RESULTS');
    console.log('='.repeat(80));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;

    console.log(`\n📊 Summary: ${passed}/${total} tests passed (${Math.round(passed/total*100)}% success rate)`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   • ${r.name}: ${r.error}`));
    }

    console.log('\n⏱️  Performance Summary:');
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgTime = Math.round(totalTime / this.results.length);
    console.log(`   • Total execution time: ${Math.round(totalTime)}ms`);
    console.log(`   • Average test time: ${avgTime}ms`);

    console.log('\n📋 Test Coverage:');
    console.log('   ✓ System connectivity and health checks');
    console.log('   ✓ External data source integration');
    console.log('   ✓ Rule creation and DMN deployment');
    console.log('   ✓ Eligibility evaluation workflow');
    console.log('   ✓ Multi-rule scenario testing');
    console.log('   ✓ Performance benchmarking');
    console.log('   ✓ Error handling validation');
    console.log('   ✓ Data consistency verification');
    console.log('   ✓ Cleanup and deletion workflows');

    if (failed === 0) {
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('   The complete benefit plan management system is working correctly.');
      console.log('   Ready for production deployment.');
    } else {
      console.log('\n⚠️  INTEGRATION TESTS FAILED!');
      console.log('   Please review and fix the issues above before deployment.');
    }

    console.log('\n' + '='.repeat(80));
  }

  public async runAll(): Promise<void> {
    console.log('🚀 Starting End-to-End Integration Test Suite');
    console.log('   Testing complete workflow: Retool → DMN → Camunda → Evaluation\n');

    const tests = [
      { name: 'System Health and Connectivity', fn: () => this.testSystemHealth() },
      { name: 'External Data Sources', fn: () => this.testExternalDataSources() },
      { name: 'Age Rule Workflow', fn: () => this.testAgeRuleWorkflow() },
      { name: 'Health Plan Rule Workflow', fn: () => this.testHealthPlanRuleWorkflow() },
      { name: 'Group Number Rule Workflow', fn: () => this.testGroupNumberRuleWorkflow() },
      { name: 'Multi-Rule Evaluation', fn: () => this.testMultiRuleEvaluation() },
      { name: 'Performance Testing', fn: () => this.testPerformance() },
      { name: 'Error Handling', fn: () => this.testErrorHandling() },
      { name: 'Data Consistency', fn: () => this.testDataConsistency() },
      { name: 'Rule Cleanup', fn: () => this.testRuleCleanup() }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn);
    }

    this.generateReport();
  }
}

// Run the test suite
async function main() {
  const testSuite = new IntegrationTestSuite();
  
  try {
    await testSuite.runAll();
  } catch (error) {
    console.error('❌ Test suite execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default IntegrationTestSuite;
