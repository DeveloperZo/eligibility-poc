# CRAWL Phase Implementation Plan - TRULY Thin Orchestration

## 🎯 Overview
Stateless orchestration service that coordinates between Retool, Camunda, and Aidbox without maintaining its own database.

## ✅ CORRECTED Architecture (No Orchestration DB!)

```
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│     Retool       │         │  Orchestration   │         │     Aidbox       │
│   PostgreSQL     │────────▶│  Service (NO DB) │────────▶│   FHIR Store     │
│                  │         │                  │         │                  │
│ • Draft Plans    │         │ • Stateless API  │         │ • Approved Plans │
│ • UI State       │         │ • Coordination   │         │ • All History    │
│ • Submission IDs │         │ • No Storage!    │         │ • Source of Truth│
└──────────────────┘         └──────────────────┘         └──────────────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │     Camunda      │
                            │                  │
                            │ • BPMN Processes │
                            │ • Workflow State │
                            │ • Process Vars   │
                            │ • Task Management│
                            └──────────────────┘
```

## 📊 Data Ownership Matrix (CORRECTED)

| Data Type | Owner | Purpose | Why NOT in Orchestration |
|-----------|-------|---------|--------------------------|
| **Draft Plans** | Retool DB | Working copies | Orchestration just passes references |
| **Workflow State** | **Camunda** | Track approval progress | Camunda already has this! |
| **Process Variables** | **Camunda** | draftId, baseVersion, etc. | Part of process instance |
| **Task Assignments** | **Camunda** | Who approves what | Built-in task management |
| **Approved Plans** | Aidbox | Published plans | Final destination |
| **Version History** | Aidbox | Audit trail | FHIR versioning |

## 🔄 Simplified Data Flow (Stateless Orchestration)

### Phase 1: Draft Creation (Retool Only)
```javascript
// Retool UI → Retool DB
const draftId = await retoolDB.saveDraft(planData);
// Orchestration service NOT involved yet
```

### Phase 2: Submit for Approval (Stateless Coordination)
```javascript
// Retool → Orchestration Service → Camunda
async submitForApproval(draftId, userId) {
  // 1. Get draft from Retool (no storage)
  const draft = await retoolDB.getDraft(draftId);
  
  // 2. Get current version from Aidbox (if editing)
  const baseVersion = draft.aidboxId 
    ? await aidbox.getVersion(draft.aidboxId)
    : null;
  
  // 3. Start Camunda process with ALL data as process variables
  const processInstance = await camunda.startProcess('benefit-approval', {
    variables: {
      draftId: { value: draftId, type: 'String' },
      draftSource: { value: 'retool', type: 'String' },
      baseVersion: { value: baseVersion, type: 'String' },
      submittedBy: { value: userId, type: 'String' },
      aidboxPlanId: { value: draft.aidboxId, type: 'String' }
    }
  });
  
  // 4. Update Retool draft with process instance ID
  await retoolDB.updateDraft(draftId, {
    status: 'submitted',
    camundaProcessId: processInstance.id
  });
  
  // That's it! No storage in orchestration!
}
```

### Phase 3: Approval Task (Query Camunda, No Storage)
```javascript
// Get pending tasks from Camunda directly
async getPendingTasks(userId) {
  // Query Camunda for tasks
  const tasks = await camunda.getTasks({ assignee: userId });
  
  // Enrich with draft data (but don't store)
  return Promise.all(tasks.map(async task => {
    const draftId = task.variables.draftId.value;
    const draft = await retoolDB.getDraft(draftId);
    return { ...task, draftName: draft.name };
  }));
}
```

### Phase 4: Complete Approval (Stateless Coordination)
```javascript
async completeApproval(taskId, approved, userId) {
  // 1. Get task and variables from Camunda
  const task = await camunda.getTask(taskId);
  const variables = await camunda.getTaskVariables(taskId);
  
  if (approved) {
    // 2. Check version conflict (no storage needed)
    if (variables.baseVersion) {
      const currentVersion = await aidbox.getVersion(variables.aidboxPlanId);
      if (currentVersion !== variables.baseVersion) {
        // Version conflict - complete task with conflict flag
        await camunda.completeTask(taskId, {
          approved: false,
          conflictDetected: true,
          reason: 'Version changed during approval'
        });
        return { status: 'conflict' };
      }
    }
    
    // 3. Complete Camunda task
    await camunda.completeTask(taskId, {
      approved: true,
      approvedBy: userId
    });
    
    // 4. Check if process is complete
    const process = await camunda.getProcessInstance(variables.processInstanceId);
    
    if (process.ended) {
      // 5. Process complete - push to Aidbox
      const draft = await retoolDB.getDraft(variables.draftId);
      const result = await aidbox.createOrUpdate(draft.planData);
      
      // 6. Update Retool draft status
      await retoolDB.updateDraft(variables.draftId, {
        status: 'approved',
        aidboxId: result.id
      });
    }
  }
}
```

## 🚫 What We DON'T Need

### No Orchestration Database!
- ❌ ~~orchestration_state table~~ → Use Camunda process variables
- ❌ ~~workflow_state tracking~~ → Camunda already tracks this
- ❌ ~~submission records~~ → Process instance ID in Retool draft
- ❌ ~~version tracking table~~ → Store as Camunda process variable

