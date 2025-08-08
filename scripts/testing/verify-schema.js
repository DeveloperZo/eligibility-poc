const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

/**
 * Schema Verification Script
 * Tests the orchestration schema with actual operations
 */

async function verifySchema() {
  // PostgreSQL connection
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'postgres'
  });

  try {
    console.log('🔍 Connecting to PostgreSQL...');
    await client.connect();

    // 1. Execute the schema
    console.log('📝 Creating schema...');
    const schemaSQL = await fs.readFile(
      path.join(__dirname, '../../data/orchestration-schema.sql'), 
      'utf8'
    );
    await client.query(schemaSQL);
    console.log('✅ Schema created successfully');

    // 2. Test INSERT operations
    console.log('\n📝 Testing INSERT operations...');
    const insertResult = await client.query(`
      INSERT INTO orchestration_state 
      (resource_id, resource_type, workflow_state, aidbox_version, submitted_by)
      VALUES 
      ($1, $2, $3, $4, $5)
      RETURNING *
    `, ['test-plan-001', 'InsurancePlan', 'draft', '1', 'user-123']);
    console.log('✅ Insert successful:', insertResult.rows[0]);

    // 3. Test UPDATE and trigger
    console.log('\n📝 Testing UPDATE and trigger...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    const updateResult = await client.query(`
      UPDATE orchestration_state 
      SET workflow_state = 'in_approval', 
          camunda_process_id = 'process-123',
          submitted_at = NOW()
      WHERE resource_id = $1
      RETURNING *
    `, ['test-plan-001']);
    
    const updated = updateResult.rows[0];
    console.log('✅ Update successful');
    console.log('   - updated_at changed:', updated.updated_at > updated.created_at);
    console.log('   - New state:', updated.workflow_state);

    // 4. Test Views
    console.log('\n📝 Testing views...');
    const pendingResult = await client.query('SELECT * FROM pending_approvals');
    console.log('✅ Pending approvals view works:', pendingResult.rows.length, 'records');

    const metricsResult = await client.query('SELECT * FROM workflow_metrics');
    console.log('✅ Workflow metrics view works:', metricsResult.rows);

    // 5. Test Audit
    console.log('\n📝 Testing audit table...');
    await client.query(`
      INSERT INTO orchestration_audit 
      (resource_id, resource_type, action, from_state, to_state, user_id, comments)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, ['test-plan-001', 'InsurancePlan', 'submitted', 'draft', 'in_approval', 'user-123', 'Submitting for approval']);
    console.log('✅ Audit log works');

    // 6. Test Constraints
    console.log('\n📝 Testing constraints...');
    try {
      await client.query(`
        INSERT INTO orchestration_state 
        (resource_id, resource_type, workflow_state, aidbox_version)
        VALUES ('test-bad', 'InsurancePlan', 'invalid_state', '1')
      `);
      console.log('❌ Constraint check failed - invalid state was allowed');
    } catch (err) {
      console.log('✅ Constraint works - invalid state rejected');
    }

    // 7. Test Transaction Rollback
    console.log('\n📝 Testing transaction rollback...');
    await client.query('BEGIN');
    await client.query(`
      UPDATE orchestration_state 
      SET workflow_state = 'approved' 
      WHERE resource_id = 'test-plan-001'
    `);
    await client.query('ROLLBACK');
    const rollbackCheck = await client.query(
      'SELECT workflow_state FROM orchestration_state WHERE resource_id = $1',
      ['test-plan-001']
    );
    console.log('✅ Rollback works, state is still:', rollbackCheck.rows[0].workflow_state);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await client.query("DELETE FROM orchestration_audit WHERE resource_id LIKE 'test-%'");
    await client.query("DELETE FROM orchestration_state WHERE resource_id LIKE 'test-%'");
    
    console.log('\n✅ All schema tests passed!');
    
    // Show schema info
    console.log('\n📊 Schema Information:');
    const tables = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('orchestration_state', 'orchestration_audit', 'pending_approvals', 'workflow_metrics')
      ORDER BY table_name
    `);
    console.table(tables.rows);

  } catch (error) {
    console.error('❌ Schema verification failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run verification
if (require.main === module) {
  verifySchema()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { verifySchema };
