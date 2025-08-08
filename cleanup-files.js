#!/usr/bin/env node

/**
 * Clean up unnecessary files
 */

const fs = require('fs');
const path = require('path');

const filesToDelete = [
  // Batch files (Windows-specific)
  'clean-start.bat',
  'fix-existing.bat',
  'fix-network.bat',
  'fix-openapi.bat',
  'fix-retool-port.bat',
  'fix-retool-version.bat',
  'force-retool-restart.bat',
  'restart-retool-fixed.bat',
  'setup-retool-license.bat',
  'start-retool-community.bat',
  'start-self-hosted.bat',
  'test-dynamic-fix.bat',
  'rebuild-fix.bat',
  
  // Shell scripts (Unix-specific)
  'cleanup.sh',
  'rebuild-fix.sh',
  'start-self-hosted.sh',
  
  // Redundant JS files
  'check-retool-config.js',
  'check-status.js',
  'debug-compose.js',
  'diagnose-retool.js',
  'rebuild-and-test.js',
  'test-retool.js',
  'verify-services.js',
  
  // Redundant documentation
  'SELF_HOSTED_README.md',
  'FINAL_STRUCTURE.md',
  'retool-queries-template.json',
  
  // Unnecessary env files
  '.env.self-hosted',
  '.env.self-hosted.example'
];

const dirsToDelete = [
  'retool-self-hosted'
];

console.log('Cleaning up unnecessary files...\n');

filesToDelete.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Deleted: ${file}`);
  }
});

dirsToDelete.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Deleted directory: ${dir}`);
  }
});

console.log('\n✓ Cleanup complete');
console.log('\nRemaining essential files:');
console.log('• docker-compose.yml (original without Retool)');
console.log('• docker-compose.self-hosted.yml (with Retool)');
console.log('• check-services.js (verify all services)');
console.log('• README.md (main documentation)');
console.log('• README-SELF-HOSTED.md (self-hosted guide)');
