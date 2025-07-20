# Documentation Index

Welcome to the Eligibility Rule Management System documentation. This index provides an overview of all available documentation and guides you to the right information for your needs.

## 📚 Documentation Structure

### 🏗️ Strategic Documents
Strategic documents define the overall approach, standards, and architectural principles that guide the entire project.

#### [ARCHITECTURE.md](./ARCHITECTURE.md)
**Purpose**: Software architecture and development standards  
**Audience**: All developers, architects, technical leads  
**Key Topics**:
- SOLID principles implementation (focus on Single Responsibility)
- File size limits (600 lines max)
- Code quality standards and naming conventions
- Error handling and security guidelines
- Performance and testing requirements

#### [ROADMAP.md](./ROADMAP.md)
**Purpose**: Project vision, goals, and development roadmap  
**Audience**: Product managers, stakeholders, development team  
**Key Topics**:
- Project vision and success metrics
- Development phases and milestones
- Current sprint goals and priorities
- Risk management and long-term vision

### 🔧 Tactical Documents
Tactical documents provide specific implementation guidance for the current problem domain.

#### [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
**Purpose**: Technical implementation details for the eligibility rule system  
**Audience**: Developers, engineers working on the system  
**Key Topics**:
- Problem domain analysis
- Solution architecture and components
- Rule type implementation patterns
- DMN XML generation strategies
- Performance optimization and security

### 🦐 Process Documents
Process documents explain how to work effectively with the tools and methodologies used in the project.

#### [SHRIMP_GUIDE.md](./SHRIMP_GUIDE.md)
**Purpose**: How to use Shrimp Task Manager for project organization  
**Audience**: All team members using Shrimp for task management  
**Key Topics**:
- Task planning and execution workflow
- Best practices for task definition
- Shrimp commands and troubleshooting
- Integration with project documentation

## 🎯 Quick Navigation

### For New Team Members
1. Start with [ROADMAP.md](./ROADMAP.md) to understand project vision
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for coding standards
3. Review [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) for technical context
4. Learn [SHRIMP_GUIDE.md](./SHRIMP_GUIDE.md) for task management

### For Developers
1. **Before coding**: Review [ARCHITECTURE.md](./ARCHITECTURE.md) standards
2. **During development**: Reference [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) patterns
3. **For task management**: Use [SHRIMP_GUIDE.md](./SHRIMP_GUIDE.md) workflow
4. **For context**: Check [ROADMAP.md](./ROADMAP.md) current phase

### For Product Managers
1. **Project status**: Check [ROADMAP.md](./ROADMAP.md) milestones
2. **Technical constraints**: Review [ARCHITECTURE.md](./ARCHITECTURE.md) limitations
3. **Implementation progress**: Track via [SHRIMP_GUIDE.md](./SHRIMP_GUIDE.md) metrics
4. **Technical details**: Reference [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) capabilities

### For Architects
1. **Design principles**: [ARCHITECTURE.md](./ARCHITECTURE.md) core standards
2. **Technical patterns**: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) solutions
3. **Future planning**: [ROADMAP.md](./ROADMAP.md) evolution strategy
4. **Process alignment**: [SHRIMP_GUIDE.md](./SHRIMP_GUIDE.md) methodology

## 📋 Document Maintenance

### Update Frequency
- **ARCHITECTURE.md**: Updated when standards change (quarterly review)
- **IMPLEMENTATION_GUIDE.md**: Updated with new patterns (per sprint)
- **ROADMAP.md**: Updated monthly with progress and adjustments
- **SHRIMP_GUIDE.md**: Updated when process changes (as needed)

### Ownership
- **ARCHITECTURE.md**: Technical Lead/Architect
- **IMPLEMENTATION_GUIDE.md**: Senior Developers/Tech Lead  
- **ROADMAP.md**: Product Manager/Project Manager
- **SHRIMP_GUIDE.md**: Scrum Master/Process Owner

### Review Process
1. **Quarterly Reviews**: Full documentation audit
2. **Sprint Reviews**: Update implementation patterns
3. **Monthly Reviews**: Roadmap progress and adjustments
4. **Ad-hoc Updates**: Process improvements and lessons learned

## 🔗 Related Documentation

### Project Root Documentation
- **[README.md](../README.md)**: Getting started and setup instructions
- **[FINAL_STATUS.md](./FINAL_STATUS.md)**: Current system status summary

### Scripts Organization
All project scripts are now organized in the `/scripts` directory for better maintainability:

- **[/scripts/testing/](../scripts/testing/)**: Test scripts and test execution utilities
- **[/scripts/validation/](../scripts/validation/)**: System validation and checking scripts
- **[/scripts/setup/](../scripts/setup/)**: Installation and project setup scripts  
- **[/scripts/utilities/](../scripts/utilities/)**: General utilities and development tools
- **[/scripts/README.md](../scripts/README.md)**: Detailed script organization guide

### Code Documentation
- **API Documentation**: Generated from code comments
- **Service Documentation**: Inline documentation in service files
- **Database Schema**: Entity relationship diagrams and table definitions

### External References
- **Camunda DMN Documentation**: https://docs.camunda.org/manual/latest/reference/dmn/
- **TypeScript Best Practices**: https://typescript-eslint.io/rules/
- **Express.js Guide**: https://expressjs.com/en/guide/
- **Docker Documentation**: https://docs.docker.com/

## ✅ Documentation Standards

### Writing Guidelines
- **Clarity**: Write for your audience's technical level
- **Completeness**: Include all necessary information
- **Currency**: Keep information up-to-date
- **Consistency**: Follow established formatting and style

### Format Standards
- **Markdown**: All documentation in Markdown format
- **Structure**: Use consistent heading hierarchy
- **Code Examples**: Include working code snippets
- **Links**: Use relative links for internal documentation

### Quality Checklist
- [ ] Purpose and audience clearly defined
- [ ] Information is accurate and current
- [ ] Examples are working and tested
- [ ] Links are functional
- [ ] Writing is clear and concise
- [ ] Document follows project standards

---

## 🆘 Getting Help

### For Documentation Issues
1. **Missing Information**: Create issue describing what's needed
2. **Outdated Content**: Update the relevant document and create PR
3. **Unclear Instructions**: Ask for clarification in team channels
4. **Process Questions**: Consult with document owner

### For Technical Questions
1. **Architecture Decisions**: Consult [ARCHITECTURE.md](./ARCHITECTURE.md) and technical lead
2. **Implementation Patterns**: Check [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) examples
3. **Project Direction**: Review [ROADMAP.md](./ROADMAP.md) and discuss with PM
4. **Task Management**: Follow [SHRIMP_GUIDE.md](./SHRIMP_GUIDE.md) processes

**Remember**: Good documentation is a team effort. Contribute updates, ask questions, and help maintain the quality of our shared knowledge base.
