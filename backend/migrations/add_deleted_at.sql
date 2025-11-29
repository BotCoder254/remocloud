-- Add deleted_at column to files table for soft delete functionality
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add index for better performance on trash queries
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_files_user_deleted ON files(user_id, deleted_at);