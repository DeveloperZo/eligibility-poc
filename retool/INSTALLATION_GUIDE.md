   - Add refresh button that triggers `healthCheck.trigger()`

#### 5.2 Add Tabs Component

1. **Insert Tabs Component**
   - Drag Tabs component below header
   - Set ID: `mainTabs`
   - Configure three tabs:
     - **Tab 1**: `createRuleTab` - "Create Rule" (Plus icon)
     - **Tab 2**: `manageRulesTab` - "Manage Rules" (Settings icon)
     - **Tab 3**: `testRulesTab` - "Test Rules" (Play icon)

#### 5.3 Build Create Rule Tab

**Basic Information Section:**

1. **Rule Name Input**
   - Component: Text Input
   - ID: `ruleNameInput`
   - Label: "Rule Name"
   - Placeholder: "Enter a descriptive name for this rule"
   - Required: `true`

2. **Description Input**
   - Component: Text Area
   - ID: `descriptionInput`
   - Label: "Description"
   - Rows: `3`

3. **Rule Type Selection**
   - Component: Select
   - ID: `ruleTypeSelect`
   - Label: "Rule Type"
   - Options:
   ```javascript
   [
     {value: "age", label: "Age Validation"},
     {value: "health_plan", label: "Health Plan Check"},
     {value: "group_number", label: "Group Number Verification"}
   ]
   ```
   - onChange: `handleRuleTypeChange()`

**Age Rules Section:**

4. **Age Rules Container**
   - Component: Container
   - ID: `ageRulesContainer`
   - Hidden: `{{ ruleTypeSelect.value !== 'age' }}`
   - Background: `#f9fafb`

5. **Operator Select**
   - Component: Select
   - ID: `operatorSelect`
   - Default value: `">="`
   - Options: `[{value: ">=", label: "Greater than or equal to"}, ...]`

6. **Age Input**
   - Component: Number Input
   - ID: `minAgeInput`
   - Min: `0`, Max: `100`

**Health Plan Section:**

7. **Health Plan Container**
   - Component: Container
   - ID: `healthPlanContainer`
   - Hidden: `{{ ruleTypeSelect.value !== 'health_plan' }}`

8. **Health Plan Multi-Select**
   - Component: Multiselect
   - ID: `healthPlanSelect`
   - Data source: `{{ getHealthPlans.data }}`
   - Value: `{{ item.id }}`
   - Label: `{{ item.name }} ({{ item.type }})`

9. **Active Status Checkbox**
   - Component: Checkbox
   - ID: `requireActiveStatus`
   - Default: `true`
   - Text: "Require Active Status"

**Group Number Section:**

10. **Group Number Container**
    - Component: Container
    - ID: `groupNumberContainer`
    - Hidden: `{{ ruleTypeSelect.value !== 'group_number' }}`

11. **Group Number Input**
    - Component: Text Input
    - ID: `groupNumberInput`
    - Label: "Required Group Number"

12. **Exact Match Checkbox**
    - Component: Checkbox
    - ID: `exactMatchCheckbox`
    - Default: `true`
    - Text: "Require exact match"

**Action Buttons:**

13. **Clear Form Button**
    - Component: Button
    - ID: `clearFormButton`
    - Text: "Clear Form"
    - Variant: `outline`
    - onClick: `clearRuleForm()`

14. **Validate Rule Button**
    - Component: Button
    - ID: `validateRuleButton`
    - Text: "Validate Rule"
    - Variant: `outline`
    - Color: `blue`
    - onClick: `validateRule()`
    - Disabled: `{{ !ruleNameInput.value || !ruleTypeSelect.value }}`

15. **Create Rule Button**
    - Component: Button
    - ID: `createRuleButton`
    - Text: "Create Rule"
    - Variant: `solid`
    - Color: `blue`
    - onClick: `createRule.trigger()`
    - Disabled: `{{ !ruleNameInput.value || !ruleTypeSelect.value || createRule.isFetching }}`
    - Loading: `{{ createRule.isFetching }}`

#### 5.4 Build Manage Rules Tab

**Table Header:**

1. **Search Input**
   - Component: Text Input
   - ID: `searchInput`
   - Placeholder: "Search rules..."
   - Icon: `Search`
   - onChange: `filterRulesTable()`

2. **Status Filter**
   - Component: Select
   - ID: `statusFilter`
   - Options: `[{value: "all", label: "All Status"}, {value: "active", label: "Active"}, ...]`
   - onChange: `filterRulesTable()`

3. **Refresh Button**
   - Component: Button
   - ID: `refreshTableButton`
   - Text: "Refresh"
   - Icon: `RefreshCw`
   - onClick: `listRules.trigger()`

