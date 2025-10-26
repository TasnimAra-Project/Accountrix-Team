-- Complete cleanup of AI Progress Tracking data
-- Run this in MySQL Workbench to fix the JSON parsing error

USE student_teacher_db;

-- Disable safe update mode
SET SQL_SAFE_UPDATES = 0;

-- Show current bad data
SELECT 
    id, 
    team_id, 
    risk_reasons,
    CHAR_LENGTH(risk_reasons) as length,
    LEFT(risk_reasons, 50) as preview
FROM team_metrics;

-- Delete all progress tracking data to start fresh
DELETE FROM team_insights;
DELETE FROM task_events;
DELETE FROM team_metrics;

-- Verify tables are empty
SELECT 'team_metrics' as table_name, COUNT(*) as count FROM team_metrics
UNION ALL
SELECT 'task_events', COUNT(*) FROM task_events
UNION ALL
SELECT 'team_insights', COUNT(*) FROM team_insights;

-- Re-enable safe update mode
SET SQL_SAFE_UPDATES = 1;

SELECT '✅ Cleanup complete! Now run: node -e "require(\'./backend/services/cronService\').runProgressNow().then(() => process.exit(0));"' as next_step;

