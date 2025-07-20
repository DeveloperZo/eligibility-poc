#!/usr/bin/env node

/**
 * TypeScript Error Scanning Script
 * Systematically checks all TypeScript files for compilation errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TypeScriptErrorScanner {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.scannedFiles = [];
  }

  async scanMiddleware() {
    console.log('🔍 Scanning middleware TypeScript files...\n');
    
    const middlewarePath = path.join(__dirname, 'middleware');
    process.chdir(middlewarePath);
    
    try {
      // 1. Check if dependencies are installed
      if (!fs.existsSync('node_modules')) {
        console.log('⚠️  Installing middleware dependencies...');
        execSync('npm install', { stdio: 'inherit' });
      }
      
      // 2. Run TypeScript compiler in check mode
      console.log('🔨 Running TypeScript compilation check...');
      const compileResult = execSync('npx tsc --noEmit --pretty', { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      
      console.log('✅ TypeScript compilation: SUCCESS');
      
      // 3. Check for any .ts files that don't have corresponding .d.ts files
      console.log('\n📋 Verifying compiled outputs...');
      this.verifyCompiledOutputs();
      
    } catch (error) {
      console.log('❌ TypeScript compilation: FAILED');
      console.log('📝 Compilation errors:');
      console.log(error.stdout || error.message);
      this.errors.push({
        file: 'middleware compilation',
        error: error.stdout || error.message
      });
    }
  }

  verifyCompiledOutputs() {
    const srcPath = path.join(__dirname, 'middleware', 'src');
    const distPath = path.join(__dirname, 'middleware', 'dist');
    
    if (!fs.existsSync(distPath)) {
      this.warnings.push('No dist folder found - TypeScript may not have been compiled yet');
      return;
    }

    const tsFiles = this.findTypeScriptFiles(srcPath);
    let missingOutputs = 0;

    tsFiles.forEach(tsFile => {
      const relativePath = path.relative(srcPath, tsFile);
      const jsFile = path.join(distPath, relativePath.replace('.ts', '.js'));
      const dtsFile = path.join(distPath, relativePath.replace('.ts', '.d.ts'));
      
      if (!fs.existsSync(jsFile)) {
        this.warnings.push(`Missing compiled JS: ${relativePath}`);
        missingOutputs++;
      }
      
      if (!fs.existsSync(dtsFile)) {
        this.warnings.push(`Missing type definition: ${relativePath}`);
        missingOutputs++;
      }
    });

    if (missingOutputs === 0) {
      console.log('✅ All TypeScript files have corresponding compiled outputs');
    } else {
      console.log(`⚠️  ${missingOutputs} files missing compiled outputs`);
    }
  }

  findTypeScriptFiles(dir) {
    let tsFiles = [];
    
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        tsFiles = tsFiles.concat(this.findTypeScriptFiles(fullPath));
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        tsFiles.push(fullPath);
        this.scannedFiles.push(fullPath);
      }
    });
    
    return tsFiles;
  }

  async scanIntegrationTests() {
    console.log('\n🔍 Scanning integration tests...\n');
    
    const testsPath = path.join(__dirname, 'tests');
    process.chdir(testsPath);
    
    try {
      // Check if package.json exists and install deps if needed
      if (fs.existsSync('package.json') && !fs.existsSync('node_modules')) {
        console.log('⚠️  Installing test dependencies...');
        execSync('npm install', { stdio: 'inherit' });
      }
      
      // Check TypeScript syntax using tsx
      console.log('🔨 Checking integration tests TypeScript syntax...');
      const result = execSync('npx tsx --check integration-tests.ts', { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      console.log('✅ Integration tests TypeScript: SUCCESS');
      
    } catch (error) {
      console.log('❌ Integration tests TypeScript: FAILED');
      console.log('📝 Test file errors:');
      console.log(error.stdout || error.message);
      this.errors.push({
        file: 'integration-tests.ts',
        error: error.stdout || error.message
      });
    }
  }

  async checkStaticMethodContextIssues() {
    console.log('\n🔍 Scanning for static method context issues...\n');
    
    const middlewareSrc = path.join(__dirname, 'middleware', 'src');
    const tsFiles = this.findTypeScriptFiles(middlewareSrc);
    
    let foundIssues = 0;
    
    tsFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      // Look for patterns like this.someMethod() inside static methods
      let inStaticMethod = false;
      let staticMethodName = '';
      
      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        
        // Detect start of static method
        if (trimmedLine.includes('static ') && (trimmedLine.includes('(') || trimmedLine.includes('async'))) {
          inStaticMethod = true;
          staticMethodName = trimmedLine.match(/static\\s+(?:async\\s+)?([\\w]+)/)?.[1] || 'unknown';
        }
        
        // Detect end of method (simple heuristic)
        if (inStaticMethod && trimmedLine === '}' && !trimmedLine.includes('{')) {
          inStaticMethod = false;
          staticMethodName = '';
        }
        
        // Look for this.method() calls inside static methods
        if (inStaticMethod && trimmedLine.includes('this.') && trimmedLine.includes('(')) {
          const relativePath = path.relative(middlewareSrc, file);
          console.log(`⚠️  Potential static method context issue:`);
          console.log(`   File: ${relativePath}:${index + 1}`);
          console.log(`   Method: ${staticMethodName}`);
          console.log(`   Line: ${trimmedLine}`);
          
          this.warnings.push({
            file: relativePath,
            line: index + 1,
            method: staticMethodName,
            issue: 'this.method() call in static method',
            code: trimmedLine
          });
          
          foundIssues++;
        }
      });
    });
    
    if (foundIssues === 0) {
      console.log('✅ No static method context issues found');
    } else {
      console.log(`⚠️  Found ${foundIssues} potential static method context issues`);
    }
  }

  async checkImportExportIssues() {
    console.log('\n🔍 Checking import/export consistency...\n');
    
    const middlewareSrc = path.join(__dirname, 'middleware', 'src');
    const tsFiles = this.findTypeScriptFiles(middlewareSrc);
    
    let issueCount = 0;
    
    // Check for common import issues
    tsFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      const relativePath = path.relative(middlewareSrc, file);
      
      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        
        // Check for relative imports that might be incorrect
        if (trimmedLine.startsWith('import') && trimmedLine.includes('../')) {
          const importPath = trimmedLine.match(/from\\s+['"]([^'"]+)['"]/)?.[1];
          if (importPath) {
            const fullImportPath = path.resolve(path.dirname(file), importPath);
            const possibleFiles = [
              fullImportPath + '.ts',
              fullImportPath + '.js',
              path.join(fullImportPath, 'index.ts'),
              path.join(fullImportPath, 'index.js')
            ];
            
            const exists = possibleFiles.some(p => fs.existsSync(p));
            if (!exists) {
              console.log(`⚠️  Potentially broken import:`);
              console.log(`   File: ${relativePath}:${index + 1}`);
              console.log(`   Import: ${importPath}`);
              
              this.warnings.push({
                file: relativePath,
                line: index + 1,
                issue: 'Import path may not resolve',
                import: importPath
              });
              
              issueCount++;
            }
          }
        }
      });
    });
    
    if (issueCount === 0) {
      console.log('✅ No import/export issues found');
    } else {
      console.log(`⚠️  Found ${issueCount} potential import issues`);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 TYPESCRIPT ERROR SCANNING REPORT');
    console.log('='.repeat(70));
    
    console.log(`\\n📈 Summary:`);
    console.log(`   • Files scanned: ${this.scannedFiles.length}`);
    console.log(`   • Compilation errors: ${this.errors.length}`);
    console.log(`   • Warnings: ${this.warnings.length}`);
    
    if (this.errors.length > 0) {
      console.log('\\n❌ COMPILATION ERRORS:');
      this.errors.forEach((error, index) => {
        console.log(`\\n${index + 1}. ${error.file}:`);
        console.log(`   ${error.error.split('\\n')[0]}`);
      });
    }
    
    if (this.warnings.length > 0 && this.warnings.length <= 10) {
      console.log('\\n⚠️  WARNINGS:');
      this.warnings.forEach((warning, index) => {
        console.log(`\\n${index + 1}. ${warning.file || warning}:`);
        if (typeof warning === 'object' && warning.issue) {
          console.log(`   Issue: ${warning.issue}`);
          if (warning.line) console.log(`   Line: ${warning.line}`);
          if (warning.code) console.log(`   Code: ${warning.code}`);
        }
      });
    } else if (this.warnings.length > 10) {
      console.log(`\\n⚠️  ${this.warnings.length} warnings found (too many to display)`);
    }
    
    console.log('\\n' + '='.repeat(70));
    
    if (this.errors.length === 0) {
      console.log('🎉 TypeScript compilation is CLEAN!');
      console.log('   All TypeScript files compile without errors.');
      console.log('   Ready for next development step.');
    } else {
      console.log('🚨 TypeScript compilation has ERRORS!');
      console.log(`   ${this.errors.length} error(s) need to be fixed before proceeding.`);
    }
    
    console.log('\\n' + '='.repeat(70));
  }

  async run() {
    console.log('🚀 Starting comprehensive TypeScript error scan...\\n');
    
    try {
      await this.scanMiddleware();
      await this.scanIntegrationTests();
      await this.checkStaticMethodContextIssues();
      await this.checkImportExportIssues();
      
      this.generateReport();
      
      return this.errors.length === 0;
    } catch (error) {
      console.error('❌ Scanner failed:', error);
      return false;
    }
  }
}

// Run the scanner
const scanner = new TypeScriptErrorScanner();
scanner.run().then(success => {
  process.exit(success ? 0 : 1);
});
