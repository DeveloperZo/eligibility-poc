/**
 * Test script to verify stateless orchestration controller
 * Ensures no database dependencies and proper stateless operation
 */

import axios from 'axios';

const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL || 'http://localhost:3000';

async function testStatelessOrchestration() {
  console.log('🧪 Testing Stateless Orchestration Controller...\n');
  
  const tests = [
    {
      name: 'Health Check - No Database',
      method: 'GET',
      url: `${MIDDLEWARE_URL}/api/health`,
      validate: (res: any) => {
        // Ensure no database in dependencies
        if (res.data.dependencies && 'database' in res.data.dependencies) {
          throw new Error('Database dependency still present in health check');
        }
        return true;
      }
    },
    {
      name: 'List Plans',
      method: 'GET',
      url: `${MIDDLEWARE_URL}/api/plans`,
      validate: (res: any) => {
        // Should work without database
        return res.success !== undefined;
      }
    },
    {
      name: 'Get Pending Tasks',
      method: 'GET',
      url: `${MIDDLEWARE_URL}/api/tasks?userId=test-user`,
      validate: (res: any) => {
        // Should work without database
        return res.success !== undefined;
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`📝 Testing: ${test.name}`);
      
      const response = await axios({
        method: test.method as any,
        url: test.url,
        validateStatus: () => true // Don't throw on non-2xx
      });
      
      if (test.validate(response.data)) {
        console.log(`✅ PASSED: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ FAILED: ${test.name} - Validation failed`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ FAILED: ${test.name} - ${error.message}`);
      failed++;
    }
    console.log('');
  }
  
  console.log('📊 Test Results:');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total:  ${tests.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Stateless orchestration is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the implementation.');
  }
  
  return failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  testStatelessOrchestration()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testStatelessOrchestration };
