/**
 * Test script for Retool database schema updates
 * 
 * This script tests the new Camunda process tracking fields
 * and verifies the RetoolDraftService can handle them correctly.
 */

import { retoolDraftService } from '../middleware/src/services/retool-draft.service';

async function testCamundaFields() {
  console.log('🧪 Testing Camunda process tracking fields...\n');
  
  try {
    // Test 1: Create a draft with Camunda fields
    console.log('Test 1: Creating draft with Camunda process ID...');
    const draftId = await retoolDraftService.createDraft({
      plan_data: {
        name: 'Test Plan with Camunda',
        status: 'active',
        type: [{ text: 'medical' }],
        coverage: []
      },
      created_by: 'test-user',
      updated_by: 'test-user',
      status: 'draft',
      camunda_process_id: 'test-process-123',
      submission_metadata: {
        initiator: 'test-user',
        department: 'HR',
        priority: 'normal'
      }
    });
    console.log('✅ Draft created with ID:', draftId);
    
    // Test 2: Retrieve draft and verify Camunda fields
    console.log('\nTest 2: Retrieving draft to verify fields...');
    const draft = await retoolDraftService.getDraft(draftId);
    if (draft?.camunda_process_id === 'test-process-123') {
      console.log('✅ Camunda process ID stored correctly');
    } else {
      console.log('❌ Camunda process ID not found or incorrect');
    }
    
    if (draft?.submission_metadata?.department === 'HR') {
      console.log('✅ Submission metadata stored correctly');
    } else {
      console.log('❌ Submission metadata not found or incorrect');
    }
    
    // Test 3: Update draft with new Camunda process info
    console.log('\nTest 3: Updating Camunda process info...');
    await retoolDraftService.updateDraft(draftId, {
      camunda_process_id: 'updated-process-456',
      submission_metadata: {
        ...draft?.submission_metadata,
        approver: 'manager-1',
        approved_at: new Date().toISOString()
      }
    });
    console.log('✅ Draft updated with new Camunda info');
    
    // Test 4: Submit draft with Camunda process
    console.log('\nTest 4: Submitting draft with Camunda process...');
    await retoolDraftService.markDraftAsSubmitted(
      draftId,
      'submission-789',
      'workflow-instance-999',
      {
        workflow_type: 'approval',
        started_at: new Date().toISOString()
      }
    );
    console.log('✅ Draft submitted with Camunda workflow instance');
    
    // Test 5: Get draft by Camunda process ID
    console.log('\nTest 5: Retrieving draft by Camunda process ID...');
    const draftByProcess = await retoolDraftService.getDraftByCamundaProcessId('workflow-instance-999');
    if (draftByProcess?.id === draftId) {
      console.log('✅ Draft retrieved successfully by Camunda process ID');
    } else {
      console.log('❌ Failed to retrieve draft by Camunda process ID');
    }
    
    // Test 6: Update Camunda process info
    console.log('\nTest 6: Updating Camunda process info directly...');
    await retoolDraftService.updateCamundaProcessInfo(
      draftId,
      'final-process-111',
      {
        completion_status: 'approved',
        completed_at: new Date().toISOString()
      }
    );
    console.log('✅ Camunda process info updated');
    
    // Verify final state
    console.log('\nFinal verification...');
    const finalDraft = await retoolDraftService.getDraft(draftId);
    console.log('Final draft state:');
    console.log('- Status:', finalDraft?.status);
    console.log('- Camunda Process ID:', finalDraft?.camunda_process_id);
    console.log('- Submission Metadata:', JSON.stringify(finalDraft?.submission_metadata, null, 2));
    
    // Clean up
    console.log('\nCleaning up test data...');
    await retoolDraftService.deleteDraft(draftId);
    console.log('✅ Test draft deleted');
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  testCamundaFields()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

export { testCamundaFields };
