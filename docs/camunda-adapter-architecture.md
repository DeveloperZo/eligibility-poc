# Retool + Camunda Adapter Pattern Specification

---
**Document Metadata**
- **Version:** 1.3.0
- **Last Modified:** 2025-01-08
- **Last Author:** Assistant (AI) - Adapter Pattern Implementation
- **Owner:** Architecture Team
- **Status:** In Development
- **Review Cycle:** Sprint-based
- **Next Review:** 2025-01-22
- **Classification:** Technical Architecture
- **Compliance:** HIPAA Required
- **Related Docs:** ARCHITECTURE.md, minimal-mvp.js
- **Change Log:**
  - v1.3.0 (2025-01-08): Added template-based workflow creation and self-serve patterns
  - v1.2.0 (2024-12-20): Enhanced adapter abstraction for n8n compatibility
  - v1.1.0 (2024-12-10): Added versioning and audit specifications
  - v1.0.0 (2024-11-20): Initial adapter pattern design
---

## 1. Overview
This architecture enables internal business users in a healthcare organization to configure **runtime configuration objects** (e.g., benefit plans, health plans, CMS settings, Auth0 config, SFTP endpoints, notification settings) through a **single pane of glass** UI built in Retool.  
Workflow automation, approvals, and versioning are delegated to **Camunda** via an adapter layer that allows future substitution with **n8n** with minimal change.

---

## 2. Goals & Constraints
- **HIPAA-compliant** deployment — all components self-hosted in customer VPC.
- **Drag-and-drop UI building** from schema-defined forms.
- **Workflow automation** for benefit plan creation, approval, routing, and versioning.
- **Pluggable workflow engine** (Camunda now, n8n later if needed).
- **Single Pane of Glass** — users never directly interact with Camunda/n8n UIs.
- **Service-to-service communication** via secure APIs.
- **Zero PHI egress** — outbound traffic blocked except required license checks.

---

## 3. High-Level Architecture
```plaintext
[Retool UI] <---> [ConfigService API] <---> [WorkflowService API] <---> [Camunda Adapter] <---> [Camunda Engine]
                                                           |
                                                           +---> (n8n Adapter, future swap)
