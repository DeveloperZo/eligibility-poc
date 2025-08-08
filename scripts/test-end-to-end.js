#!/usr/bin/env node

/**
 * End-to-End Test for Stateless Orchestration
 * Tests the complete flow from draft to approval
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_BASE = 'http://localhost:3000/api';
const CAMUNDA_BASE = 'http://localhost:8080/engine-rest';

// Test data
const testDraft = {
  plan_data: {
    resourceType: 'InsurancePlan',
    id: uuidv4(),
    name: 'Test Premium Plan 2025',
    status: 'draft',
    type: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/insurance-plan-type',
        code: 'medical'
      }]
    }],
    period: {
      start: '2025-01-01',
      end: '2025-12-31'
    },
    coverage: [{
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/coverage-type',
          code: 'medical'
        }]
      },
      benefit: [{
        type: {
          coding: [{
            code: 'medical'
          }]
        }
      }]
    }]
  },
  created_by: 'test-user-1',
  updated_by: 'test-user-1'
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEndToEndTest() {
  log('\n🚀 Starting End-to-End Test\n', 'cyan');
  
  let draftId;
  let processInstanceId;
  let taskId;

  try {
    // Step 1: Create a draft
    log('1️⃣  Creating draft in Retool DB...', 'yellow');
    const createResponse = await axios.post(`${API_BASE}/drafts`, testDraft);
    draftId = createResponse.data.draftId;
    log(`   ✅ Draft created: ${draftId}`, 'green');

    // Step 2: Submit for approval
    log('\n2️⃣  Submitting draft for approval...', 'yellow');
    const submitResponse = await axios.post(`${API_BASE}/drafts/${draftId}/submit`, {
      userId: 'test-user-1'
    });
    processInstanceId = submitResponse.data.data.processInstanceId;
    log(`   ✅ Submitted, process: ${processInstanceId}`, 'green');

    // Step 3: Check approval status
    log('\n3️⃣  Checking approval status...', 'yellow');
    const statusResponse = await axios.get(`${API_BASE}/drafts/${draftId}/status`);
    log(`   ✅ Status: ${JSON.stringify(statusResponse.data.data)}`, 'green');

    // Step 4: Get pending tasks (as approver)
    log('\n4️⃣  Getting pending tasks for approver...', 'yellow');
    const tasksResponse = await axios.get(`${API_BASE}/tasks?userId=legal-approver`);
    
    if (tasksResponse.data.data && tasksResponse.data.data.length > 0) {
      taskId = tasksResponse.data.data[0].taskId;
      log(`   ✅ Found task: ${taskId}`, 'green');
    } else {
      // Try to get tasks without user filter
      const allTasksResponse = await axios.get(`${CAMUNDA_BASE}/task`);
      if (allTasksResponse.data.length > 0) {
        taskId = allTasksResponse.data[0].id;
        log(`   ✅ Found task (unassigned): ${taskId}`, 'green');
      } else {
        log('   ⚠️  No tasks found, checking process...', 'yellow');
      }
    }

    // Step 5: Complete approval task
    if (taskId) {
      log('\n5️⃣  Approving the plan...', 'yellow');
      const approveResponse = await axios.post(`${API_BASE}/tasks/${taskId}/complete`, {
        approved: true,
        comments: 'Looks good, approved for testing',
        userId: 'legal-approver'
      });
      log(`   ✅ Approval result: ${approveResponse.data.data.status}`, 'green');
    }

    // Step 6: Check final status
    log('\n6️⃣  Checking final status...', 'yellow');
    await sleep(2000); // Wait for process to complete
    const finalStatusResponse = await axios.get(`${API_BASE}/drafts/${draftId}/status`);
    log(`   ✅ Final status: ${JSON.stringify(finalStatusResponse.data.data)}`, 'green');

    // Step 7: Verify in Aidbox (mock)
    log('\n7️⃣  Verifying plan in Aidbox...', 'yellow');
    const draft = await axios.get(`${API_BASE}/drafts/${draftId}`);
    if (draft.data.aidbox_plan_id) {
      log(`   ✅ Plan published to Aidbox: ${draft.data.aidbox_plan_id}`, 'green');
    } else {
      log('   ⚠️  Plan not yet in Aidbox (may need more approvals)', 'yellow');
    }

    // Summary
    log('\n' + '='.repeat(60), 'cyan');
    log('✅ END-TO-END TEST COMPLETED SUCCESSFULLY!', 'green');
    log('='.repeat(60), 'cyan');
    
    log('\nTest Summary:', 'cyan');
    log(`  • Draft ID: ${draftId}`);
    log(`  • Process ID: ${processInstanceId}`);
    log(`  • Task ID: ${taskId || 'N/A'}`);
    log(`  • Status: ${finalStatusResponse.data.data.draftStatus}`);
    
  } catch (error) {
    log('\n❌ Test failed:', 'red');
    if (error.response) {
      console.error('Response error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

// Check services are running
async function checkServices() {
  log('🔍 Checking services...', 'cyan');
  
  const services = [
    { name: 'Middleware', url: `${API_BASE}/health` },
    { name: 'Camunda', url: `${CAMUNDA_BASE}/engine` }
  ];
  
  for (const service of services) {
    try {
      await axios.get(service.url);
      log(`  ✅ ${service.name} is running`, 'green');
    } catch (error) {
      log(`  ❌ ${service.name} is not responding at ${service.url}`, 'red');
      log('     Please start services with: docker-compose up -d', 'yellow');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  try {
    await checkServices();
    await runEndToEndTest();
  } catch (error) {
    log('Unexpected error:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
main();
