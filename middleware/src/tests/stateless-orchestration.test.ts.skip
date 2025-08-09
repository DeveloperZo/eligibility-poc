import { StatelessOrchestrationService } from '../services/stateless-orchestration.service';
import { retoolDraftService } from '../services/retool-draft.service';
import { aidboxService } from '../services/mock-aidbox.service';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../services/retool-draft.service');
jest.mock('../services/mock-aidbox.service');
jest.mock('../utils/logger');

describe('StatelessOrchestrationService', () => {
  let service: StatelessOrchestrationService;
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const mockedRetoolService = retoolDraftService as jest.Mocked<typeof retoolDraftService>;
  const mockedAidboxService = aidboxService as jest.Mocked<typeof aidboxService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StatelessOrchestrationService();
  });

  describe('submitForApproval', () => {
    it('should successfully submit a draft for approval', async () => {
      const draftId = 'test-draft-id';
      const userId = 'test-user';
      const mockDraft = {
        id: draftId,
        status: 'draft',
        plan_data: { name: 'Test Plan' },
        aidbox_plan_id: 'test-plan-id'
      };
      const mockProcessId = 'test-process-id';

      mockedRetoolService.getDraft.mockResolvedValue(mockDraft);
      mockedAidboxService.getResource.mockResolvedValue({
        meta: { versionId: 'v1' }
      });
      mockedAxios.post.mockResolvedValue({
        data: { id: mockProcessId }
      });
      mockedRetoolService.updateDraft.mockResolvedValue(undefined);

      const result = await service.submitForApproval(draftId, userId);

      expect(result.success).toBe(true);
      expect(result.data.processInstanceId).toBe(mockProcessId);
      expect(mockedRetoolService.updateDraft).toHaveBeenCalledWith(
        draftId,
        {
          status: 'submitted',
          submission_id: mockProcessId
        }
      );
    });

    it('should handle draft not found', async () => {
      mockedRetoolService.getDraft.mockResolvedValue(null);

      const result = await service.submitForApproval('invalid-id', 'user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Draft not found');
    });

    it('should handle already submitted draft', async () => {
      const mockDraft = {
        id: 'draft-id',
        status: 'submitted',
        plan_data: { name: 'Test Plan' }
      };
      mockedRetoolService.getDraft.mockResolvedValue(mockDraft);

      const result = await service.submitForApproval('draft-id', 'user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Draft already submitted');
    });
  });

  describe('getPendingTasks', () => {
    it('should retrieve and enrich pending tasks', async () => {
      const userId = 'test-user';
      const mockTasks = [
        {
          id: 'task-1',
          name: 'Approve Plan',
          created: '2024-01-01'
        }
      ];
      const mockVariables = {
        draftId: { value: 'draft-1' },
        submittedBy: { value: 'submitter' },
        submittedAt: { value: '2024-01-01' }
      };
      const mockDraft = {
        plan_data: { name: 'Test Plan' }
      };

      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('/task')) {
          if (url.includes('/variables')) {
            return Promise.resolve({ data: mockVariables });
          }
          return Promise.resolve({ data: mockTasks });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      mockedRetoolService.getDraft.mockResolvedValue(mockDraft);

      const result = await service.getPendingTasks(userId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].planName).toBe('Test Plan');
    });
  });

  describe('completeApprovalTask', () => {
    it('should complete approval and push to Aidbox when process ends', async () => {
      const taskId = 'task-id';
      const mockTask = {
        processInstanceId: 'process-id'
      };
      const mockVariables = {
        draftId: { value: 'draft-id' },
        baseVersion: { value: 'v1' },
        aidboxPlanId: { value: 'plan-id' }
      };
      const mockDraft = {
        id: 'draft-id',
        plan_data: { name: 'Test Plan' },
        aidbox_plan_id: 'plan-id'
      };

      mockedAxios.get.mockImplementation((url) => {
        if (url.includes(`/task/${taskId}`)) {
          if (url.includes('/variables')) {
            return Promise.resolve({ data: mockVariables });
          }
          return Promise.resolve({ data: mockTask });
        }
        if (url.includes('/process-instance')) {
          // Process not found (ended)
          return Promise.reject({ response: { status: 404 } });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      
      mockedRetoolService.getDraft.mockResolvedValue(mockDraft);
      mockedAidboxService.getResource.mockResolvedValue({
        meta: { versionId: 'v1' }
      });
      mockedAxios.post.mockResolvedValue({});
      mockedAidboxService.updateResource.mockResolvedValue({ id: 'updated-plan-id' });
      mockedRetoolService.markDraftAsApproved.mockResolvedValue(undefined);

      const result = await service.completeApprovalTask(
        taskId,
        true,
        'Approved',
        'approver'
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('approved_and_published');
      expect(mockedRetoolService.markDraftAsApproved).toHaveBeenCalled();
    });

    it('should handle version conflict', async () => {
      const taskId = 'task-id';
      const mockTask = {
        processInstanceId: 'process-id'
      };
      const mockVariables = {
        draftId: { value: 'draft-id' },
        baseVersion: { value: 'v1' },
        aidboxPlanId: { value: 'plan-id' }
      };
      const mockDraft = {
        id: 'draft-id',
        plan_data: { name: 'Test Plan' },
        aidbox_plan_id: 'plan-id'
      };

      mockedAxios.get.mockImplementation((url) => {
        if (url.includes(`/task/${taskId}`)) {
          if (url.includes('/variables')) {
            return Promise.resolve({ data: mockVariables });
          }
          return Promise.resolve({ data: mockTask });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      
      mockedRetoolService.getDraft.mockResolvedValue(mockDraft);
      mockedAidboxService.getResource.mockResolvedValue({
        meta: { versionId: 'v2' } // Different version
      });
      mockedAxios.post.mockResolvedValue({});
      mockedRetoolService.updateDraft.mockResolvedValue(undefined);

      const result = await service.completeApprovalTask(
        taskId,
        true,
        'Approved',
        'approver'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('version_conflict');
    });

    it('should handle rejection', async () => {
      const taskId = 'task-id';
      const mockTask = {
        processInstanceId: 'process-id'
      };
      const mockVariables = {
        draftId: { value: 'draft-id' }
      };
      const mockDraft = {
        id: 'draft-id',
        plan_data: { name: 'Test Plan' }
      };

      mockedAxios.get.mockImplementation((url) => {
        if (url.includes(`/task/${taskId}`)) {
          if (url.includes('/variables')) {
            return Promise.resolve({ data: mockVariables });
          }
          return Promise.resolve({ data: mockTask });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      
      mockedRetoolService.getDraft.mockResolvedValue(mockDraft);
      mockedAxios.post.mockResolvedValue({});
      mockedRetoolService.markDraftAsRejected.mockResolvedValue(undefined);

      const result = await service.completeApprovalTask(
        taskId,
        false,
        'Not approved',
        'rejector'
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('rejected');
      expect(mockedRetoolService.markDraftAsRejected).toHaveBeenCalled();
    });
  });

  describe('getApprovalStatus', () => {
    it('should get approval status for submitted draft', async () => {
      const draftId = 'draft-id';
      const mockDraft = {
        id: draftId,
        status: 'submitted',
        submission_id: 'process-id'
      };
      const mockActivities = {
        childActivityInstances: [
          { activityName: 'Approval Task' }
        ]
      };

      mockedRetoolService.getDraft.mockResolvedValue(mockDraft);
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('/process-instance/process-id')) {
          if (url.includes('/activity-instances')) {
            return Promise.resolve({ data: mockActivities });
          }
          return Promise.resolve({ data: {} });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const result = await service.getApprovalStatus(draftId);

      expect(result.success).toBe(true);
      expect(result.data.processActive).toBe(true);
      expect(result.data.currentActivities).toContain('Approval Task');
    });

    it('should handle completed process', async () => {
      const mockDraft = {
        id: 'draft-id',
        status: 'approved',
        submission_id: 'process-id'
      };

      mockedRetoolService.getDraft.mockResolvedValue(mockDraft);
      mockedAxios.get.mockRejectedValue({ response: { status: 404 } });

      const result = await service.getApprovalStatus('draft-id');

      expect(result.success).toBe(true);
      expect(result.data.processActive).toBe(false);
    });
  });

  describe('listPlansWithStatus', () => {
    it('should list all plans with their approval status', async () => {
      const mockPlans = [
        { id: 'plan-1', name: 'Plan 1', status: 'active', meta: { versionId: 'v1' } }
      ];
      const mockDrafts = [
        { aidbox_plan_id: 'plan-1', submission_id: 'process-1', status: 'submitted', updated_at: '2024-01-01' }
      ];

      mockedAidboxService.searchResources.mockResolvedValue(mockPlans);
      mockedRetoolService.listDrafts.mockResolvedValue(mockDrafts);
      mockedAxios.get.mockResolvedValue({ data: {} }); // Process still running

      const result = await service.listPlansWithStatus();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].approvalState.workflowState).toBe('pending_approval');
    });
  });

  describe('listDraftsWithStatus', () => {
    it('should list drafts with workflow status', async () => {
      const mockDrafts = [
        {
          id: 'draft-1',
          plan_data: { name: 'Draft Plan' },
          status: 'submitted',
          submission_id: 'process-1',
          created_by: 'user-1',
          updated_at: '2024-01-01'
        }
      ];

      mockedRetoolService.listDrafts.mockResolvedValue(mockDrafts);
      mockedAxios.get.mockResolvedValue({ data: {} }); // Process active

      const result = await service.listDraftsWithStatus('user-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].workflowStatus).toBe('active');
    });

    it('should handle completed workflow', async () => {
      const mockDrafts = [
        {
          id: 'draft-1',
          plan_data: { name: 'Draft Plan' },
          status: 'approved',
          submission_id: 'process-1',
          created_by: 'user-1',
          updated_at: '2024-01-01'
        }
      ];

      mockedRetoolService.listDrafts.mockResolvedValue(mockDrafts);
      mockedAxios.get.mockRejectedValue({ response: { status: 404 } });

      const result = await service.listDraftsWithStatus();

      expect(result.success).toBe(true);
      expect(result.data[0].workflowStatus).toBe('completed');
    });
  });
});
