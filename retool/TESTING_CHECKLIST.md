# Retool Application Testing Checklist

Use this checklist to verify that the Eligibility Rule Manager application is working correctly after installation.

## Pre-Testing Setup

### ✅ Prerequisites Verification

- [ ] Middleware service running on `http://localhost:3000`
- [ ] Docker environment started (`docker-compose up -d`)
- [ ] Camunda accessible at `http://localhost:8080`
- [ ] Database connection established
- [ ] Retool application created and configured
- [ ] All queries imported and configured
- [ ] Helper functions added to global scope

### ✅ Initial Load Test

- [ ] Application loads without errors
- [ ] Health check shows "System Healthy" status
- [ ] All three tabs are visible (Create, Manage, Test)
- [ ] No JavaScript errors in browser console
- [ ] API resource connection successful

## Rule Creation Testing

### ✅ Basic Form Functionality

**Form Display:**
- [ ] Rule name input field visible and functional
- [ ] Description text area visible and functional
- [ ] Rule type dropdown populated with three options
- [ ] Form sections hidden initially (before type selection)

**Rule Type Selection:**
- [ ] Selecting "Age Validation" shows age form section
- [ ] Selecting "Health Plan Check" shows health plan section  
- [ ] Selecting "Group Number Verification" shows group section
- [ ] Previous sections hide when switching types
- [ ] Form fields clear when switching types

### ✅ Age Rule Creation

**Form Fields:**
- [ ] Operator dropdown shows comparison options (>=, >, =, <=, <)
- [ ] Default operator is ">="
- [ ] Age input accepts numbers 0-100
- [ ] Age input rejects negative numbers and values > 100
- [ ] Rule preview updates dynamically

**Rule Creation:**
- [ ] Can create rule with name "Test Age 18", type "age", min age 18
- [ ] Validation passes with valid data
- [ ] Validation fails with missing rule name
- [ ] Validation fails with missing age value
- [ ] Success notification appears on creation
- [ ] Form clears after successful creation
- [ ] Redirects to management tab after creation

### ✅ Health Plan Rule Creation

**Form Fields:**
- [ ] Health plan multi-select loads available plans
- [ ] Can select multiple health plans
- [ ] "Require Active Status" checkbox defaults to checked
- [ ] Rule preview updates with selected plans

**Rule Creation:**
- [ ] Can create rule with selected health plans
- [ ] Validation fails if no health plans selected
- [ ] Success notification appears
- [ ] Rule appears in management table

### ✅ Group Number Rule Creation

**Form Fields:**
- [ ] Group number input accepts text
- [ ] "Exact match" checkbox defaults to checked
- [ ] Rule preview shows matching type

**Rule Creation:**
- [ ] Can create rule with group number "12345"
- [ ] Validation fails with empty group number
- [ ] Both exact and pattern matching options work
- [ ] Success notification appears

### ✅ Form Validation

**Client-Side Validation:**
- [ ] Validate button shows validation results
- [ ] Missing rule name shows error message
- [ ] Missing rule type shows error message
- [ ] Invalid age values show error message
- [ ] No health plans selected shows error message
- [ ] Empty group number shows error message

**Server-Side Validation:**
- [ ] Create button disabled when validation fails
- [ ] API validation errors display properly
- [ ] Network errors handled gracefully

## Rule Management Testing

### ✅ Rules Table Display

**Data Loading:**
- [ ] Table loads with created rules
- [ ] All columns display correctly (Name, Type, Status, Configuration, Created)
- [ ] Rule names and descriptions appear
- [ ] Rule types show as color-coded badges
- [ ] Status badges show correct colors (green=active, red=error, etc.)
- [ ] Configuration summaries are accurate
- [ ] Created dates formatted properly

**Table Features:**
- [ ] Table pagination works with 10 items per page
- [ ] Column sorting works for all sortable columns
- [ ] Default sort by created date (newest first)
- [ ] Empty state shows when no rules exist

### ✅ Search and Filtering

**Search Functionality:**
- [ ] Search box filters rules by name
- [ ] Search box filters rules by description  
- [ ] Search box filters rules by type
- [ ] Search is case-insensitive
- [ ] Clear search button works

**Status Filtering:**
- [ ] "All Status" shows all rules
- [ ] "Active" shows only active rules
- [ ] "Inactive" shows only inactive rules
- [ ] "Error" shows only error rules
- [ ] Filter combines with search correctly

### ✅ Rule Actions

**Individual Actions:**
- [ ] Test button redirects to test tab with rule selected
- [ ] Edit button shows "future feature" message
- [ ] Delete button shows confirmation dialog
- [ ] Delete confirmation removes rule from table
- [ ] Table refreshes after deletion
- [ ] Action buttons only appear for valid rules

