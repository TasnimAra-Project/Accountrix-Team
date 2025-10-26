-- Add expiry_date column to classes table if it doesn't exist
ALTER TABLE classes ADD COLUMN IF NOT EXISTS expiry_date DATE NULL;

-- Optionally, add an index for querying expired classes
CREATE INDEX IF NOT EXISTS idx_classes_expiry ON classes(expiry_date);

