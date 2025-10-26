const db = require('../config/database');

/**
 * Progress Service - AI-based team progress tracking
 * Calculates progress metrics, risk scores, and generates insights
 */

class ProgressService {
    /**
     * Calculate comprehensive progress metrics for a team
     * @param {number} teamId - Team ID
     * @param {Date} weekStart - Start of the week
     * @param {Date} weekEnd - End of the week
     * @returns {Object} Progress metrics
     */
    async calculateTeamMetrics(teamId, weekStart, weekEnd) {
        try {
            // Get all tasks for the team
            const [tasks] = await db.query(`
                SELECT t.*, ts.submitted_at, ts.submission_text
                FROM tasks t
                LEFT JOIN task_submissions ts ON t.id = ts.task_id
                WHERE t.team_id = ?
            `, [teamId]);

            if (tasks.length === 0) {
                return this.getDefaultMetrics(teamId, weekStart, weekEnd);
            }

            // Calculate individual metrics
            const timeliness = this.calculateTimeliness(tasks);
            const velocity = this.calculateVelocity(tasks, weekStart, weekEnd);
            const engagement = await this.calculateEngagement(teamId, weekStart, weekEnd);
            const workBalance = await this.calculateWorkBalance(teamId);
            const rework = await this.calculateRework(tasks);
            const scopeRemaining = this.calculateScopeRemaining(tasks);

            // Calculate composite scores
            const progressScore = this.calculateProgressScore({
                timeliness,
                velocity,
                engagement,
                scopeRemaining
            });

            const riskScore = this.calculateRiskScore({
                timeliness,
                velocity,
                engagement,
                workBalance,
                rework,
                scopeRemaining
            });

            const riskBand = this.getRiskBand(riskScore);
            const riskReasons = this.generateRiskReasons({
                timeliness,
                velocity,
                engagement,
                workBalance,
                rework,
                scopeRemaining
            });

            // Count task statuses
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.status === 'completed').length;
            const overdueTasks = tasks.filter(t => 
                t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
            ).length;

            // Get active member count
            const [members] = await db.query(
                'SELECT COUNT(*) as count FROM team_members WHERE team_id = ?',
                [teamId]
            );
            const activemembers = members[0].count;

            return {
                team_id: teamId,
                week_start: weekStart,
                week_end: weekEnd,
                timeliness,
                velocity,
                engagement,
                work_balance: workBalance,
                rework,
                scope_remaining: scopeRemaining,
                progress_score: progressScore,
                risk_score: riskScore,
                risk_band: riskBand,
                risk_reasons: JSON.stringify(riskReasons),
                total_tasks: totalTasks,
                completed_tasks: completedTasks,
                overdue_tasks: overdueTasks,
                active_members: activemembers
            };

        } catch (error) {
            console.error('Error calculating team metrics:', error);
            throw error;
        }
    }

    /**
     * Calculate timeliness: percentage of tasks completed on time
     */
    calculateTimeliness(tasks) {
        const completedTasks = tasks.filter(t => t.status === 'completed');
        if (completedTasks.length === 0) return 0;

        const onTimeCount = completedTasks.filter(t => {
            if (!t.due_date) return true; // No due date = considered on time
            const submissions = tasks.filter(sub => 
                sub.id === t.id && sub.submitted_at && sub.submitted_at <= t.due_date
            );
            return submissions.length > 0;
        }).length;

        return Math.round((onTimeCount / completedTasks.length) * 100);
    }

    /**
     * Calculate velocity: tasks completed per week
     */
    calculateVelocity(tasks, weekStart, weekEnd) {
        const completedInWeek = tasks.filter(t => {
            if (t.status !== 'completed') return false;
            const updatedAt = new Date(t.updated_at);
            return updatedAt >= weekStart && updatedAt <= weekEnd;
        });

        return completedInWeek.length;
    }

    /**
     * Calculate engagement: chat and submission activity
     */
    async calculateEngagement(teamId, weekStart, weekEnd) {
        try {
            // Get message count
            const [messages] = await db.query(`
                SELECT COUNT(*) as count 
                FROM messages 
                WHERE team_id = ? AND created_at BETWEEN ? AND ?
            `, [teamId, weekStart, weekEnd]);

            // Get submission count
            const [submissions] = await db.query(`
                SELECT COUNT(DISTINCT ts.id) as count
                FROM task_submissions ts
                JOIN tasks t ON ts.task_id = t.id
                WHERE t.team_id = ? AND ts.submitted_at BETWEEN ? AND ?
            `, [teamId, weekStart, weekEnd]);

            // Get active members count
            const [members] = await db.query(
                'SELECT COUNT(*) as count FROM team_members WHERE team_id = ?',
                [teamId]
            );

            const messageCount = messages[0].count;
            const submissionCount = submissions[0].count;
            const memberCount = members[0].count || 1;

            // Engagement score: weighted average of activity
            // Messages (30%), Submissions (70%)
            const messageScore = Math.min((messageCount / (memberCount * 5)) * 30, 30);
            const submissionScore = Math.min((submissionCount / memberCount) * 70, 70);

            return Math.round(messageScore + submissionScore);

        } catch (error) {
            console.error('Error calculating engagement:', error);
            return 0;
        }
    }

    /**
     * Calculate work balance using Gini coefficient
     * Lower is better (0 = perfect balance, 1 = maximum imbalance)
     */
    async calculateWorkBalance(teamId) {
        try {
            const [memberTasks] = await db.query(`
                SELECT 
                    u.id,
                    COUNT(ts.id) as submission_count
                FROM team_members tm
                JOIN users u ON tm.user_id = u.id
                LEFT JOIN task_submissions ts ON ts.submitted_by = u.id
                LEFT JOIN tasks t ON ts.task_id = t.id
                WHERE tm.team_id = ? AND t.team_id = ?
                GROUP BY u.id
            `, [teamId, teamId]);

            if (memberTasks.length <= 1) return 0;

            const submissions = memberTasks.map(m => m.submission_count);
            const gini = this.calculateGini(submissions);

            return Math.round(gini * 100);

        } catch (error) {
            console.error('Error calculating work balance:', error);
            return 0;
        }
    }

    /**
     * Calculate Gini coefficient for work distribution
     */
    calculateGini(values) {
        if (values.length === 0) return 0;

        const sorted = values.slice().sort((a, b) => a - b);
        const n = sorted.length;
        const sum = sorted.reduce((a, b) => a + b, 0);

        if (sum === 0) return 0;

        let numerator = 0;
        for (let i = 0; i < n; i++) {
            numerator += (2 * (i + 1) - n - 1) * sorted[i];
        }

        return numerator / (n * sum);
    }

    /**
     * Calculate rework: percentage of tasks with resubmissions
     */
    async calculateRework(tasks) {
        if (tasks.length === 0) return 0;

        const tasksWithMultipleSubmissions = new Set();
        tasks.forEach(t => {
            if (t.submitted_at) {
                tasksWithMultipleSubmissions.add(t.id);
            }
        });

        // If no tasks with submissions, return 0
        if (tasksWithMultipleSubmissions.size === 0) return 0;

        try {
            // Count tasks with more than one submission
            const [submissions] = await db.query(`
                SELECT task_id, COUNT(*) as count
                FROM task_submissions
                WHERE task_id IN (?)
                GROUP BY task_id
                HAVING count > 1
            `, [Array.from(tasksWithMultipleSubmissions)]);

            return submissions.length > 0 
                ? Math.round((submissions.length / tasks.length) * 100)
                : 0;
        } catch (error) {
            console.error('Error calculating rework:', error);
            return 0;
        }
    }

    /**
     * Calculate scope remaining: percentage of incomplete tasks
     */
    calculateScopeRemaining(tasks) {
        if (tasks.length === 0) return 0;

        const incompleteTasks = tasks.filter(t => t.status !== 'completed').length;
        return Math.round((incompleteTasks / tasks.length) * 100);
    }

    /**
     * Calculate overall progress score (0-100)
     * Higher is better
     */
    calculateProgressScore({ timeliness, velocity, engagement, scopeRemaining }) {
        // Weighted average
        const timelinessWeight = 0.30;
        const velocityWeight = 0.20;
        const engagementWeight = 0.25;
        const completionWeight = 0.25;

        const normalizedVelocity = Math.min(velocity * 20, 100); // Normalize assuming 5 tasks/week is 100
        const completionScore = 100 - scopeRemaining;

        const score = 
            (timeliness * timelinessWeight) +
            (normalizedVelocity * velocityWeight) +
            (engagement * engagementWeight) +
            (completionScore * completionWeight);

        return Math.round(score);
    }

    /**
     * Calculate risk score (0-100)
     * Higher means more risk
     */
    calculateRiskScore({ timeliness, velocity, engagement, workBalance, rework, scopeRemaining }) {
        let riskScore = 0;

        // Poor timeliness (inverted - low is risky)
        riskScore += (100 - timeliness) * 0.25;

        // Low velocity (less than 2 tasks/week)
        if (velocity < 2) riskScore += 25;
        else if (velocity < 4) riskScore += 10;

        // Low engagement
        riskScore += (100 - engagement) * 0.20;

        // Work imbalance (Gini > 35% is concerning)
        if (workBalance > 35) riskScore += 20;
        else if (workBalance > 25) riskScore += 10;

        // High rework rate
        if (rework > 30) riskScore += 15;
        else if (rework > 15) riskScore += 8;

        // High scope remaining with approaching deadlines
        if (scopeRemaining > 70) riskScore += 15;
        else if (scopeRemaining > 50) riskScore += 8;

        return Math.min(Math.round(riskScore), 100);
    }

    /**
     * Get risk band based on risk score
     */
    getRiskBand(riskScore) {
        if (riskScore >= 70) return 'red';
        if (riskScore >= 40) return 'yellow';
        return 'green';
    }

    /**
     * Generate human-readable risk reasons
     */
    generateRiskReasons({ timeliness, velocity, engagement, workBalance, rework, scopeRemaining }) {
        const reasons = [];

        if (timeliness < 60) {
            reasons.push({
                type: 'timeliness',
                severity: 'high',
                message: `Only ${timeliness}% of tasks completed on time`,
                recommendation: 'Review task assignments and provide deadline reminders'
            });
        }

        if (velocity < 2) {
            reasons.push({
                type: 'velocity',
                severity: 'high',
                message: `Low completion rate (${velocity} tasks/week)`,
                recommendation: 'Check if team has too many tasks or needs support'
            });
        }

        if (engagement < 50) {
            reasons.push({
                type: 'engagement',
                severity: 'medium',
                message: `Low team engagement (${engagement}/100)`,
                recommendation: 'Encourage team communication and collaboration'
            });
        }

        if (workBalance > 35) {
            reasons.push({
                type: 'work_balance',
                severity: 'medium',
                message: `Uneven work distribution across team members`,
                recommendation: 'Redistribute tasks to balance workload'
            });
        }

        if (rework > 30) {
            reasons.push({
                type: 'rework',
                severity: 'low',
                message: `High rework rate (${rework}% of tasks resubmitted)`,
                recommendation: 'Provide clearer task requirements and examples'
            });
        }

        if (scopeRemaining > 70) {
            reasons.push({
                type: 'scope',
                severity: 'high',
                message: `${scopeRemaining}% of tasks still incomplete`,
                recommendation: 'Consider adjusting deadlines or reducing scope'
            });
        }

        if (reasons.length === 0) {
            reasons.push({
                type: 'on_track',
                severity: 'none',
                message: 'Team is performing well',
                recommendation: 'Continue monitoring progress'
            });
        }

        return reasons;
    }

    /**
     * Get default metrics for teams with no data
     */
    getDefaultMetrics(teamId, weekStart, weekEnd) {
        return {
            team_id: teamId,
            week_start: weekStart,
            week_end: weekEnd,
            timeliness: 0,
            velocity: 0,
            engagement: 0,
            work_balance: 0,
            rework: 0,
            scope_remaining: 100,
            progress_score: 0,
            risk_score: 100,
            risk_band: 'red',
            risk_reasons: JSON.stringify([{
                type: 'no_data',
                severity: 'high',
                message: 'No task data available for this team',
                recommendation: 'Assign tasks to get started'
            }]),
            total_tasks: 0,
            completed_tasks: 0,
            overdue_tasks: 0,
            active_members: 0
        };
    }

    /**
     * Store metrics in database
     */
    async storeMetrics(metrics) {
        try {
            await db.query(`
                INSERT INTO team_metrics (
                    team_id, week_start, week_end, timeliness, velocity, engagement,
                    work_balance, rework, scope_remaining, progress_score, risk_score,
                    risk_band, risk_reasons, total_tasks, completed_tasks,
                    overdue_tasks, active_members
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    timeliness = VALUES(timeliness),
                    velocity = VALUES(velocity),
                    engagement = VALUES(engagement),
                    work_balance = VALUES(work_balance),
                    rework = VALUES(rework),
                    scope_remaining = VALUES(scope_remaining),
                    progress_score = VALUES(progress_score),
                    risk_score = VALUES(risk_score),
                    risk_band = VALUES(risk_band),
                    risk_reasons = VALUES(risk_reasons),
                    total_tasks = VALUES(total_tasks),
                    completed_tasks = VALUES(completed_tasks),
                    overdue_tasks = VALUES(overdue_tasks),
                    active_members = VALUES(active_members),
                    updated_at = CURRENT_TIMESTAMP
            `, [
                metrics.team_id,
                metrics.week_start,
                metrics.week_end,
                metrics.timeliness,
                metrics.velocity,
                metrics.engagement,
                metrics.work_balance,
                metrics.rework,
                metrics.scope_remaining,
                metrics.progress_score,
                metrics.risk_score,
                metrics.risk_band,
                metrics.risk_reasons,
                metrics.total_tasks,
                metrics.completed_tasks,
                metrics.overdue_tasks,
                metrics.active_members
            ]);

            console.log(`✅ Metrics stored for team ${metrics.team_id}`);
            return true;

        } catch (error) {
            console.error('Error storing metrics:', error);
            throw error;
        }
    }

    /**
     * Generate insights based on metrics
     */
    async generateInsights(teamId, metrics) {
        const insights = [];
        const riskReasons = JSON.parse(metrics.risk_reasons);

        for (const reason of riskReasons) {
            if (reason.severity === 'high' || reason.severity === 'medium') {
                insights.push({
                    team_id: teamId,
                    insight_type: this.mapReasonToInsightType(reason.type),
                    severity: reason.severity === 'high' ? 'critical' : 'warning',
                    title: reason.message,
                    description: reason.recommendation,
                    recommendations: JSON.stringify([reason.recommendation])
                });
            }
        }

        // Store insights
        for (const insight of insights) {
            await this.storeInsight(insight);
        }

        return insights;
    }

    /**
     * Map risk reason type to insight type
     */
    mapReasonToInsightType(reasonType) {
        const mapping = {
            'timeliness': 'falling_behind',
            'velocity': 'at_risk',
            'engagement': 'low_engagement',
            'work_balance': 'work_imbalance',
            'scope': 'at_risk',
            'on_track': 'on_track'
        };
        return mapping[reasonType] || 'at_risk';
    }

    /**
     * Store insight in database
     */
    async storeInsight(insight) {
        try {
            await db.query(`
                INSERT INTO team_insights (
                    team_id, insight_type, severity, title, description, recommendations
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                insight.team_id,
                insight.insight_type,
                insight.severity,
                insight.title,
                insight.description,
                insight.recommendations
            ]);
        } catch (error) {
            console.error('Error storing insight:', error);
        }
    }

    /**
     * Get week start and end dates
     */
    getWeekDates(date = new Date()) {
        const current = new Date(date);
        const first = current.getDate() - current.getDay(); // First day of week (Sunday)
        
        const weekStart = new Date(current.setDate(first));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        return { weekStart, weekEnd };
    }

    /**
     * Process all teams
     */
    async processAllTeams() {
        try {
            const { weekStart, weekEnd } = this.getWeekDates();
            console.log(`📊 Processing all teams for week: ${weekStart.toDateString()} - ${weekEnd.toDateString()}`);

            const [teams] = await db.query('SELECT id FROM teams');
            console.log(`Found ${teams.length} teams to process`);

            let processed = 0;
            for (const team of teams) {
                try {
                    const metrics = await this.calculateTeamMetrics(team.id, weekStart, weekEnd);
                    await this.storeMetrics(metrics);
                    await this.generateInsights(team.id, metrics);
                    processed++;
                } catch (error) {
                    console.error(`Error processing team ${team.id}:`, error);
                }
            }

            console.log(`✅ Successfully processed ${processed}/${teams.length} teams`);
            return processed;

        } catch (error) {
            console.error('Error processing all teams:', error);
            throw error;
        }
    }
}

module.exports = new ProgressService();

