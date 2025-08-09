#!/usr/bin/env node

/**
 * OS-agnostic script to verify Camunda database
 * Works on Windows, Mac, and Linux
 * Run: node scripts/apply-schema.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result;
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

async function verifyCamundaDatabase() {
  log('\n📦 Verifying Camunda database setup...', 'cyan');
  log('   Note: Using 3-database stateless architecture (Retool, Camunda, Aidbox)', 'yellow');

  // Check if Docker is running
  try {
    runCommand('docker --version', { silent: true });
  } catch (error) {
    log('❌ Docker is not installed or not running', 'red');
    process.exit(1);
  }

  // Check if Camunda PostgreSQL container is running
  const containerName = 'camunda-postgres';
  const containers = runCommand('docker ps --format "{{.Names}}"', { silent: true });
  
  if (!containers || !containers.includes(containerName)) {
    log(`❌ Camunda PostgreSQL container '${containerName}' is not running`, 'red');
    log('   Start it with: docker-compose up -d postgres', 'yellow');
    process.exit(1);
  }

  try {
    // Verify Camunda tables exist
    log('\n📋 Verifying Camunda tables...', 'cyan');
    const tables = runCommand(
      `docker exec ${containerName} psql -U camunda -d camunda -c "\\dt act_*" 2>/dev/null || echo "Camunda tables will be created on first startup"`,
      { silent: true }
    );
    console.log(tables);

    // Test database connection
    log('\n🔍 Testing database connection...', 'cyan');
    const testQuery = runCommand(
      `docker exec ${containerName} psql -U camunda -d camunda -c "SELECT current_database(), current_user, version();"`,
      { silent: true }
    );
    console.log(testQuery);

    log('\n✅ Camunda database verified!', 'green');
    log('\n📌 Architecture Overview:', 'cyan');
    log('   • Retool Database: Stores draft rules and UI state', 'yellow');
    log('   • Camunda Database: Manages workflows and DMN rules', 'yellow');
    log('   • Aidbox Database: Stores approved benefit plans (FHIR)', 'yellow');
    log('   • Middleware: Stateless orchestration layer (no database)', 'green');

    log('\n🎉 Database verification complete!', 'green');
    log('\nYou can now:', 'cyan');
    log('  1. Start the middleware: cd middleware && npm start');
    log('  2. Access Camunda: http://localhost:8080 (admin/admin)');
    log('  3. View API docs: http://localhost:3000/api-docs');

  } catch (error) {
    log('\n❌ Failed to verify database:', 'red');
    console.error(error.message);
    
    // Try to show PostgreSQL logs for debugging
    try {
      log('\n📋 PostgreSQL logs:', 'yellow');
      runCommand(`docker logs --tail 20 ${containerName}`);
    } catch (logError) {
      // Ignore if we can't get logs
    }
    
    process.exit(1);
  }
}

// Run the script
verifyCamundaDatabase().catch(error => {
  log('❌ Unexpected error:', 'red');
  console.error(error);
  process.exit(1);
});
