const { pool } = require('./models/database');

async function addLoOidColumn() {
  const client = await pool.connect();
  
  try {
    console.log('Adding lo_oid column to files table...');
    
    // Add lo_oid column if it doesn't exist
    await client.query(`
      ALTER TABLE files 
      ADD COLUMN IF NOT EXISTS lo_oid OID
    `);
    
    console.log('Successfully added lo_oid column');
    
    // Check current columns
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'files' 
      ORDER BY ordinal_position
    `);
    
    console.log('Current files table columns:');
    result.rows.forEach(row => console.log('- ' + row.column_name));
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

addLoOidColumn();