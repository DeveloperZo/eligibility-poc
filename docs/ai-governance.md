# AI Assistant Governance

---
**Document Metadata**
- **Version:** 1.0.0
- **Last Modified:** 2025-01-08
- **Last Author:** Assistant (AI) - Initial Guidelines
- **Owner:** Development Team
- **Status:** Active
- **Review Cycle:** As Needed
---

## AI Assistant Guidelines

### ASK PERMISSION BEFORE:

1. **Modifying package.json** - Dependencies affect the whole project
2. **Creating new scripts** (.sh, .bat, deployment scripts) - Can affect system operations
3. **Adding new .md files** - Keep docs organized and avoid duplication

### JUST DO IT:

- Writing/modifying TypeScript code
- Creating React components
- Updating existing documentation
- Writing tests
- Creating API endpoints
- Fixing bugs
- Not using iconography in markdown

### PRAGMATIC APPROACH:

- **If it's reversible** → Just do it
- **If it affects others** → Ask first
- **If you're unsure** → Ask first
- **If it's core architecture** → Always ask

### Example:
```
NO: "I'll add moment.js to package.json" 
YES: "Should I add moment.js for date handling, or use the existing date-fns?"

NO: "I'll create a new DEPLOYMENT.md"
YES: "Should I add deployment info to QUICKSTART.md or create a new file?"
```

---

*Remember: This is a POC. Move fast, but communicate when making structural changes.*
