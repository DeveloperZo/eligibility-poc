/**
 * Version Conflict Detection Tests
 * 
 * Tests for the enhanced version conflict detection functionality
 * in the stateless orchestration service
 */

import { orchestrationService } from '../services/stateless-orchestration.service';
import { mockAidboxService } from '../services/mock-aidbox.service';
import { retoolDraftService } from '../services/retool-draft.service';
import { logger } from '../utils/logger';

// Mock data
const TEST_USER_ID = 'test-user-123';
const TEST_APPROVER_ID = 'approver-456';

/**
 * Test Suite for Version Conflict Detection
 */
export class VersionConflictTests {
  
  /**
   * Test 1: Detect version mismatch during approval
   */
  async testVersionMismatchDetection(): Promise<void> {
    console.log('\n=== Test 1: Version Mismatch Detection ===');
    
    try {
      // 1. Create a plan in Aidbox
      const originalPlan = await mockAidboxService.createSampleInsurancePlan('Test Plan v1', 'active');
      console.log(`Created plan: ${originalPlan.id}, version: ${originalPlan.meta?.versionId}`);
      
      // 2. Create a draft based on this plan
      const draftId = await retoolDraftService.createDraft({
        aidbox_plan_id: originalPlan.id,
        plan_data: { ...originalPlan, name: 'Test Plan v1 - Draft' },
        created_by: TEST_USER_ID,
        updated_by: TEST_USER_ID,
        status: 'draft',
        submission_metadata: {
          baseVersion: originalPlan.meta?.versionId
        }
      });
      console.log(`Created draft: ${draftId}`);
      
      // 3. Submit draft for approval
      const submitResult = await orchestrationService.submitForApproval(draftId, TEST_USER_ID);
      console.log(`Submitted for approval: ${submitResult.success ? 'Success' : 'Failed'}`);
      
      if (!submitResult.success) {
        throw new Error('Failed to submit for approval');
      }
      
      // 4. Simulate another user updating the plan
      await mockAidboxService.updateResource('InsurancePlan', originalPlan.id, {
        ...originalPlan,
        name: 'Test Plan v2 - Updated by another user'
      });
      console.log('Another user updated the plan');
      
      // 5. Get pending tasks
      const tasksResult = await orchestrationService.getPendingTasks(TEST_APPROVER_ID);
      if (!tasksResult.success || tasksResult.data.length === 0) {
        throw new Error('No pending tasks found');
      }
      
      const taskId = tasksResult.data[0].taskId;
      console.log(`Found pending task: ${taskId}`);
      
      // 6. Try to approve - should detect conflict
      const approvalResult = await orchestrationService.completeApprovalTask(
        taskId,
        true, // approved
        'Looks good',
        TEST_APPROVER_ID
      );
      
      // Verify conflict was detected
      if (approvalResult.error === 'version_conflict') {
        console.log('✅ Version conflict detected successfully!');
        console.log(`   Conflict type: ${approvalResult.conflictType}`);
        console.log(`   Base version: ${approvalResult.data.baseVersion}`);
        console.log(`   Current version: ${approvalResult.data.currentVersion}`);
        return;
      } else {
        throw new Error('Version conflict was not detected!');
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }
  
  /**
   * Test 2: Detect plan deletion during approval
   */
  async testPlanDeletionDetection(): Promise<void> {
    console.log('\n=== Test 2: Plan Deletion Detection ===');
    
    try {
      // 1. Create a plan in Aidbox
      const originalPlan = await mockAidboxService.createSampleInsurancePlan('Test Plan for Deletion', 'active');
      console.log(`Created plan: ${originalPlan.id}`);
      
      // 2. Create and submit a draft
      const draftId = await retoolDraftService.createDraft({
        aidbox_plan_id: originalPlan.id,
        plan_data: { ...originalPlan, name: 'Test Plan - Draft' },
        created_by: TEST_USER_ID,
        updated_by: TEST_USER_ID,
        status: 'draft'
      });
      
      const submitResult = await orchestrationService.submitForApproval(draftId, TEST_USER_ID);
      if (!submitResult.success) {
        throw new Error('Failed to submit for approval');
      }
      console.log('Draft submitted for approval');
      
      // 3. Delete the plan from Aidbox
      await mockAidboxService.delete('InsurancePlan', originalPlan.id);
      console.log('Plan deleted from Aidbox');
      
      // 4. Get pending tasks
      const tasksResult = await orchestrationService.getPendingTasks(TEST_APPROVER_ID);
      if (!tasksResult.success || tasksResult.data.length === 0) {
        throw new Error('No pending tasks found');
      }
      
      const taskId = tasksResult.data[0].taskId;
      
      // 5. Try to approve - should detect deletion
      const approvalResult = await orchestrationService.completeApprovalTask(
        taskId,
        true,
        'Approved',
        TEST_APPROVER_ID
      );
      
      // Verify deletion was detected
      if (approvalResult.error === 'version_conflict' && 
          approvalResult.conflictType === 'DELETED') {
        console.log('✅ Plan deletion detected successfully!');
        console.log(`   Message: ${approvalResult.message}`);
        return;
      } else {
        throw new Error('Plan deletion was not detected!');
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }
  
  /**
   * Test 3: Resubmit with updated version
   */
  async testResubmitWithUpdatedVersion(): Promise<void> {
    console.log('\n=== Test 3: Resubmit with Updated Version ===');
    
    try {
      // 1. Create a plan and draft
      const originalPlan = await mockAidboxService.createSampleInsurancePlan('Test Plan for Resubmit', 'active');
      console.log(`Created plan: ${originalPlan.id}, version: ${originalPlan.meta?.versionId}`);
      
      const draftId = await retoolDraftService.createDraft({
        aidbox_plan_id: originalPlan.id,
        plan_data: { ...originalPlan, name: 'Test Plan - Draft' },
        created_by: TEST_USER_ID,
        updated_by: TEST_USER_ID,
        status: 'draft'
      });
      
      // 2. Submit and create a conflict
      await orchestrationService.submitForApproval(draftId, TEST_USER_ID);
      
      // Update plan to create conflict
      const updatedPlan = await mockAidboxService.updateResource('InsurancePlan', originalPlan.id, {
        ...originalPlan,
        name: 'Test Plan - Updated'
      });
      console.log(`Plan updated to version: ${updatedPlan.meta?.versionId}`);
      
      // 3. Try to approve (will fail with conflict)
      const tasksResult = await orchestrationService.getPendingTasks(TEST_APPROVER_ID);
      const taskId = tasksResult.data[0].taskId;
      
      await orchestrationService.completeApprovalTask(
        taskId,
        true,
        'Approved',
        TEST_APPROVER_ID
      );
      console.log('Conflict detected, draft rejected');
      
      // 4. Resubmit with updated version
      const resubmitResult = await orchestrationService.resubmitWithUpdatedVersion(
        draftId,
        TEST_USER_ID
      );
      
      if (resubmitResult.success) {
        console.log('✅ Draft resubmitted successfully with updated version!');
        console.log(`   New process ID: ${resubmitResult.data.processInstanceId}`);
        console.log(`   Base version: ${resubmitResult.data.baseVersion}`);
        return;
      } else {
        throw new Error('Failed to resubmit draft');
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }
  
  /**
   * Test 4: Proactive conflict check
   */
  async testProactiveConflictCheck(): Promise<void> {
    console.log('\n=== Test 4: Proactive Conflict Check ===');
    
    try {
      // 1. Create a plan and draft
      const originalPlan = await mockAidboxService.createSampleInsurancePlan('Test Plan for Check', 'active');
      const originalVersion = originalPlan.meta?.versionId;
      
      const draftId = await retoolDraftService.createDraft({
        aidbox_plan_id: originalPlan.id,
        plan_data: originalPlan,
        created_by: TEST_USER_ID,
        updated_by: TEST_USER_ID,
        status: 'draft',
        submission_metadata: {
          baseVersion: originalVersion
        }
      });
      console.log(`Created draft based on version: ${originalVersion}`);
      
      // 2. Check for conflicts (should be none)
      let checkResult = await orchestrationService.checkVersionConflict(draftId);
      if (checkResult.success && !checkResult.data.hasConflict) {
        console.log('✅ No conflict detected initially');
      } else {
        throw new Error('Unexpected conflict detected');
      }
      
      // 3. Update the plan
      await mockAidboxService.updateResource('InsurancePlan', originalPlan.id, {
        ...originalPlan,
        name: 'Updated Plan'
      });
      console.log('Plan updated by another user');
      
      // 4. Check for conflicts again (should detect conflict)
      checkResult = await orchestrationService.checkVersionConflict(draftId);
      if (checkResult.success && checkResult.data.hasConflict) {
        console.log('✅ Version conflict detected proactively!');
        console.log(`   Conflict type: ${checkResult.data.conflictType}`);
        console.log(`   Base version: ${checkResult.data.baseVersion}`);
        console.log(`   Current version: ${checkResult.data.currentVersion}`);
        return;
      } else {
        throw new Error('Failed to detect version conflict');
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  }
  
  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('========================================');
    console.log('Running Version Conflict Detection Tests');
    console.log('========================================');
    
    try {
      await this.testVersionMismatchDetection();
      await this.testPlanDeletionDetection();
      await this.testResubmitWithUpdatedVersion();
      await this.testProactiveConflictCheck();
      
      console.log('\n========================================');
      console.log('✅ All tests passed successfully!');
      console.log('========================================');
    } catch (error) {
      console.log('\n========================================');
      console.log('❌ Test suite failed');
      console.log('========================================');
      throw error;
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tests = new VersionConflictTests();
  tests.runAllTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default VersionConflictTests;