**Rules Table:**

4. **Rules Table**
   - Component: Table
   - ID: `rulesTable`
   - Data source: `{{ getFilteredRules() }}`
   
   **Columns Configuration:**
   
   - **Rule Name Column**:
     - Header: "Rule Name"
     - Cell: Custom component showing name + description
     
   - **Type Column**:
     - Header: "Type" 
     - Cell: Badge component
     - Text: `{{ formatRuleType(item.type) }}`
     - Color: `{{ getRuleTypeColor(item.type) }}`
     
   - **Status Column**:
     - Header: "Status"
     - Cell: Badge component
     - Text: `{{ item.status?.toUpperCase() || 'UNKNOWN' }}`
     - Color: `{{ getStatusColor(item.status) }}`
     
   - **Configuration Column**:
     - Header: "Configuration"
     - Cell: Text component
     - Text: `{{ getRuleConfigSummary(item) }}`
     
   - **Created Column**:
     - Header: "Created"
     - Cell: Text component
     - Text: `{{ formatDate(item.createdAt) }}`
     
   - **Actions Column**:
     - Header: "Actions"
     - Cell: Container with action buttons
     
   **Action Buttons in Table:**
   
   - **Test Button**: onClick `openTestModal(item)`
   - **Edit Button**: onClick `openEditModal(item)`
   - **Delete Button**: onClick `openDeleteModal(item)`

**Table Configuration:**
- Pagination: Enabled, 10 items per page
- Selection: Single row selection
- Sorting: Enabled, default sort by created date (desc)

#### 5.5 Build Test Rules Tab

**Rule Selection Section:**

1. **Test Rule Select**
   - Component: Select
   - ID: `testRuleSelect`
   - Data source: `{{ listRules.data }}`
   - Value: `{{ item.id }}`
   - Label: `{{ item.name }} ({{ formatRuleType(item.type) }})`
   - onChange: `handleTestRuleSelection()`

2. **Selected Rule Info Container**
   - Component: Container
   - ID: `selectedRuleInfo`
   - Hidden: `{{ !testRuleSelect.value }}`
   - Shows rule details when selected

**Employee Selection Section:**

3. **Data Source Toggle**
   - Component: Segmented Control
   - ID: `dataSourceSelect`
   - Options: `[{value: "real", label: "Real Data"}, {value: "mock", label: "Mock Data"}]`
   - Default: `"mock"`
   - onChange: `handleDataSourceChange()`

4. **Employee Select**
   - Component: Select
   - ID: `employeeSelect`
   - Data source: `{{ getEmployeeData() }}`
   - Value: `{{ item.id }}`
   - Label: `{{ item.name }} ({{ item.id }}) - Age: {{ item.age }}`
   - Searchable: `true`
   - onChange: `handleEmployeeSelection()`

5. **Selected Employee Info**
   - Component: Container
   - ID: `selectedEmployeeInfo`
   - Hidden: `{{ !employeeSelect.value }}`
   - Shows employee details when selected

**Test Actions:**

6. **Run Test Button**
   - Component: Button
   - ID: `runTestButton`
   - Text: "Run Eligibility Test"
   - Size: `large`
   - Color: `blue`
   - Icon: `Play`
   - onClick: `runEligibilityTest()`
   - Disabled: `{{ !testRuleSelect.value || !employeeSelect.value || testRule.isFetching }}`
   - Loading: `{{ testRule.isFetching }}`

7. **Clear Results Button**
   - Component: Button
   - ID: `clearTestButton`
   - Text: "Clear Results"
   - Variant: `outline`
   - onClick: `clearTestResults()`

**Test Results Section:**

8. **Test Results Container**
   - Component: Container
   - ID: `testResultsContainer`
   - Hidden: `{{ !testRule.data }}`

9. **Eligibility Result Display**
   - Component: Container with icon and text
   - Background color: `{{ testRule.data?.eligible ? '#dcfce7' : '#fef2f2' }}`
   - Border: `{{ testRule.data?.eligible ? '#16a34a' : '#dc2626' }}`
   - Icon: `{{ testRule.data?.eligible ? 'CheckCircle' : 'XCircle' }}`
   - Text: `{{ testRule.data?.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE' }}`

10. **Reasoning Display**
    - Component: Container
    - Background: `#f9fafb`
    - Text: `{{ testRule.data?.reasoning || 'No reasoning provided' }}`

11. **Test Details**
    - Component: Container
    - Shows timestamp, duration, rule name, employee name

### Step 6: Configure Event Handlers

Add the following event handlers to their respective components:

