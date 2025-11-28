const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  } : {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'remocloud',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: false
  }
);

// Initialize database tables
const initDB = async () => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      )
    `);

    // API Keys table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        key_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        scopes TEXT[] DEFAULT ARRAY['read', 'write'],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        revoked_at TIMESTAMP
      )
    `);

    // Buckets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buckets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        is_public_by_default BOOLEAN DEFAULT FALSE,
        versioning_enabled BOOLEAN DEFAULT FALSE,
        allowed_types TEXT[] DEFAULT ARRAY['*'],
        storage_used BIGINT DEFAULT 0,
        file_count INTEGER DEFAULT 0,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, slug)
      )
    `);

    // Upload sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id UUID REFERENCES buckets(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(255),
        size BIGINT,
        object_key TEXT NOT NULL,
        signed_url TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id UUID REFERENCES buckets(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        upload_session_id UUID REFERENCES upload_sessions(id),
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(255),
        size BIGINT,
        object_key TEXT NOT NULL,
        file_hash VARCHAR(255),
        is_public BOOLEAN DEFAULT FALSE,
        version INTEGER DEFAULT 1,
        current_version_id UUID,
        metadata_json JSONB DEFAULT '{}',
        created_by UUID REFERENCES users(id),
        deleted_at TIMESTAMP,
        deleted_by UUID REFERENCES users(id),
        restore_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // File versions table for version history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS file_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_id UUID REFERENCES files(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(255),
        size BIGINT,
        object_key TEXT NOT NULL,
        file_hash VARCHAR(255),
        metadata_json JSONB DEFAULT '{}',
        is_current BOOLEAN DEFAULT FALSE,
        created_by UUID REFERENCES users(id),
        restored_from_version INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(file_id, version_number)
      )
    `);

    // Add foreign key constraint for current_version_id
    await pool.query(`
      ALTER TABLE files 
      ADD CONSTRAINT fk_files_current_version 
      FOREIGN KEY (current_version_id) 
      REFERENCES file_versions(id) 
      ON DELETE SET NULL
    `).catch(() => {}); // Ignore if constraint already exists

    // Image derivatives table for transform caching
    await pool.query(`
      CREATE TABLE IF NOT EXISTS image_derivatives (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_id UUID REFERENCES files(id) ON DELETE CASCADE,
        file_version_id UUID REFERENCES file_versions(id) ON DELETE CASCADE,
        transform_spec JSONB NOT NULL,
        transform_key VARCHAR(255) NOT NULL,
        object_key TEXT NOT NULL,
        mime_type VARCHAR(255) NOT NULL,
        size BIGINT NOT NULL,
        width INTEGER,
        height INTEGER,
        quality INTEGER,
        format VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(file_version_id, transform_key)
      )
    `);

    // Usage analytics table for tracking daily aggregates
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        bucket_id UUID REFERENCES buckets(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        uploads_count INTEGER DEFAULT 0,
        downloads_count INTEGER DEFAULT 0,
        deletes_count INTEGER DEFAULT 0,
        bandwidth_bytes BIGINT DEFAULT 0,
        storage_bytes BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, bucket_id, date)
      )
    `);

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_files_bucket_id ON files(bucket_id);
      CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
      CREATE INDEX IF NOT EXISTS idx_files_original_name ON files(original_name);
      CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
      CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);
      CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
      CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
      CREATE INDEX IF NOT EXISTS idx_file_versions_current ON file_versions(file_id, is_current);
      CREATE INDEX IF NOT EXISTS idx_derivatives_file_id ON image_derivatives(file_id);
      CREATE INDEX IF NOT EXISTS idx_derivatives_transform_key ON image_derivatives(transform_key);
      CREATE INDEX IF NOT EXISTS idx_derivatives_accessed_at ON image_derivatives(accessed_at);
      CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON usage_analytics(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_analytics_bucket_date ON usage_analytics(bucket_id, date);
      CREATE INDEX IF NOT EXISTS idx_analytics_date ON usage_analytics(date);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

module.exports = { pool, initDB };