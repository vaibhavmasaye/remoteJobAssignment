import { execute } from './connection';
import { getLogger } from '../observability/logger';

const logger = getLogger('db-init');

// Database schema as a string
const DATABASE_SCHEMA = `
-- Sync Pipeline Schema

-- Source Connections
CREATE TABLE IF NOT EXISTS source_connections (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  account_external_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  encrypted_credentials TEXT,
  last_success_at TIMESTAMP,
  last_error_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, account_external_id)
);

CREATE INDEX IF NOT EXISTS idx_source_connections_status ON source_connections(status);
CREATE INDEX IF NOT EXISTS idx_source_connections_last_error ON source_connections(last_error_at);

-- Sync Checkpoints (Cursors, watermarks for incremental sync)
CREATE TABLE IF NOT EXISTS sync_checkpoints (
  id VARCHAR(255) PRIMARY KEY,
  connection_id VARCHAR(255) NOT NULL,
  object_type VARCHAR(255) NOT NULL,
  cursor TEXT,
  watermark TIMESTAMP,
  cursor_version INTEGER DEFAULT 1,
  last_full_sync_at TIMESTAMP,
  last_incremental_sync_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES source_connections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_checkpoints_connection ON sync_checkpoints(connection_id);

-- External Records (Raw data from sources)
CREATE TABLE IF NOT EXISTS external_records (
  id VARCHAR(255) PRIMARY KEY,
  connection_id VARCHAR(255) NOT NULL,
  object_type VARCHAR(255) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES source_connections(id) ON DELETE CASCADE,
  UNIQUE(connection_id, object_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_records_connection ON external_records(connection_id);
CREATE INDEX IF NOT EXISTS idx_external_records_synced ON external_records(synced_at);

-- Normalized Data (Transformed data in uniform schema)
CREATE TABLE IF NOT EXISTS normalized_data (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_data JSONB NOT NULL,
  external_record_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (external_record_id) REFERENCES external_records(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_normalized_data_source ON normalized_data(source);
CREATE INDEX IF NOT EXISTS idx_normalized_data_entity_type ON normalized_data(entity_type);

-- Failed Records (Records that failed during sync)
CREATE TABLE IF NOT EXISTS failed_records (
  id VARCHAR(255) PRIMARY KEY,
  connection_id VARCHAR(255) NOT NULL,
  object_type VARCHAR(255) NOT NULL,
  external_id VARCHAR(255),
  error_message TEXT,
  error_stack TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES source_connections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_failed_records_connection ON failed_records(connection_id);
CREATE INDEX IF NOT EXISTS idx_failed_records_retry_count ON failed_records(retry_count);

-- Sync Runs (Track individual sync executions)
CREATE TABLE IF NOT EXISTS sync_runs (
  id VARCHAR(255) PRIMARY KEY,
  correlation_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  requested_by VARCHAR(255),
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  error_message TEXT,
  summary JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_sync_runs_correlation_id ON sync_runs(correlation_id);

-- Source Sync Runs (Per-source sync tracking)
CREATE TABLE IF NOT EXISTS source_sync_runs (
  id VARCHAR(255) PRIMARY KEY,
  sync_run_id VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255) NOT NULL,
  source VARCHAR(50) NOT NULL,
  mode VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  record_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (connection_id) REFERENCES source_connections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_sync_runs_sync_run ON source_sync_runs(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_source_sync_runs_connection ON source_sync_runs(connection_id);
CREATE INDEX IF NOT EXISTS idx_source_sync_runs_status ON source_sync_runs(status);

-- Webhook Events (Track incoming webhooks)
CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed_at);
`;

/**
 * Initialize database schema
 */
export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database schema...');
    
    // Split by semicolon and execute each statement
    const statements = DATABASE_SCHEMA
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    for (const statement of statements) {
      await execute(statement);
    }
    
    logger.info('✅ Database schema initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database schema');
    throw error;
  }
}
