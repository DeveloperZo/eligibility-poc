# Retool Database Schema Update - Camunda Process Tracking

## Overview
This update adds Camunda process instance tracking fields to the Retool `benefit_plan_drafts` table to support stateless orchestration. The orchestration service no longer maintains its own database and instead delegates state management to:
- **Retool**: Draft management
- **Camunda**: Workflow state
- **Aidbox**: Approved plans

## Changes Made

### 1. Database Schema Changes
**File**: `data/migration-add-camunda-fields.sql`

Added two new columns to `benefit_plan_drafts` table:
- `camunda_process_id VARCHAR(255)`: Stores the Camunda process instance ID
- `submission_metadata JSONB`: Stores additional workflow metadata

Additional changes:
- Created indexes for efficient lookups on both new fields
- Updated stored procedures to handle the new fields
- Modified the `submit_draft_for_approval` function to accept Camunda parameters
- Added new helper functions:
  - `update_camunda_process_info`: Update Camunda tracking information
  - `get_draft_by_camunda_process`: Retrieve drafts by process ID
- Updated the `draft_summary` view to include workflow status

### 2. Service Layer Updates
**File**: `middleware/src/services/retool-draft.service.ts`

Updated the `RetoolDraftService` to handle the new fields:

#### Interface Changes
- Added `camunda_process_id?: string` to `IBenefitPlanDraft`
- Added `submission_metadata?: any` to `IBenefitPlanDraft`

#### Method Updates
- `createDraft()`: Now accepts and stores Camunda fields
- `getDraft()`: Returns Camunda fields in the response
- `updateDraft()`: Can update Camunda fields
- `listDrafts()`: Includes Camunda fields in results
- `markDraftAsSubmitted()`: Enhanced to accept Camunda process ID and metadata
- `getDraftBySubmissionId()`: Returns Camunda fields

#### New Methods
- `getDraftByCamundaProcessId()`: Find drafts by Camunda process instance
- `updateCamundaProcessInfo()`: Update Camunda tracking for a draft

### 3. Test Coverage
**File**: `tests/test-camunda-fields.ts`

Created comprehensive tests covering:
- Creating drafts with Camunda fields
- Retrieving and verifying Camunda data
- Updating Camunda process information
- Submitting drafts with workflow instances
- Finding drafts by Camunda process ID
- Direct updates to Camunda metadata

## Migration Instructions

### Step 1: Apply Database Migration
Run the migration script on your Retool PostgreSQL database:
```bash
psql -h localhost -p 5433 -U retool -d retool -f data/migration-add-camunda-fields.sql
```

### Step 2: Update Service Code
The RetoolDraftService has been updated to handle the new fields. Deploy the updated service:
```bash
cd middleware
npm run build
npm run deploy
```

### Step 3: Verify Migration
Run the test script to verify everything is working:
```bash
cd tests
npx ts-node test-camunda-fields.ts
```

## Usage Examples

### Creating a Draft with Camunda Process
```typescript
const draftId = await retoolDraftService.createDraft({
  plan_data: { /* FHIR InsurancePlan */ },
  created_by: 'user-123',
  updated_by: 'user-123',
  status: 'draft',
  camunda_process_id: 'process-instance-456',
  submission_metadata: {
    workflow_type: 'approval',
    priority: 'high'
  }
});
```

### Submitting Draft with Workflow
```typescript
await retoolDraftService.markDraftAsSubmitted(
  draftId,
  submissionId,
  camundaProcessId,
  {
    initiator: 'user-123',
    department: 'HR',
    submitted_at: new Date().toISOString()
  }
);
```

### Finding Draft by Process ID
```typescript
const draft = await retoolDraftService.getDraftByCamundaProcessId('process-123');
```

## Backwards Compatibility
- All changes are backwards compatible
- Existing drafts without Camunda fields will continue to work
- New fields are nullable and optional
- Existing API endpoints remain unchanged

## Benefits
1. **Stateless Orchestration**: No need for separate orchestration database
2. **Better Traceability**: Direct link between drafts and workflow instances
3. **Enhanced Metadata**: Store workflow-related information with drafts
4. **Improved Performance**: Indexed lookups for process IDs
5. **Simplified Architecture**: Reduced database dependencies

## Related Tasks
This update is part of the larger effort to transform the eligibility POC from a 4-database to a 3-database architecture:
- ✅ Remove orchestration database dependencies
- ✅ Update Retool schema for Camunda tracking
- ⏳ Complete stateless orchestration service
- ⏳ Configure Camunda process variables
- ⏳ Update orchestration controller

## Support
For questions or issues, please refer to the project documentation or contact the development team.