**Bulk Actions:**
- [ ] Selecting multiple rows shows bulk actions
- [ ] Selection counter shows correct count
- [ ] Bulk test shows "future feature" message
- [ ] Bulk delete shows confirmation for multiple rules

### ✅ Table Management

**Refresh Functionality:**
- [ ] Refresh button reloads table data
- [ ] Loading indicator shows during refresh
- [ ] New rules appear after refresh
- [ ] Deleted rules disappear after refresh

**Error Handling:**
- [ ] API errors show appropriate notifications
- [ ] Network timeouts handled gracefully
- [ ] Empty responses handled correctly

## Rule Testing Testing

### ✅ Test Setup Interface

**Rule Selection:**
- [ ] Rule dropdown populated with available rules
- [ ] Selecting rule shows rule information panel
- [ ] Rule info shows name, description, and configuration
- [ ] Can switch between different rules

**Employee Selection:**
- [ ] Data source toggle shows "Real Data" and "Mock Data" options
- [ ] Default selection is "Mock Data"
- [ ] Employee dropdown loads based on data source
- [ ] Employee list shows name, ID, and age
- [ ] Selecting employee shows employee information panel
- [ ] Employee info shows ID, age, group, and health plan

### ✅ Test Execution

**Test Validation:**
- [ ] Run test button disabled when no rule selected
- [ ] Run test button disabled when no employee selected
- [ ] Run test button shows loading state during execution
- [ ] Clear results button clears all test data

**Test Execution:**
- [ ] Can run test with age rule and appropriate employee
- [ ] Can run test with health plan rule and enrolled employee
- [ ] Can run test with group number rule and matching employee
- [ ] Test executes within reasonable time (< 5 seconds)

### ✅ Test Results Display

**Eligibility Results:**
- [ ] ELIGIBLE result shows green banner with checkmark
- [ ] NOT ELIGIBLE result shows red banner with X
- [ ] Result text is clear and prominent

**Reasoning Display:**
- [ ] Reasoning section explains eligibility decision
- [ ] Reasoning includes specific criteria evaluated
- [ ] Reasoning is clear and understandable
- [ ] No reasoning shows appropriate message

**Test Details:**
- [ ] Test timestamp shows current time
- [ ] Test duration shows execution time
- [ ] Rule name matches selected rule
- [ ] Employee name matches selected employee

### ✅ Test Scenarios

**Age Rule Testing:**
- [ ] Employee age 17 with "age >= 18" rule = NOT ELIGIBLE
- [ ] Employee age 18 with "age >= 18" rule = ELIGIBLE  
- [ ] Employee age 25 with "age >= 18" rule = ELIGIBLE
- [ ] Employee age 19 with "age > 18" rule = ELIGIBLE
- [ ] Employee age 18 with "age > 18" rule = NOT ELIGIBLE

**Health Plan Testing:**
- [ ] Employee with approved health plan = ELIGIBLE
- [ ] Employee with non-approved health plan = NOT ELIGIBLE
- [ ] Employee with no health plan = NOT ELIGIBLE
- [ ] Employee with inactive approved plan (require active) = NOT ELIGIBLE
- [ ] Employee with active approved plan (require active) = ELIGIBLE

**Group Number Testing:**
- [ ] Employee with matching group number = ELIGIBLE
- [ ] Employee with non-matching group number = NOT ELIGIBLE
- [ ] Employee with no group assignment = NOT ELIGIBLE
- [ ] Pattern matching works correctly when enabled
- [ ] Exact matching works correctly when enabled

## System Integration Testing

### ✅ API Integration

**Health Check:**
- [ ] Health check query executes on page load
- [ ] Health status updates in header
- [ ] System healthy shows green indicator
- [ ] System error shows red indicator
- [ ] Manual refresh button updates status

**Rule Management API:**
- [ ] List rules query loads data on page load
- [ ] Create rule API call succeeds with valid data
- [ ] Create rule API call fails with invalid data
- [ ] Delete rule API call removes rule from backend
- [ ] Test rule API call returns expected results

**Data APIs:**
- [ ] Health plans API loads plan data
- [ ] Employees API loads employee data
- [ ] Employee context API provides eligibility data
- [ ] All APIs handle errors gracefully

### ✅ Error Handling

**Network Errors:**
- [ ] Middleware service down shows appropriate errors
- [ ] Slow API responses show loading indicators
- [ ] API timeouts show timeout messages
- [ ] Connection failures show network error messages

**Validation Errors:**
- [ ] Invalid rule data shows validation messages
- [ ] Missing required fields highlighted clearly
- [ ] API validation errors display user-friendly messages

