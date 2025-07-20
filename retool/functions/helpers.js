// Helper functions for the Retool Eligibility Rule Management application

/**
 * Get rule configuration object based on current form values
 * @returns {Object} Configuration object for the selected rule type
 */
function getRuleConfiguration() {
  const ruleType = ruleTypeSelect.value;
  
  switch (ruleType) {
    case 'age':
      return {
        minAge: minAgeInput.value,
        operator: operatorSelect.value || '>='
      };
    
    case 'health_plan':
      return {
        allowedPlans: healthPlanSelect.value || [],
        requireActive: requireActiveStatus.value
      };
    
    case 'group_number':
      return {
        groupNumber: groupNumberInput.value,
        exactMatch: exactMatchCheckbox.value
      };
    
    default:
      return {};
  }
}

/**
 * Format rule type for display
 * @param {string} type - Rule type code
 * @returns {string} Formatted rule type name
 */
function formatRuleType(type) {
  const typeMap = {
    'age': 'Age Validation',
    'health_plan': 'Health Plan Check',
    'group_number': 'Group Number Verification'
  };
  
  return typeMap[type] || type;
}

/**
 * Get color for rule type badge
 * @param {string} type - Rule type code
 * @returns {string} Color name for badge
 */
function getRuleTypeColor(type) {
  const colorMap = {
    'age': 'blue',
    'health_plan': 'green',
    'group_number': 'purple'
  };
  
  return colorMap[type] || 'gray';
}

/**
 * Get color for status badge
 * @param {string} status - Rule status
 * @returns {string} Color name for badge
 */
function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'deployed':
      return 'green';
    case 'inactive':
    case 'draft':
      return 'orange';
    case 'error':
    case 'failed':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get rule configuration summary for display
 * @param {Object} rule - Rule object
 * @returns {string} Summary of rule configuration
 */
