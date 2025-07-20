# Scripts Directory Organization

This directory contains all project scripts organized by functionality to maintain a clean and professional project structure.

## Directory Structure

### `/testing`
Contains all test-related scripts and utilities for:
- Integration testing
- Service compilation testing
- Execution simulation
- Test setup and configuration
- Unit and component testing utilities

Example scripts: `test-*.js`, `execute-integration-tests.js`

### `/validation`
Contains validation and system checking scripts for:
- Dependency validation
- System configuration checks
- Docker environment validation
- Deployment readiness checks
- TypeScript validation

Example scripts: `check-*.js`, `validate-*.js`

### `/setup`
Contains installation and project setup scripts for:
- Dependency installation
- Environment setup
- Initial project configuration
- Development environment preparation

Example scripts: `install-*.js`, `dependency-installer.js`

### `/utilities`
Contains utility scripts and helper tools for:
- Development utilities
- System health checks
- Workflow verification
- General purpose tools
- Development server management

Example scripts: `start-dev.js`, `health-check.js`

## Usage Guidelines

1. **Script Execution**: All scripts can be executed from the project root directory
2. **Dependencies**: Ensure all project dependencies are installed before running scripts
3. **Environment**: Check environment variables and configuration before execution
4. **Testing**: Use testing scripts to validate changes before deployment
5. **Validation**: Run validation scripts to ensure system readiness

## Script Naming Conventions

- **test-**: Testing and quality assurance scripts
- **check-**: System and configuration validation scripts
- **install-**: Installation and setup scripts
- **validate-**: Data and system validation scripts
- **verify-**: Comprehensive verification scripts

## Maintenance

When adding new scripts:
1. Place them in the appropriate subdirectory based on functionality
2. Update package.json scripts section if needed
3. Add documentation for complex scripts
4. Ensure proper error handling and logging
5. Test scripts thoroughly before committing

## Integration with Package.json

All npm scripts in package.json reference these organized script locations. Update package.json when moving or renaming scripts to maintain functionality.