#### Form Events
- `ruleTypeSelect.onChange`: `handleRuleTypeChange()`
- `createRuleButton.onClick`: `createRule.trigger()`
- `clearFormButton.onClick`: `clearRuleForm()`
- `validateRuleButton.onClick`: `validateRule()`

#### Table Events
- `searchInput.onChange`: `filterRulesTable()`
- `statusFilter.onChange`: `filterRulesTable()`
- `refreshTableButton.onClick`: `listRules.trigger()`

#### Test Events  
- `testRuleSelect.onChange`: `handleTestRuleSelection()`
- `dataSourceSelect.onChange`: `handleDataSourceChange()`
- `employeeSelect.onChange`: `handleEmployeeSelection()`
- `runTestButton.onClick`: `runEligibilityTest()`
- `clearTestButton.onClick`: `clearTestResults()`

### Step 7: Configure Query Success/Error Handlers

#### Create Rule Success Handler
```javascript
// createRule.onSuccess
// Refresh rules table
listRules.trigger();

// Clear form
clearRuleForm();

// Switch to management tab
setTimeout(() => {
  mainTabs.setCurrentTab('manageRulesTab');
}, 1000);
```

#### Delete Rule Success Handler
```javascript
// deleteRule.onSuccess
// Refresh rules table
listRules.trigger();
```

#### Test Rule Success Handler
```javascript
// testRule.onSuccess
// Results will be displayed automatically
// Test results container will show/hide based on testRule.data
```

### Step 8: Style and Polish

#### Color Scheme
- Primary: `#2563eb` (blue)
- Success: `#16a34a` (green)  
- Warning: `#ea580c` (orange)
- Error: `#dc2626` (red)
- Background: `#f8fafc` (light gray)

#### Component Spacing
- Container padding: `24px`
- Form element gaps: `16px`
- Section margins: `24px`
- Button gaps: `12px`

#### Typography
- Page title: `24px`, bold
- Section titles: `20px`, semibold
- Subsection titles: `16px`, medium
- Body text: `14px`, normal
- Helper text: `12px`, gray

### Step 9: Test the Application

#### Functional Testing

**✅ Rule Creation:**
1. Switch between rule types and verify form sections show/hide
2. Fill out form for each rule type
3. Test validation with invalid/missing data
4. Create rules and verify they appear in the management table
5. Check success notifications

**✅ Rule Management:**
1. Verify rules table loads with data
2. Test search functionality
3. Test status filtering
4. Test table sorting
5. Test action buttons (test redirects to test tab, delete works)

**✅ Rule Testing:**
1. Select different rules and verify info displays
2. Switch between real/mock data sources
3. Select employees and verify info displays  
4. Run tests and verify results display correctly
5. Test with both eligible and non-eligible scenarios

**✅ System Integration:**
1. Verify health check shows system status
2. Test API connectivity
3. Verify all queries execute successfully
4. Check error handling for API failures

### Step 10: Deploy and Monitor

#### Deployment
1. **Save Application**: Ensure all changes are saved
2. **Share Access**: Configure user permissions if needed
3. **Document URLs**: Note the Retool app URL for users

#### Monitoring
1. **Check Logs**: Monitor Retool query logs for errors
2. **Monitor API**: Check middleware logs for API call patterns
3. **User Feedback**: Gather feedback from business users
4. **Performance**: Monitor query response times

### Troubleshooting

#### Common Issues

**API Connection Failed:**
- Verify middleware is running on `http://localhost:3000`
- Check CORS configuration in middleware
- Ensure Retool can reach localhost (use ngrok for cloud Retool)

**Queries Failing:**
- Check query configuration matches middleware endpoints
- Verify request body format
- Check middleware logs for error details

**Components Not Updating:**
- Verify component data bindings use correct syntax
- Check that queries have proper transformers
- Ensure event handlers are correctly configured

**Functions Not Working:**
- Verify helper functions are saved in global scope
- Check for JavaScript syntax errors
- Ensure function names match component event handlers

#### Getting Help

- **Retool Documentation**: https://docs.retool.com
- **Middleware API**: Check `http://localhost:3000` for endpoint documentation
- **Logs**: Check browser console and middleware logs for detailed errors

## Next Steps

After successful installation:

1. **User Training**: Train business users on the interface
2. **Additional Features**: Add rule versioning, audit logs, bulk operations
3. **Integration**: Connect to real employee/health plan systems
4. **Monitoring**: Set up application monitoring and alerting
5. **Security**: Implement proper authentication and authorization

## Support

For questions about this installation:
- Check the main project README.md
- Review middleware documentation
- Test individual components step-by-step
- Verify API endpoints using tools like Postman