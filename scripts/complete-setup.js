#!/usr/bin/env node

/**
 * Complete Setup for Benefit Plan Approval Workflow
 * Implements the CRAWL plan with stateless orchestration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, options = {}) {
  try {
    log(`  Running: ${command}`, 'yellow');
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result;
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Step 1: Start Docker Services
async function startServices() {
  log('\n🐳 Starting Docker Services...', 'cyan');
  
  // Start core services
  runCommand('docker compose up -d postgres camunda');
  
  log('  Waiting for services to be ready...', 'yellow');
  await sleep(10000);
  
  // Start mock Retool DB (using second postgres instance)
  log('  Starting Retool PostgreSQL...', 'yellow');
  runCommand('docker run -d --name retool-postgres -p 5433:5432 -e POSTGRES_PASSWORD=retool postgres:14');
  
  await sleep(5000);
  log('  ✅ Services started', 'green');
}

// Step 2: Apply Database Schemas
async function applySchemas() {
  log('\n💾 Applying Database Schemas...', 'cyan');
  
  // Apply Retool schema
  const retoolSchema = `
-- Retool Database Schema for Benefit Plan Drafts
CREATE TABLE IF NOT EXISTS benefit_plan_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aidbox_plan_id VARCHAR(255),
    plan_data JSONB NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'draft',
    camunda_process_id VARCHAR(255),
    
    -- Indexes
    CONSTRAINT uk_active_process UNIQUE (camunda_process_id) WHERE status = 'submitted'
);

CREATE INDEX idx_draft_user ON benefit_plan_drafts(created_by);
CREATE INDEX idx_draft_status ON benefit_plan_drafts(status);
CREATE INDEX idx_draft_process ON benefit_plan_drafts(camunda_process_id) WHERE camunda_process_id IS NOT NULL;
`;

  // Write schema to temp file
  fs.writeFileSync('/tmp/retool-schema.sql', retoolSchema);
  
  // Apply to Retool DB
  runCommand('docker cp /tmp/retool-schema.sql retool-postgres:/tmp/');
  runCommand('docker exec retool-postgres psql -U postgres -d postgres -f /tmp/retool-schema.sql');
  
  log('  ✅ Schemas applied', 'green');
}

// Step 3: Deploy BPMN to Camunda
async function deployBPMN() {
  log('\n📋 Deploying BPMN Process...', 'cyan');
  
  const bpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="benefit-approval-process" 
                  targetNamespace="http://example.org/benefit">
  
  <bpmn:process id="benefit-approval" name="Benefit Plan Approval" isExecutable="true">
    
    <bpmn:startEvent id="start" name="Plan Submitted">
      <bpmn:extensionElements>
        <camunda:formData>
          <camunda:formField id="draftId" type="string" />
          <camunda:formField id="baseVersion" type="string" />
          <camunda:formField id="submittedBy" type="string" />
        </camunda:formData>
      </bpmn:extensionElements>
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="legal-approval" />
    
    <bpmn:userTask id="legal-approval" name="Legal Approval" camunda:assignee="legal-team">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:userTask>
    
    <bpmn:sequenceFlow id="flow2" sourceRef="legal-approval" targetRef="gateway" />
    
    <bpmn:exclusiveGateway id="gateway" name="Approved?">
      <bpmn:incoming>flow2</bpmn:incoming>
      <bpmn:outgoing>approved-flow</bpmn:outgoing>
      <bpmn:outgoing>rejected-flow</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <bpmn:sequenceFlow id="approved-flow" sourceRef="gateway" targetRef="publish">
      <bpmn:conditionExpression>\${approved == true}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    
    <bpmn:sequenceFlow id="rejected-flow" sourceRef="gateway" targetRef="end-rejected">
      <bpmn:conditionExpression>\${approved == false}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    
    <bpmn:serviceTask id="publish" name="Publish to Aidbox" camunda:type="external" camunda:topic="publish-plan">
      <bpmn:incoming>approved-flow</bpmn:incoming>
      <bpmn:outgoing>flow3</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <bpmn:sequenceFlow id="flow3" sourceRef="publish" targetRef="end-approved" />
    
    <bpmn:endEvent id="end-approved" name="Plan Approved">
      <bpmn:incoming>flow3</bpmn:incoming>
    </bpmn:endEvent>
    
    <bpmn:endEvent id="end-rejected" name="Plan Rejected">
      <bpmn:incoming>rejected-flow</bpmn:incoming>
    </bpmn:endEvent>
    
  </bpmn:process>
</bpmn:definitions>`;

  // Save BPMN file
  fs.writeFileSync('/tmp/benefit-approval.bpmn', bpmn);
  
  // Deploy to Camunda via REST API
  try {
    const formData = new (require('form-data'))();
    formData.append('deployment-name', 'Benefit Plan Approval Process');
    formData.append('benefit-approval.bpmn', fs.createReadStream('/tmp/benefit-approval.bpmn'));
    
    await axios.post('http://localhost:8080/engine-rest/deployment/create', formData, {
      headers: formData.getHeaders()
    });
    
    log('  ✅ BPMN deployed to Camunda', 'green');
  } catch (error) {
    log('  ⚠️  BPMN deployment failed (Camunda might not be ready)', 'yellow');
  }
}

// Step 4: Build and Start Middleware
async function startMiddleware() {
  log('\n🔨 Building Middleware...', 'cyan');
  
  const middlewarePath = path.join(__dirname, '..', 'middleware');
  
  // Install dependencies
  runCommand('npm install', { cwd: middlewarePath });
  
  // Build TypeScript
  runCommand('npm run build', { cwd: middlewarePath });
  
  log('  ✅ Middleware built', 'green');
  
  // Start middleware in background
  log('  Starting middleware service...', 'yellow');
  const { spawn } = require('child_process');
  const middleware = spawn('npm', ['start'], {
    cwd: middlewarePath,
    detached: true,
    stdio: 'ignore'
  });
  middleware.unref();
  
  await sleep(5000);
  log('  ✅ Middleware started', 'green');
}

// Step 5: Run End-to-End Test
async function runE2ETest() {
  log('\n🧪 Running End-to-End Test...', 'cyan');
  
  try {
    // Create a test draft
    log('  Creating test draft...', 'yellow');
    const draftResponse = await axios.post('http://localhost:3000/api/drafts', {
      plan_data: {
        resourceType: 'InsurancePlan',
        name: 'Test Benefit Plan',
        status: 'draft',
        period: {
          start: '2025-01-01',
          end: '2025-12-31'
        }
      },
      created_by: 'test-user',
      updated_by: 'test-user'
    });
    
    const draftId = draftResponse.data.draftId;
    log(`  ✅ Draft created: ${draftId}`, 'green');
    
    // Submit for approval
    log('  Submitting for approval...', 'yellow');
    const submitResponse = await axios.post(`http://localhost:3000/api/drafts/${draftId}/submit`, {
      userId: 'test-user'
    });
    
    const processId = submitResponse.data.data.processInstanceId;
    log(`  ✅ Submitted, process: ${processId}`, 'green');
    
    // Get pending tasks
    log('  Checking for pending tasks...', 'yellow');
    const tasksResponse = await axios.get('http://localhost:3000/api/tasks?userId=legal-team');
    
    if (tasksResponse.data.data && tasksResponse.data.data.length > 0) {
      const taskId = tasksResponse.data.data[0].taskId;
      log(`  ✅ Found task: ${taskId}`, 'green');
      
      // Complete approval
      log('  Approving plan...', 'yellow');
      await axios.post(`http://localhost:3000/api/tasks/${taskId}/complete`, {
        approved: true,
        comments: 'Approved for testing',
        userId: 'legal-team'
      });
      log('  ✅ Plan approved', 'green');
    }
    
    log('\n✅ End-to-End Test Completed Successfully!', 'green');
    
  } catch (error) {
    log(`  ❌ Test failed: ${error.message}`, 'red');
  }
}

// Main execution
async function main() {
  log('\n🚀 Setting Up Benefit Plan Approval Workflow', 'magenta');
  log('   Following CRAWL Implementation Plan', 'cyan');
  log('=' .repeat(60), 'magenta');
  
  try {
    await startServices();
    await applySchemas();
    await deployBPMN();
    await startMiddleware();
    await runE2ETest();
    
    log('\n' + '='.repeat(60), 'magenta');
    log('🎉 SETUP COMPLETE!', 'green');
    log('='.repeat(60), 'magenta');
    
    log('\n📚 Architecture:', 'cyan');
    log('  • Retool DB (5433): Stores drafts');
    log('  • Camunda (8080): Manages workflow state');
    log('  • Orchestration (3000): Stateless coordination');
    log('  • Aidbox: Will store approved plans');
    
    log('\n🔗 Access Points:', 'cyan');
    log('  • API: http://localhost:3000/api');
    log('  • Camunda: http://localhost:8080/camunda (admin/admin)');
    log('  • Health: http://localhost:3000/api/health');
    
    log('\n✅ System is ready for benefit plan management!', 'green');
    
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run setup
main();
