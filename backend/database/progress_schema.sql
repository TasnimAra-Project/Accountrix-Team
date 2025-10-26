-- AI Progress Tracking Schema for SwipeTask
-- Add these tables to your existing database

USE student_teacher_db;

-- Table to store weekly progress metrics for teams
CREATE TABLE IF NOT EXISTS team_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    
    -- Core Metrics
    timeliness DECIMAL(5,2) DEFAULT 0 COMMENT 'Percentage of tasks completed on time',
    velocity DECIMAL(5,2) DEFAULT 0 COMMENT 'Tasks completed per week',
    engagement DECIMAL(5,2) DEFAULT 0 COMMENT 'Chat and submission activity score',
    work_balance DECIMAL(5,2) DEFAULT 0 COMMENT 'Gini coefficient for work distribution',
    rework DECIMAL(5,2) DEFAULT 0 COMMENT 'Percentage of tasks requiring resubmission',
    scope_remaining DECIMAL(5,2) DEFAULT 0 COMMENT 'Percentage of incomplete tasks',
    
    -- Computed Scores
    progress_score DECIMAL(5,2) DEFAULT 0 COMMENT 'Overall progress score (0-100)',
    risk_score DECIMAL(5,2) DEFAULT 0 COMMENT 'Risk score (0-100, higher = more risk)',
    risk_band ENUM('green', 'yellow', 'red') DEFAULT 'green' COMMENT 'Risk level indicator',
    
    -- Risk Reasons
    risk_reasons JSON COMMENT 'Array of reasons why team is at risk',
    
    -- Metadata
    total_tasks INT DEFAULT 0,
    completed_tasks INT DEFAULT 0,
    overdue_tasks INT DEFAULT 0,
    active_members INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_team_week (team_id, week_start),
    INDEX idx_team_date (team_id, week_start),
    INDEX idx_risk (risk_band, risk_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Weekly progress metrics for teams';

-- Table to log task-related events for analytics
CREATE TABLE IF NOT EXISTS task_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    team_id INT NOT NULL,
    user_id INT COMMENT 'User who triggered the event',
    
    event_type ENUM(
        'created',
        'assigned',
        'reassigned',
        'status_changed',
        'submitted',
        'resubmitted',
        'completed',
        'deleted',
        'due_date_changed'
    ) NOT NULL,
    
    -- Event Details
    old_value VARCHAR(255) COMMENT 'Previous value (for changes)',
    new_value VARCHAR(255) COMMENT 'New value (for changes)',
    metadata JSON COMMENT 'Additional event data',
    
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_task (task_id),
    INDEX idx_team_date (team_id, event_timestamp),
    INDEX idx_event_type (event_type, event_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Log of all task-related events';

-- Table to store AI-generated insights and recommendations
CREATE TABLE IF NOT EXISTS team_insights (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    
    insight_type ENUM(
        'at_risk',
        'falling_behind',
        'work_imbalance',
        'low_engagement',
        'improving',
        'on_track',
        'excellent'
    ) NOT NULL,
    
    severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    recommendations JSON COMMENT 'Array of recommended actions',
    
    is_active BOOLEAN DEFAULT TRUE,
    resolved_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_team_active (team_id, is_active),
    INDEX idx_severity (severity, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI-generated team insights';

-- Add indexes for better query performance (if they don't already exist)
-- Note: These may fail if indexes already exist, which is fine
CREATE INDEX idx_tasks_status ON tasks(status, due_date);
CREATE INDEX idx_tasks_team_status ON tasks(team_id, status);
CREATE INDEX idx_submissions_date ON task_submissions(task_id, submitted_at);

-- View for quick team health overview
CREATE OR REPLACE VIEW team_health_overview AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    c.name as class_name,
    tm.progress_score,
    tm.risk_score,
    tm.risk_band,
    tm.timeliness,
    tm.velocity,
    tm.engagement,
    tm.total_tasks,
    tm.completed_tasks,
    tm.overdue_tasks,
    tm.week_start,
    COUNT(DISTINCT ti.id) as active_insights
FROM teams t
LEFT JOIN classes c ON t.class_id = c.id
LEFT JOIN team_metrics tm ON t.id = tm.team_id 
    AND tm.week_start = (
        SELECT MAX(week_start) 
        FROM team_metrics 
        WHERE team_id = t.id
    )
LEFT JOIN team_insights ti ON t.id = ti.team_id AND ti.is_active = TRUE
GROUP BY t.id, t.name, c.name, tm.progress_score, tm.risk_score, 
         tm.risk_band, tm.timeliness, tm.velocity, tm.engagement,
         tm.total_tasks, tm.completed_tasks, tm.overdue_tasks, tm.week_start;

