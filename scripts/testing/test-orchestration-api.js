/**
 * Test script for Orchestration API endpoints
 * Run with: node scripts/testing/test-orchestration-api.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

// Test data
const testPlan = {
  id: 'test-plan-001',
  name: 'Premium Health Plan 2025',
  status: 'draft',
  period: ['2025-01-01', '2025-12-31'],
  coverage: [
    {
      type: 'medical',
      network: ['in-network', 'out-of-network'],
      costSharing: {
        deductible: { value: 1000, currency: 'USD' },
        outOfPocketMax: { value: 5000, currency: 'USD' }
      }
    }
  ],
  meta: {
    versionId: '1'
  }
};

const testUserId = 'user-123';

async function runTests() {
  console.log('🧪 Testing Orchestration API Endpoints\n');
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    // Test 2: Get Plan (should fail initially as plan doesn't exist)
    console.log('\n2️⃣ Testing Get Plan (expect 404)...');
    try {
      await axios.get(`${API_BASE}/plans/${testPlan.id}`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Correctly returned 404 for non-existent plan');
      } else {
        throw error;
      }
    }
    
    // Test 3: Submit for Approval
    console.log('\n3️⃣ Testing Submit for Approval...');
    const submitResponse = await axios.post(
      `${API_BASE}/plans/${testPlan.id}/submit`,
      {
        planData: testPlan,
        userId: testUserId
      }
    );
    console.log('✅ Plan submitted for approval:', submitResponse.data);
    
    // Test 4: Check Status
    console.log('\n4️⃣ Testing Get Plan Status...');
    const statusResponse = await axios.get(`${API_BASE}/plans/${testPlan.id}/status`);
    console.log('✅ Plan status retrieved:', statusResponse.data);
    
    // Test 5: Get Pending Tasks
    console.log('\n5️⃣ Testing Get Pending Tasks...');
    const tasksResponse = await axios.get(`${API_BASE}/tasks?userId=${testUserId}`);
    console.log('✅ Pending tasks retrieved:', tasksResponse.data);
    
    // Test 6: List All Plans
    console.log('\n6️⃣ Testing List All Plans...');
    const plansResponse = await axios.get(`${API_BASE}/plans`);
    console.log('✅ Plans list retrieved:', plansResponse.data);
    
    // Test 7: Try to Submit Again (should fail - already in approval)
    console.log('\n7️⃣ Testing Duplicate Submit (expect 409)...');
    try {
      await axios.post(
        `${API_BASE}/plans/${testPlan.id}/submit`,
        {
          planData: testPlan,
          userId: testUserId
        }
      );
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('✅ Correctly prevented duplicate submission');
      } else {
        throw error;
      }
    }
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests
runTests().then(() => {
  console.log('\n🎉 Orchestration API tests completed successfully!');
}).catch(error => {
  console.error('\n💥 Tests failed:', error);
  process.exit(1);
});
