#!/usr/bin/env node

/**
 * OS-agnostic script to apply database schema
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

async function applySchema() {
  log('\n📦 Applying orchestration schema to PostgreSQL...', 'cyan');

  // Check if Docker is running
  try {
    runCommand('docker --version', { silent: true });
  } catch (error) {
    log('❌ Docker is not installed or not running', 'red');
    process.exit(1);
  }

  // Check if container is running
  const containerName = 'eligibility-poc-postgres-1';
  const containers = runCommand('docker ps --format "{{.Names}}"', { silent: true });
  
  if (!containers || !containers.includes(containerName)) {
    log(`❌ PostgreSQL container '${containerName}' is not running`, 'red');
    log('   Start it with: docker-compose up -d postgres', 'yellow');
    process.exit(1);
  }

  // Path to schema file
  const schemaPath = path.join(__dirname, '..', 'data', 'orchestration-schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    log(`❌ Schema file not found: ${schemaPath}`, 'red');
    process.exit(1);
  }

  // Read schema file
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  try {
    // Apply schema using docker exec with stdin
    log('\nApplying schema...', 'cyan');
    
    // Create a temporary file with the schema content (works on all OS)
    const tempFile = path.join(__dirname, '..', 'data', '.temp-schema.sql');
    fs.writeFileSync(tempFile, schemaContent);
    
    // Copy file to container
    runCommand(`docker cp "${tempFile}" ${containerName}:/tmp/schema.sql`, { silent: true });
    
    // Execute the schema
    runCommand(`docker exec ${containerName} psql -U postgres -d postgres -f /tmp/schema.sql`);
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    runCommand(`docker exec ${containerName} rm /tmp/schema.sql`, { silent: true, ignoreError: true });
    
    log('\n✅ Schema applied successfully!', 'green');

    // Verify tables were created
    log('\n📋 Verifying tables...', 'cyan');
    const tables = runCommand(
      `docker exec ${containerName} psql -U postgres -d postgres -c "\\dt orchestration_*"`,
      { silent: true }
    );
    console.log(tables);

    // Check views
    log('\n📊 Checking views...', 'cyan');
    const views = runCommand(
      `docker exec ${containerName} psql -U postgres -d postgres -c "SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE '%approval%' OR viewname LIKE '%metric%';"`,
      { silent: true }
    );
    console.log(views);

    // Test a simple query
    log('\n🔍 Testing database connection...', 'cyan');
    const testQuery = runCommand(
      `docker exec ${containerName} psql -U postgres -d postgres -c "SELECT COUNT(*) FROM orchestration_state;"`,
      { silent: true }
    );
    console.log(testQuery);

    log('\n🎉 Database setup complete!', 'green');
    log('\nYou can now:', 'cyan');
    log('  1. Start the middleware: cd middleware && npm start');
    log('  2. Run API tests: node scripts/testing/test-orchestration-api.js');
    log('  3. Access Camunda: http://localhost:8080 (admin/admin)');

  } catch (error) {
    log('\n❌ Failed to apply schema:', 'red');
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
applySchema().catch(error => {
  log('❌ Unexpected error:', 'red');
  console.error(error);
  process.exit(1);
});
