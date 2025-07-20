# 🚨 MANDATORY LOCAL TESTING BEFORE DEPLOYMENT

## Critical Requirement

**NO DEPLOYMENT of the Eligibility Rule Management System should occur without successfully completing the local testing suite.**

This system involves complex integrations between:
- Retool frontend
- TypeScript middleware service  
- Camunda DMN engine
- PostgreSQL database
- External data APIs

**A single misconfiguration or untested component could cause system-wide failures in production.**

## Required Commands (In Order)

### 1. Environment Setup and Validation
```bash
# Install all dependencies and validate system
npm run install-all
npm run validate
```

### 2. Complete Local Testing (MANDATORY)
```bash
# Run comprehensive integration testing
npm run test-local
```

**This command will:**
- ✅ Validate environment prerequisites
- ✅ Install and check all dependencies  
- ✅ Start Docker services (Camunda, PostgreSQL)
- ✅ Build and start middleware and data API
- ✅ Run complete integration test suite
- ✅ Validate all rule types and workflows
- ✅ Test multi-rule evaluation scenarios
- ✅ Benchmark performance metrics
- ✅ Generate comprehensive test reports

### 3. Deployment Readiness Check
```bash
# Verify system is ready for deployment
npm run check-deployment
```

## Success Criteria

You should see this message before proceeding:
```
🎉 LOCAL TESTING SETUP COMPLETE!
🚀 System Status: READY FOR DEVELOPMENT
   All services running, all tests passing
   Safe to proceed with additional development or deployment
```

## Test Reports Generated

After successful testing, review these reports:
- `tests/test-report.html` - Visual test results with performance metrics
- `tests/test-report.json` - Machine-readable results for CI/CD

## What Gets Tested

### System Integration
- [x] Complete workflow: Retool → Middleware → DMN → Camunda → Evaluation
- [x] Service health and connectivity (Middleware, Data API, Camunda)
- [x] Database connectivity and operations
- [x] External data source integration

### Rule Processing
- [x] Age validation rules (>=, >, =, <=, <)
- [x] Health plan validation (specific plans, active status)
- [x] Group number validation (exact match, pattern matching)
- [x] Multi-rule evaluation with AND logic
- [x] DMN XML generation and deployment

### Error Handling
- [x] Invalid rule configurations
- [x] Missing employee data
- [x] Network timeouts and failures
- [x] Service unavailability scenarios

### Performance
- [x] Response time benchmarks (< 2 seconds)
- [x] Concurrent request handling
- [x] Resource utilization monitoring
- [x] Memory and CPU usage validation

## Failure Cases - DO NOT DEPLOY

### If You See These Messages:
```
❌ LOCAL TESTING SETUP FAILED!
❌ Some integration tests failed
❌ DEPLOYMENT NOT READY
⚠️ System health check failed
```

### Common Issues:
- Docker services not running
- Port conflicts (3000, 3001, 8080, 5432)
- Missing dependencies
- TypeScript compilation errors
- Database connection failures

### Resolution:
1. Check Docker: `docker info`
2. Check ports: `netstat -an | grep :8080`
3. Reset environment: `npm run docker:clean`
4. Restart setup: `npm run test-local`

## Why This Is Critical

### Complex System Architecture
The system involves multiple moving parts that must work together:
```
Retool Frontend ←→ TypeScript Middleware ←→ Camunda DMN Engine
                           ↕
                   External Data APIs ←→ PostgreSQL Database
```

### Real-World Business Impact
- **Eligibility decisions affect employee benefits**
- **Failed rules could deny valid claims**  
- **Performance issues impact user experience**
- **Data integrity errors cause compliance issues**

### Production Failure Scenarios Prevented
- DMN XML generation errors causing rule deployment failures
- Database connection issues preventing evaluations
- Memory leaks causing service crashes
- Performance degradation under load
- Integration failures between services

## Development Team Responsibilities

### Before Any Deployment:
1. ✅ Run `npm run test-local` successfully
2. ✅ Review test reports for any warnings
3. ✅ Confirm all integration tests pass
4. ✅ Validate performance benchmarks meet targets
5. ✅ Run `npm run check-deployment` for final verification

### Continuous Integration
Add to CI/CD pipeline:
```yaml
- name: Mandatory Local Testing
  run: |
    npm run test-local
    npm run check-deployment
```

### Code Review Checklist
- [ ] Local testing completed before PR
- [ ] Test reports attached to PR
- [ ] All integration tests passing
- [ ] Performance benchmarks met
- [ ] No deployment blockers identified

## Emergency Procedures

### If Production Issues Occur:
1. **Immediate rollback** to last known good version
2. **Run local testing** on current codebase
3. **Identify and fix** failing tests
4. **Re-run complete test suite**
5. **Only redeploy** after 100% test success

### Support Contacts:
- **Development Team**: dev-team@company.com
- **On-Call Engineer**: Slack #engineering-oncall
- **Emergency Escalation**: CTO/Engineering Manager

---

## Summary

**The local testing suite is not optional - it's a critical safety mechanism that prevents production failures and ensures system reliability.**

**Command to remember:**
```bash
npm run test-local
```

**Only deploy after seeing:**
```
🚀 System Status: READY FOR DEVELOPMENT
```

**No exceptions. No shortcuts. Test first, deploy safely.**

---

**Document Version**: 1.0  
**Last Updated**: July 19, 2025  
**Status**: MANDATORY REQUIREMENT ⚠️
