# Retool Application User Guide

## Welcome to the Eligibility Rule Manager

This application allows business users to create, manage, and test employee eligibility rules without requiring technical knowledge. The system automatically converts your business rules into technical format and deploys them to the decision engine.

## Getting Started

### System Overview

The Eligibility Rule Manager helps you:
- **Create Rules**: Define eligibility criteria using simple forms
- **Manage Rules**: View, edit, and delete existing rules  
- **Test Rules**: Validate rules with real or mock employee data
- **Monitor System**: Check system health and rule performance

### Main Interface

The application has three main sections accessible via tabs:

1. **Create Rule** - Build new eligibility rules
2. **Manage Rules** - View and manage existing rules
3. **Test Rules** - Test rules with employee data

## Creating Rules

### Step 1: Choose Rule Type

Select from three types of eligibility rules:

#### Age Validation
- **Purpose**: Check if employee meets minimum age requirement
- **Example**: "Employee must be 18 or older"
- **Configuration**: Set age threshold and comparison operator

#### Health Plan Check  
- **Purpose**: Verify employee has valid health plan enrollment
- **Example**: "Employee must be enrolled in approved health plans"
- **Configuration**: Select allowed health plans and status requirements

#### Group Number Verification
- **Purpose**: Validate employee belongs to specific group
- **Example**: "Employee must belong to group number 12345"
- **Configuration**: Set required group number and matching type

### Step 2: Fill Out Rule Details

**Required Information:**
- **Rule Name**: Clear, descriptive name (e.g., "Minimum Age 18")
- **Description**: Optional explanation of the rule's purpose

**Rule-Specific Configuration:**

**For Age Rules:**
- **Comparison**: Choose operator (>=, >, =, <=, <)
- **Age**: Enter age threshold (0-100)
- **Preview**: "Employee age >= 18"

**For Health Plan Rules:**
- **Allowed Plans**: Select one or more health plans from dropdown
- **Active Status**: Check to require active enrollment only
- **Preview**: Shows selected plans and requirements

**For Group Number Rules:**
- **Group Number**: Enter required group number or pattern
- **Matching Type**: Choose exact match or pattern matching
- **Preview**: Shows matching criteria

### Step 3: Validate and Create

1. **Validate Rule**: Click "Validate Rule" to check configuration
2. **Review**: Check validation results and fix any issues
3. **Create Rule**: Click "Create Rule" to deploy the rule
4. **Confirmation**: Success message confirms rule creation

## Managing Rules

### Rules Table

The management interface shows all created rules in a table with:

- **Rule Name**: Name and description
- **Type**: Rule type with color-coded badge
- **Status**: Current rule status (Active, Inactive, Error)
- **Configuration**: Summary of rule settings
- **Created**: When the rule was created
- **Actions**: Test, Edit, Delete buttons

### Table Features

**Search**: Type in search box to find rules by name or description
**Filter**: Use status dropdown to show only rules with specific status
**Sort**: Click column headers to sort by any field
**Refresh**: Click refresh button to reload latest rule data

### Rule Actions

**Test Rule**: 
- Redirects to Test tab with rule pre-selected
- Allows immediate testing with employee data

**Edit Rule**: 
- Currently shows info message
- Future feature for modifying existing rules

**Delete Rule**:
- Shows confirmation dialog
- Permanently removes rule from system
- Cannot be undone

### Bulk Operations

When multiple rules are selected:
- **Bulk Test**: Test multiple rules (future feature)
- **Bulk Delete**: Delete multiple rules (future feature)

## Testing Rules

### Test Setup

**Step 1: Select Rule**
- Choose rule from dropdown list
- View rule details including configuration
- See rule type and current status

**Step 2: Choose Data Source**
- **Mock Data**: Use sample employee data for testing
- **Real Data**: Use actual employee information (when available)

**Step 3: Select Employee**
- Pick employee from searchable dropdown
- View employee details including:
  - Employee ID and name
  - Age and group number
  - Health plan enrollment status

### Running Tests

1. **Click "Run Eligibility Test"**
2. **Wait for Processing**: Test executes against rule engine
3. **Review Results**: See eligibility outcome and reasoning