### Why This Is Better:
1. **No State Duplication** - Camunda is the single source of workflow truth
2. **Truly Stateless Service** - Orchestration becomes pure coordination
3. **Simpler Deployment** - One less database to manage
4. **Better Reliability** - No sync issues between orchestration DB and Camunda
5. **Easier Debugging** - All workflow state in Camunda cockpit

## 📝 Simplified Implementation

### Orchestration Service (Stateless)
```typescript
export class OrchestrationService {
  // NO database connection needed!
  
  constructor(
    private retoolService: RetoolDraftService,
    private camundaService: CamundaService,
    private aidboxService: AidboxService
  ) {}
  
  async submitForApproval(draftId: string, userId: string) {
    const draft = await this.retoolService.getDraft(draftId);
    
    // Start Camunda process with all needed data
    const process = await this.camundaService.startProcess({
      key: 'benefit-approval',
      variables: {
        draftId,
        baseVersion: await this.getBaseVersion(draft),
        submittedBy: userId
      }
    });
    
    // Update draft with process ID
    await this.retoolService.updateDraft(draftId, {
      camundaProcessId: process.id,
      status: 'submitted'
    });
    
    return { processId: process.id, status: 'submitted' };
  }
  
  async getPendingTasks(userId: string) {
    // Direct query to Camunda
    return this.camundaService.getTasks({ assignee: userId });
  }
  
  async getApprovalStatus(draftId: string) {
    // Get from Retool draft
    const draft = await this.retoolService.getDraft(draftId);
    
    if (draft.camundaProcessId) {
      // Get process state from Camunda
      const process = await this.camundaService.getProcessInstance(
        draft.camundaProcessId
      );
      
      return {
        draftStatus: draft.status,
        workflowActive: !process.ended,
        currentActivity: process.activityId
      };
    }
    
    return { draftStatus: draft.status, workflowActive: false };
  }
}
```

### Updated Retool Schema (Add Camunda Reference)
```sql
ALTER TABLE benefit_plan_drafts ADD COLUMN IF NOT EXISTS 
  camunda_process_id VARCHAR(255);

CREATE INDEX idx_draft_process ON benefit_plan_drafts(camunda_process_id) 
  WHERE camunda_process_id IS NOT NULL;
```

### Camunda Process Variables
```xml
<!-- Store everything in process instance -->
<process id="benefit-approval">
  <startEvent>
    <extensionElements>
      <camunda:formData>
        <camunda:formField id="draftId" type="string" />
        <camunda:formField id="baseVersion" type="string" />
        <camunda:formField id="submittedBy" type="string" />
        <camunda:formField id="aidboxPlanId" type="string" />
      </camunda:formData>
    </extensionElements>
  </startEvent>
</process>
```

## 🎯 Benefits of Stateless Orchestration

### 1. **Simpler Architecture**
```
Before: 4 databases (Retool, Orchestration, Camunda, Aidbox)
After:  3 databases (Retool, Camunda, Aidbox)
```

### 2. **Single Source of Truth**
- Drafts: Retool DB only
- Workflow: Camunda only
- Approved: Aidbox only
- No overlap!

### 3. **Better Operations**
- View all workflow state in Camunda Cockpit
- No custom tables to maintain
- Standard Camunda REST API for everything

### 4. **Easier Testing**
- Mock three services instead of four
- No database migrations for orchestration
- Clear boundaries

## 📋 Migration Path

### From Current Implementation:
1. **Remove orchestration database entirely**
2. **Store process instance ID in Retool draft**
3. **Move all workflow data to Camunda variables**
4. **Make orchestration service stateless**

### API Changes:
```typescript
// Old (with DB)
POST /api/plans/:id/submit
{ planData, userId }  // Stored in orchestration DB

// New (stateless)
POST /api/plans/:id/submit  
{ draftId, userId }   // Just coordinates between services
```

## ✅ Final Architecture Summary

| Component | Responsibilities | Data Storage |
|-----------|-----------------|--------------|
| **Retool** | UI, Draft Management | Drafts, UI State |
| **Orchestration** | API Gateway, Coordination | **NONE! (Stateless)** |
| **Camunda** | Workflow, Tasks, State | Process Instances, Variables |
| **Aidbox** | Final Storage, Versioning | Approved Plans |

## 🚀 Why This Is The Right Architecture

1. **Each tool does what it's best at:**
   - Retool: UI and drafts
   - Camunda: Workflow management
   - Aidbox: FHIR storage
   - Orchestration: Just coordinates

2. **No redundant state:**
   - Workflow state ONLY in Camunda
   - No synchronization issues
   - Single source of truth for each concern

3. **Standard patterns:**
   - Stateless services scale better
   - Camunda's built-in state management
   - No custom workflow tracking

4. **Operational simplicity:**
   - Fewer databases
   - Less code to maintain
   - Standard tools doing standard things

---

**The orchestration service should be a thin, stateless coordination layer - NOT another database!** This is the correct microservices pattern. Thank you for catching this! 🎉
