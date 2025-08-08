# CRAWL Phase Implementation Plan - Clean & Simple

## Overview
End-to-end governed workflow for benefit plan management using Aidbox as the single source of truth, with thin orchestration layer for approvals.

## Architecture
```
Aidbox (FHIR Source of Truth)
    ↑↓ 
Orchestration Service (Thin Layer)
    ├── PostgreSQL (Approval State Only)
    ├── Camunda (Workflow Engine)
    └── Retool (UI Layer)
```

## Core Design Principle
**Aidbox is the single source of truth. We only store proposed changes during approval.**

## Data Flow
```
0. PULL from Aidbox → Display in UI
1. EDIT in UI → Changes stay in memory only
2. SUBMIT for approval → Store changes + version in PostgreSQL
3. APPROVAL process → Check version before applying
4. APPLY or VOID → Push to Aidbox or require resubmission
```

## Version Control Strategy
- When submitted: Store base_version and proposed_changes
- During approval: If Aidbox version changes, void approval
- On completion: Apply changes only if version matches
- Simple, clean, no complex merging

## Implementation Status

### ✅ Phase 1: Core Setup (COMPLETED)

#### Database Schema
**File:** `data/orchestration-schema.sql`
- Simple orchestration_state table
- Stores: base_version, proposed_changes, workflow_state
- Audit logging included

#### Aidbox Integration  
**File:** `middleware/src/services/mock-aidbox.service.ts`
- Mock FHIR InsurancePlan resources
- Auto-versioning (meta.versionId)
- Ready to swap with real Aidbox SDK

#### Orchestration Service
**File:** `middleware/src/services/orchestration.service.ts`
- `getPlan()` - Direct from Aidbox
- `submitForApproval()` - Store changes + version
- `completeApprovalTask()` - Version check → Apply/Void
- `getPendingTasks()` - User's approval tasks
- Clean, simple, no unnecessary complexity

### 🚧 Phase 2: API Layer (IN PROGRESS)

#### API Controller (NEXT STEP)
**Need:** `middleware/src/controllers/orchestration.controller.ts`

Required endpoints:
```
GET    /api/plans/:id          // Get from Aidbox
POST   /api/plans/:id/submit   // Submit for approval
GET    /api/plans/:id/status   // Approval status
GET    /api/tasks              // Pending approvals
POST   /api/tasks/:id/complete // Approve/reject
```

### ⏳ Phase 3: Retool UI (NOT STARTED)

Simple forms for:
- Viewing/editing plans
- Submitting for approval
- Reviewing/approving tasks
- Showing version conflicts

## Testing Scenarios

### Critical Test: Version Conflict
1. Create plan v1
2. Submit for approval (stores v1 as base)
3. Edit plan directly (creates v2 in Aidbox)
4. Try to complete approval
5. System voids approval, requires resubmission

## File Structure (Clean)
```
middleware/src/
├── services/
│   ├── orchestration.service.ts    # Main orchestration logic
│   ├── mock-aidbox.service.ts      # Aidbox mock/interface
│   ├── camunda.service.ts          # Workflow engine
│   └── dmn-generator.service.ts    # Rule generation
├── controllers/
│   └── orchestration.controller.ts # API endpoints (TODO)
└── app.ts                          # Express app

data/
├── orchestration-schema.sql        # Database schema
├── employees.json                  # Test data
├── healthPlans.json                # Test data
└── groups.json                     # Test data

archive/                            # Old/unused files
```

## Next Steps
1. Create orchestration.controller.ts
2. Wire up routes in app.ts
3. Test the complete flow
4. Build Retool UI

## Environment Setup
```bash
# Apply database schema
docker exec -i eligibility-poc-postgres-1 psql -U postgres -d postgres < data/orchestration-schema.sql

# Start services
docker-compose up -d

# Access points
Camunda: http://localhost:8080 (admin/admin)
Middleware: http://localhost:3000
Data API: http://localhost:3001
```

## Success Criteria
- [ ] Plans can be edited and submitted for approval
- [ ] Version conflicts are detected and handled
- [ ] Approved changes are applied to Aidbox
- [ ] No data duplication or complex merging
- [ ] Simple, maintainable code

---
**Remember: Keep it simple. One source of truth. Clean version checking.**