### Understanding Test Results

**Eligibility Outcome:**
- **ELIGIBLE**: Green banner with checkmark - employee meets criteria
- **NOT ELIGIBLE**: Red banner with X - employee doesn't meet criteria

**Reasoning Section:**
- Explains why employee is or isn't eligible
- Shows which criteria were evaluated
- Provides specific details about the decision

**Test Details:**
- Test timestamp and duration
- Rule name and employee name used
- Technical execution information

### Test Scenarios

**Age Rule Testing:**
- Test with employees of different ages
- Verify age thresholds work correctly
- Check edge cases (exactly at threshold)

**Health Plan Testing:**
- Test employees with different health plans
- Verify active/inactive status checking
- Test employees with no health plan

**Group Number Testing:**
- Test employees in different groups
- Verify exact vs. pattern matching
- Test employees with no group assignment

## System Health Monitoring

### Health Status Indicator

Located in the top-right corner:
- **Green "System Healthy"**: All systems operational
- **Red "System Error"**: Issues detected with backend services
- **Refresh Button**: Manually check system status

### What Health Check Monitors

- **Middleware Service**: Core application backend
- **Camunda Engine**: Decision rule engine
- **Database**: Data storage system
- **External Data**: Employee and health plan data sources

## Best Practices

### Rule Naming
- Use clear, descriptive names
- Include key criteria in the name
- Example: "Age_18_Plus_PPO_Plans" vs. "Rule_001"

### Rule Descriptions
- Explain the business purpose
- Document any special considerations
- Include examples when helpful

### Testing Strategy
- Test new rules with known employee data
- Try both eligible and non-eligible scenarios
- Verify edge cases and boundary conditions
- Test with different employee types

### Rule Management
- Regularly review active rules
- Remove unused or outdated rules
- Monitor rule performance and accuracy

## Troubleshooting

### Common Issues

**Rule Creation Fails:**
- Check all required fields are filled
- Verify age values are reasonable (0-100)
- Ensure at least one health plan is selected
- Make sure group numbers are not empty

**Rules Not Loading:**
- Check system health indicator
- Click refresh button to reload
- Verify middleware service is running

**Test Results Unexpected:**
- Verify employee data is correct
- Check rule configuration matches expectations
- Try testing with different employees
- Review rule reasoning for details

**System Health Shows Error:**
- Check if middleware service is running
- Verify database connectivity
- Contact system administrator if persistent

### Error Messages

**"Validation Error"**: Fix form issues before creating rule
**"Failed to create rule"**: Check system health and try again
**"No Rule Selected"**: Choose a rule before testing
**"Test Failed"**: Verify employee data and rule status

## Tips for Success

### Creating Effective Rules
- Start simple with basic age or group rules
- Test rules immediately after creation
- Use descriptive names that explain the criteria
- Document complex rules with detailed descriptions

### Efficient Testing
- Use mock data for initial testing
- Create test scenarios for common employee types
- Keep notes on test results for future reference
- Test edge cases to ensure rules work as expected

### Managing Rules Long-term
- Review rules periodically for accuracy
- Remove duplicate or conflicting rules
- Update rules when business requirements change
- Monitor system performance with many rules

## Getting Help

### In-Application Help
- Hover over help icons for field explanations
- Check validation messages for guidance
- Use rule previews to verify configuration

### System Information
- Check system health for connectivity issues
- Review test results reasoning for rule logic
- Use search and filters to find specific rules

### Support Resources
- Contact your system administrator for technical issues
- Review rule documentation for business requirements
- Check with HR team for employee data questions

## Keyboard Shortcuts

- **Tab**: Navigate between form fields
- **Enter**: Submit forms or confirm actions
- **Escape**: Cancel dialogs or clear selections
- **Ctrl+F**: Focus search box in rules table

## Accessibility Features

- **Screen Reader Support**: All components work with screen readers
- **Keyboard Navigation**: Full keyboard navigation support
- **High Contrast**: Clear visual indicators and color coding
- **Large Click Targets**: Buttons and links sized for easy clicking

---

**Need Additional Help?**
Contact your system administrator or check the technical documentation for advanced features and troubleshooting.