/**
 * MINIMAL VIABLE BENEFIT PLAN SYSTEM
 * Total code: ~200 lines
 * Development time: 1 weekend
 */

import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

// Camunda client (10 lines)
const camunda = axios.create({
  baseURL: 'http://localhost:8080/engine-rest'
});

// Database "simulator" (in production, use real DB)
const plans = new Map();
const versions = [];

// ============ THAT'S IT FOR SETUP ============

// API 1: Submit Plan (starts workflow)
app.post('/api/plan/submit', async (req, res) => {
  const { planName, planType, submittedBy } = req.body;
  
  // Save plan
  const planId = `PLAN-${Date.now()}`;
  plans.set(planId, {
    id: planId,
    name: planName,
    type: planType,
    submittedBy,
    status: 'pending',
    version: 1,
    createdAt: new Date()
  });
  
  // Start workflow
  const { data: process } = await camunda.post(
    '/process-definition/key/benefit-plan-approval/start',
    {
      variables: {
        planId: { value: planId, type: 'String' },
        planName: { value: planName, type: 'String' },
        planType: { value: planType, type: 'String' },
        submittedBy: { value: submittedBy, type: 'String' }
      }
    }
  );
  
  res.json({
    success: true,
    planId,
    processId: process.id,
    message: 'Plan submitted for approval'
  });
});

// API 2: Get Pending Approvals
app.get('/api/approvals/pending', async (req, res) => {
  const { data: tasks } = await camunda.get('/task');
  
  // Enrich with plan data
  const enrichedTasks = await Promise.all(
    tasks.map(async (task) => {
      // Get process variables
      const { data: vars } = await camunda.get(
        `/task/${task.id}/variables`
      );
      
      return {
        taskId: task.id,
        taskName: task.name,
        planId: vars.planId?.value,
        planName: vars.planName?.value,
        planType: vars.planType?.value,
        submittedBy: vars.submittedBy?.value,
        created: task.created,
        assignee: task.assignee
      };
    })
  );
  
  res.json({
    success: true,
    tasks: enrichedTasks,
    count: enrichedTasks.length
  });
});

// API 3: Approve/Reject Plan
app.post('/api/approval/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const { decision, comments } = req.body;
  
  // Get task variables to find plan
  const { data: vars } = await camunda.get(`/task/${taskId}/variables`);
  const planId = vars.planId?.value;
  
  // Update plan status
  const plan = plans.get(planId);
  if (plan) {
    plan.status = decision === 'approve' ? 'approved' : 'rejected';
    plan.approvedBy = req.body.approvedBy || 'system';
    plan.approvalDate = new Date();
    
    // Create version if approved
    if (decision === 'approve') {
      plan.version += 1;
      versions.push({
        planId,
        version: plan.version,
        timestamp: new Date(),
        changes: comments
      });
    }
  }
  
  // Complete Camunda task
  await camunda.post(`/task/${taskId}/complete`, {
    variables: {
      approved: { value: decision === 'approve', type: 'Boolean' },
      comments: { value: comments || '', type: 'String' }
    }
  });
  
  res.json({
    success: true,
    planId,
    decision,
    newVersion: plan?.version,
    message: `Plan ${decision}d successfully`
  });
});

// API 4: Get Plan History
app.get('/api/plans/:planId/history', async (req, res) => {
  const { planId } = req.params;
  const plan = plans.get(planId);
  const planVersions = versions.filter(v => v.planId === planId);
  
  res.json({
    success: true,
    plan,
    versions: planVersions,
    versionCount: planVersions.length
  });
});

// API 5: List All Plans
app.get('/api/plans', async (req, res) => {
  res.json({
    success: true,
    plans: Array.from(plans.values()),
    total: plans.size
  });
});

// Start server
app.listen(3000, () => {
  console.log('✅ Minimal Benefit Plan API running on :3000');
  console.log('📝 Connect Retool to these endpoints:');
  console.log('   POST /api/plan/submit');
  console.log('   GET  /api/approvals/pending');
  console.log('   POST /api/approval/:taskId');
  console.log('   GET  /api/plans');
  console.log('   GET  /api/plans/:planId/history');
});