**User Input Errors:**
- [ ] Invalid form data prevented from submission
- [ ] Clear error messages guide user correction
- [ ] Form state preserved during error resolution

## User Experience Testing

### ✅ Navigation and Flow

**Tab Navigation:**
- [ ] Can switch between all three tabs smoothly
- [ ] Tab state preserved when switching
- [ ] URLs update correctly (if using URL routing)
- [ ] No data loss when switching tabs

**Workflow Testing:**
- [ ] Create rule → Manage rules → Test rule workflow works
- [ ] Can create rule and immediately test it
- [ ] Management table updates after rule creation
- [ ] Test tab pre-selects rule when coming from management

### ✅ Responsive Design

**Different Screen Sizes:**
- [ ] Desktop view (1920x1080) displays correctly
- [ ] Laptop view (1366x768) displays correctly  
- [ ] Tablet view (768x1024) displays correctly
- [ ] Mobile view (375x667) displays correctly
- [ ] Components resize appropriately
- [ ] Text remains readable at all sizes

### ✅ Performance

**Load Times:**
- [ ] Initial page load < 3 seconds
- [ ] Rule creation < 5 seconds
- [ ] Rule testing < 5 seconds
- [ ] Table refresh < 2 seconds
- [ ] No memory leaks during extended use

**Responsiveness:**
- [ ] UI updates immediately on user actions
- [ ] Loading states show for long operations
- [ ] No blocking operations freeze interface
- [ ] Smooth animations and transitions

## Accessibility Testing

### ✅ Keyboard Navigation

- [ ] Can navigate entire app using only keyboard
- [ ] Tab order follows logical flow
- [ ] Focus indicators clearly visible
- [ ] All buttons and links keyboard accessible
- [ ] Dropdown menus keyboard navigable

### ✅ Screen Reader Support

- [ ] Form labels properly associated with inputs
- [ ] Button purposes clearly announced
- [ ] Table headers properly associated
- [ ] Status messages announced when they appear
- [ ] Error messages read aloud

### ✅ Visual Accessibility

- [ ] Sufficient color contrast for all text
- [ ] Status indicators don't rely only on color
- [ ] Focus indicators visible for all interactive elements
- [ ] Text scaling doesn't break layout
- [ ] No information conveyed only through color

## Security Testing

### ✅ Input Validation

- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized
- [ ] Large input values handled safely
- [ ] Special characters in rule names handled
- [ ] File upload restrictions enforced (if applicable)

### ✅ API Security

- [ ] CORS configured correctly for Retool domain
- [ ] API endpoints validate input data
- [ ] No sensitive data exposed in responses
- [ ] Error messages don't reveal system internals

## Final Verification

### ✅ End-to-End Scenarios

**Business User Workflow:**
- [ ] Business user can create age validation rule without technical knowledge
- [ ] Rule appears in management interface with correct status
- [ ] User can test rule with sample employee data
- [ ] Test results clearly indicate eligibility outcome
- [ ] User can manage multiple rules effectively

**Error Recovery:**
- [ ] User can recover from validation errors
- [ ] Network interruptions don't corrupt application state
- [ ] Invalid data doesn't crash the application
- [ ] User can retry failed operations

**Data Consistency:**
- [ ] Created rules persist across page refreshes
- [ ] Deleted rules don't appear in any interface
- [ ] Test results match rule configuration
- [ ] Employee data displays consistently

### ✅ Documentation Verification

- [ ] Installation guide steps work correctly
- [ ] User guide matches actual interface
- [ ] All features mentioned in docs are functional
- [ ] Troubleshooting guide addresses common issues

## Sign-Off Checklist

### ✅ Functional Requirements

- [ ] ✅ All rule types can be created successfully
- [ ] ✅ Rules display correctly in management interface  
- [ ] ✅ Rule testing works with both eligible and non-eligible scenarios
- [ ] ✅ System health monitoring functional
- [ ] ✅ Error handling works for all failure scenarios

### ✅ Non-Functional Requirements

- [ ] ✅ Performance meets acceptable thresholds
- [ ] ✅ User interface is intuitive for business users
- [ ] ✅ Application is accessible to users with disabilities
- [ ] ✅ Security measures protect against common threats
- [ ] ✅ Integration with backend services stable

### ✅ Deployment Readiness

- [ ] ✅ Application can be shared with business users
- [ ] ✅ Documentation complete and accurate
- [ ] ✅ Support procedures established
- [ ] ✅ Monitoring and alerting configured
- [ ] ✅ Backup and recovery procedures tested

---

**Testing Complete**: Date: _____________ Tester: _____________

**Status**: [ ] ✅ Pass - Ready for Production [ ] ❌ Fail - Issues Found

**Notes**: _________________________________________________