function getRuleConfigSummary(rule) {
  if (!rule || !rule.configuration) return 'No configuration';
  
  const config = rule.configuration;
  
  switch (rule.type) {
    case 'age':
      return `Age ${config.operator || '>='} ${config.minAge || 'N/A'}`;
    
    case 'health_plan':
      const plans = config.allowedPlans || [];
      const planText = plans.length > 0 ? `${plans.length} plan(s)` : 'No plans';
      const activeText = config.requireActive ? ' (active only)' : '';
      return `${planText}${activeText}`;
    
    case 'group_number':
      const matchType = config.exactMatch ? 'exact' : 'pattern';
      return `Group: ${config.groupNumber || 'N/A'} (${matchType} match)`;
    
    default:
      return 'Unknown configuration';
  }
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return 'N/A';
  
  try {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch (e) {
    return 'Invalid date';
  }
}

/**
 * Format timestamp for display
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {string} Formatted timestamp string
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  
  try {
    const d = new Date(timestamp);
    return d.toLocaleString();
  } catch (e) {
    return 'Invalid timestamp';
  }
}

/**
 * Handle rule type selection change
 */
function handleRuleTypeChange() {
  const selectedType = ruleTypeSelect.value;

  // Show/hide appropriate form sections
  ageRulesContainer.setHidden(selectedType !== 'age');
  healthPlanContainer.setHidden(selectedType !== 'health_plan');
  groupNumberContainer.setHidden(selectedType !== 'group_number');

  // Clear previous values when switching types
  if (selectedType !== 'age') {
    minAgeInput.clearValue();
    operatorSelect.setValue('>=');
  }

  if (selectedType !== 'health_plan') {
    healthPlanSelect.clearValue();
    requireActiveStatus.setValue(true);
  }

  if (selectedType !== 'group_number') {
    groupNumberInput.clearValue();
    exactMatchCheckbox.setValue(true);
  }
}

/**
 * Clear the rule creation form
 */
function clearRuleForm() {
  ruleNameInput.clearValue();
  descriptionInput.clearValue();
  ruleTypeSelect.clearValue();
  minAgeInput.clearValue();
  operatorSelect.setValue('>=');
  healthPlanSelect.clearValue();
  requireActiveStatus.setValue(true);
  groupNumberInput.clearValue();
  exactMatchCheckbox.setValue(true);
  
  // Hide all rule type containers
  ageRulesContainer.setHidden(true);
  healthPlanContainer.setHidden(true);
  groupNumberContainer.setHidden(true);
  
  // Hide validation results
  validationResultsContainer.setHidden(true);
}

/**
 * Validate rule configuration
 */
function validateRule() {
  const ruleType = ruleTypeSelect.value;
  const config = getRuleConfiguration();
  
  let isValid = true;
  let message = '';
  
  // Basic validation
  if (!ruleNameInput.value) {
    isValid = false;
    message = 'Rule name is required';
  } else if (!ruleType) {
    isValid = false;
    message = 'Rule type is required';
  } else {
    // Type-specific validation
    switch (ruleType) {
      case 'age':
        if (!config.minAge || config.minAge < 0 || config.minAge > 150) {
          isValid = false;
          message = 'Please enter a valid age between 0 and 150';
        }
        break;
      
      case 'health_plan':
        if (!config.allowedPlans || config.allowedPlans.length === 0) {
          isValid = false;
          message = 'Please select at least one health plan';
        }
        break;
      
      case 'group_number':
        if (!config.groupNumber || config.groupNumber.trim() === '') {
          isValid = false;
          message = 'Please enter a group number';
        }
        break;
    }
  }
  
  // Show validation results
  validationResultsContainer.setHidden(false);
  validationMessage.setValue(isValid ? 'Rule configuration is valid' : message);
  
  return isValid;
}

/**
 * Create rule and handle response
 */
function createRule() {
  // Validate first
  if (!validateRule()) {
    return;
  }
  
  // Execute create rule query
  createRule.trigger({
    onSuccess: () => {
      // Refresh rules table
      listRules.trigger();
      
      // Clear form
      clearRuleForm();
      
      // Switch to management tab to see the new rule
      setTimeout(() => {
        mainTabs.setCurrentTab('manageRulesTab');
      }, 1000);
    },
    onFailure: (error) => {
      console.error('Failed to create rule:', error);
    }
  });
}

/**
 * Get filtered rules for the table
 * @returns {Array} Filtered rules array
 */
function getFilteredRules() {
  const rules = listRules.data || [];
  const searchTerm = searchInput.value?.toLowerCase() || '';
  const statusFilter = statusFilter.value || 'all';
  
  return rules.filter(rule => {
    // Search filter
    const matchesSearch = !searchTerm || 
      rule.name?.toLowerCase().includes(searchTerm) ||
      rule.description?.toLowerCase().includes(searchTerm) ||
      formatRuleType(rule.type).toLowerCase().includes(searchTerm);
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || 
      rule.status?.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });
}

/**
 * Filter rules table
 */
function filterRulesTable() {
  // The table will automatically re-render with filtered data
  // due to the getFilteredRules() function in the data property
}

/**
 * Handle rule selection in the table
 */
function handleRuleSelection() {
  const selectedRule = rulesTable.selectedRow;
  console.log('Selected rule:', selectedRule);
}

/**
 * Open test modal for a specific rule
 * @param {Object} rule - Rule to test
 */
function openTestModal(rule) {
  testRuleSelect.setValue(rule.id);
  mainTabs.setCurrentTab('testRulesTab');
}

/**
 * Open edit modal for a specific rule
 * @param {Object} rule - Rule to edit
 */
function openEditModal(rule) {
  // For now, just show an info message
  // In the future, this could populate the create form with existing values
  utils.showNotification({
    title: "Edit Feature",
    description: "Rule editing will be available in a future version",
    type: "info"
  });
}

/**
 * Open delete confirmation modal
 * @param {Object} rule - Rule to delete
 */
function openDeleteModal(rule) {
  if (confirm(`Are you sure you want to delete the rule "${rule.name}"? This action cannot be undone.`)) {
    deleteRule.trigger({
      additionalScope: {
        ruleId: rule.id
      },
      onSuccess: () => {
        // Refresh rules table
        listRules.trigger();
      }
    });
  }
}

/**
 * Bulk test selected rules
 */
function bulkTestRules() {
  const selectedRules = rulesTable.selectedRows;
  
  utils.showNotification({
    title: "Bulk Test",
    description: `Bulk testing for ${selectedRules.length} rules will be available in a future version`,
    type: "info"
  });
}

/**
 * Bulk delete selected rules
 */
function bulkDeleteRules() {
  const selectedRules = rulesTable.selectedRows;
  
  if (confirm(`Are you sure you want to delete ${selectedRules.length} selected rules? This action cannot be undone.`)) {
    utils.showNotification({
      title: "Bulk Delete",
      description: `Bulk deletion for ${selectedRules.length} rules will be available in a future version`,
      type: "info"
    });
  }
}

/**
 * Handle test rule selection
 */
function handleTestRuleSelection() {
  const ruleId = testRuleSelect.value;
  const selectedRule = listRules.data?.find(rule => rule.id === ruleId);
  console.log('Test rule selected:', selectedRule);
}

/**
 * Get selected rule for testing
 * @returns {Object|null} Selected rule object
 */
function getSelectedRule() {
  const ruleId = testRuleSelect.value;
  return listRules.data?.find(rule => rule.id === ruleId) || null;
}

/**
 * Handle data source change (real vs mock)
 */
function handleDataSourceChange() {
  // Clear employee selection when switching data sources
  employeeSelect.clearValue();
  
  // Refresh employee data
  getEmployees.trigger();
}

/**
 * Get employee data based on selected data source
 * @returns {Array} Employee data array
 */
function getEmployeeData() {
  const dataSource = dataSourceSelect.value;
  const employees = getEmployees.data || [];
  
  // For now, return all employees regardless of data source
  // In the future, this could filter or modify data based on source
  return employees;
}

/**
 * Handle employee selection
 */
function handleEmployeeSelection() {
  const employeeId = employeeSelect.value;
  const selectedEmployee = getEmployees.data?.find(emp => emp.id === employeeId);
  console.log('Employee selected:', selectedEmployee);
}

/**
 * Get selected employee for testing
 * @returns {Object|null} Selected employee object
 */
function getSelectedEmployee() {
  const employeeId = employeeSelect.value;
  return getEmployees.data?.find(emp => emp.id === employeeId) || null;
}

/**
 * Run eligibility test
 */
function runEligibilityTest() {
  const selectedRule = getSelectedRule();
  const selectedEmployee = getSelectedEmployee();
  
  if (!selectedRule) {
    utils.showNotification({
      title: "No Rule Selected",
      description: "Please select a rule to test",
      type: "warning"
    });
    return;
  }
  
  if (!selectedEmployee) {
    utils.showNotification({
      title: "No Employee Selected", 
      description: "Please select an employee to test",
      type: "warning"
    });
    return;
  }
  
  testRule.trigger({
    additionalScope: {
      selectedRule: selectedRule
    },
    onSuccess: (result) => {
      // Results will be displayed automatically via the testResults container
      console.log('Test completed:', result);
    },
    onFailure: (error) => {
      console.error('Test failed:', error);
    }
  });
}

/**
 * Clear test results
 */
function clearTestResults() {
  testResultsContainer.setHidden(true);
  testRuleSelect.clearValue();
  employeeSelect.clearValue();
  dataSourceSelect.setValue('mock');
}