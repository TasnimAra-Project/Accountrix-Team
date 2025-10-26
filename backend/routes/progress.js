const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const progressService = require('../services/progressService');

// All routes require authentication
router.use(authenticateToken);

// ========== TEACHER ENDPOINTS ==========

// Get progress for all teams in a class
router.get('/teacher/classes/:classId/progress', requireRole('teacher'), async (req, res) => {
    try {
        const { classId } = req.params;
        const teacherId = req.user.id;

        // Verify class belongs to teacher
        const [classes] = await db.query(
            'SELECT id FROM classes WHERE id = ? AND teacher_id = ?',
            [classId, teacherId]
        );

        if (classes.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get all teams in the class with their latest metrics
        const [teamsProgress] = await db.query(`
            SELECT 
                t.id as team_id,
                t.name as team_name,
                tm.week_start,
                tm.week_end,
                tm.progress_score,
                tm.risk_score,
                tm.risk_band,
                tm.risk_reasons,
                tm.timeliness,
                tm.velocity,
                tm.engagement,
                tm.work_balance,
                tm.rework,
                tm.scope_remaining,
                tm.total_tasks,
                tm.completed_tasks,
                tm.overdue_tasks,
                tm.active_members,
                tm.updated_at
            FROM teams t
            LEFT JOIN team_metrics tm ON t.id = tm.team_id
                AND tm.week_start = (
                    SELECT MAX(week_start)
                    FROM team_metrics
                    WHERE team_id = t.id
                )
            WHERE t.class_id = ?
            ORDER BY tm.risk_score DESC, t.name
        `, [classId]);

        // Get historical data (last 4 weeks) for sparklines
        const [historical] = await db.query(`
            SELECT 
                team_id,
                week_start,
                progress_score,
                risk_score
            FROM team_metrics tm
            WHERE team_id IN (
                SELECT id FROM teams WHERE class_id = ?
            )
            AND week_start >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
            ORDER BY team_id, week_start
        `, [classId]);

        // Group historical data by team
        const historicalByTeam = {};
        historical.forEach(row => {
            if (!historicalByTeam[row.team_id]) {
                historicalByTeam[row.team_id] = [];
            }
            historicalByTeam[row.team_id].push({
                week: row.week_start,
                progress: row.progress_score,
                risk: row.risk_score
            });
        });

        // Combine current and historical data
        const teamsWithHistory = teamsProgress.map(team => {
            let parsedReasons = [];
            
            // Safely parse risk_reasons
            if (team.risk_reasons) {
                try {
                    // Check if it's already an object (shouldn't be, but just in case)
                    if (typeof team.risk_reasons === 'object') {
                        parsedReasons = Array.isArray(team.risk_reasons) ? team.risk_reasons : [];
                    } else if (typeof team.risk_reasons === 'string') {
                        // Only parse if it's a string
                        parsedReasons = JSON.parse(team.risk_reasons);
                    }
                } catch (error) {
                    console.error(`Error parsing risk_reasons for team ${team.team_id}:`, team.risk_reasons);
                    console.error('Parse error:', error.message);
                    parsedReasons = [];
                }
            }
            
            return {
                ...team,
                risk_reasons: parsedReasons,
                history: historicalByTeam[team.team_id] || []
            };
        });

        res.json({
            class_id: classId,
            teams: teamsWithHistory,
            summary: {
                total_teams: teamsProgress.length,
                at_risk: teamsProgress.filter(t => t.risk_band === 'red').length,
                needs_attention: teamsProgress.filter(t => t.risk_band === 'yellow').length,
                on_track: teamsProgress.filter(t => t.risk_band === 'green').length
            }
        });

    } catch (error) {
        console.error('Get class progress error:', error);
        res.status(500).json({ error: 'Error fetching class progress' });
    }
});

// Get progress for a specific team
router.get('/teacher/teams/:teamId/progress', requireRole('teacher'), async (req, res) => {
    try {
        const { teamId } = req.params;
        const teacherId = req.user.id;

        // Verify team belongs to teacher
        const [teams] = await db.query(`
            SELECT t.id 
            FROM teams t
            JOIN classes c ON t.class_id = c.id
            WHERE t.id = ? AND c.teacher_id = ?
        `, [teamId, teacherId]);

        if (teams.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get latest metrics
        const [current] = await db.query(`
            SELECT * FROM team_metrics
            WHERE team_id = ?
            ORDER BY week_start DESC
            LIMIT 1
        `, [teamId]);

        // Get historical metrics (last 8 weeks)
        const [historical] = await db.query(`
            SELECT 
                week_start,
                week_end,
                progress_score,
                risk_score,
                risk_band,
                timeliness,
                velocity,
                engagement,
                total_tasks,
                completed_tasks
            FROM team_metrics
            WHERE team_id = ?
            AND week_start >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
            ORDER BY week_start ASC
        `, [teamId]);

        // Get active insights
        const [insights] = await db.query(`
            SELECT 
                insight_type,
                severity,
                title,
                description,
                recommendations,
                created_at
            FROM team_insights
            WHERE team_id = ? AND is_active = TRUE
            ORDER BY severity DESC, created_at DESC
        `, [teamId]);

        const currentMetrics = current[0] || null;
        if (currentMetrics && currentMetrics.risk_reasons) {
            try {
                // Safe parsing for risk_reasons
                if (typeof currentMetrics.risk_reasons === 'object') {
                    currentMetrics.risk_reasons = Array.isArray(currentMetrics.risk_reasons) ? currentMetrics.risk_reasons : [];
                } else if (typeof currentMetrics.risk_reasons === 'string') {
                    currentMetrics.risk_reasons = JSON.parse(currentMetrics.risk_reasons);
                }
            } catch (error) {
                console.error(`Error parsing risk_reasons for team ${teamId}:`, currentMetrics.risk_reasons);
                currentMetrics.risk_reasons = [];
            }
        }

        const processedInsights = insights.map(i => {
            let parsedRecommendations = [];
            if (i.recommendations) {
                try {
                    if (typeof i.recommendations === 'object') {
                        parsedRecommendations = Array.isArray(i.recommendations) ? i.recommendations : [];
                    } else if (typeof i.recommendations === 'string') {
                        parsedRecommendations = JSON.parse(i.recommendations);
                    }
                } catch (error) {
                    console.error('Error parsing recommendations:', error);
                    parsedRecommendations = [];
                }
            }
            return {
                ...i,
                recommendations: parsedRecommendations
            };
        });

        res.json({
            team_id: teamId,
            current: currentMetrics,
            historical,
            insights: processedInsights
        });

    } catch (error) {
        console.error('Get team progress error:', error);
        res.status(500).json({ error: 'Error fetching team progress' });
    }
});

// Manually trigger progress calculation for a team
router.post('/teacher/teams/:teamId/progress/calculate', requireRole('teacher'), async (req, res) => {
    try {
        const { teamId } = req.params;
        const teacherId = req.user.id;

        // Verify team belongs to teacher
        const [teams] = await db.query(`
            SELECT t.id 
            FROM teams t
            JOIN classes c ON t.class_id = c.id
            WHERE t.id = ? AND c.teacher_id = ?
        `, [teamId, teacherId]);

        if (teams.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Calculate metrics
        const { weekStart, weekEnd } = progressService.getWeekDates();
        const metrics = await progressService.calculateTeamMetrics(teamId, weekStart, weekEnd);
        await progressService.storeMetrics(metrics);
        await progressService.generateInsights(teamId, metrics);

        res.json({
            message: 'Progress calculated successfully',
            metrics: {
                ...metrics,
                risk_reasons: JSON.parse(metrics.risk_reasons)
            }
        });

    } catch (error) {
        console.error('Calculate progress error:', error);
        res.status(500).json({ error: 'Error calculating progress' });
    }
});

// ========== STUDENT ENDPOINTS ==========

// Get progress for student's team
router.get('/student/teams/:teamId/progress', requireRole('student'), async (req, res) => {
    try {
        const { teamId } = req.params;
        const studentId = req.user.id;

        // Verify student is member of team
        const [membership] = await db.query(
            'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
            [teamId, studentId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get latest metrics
        const [current] = await db.query(`
            SELECT 
                week_start,
                week_end,
                progress_score,
                timeliness,
                velocity,
                engagement,
                scope_remaining,
                total_tasks,
                completed_tasks,
                overdue_tasks,
                updated_at
            FROM team_metrics
            WHERE team_id = ?
            ORDER BY week_start DESC
            LIMIT 1
        `, [teamId]);

        // Get historical progress (last 4 weeks)
        const [historical] = await db.query(`
            SELECT 
                week_start,
                progress_score,
                completed_tasks,
                total_tasks
            FROM team_metrics
            WHERE team_id = ?
            AND week_start >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
            ORDER BY week_start ASC
        `, [teamId]);

        res.json({
            team_id: teamId,
            current: current[0] || null,
            historical
        });

    } catch (error) {
        console.error('Get student team progress error:', error);
        res.status(500).json({ error: 'Error fetching team progress' });
    }
});

// ========== ADMIN ENDPOINTS ==========

// Manually run progress calculation for all teams (admin only)
router.post('/admin/progress/run', requireRole('teacher'), async (req, res) => {
    try {
        const processed = await progressService.processAllTeams();
        
        res.json({
            message: 'Progress calculation completed',
            teams_processed: processed
        });

    } catch (error) {
        console.error('Run progress calculation error:', error);
        res.status(500).json({ error: 'Error running progress calculation' });
    }
});

module.exports = router;

