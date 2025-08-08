# Project Roadmap 

## Document Metadata

* **Version:** 1.0.0
* **Last Modified:** 2025-08-08
* **Last Author:** Assistant (AI)
* **Owner:** Product Management
* **Status:** Active
* **Review Cycle:** Monthly
* **Next Review:** 2025-09-08
* **Stakeholders:** Product, Engineering, Business Operations
* **Approval:** CTO, VP Product
* **Change Log:**

  * **v1.0.0 (2025-08-08):** Initial roadmap creation with crawl/walk/run phases for benefit plan creation use case.

---

## Project Vision

Transform benefit plan and benefit plan management from a developer-dependent, slow process into a business-admin self-service platform where changes flow through governed, auditable workflows and versioned artifacts. Immediate action is to provide an self serve ease at building UI and BPMN/DMN items.If not possible entirely then pragmatic sequence acquiring high self serve functionality over time. 

### Success Metrics

**Business Metrics**

* Rule/Plan Deployment Speed: Weeks → < 1 hour
* IT Dependency: Reduce support tickets by 75%
* User Adoption: 80% of benefit administrators actively using within 3 months
* Error Reduction: 50% decrease in eligibility-related issues

**Technical Metrics**

* API Response Time: < 200ms for reads, < 500ms for writes
* System Uptime: 99.9% availability target
* Test Coverage: > 80% code coverage
* Deployment Success: > 95% successful deployments

---

## Primary Use Case

**Title:** Create/Revise a Benefit Plan with Routing, Approvals, and Versioning

**Actors:** Plan Author, Approvers, Workflow Engine (Camunda), Business UI (Retool), Plan Catalog API

**Preconditions:** Authenticated user with Plan Author role, Camunda process definition deployed, Plan Catalog DB available.

**Happy Path:** Draft → Edit → Validate → Submit for Approval → Sequential Approvals (Legal, Finance, Compliance) → Version Freeze → Publish.

**Alternate Paths:** Rejection and rework, timeout/escalation (walk), validation failure, withdrawal.

**Postconditions:** Approved plans stored as immutable versions with audit trail.

---

## Phase Plan

### CRAWL — End-to-End Minimal, Production-Viable

**Goal:** A business admin can draft a plan in Retool and easily build a BPMN in Camunda. This should allow  for the Primary Use Case of end to end fuctionality (e.g. sequential approvals, and land an immutable approved version with audit trail, etc).
**Scope:**

* Retool screens: Plan List, Plan Editor, Submit for Approval, Task Inbox, Version History.
* Camunda screens: BPMN related screens to assist in building.
* Sequential approvals with static route.
* Versioning model with immutable snapshots.
* Basic RBAC and audit logging.

---

### WALK — Power, Governance, and Flexibility

**Goal:** Introduce dynamic routing, stronger governance, better authoring/testing UX.
**Scope:**

* Dynamic routing via DMN.
* Parallel approvals, escalations, and SLAs.
* Version diff/rollback.
* Rule templates and visual builder.
* Batch testing and simulation.
* Environment promotion and granular RBAC.

---

### RUN — Enterprise Scale, Compliance, and Insights

**Goal:** Multi-tenant, analytics-rich, resilient platform with strong compliance posture.
**Scope:**

* Multi-tenancy.
* Downstream publishing to external systems.
* Advanced analytics and A/B testing.
* Evidence store with retention policies.
* SSO, SCIM provisioning, and fine-grained entitlements.
* Resilience and disaster recovery.
* Compliance automation and assistive features.

---

## Risks & Mitigations

* Schema churn → Flexible JSON payload with typed fields for indexed queries.
* Over-building UI → Retool-first approach.
* Process lock-in → Keep BPMN minimal and extensible.

---

## Definition of Success

**Crawl:** Create, submit, approve, and version a benefit plan fully via UI without engineering support.
**Walk:** Dynamic governance and routing with richer authoring/testing features.
**Run:** Enterprise-grade scalability, compliance, and intelligence.

---

**Next Review:** Align stakeholders on scope lock for Crawl and initiate BPMN v1 build.
