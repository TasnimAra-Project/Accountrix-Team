const cron = require('node-cron');
const progressService = require('./progressService');

/**
 * Cron Service - Schedule background jobs
 * Runs daily progress calculations and other maintenance tasks
 */

class CronService {
    constructor() {
        this.jobs = [];
    }

    /**
     * Start all cron jobs
     */
    start() {
        console.log('🕐 Starting cron jobs...');

        // Daily progress calculation - runs at 2 AM every day
        const dailyProgressJob = cron.schedule('0 2 * * *', async () => {
            console.log('⏰ Running daily progress calculation...');
            try {
                await progressService.processAllTeams();
                console.log('✅ Daily progress calculation completed');
            } catch (error) {
                console.error('❌ Daily progress calculation failed:', error);
            }
        });

        this.jobs.push({ name: 'Daily Progress', job: dailyProgressJob });

        // Real-time progress update - runs every hour during work hours (8 AM - 8 PM)
        const hourlyProgressJob = cron.schedule('0 8-20 * * *', async () => {
            console.log('⏰ Running hourly progress update...');
            try {
                await progressService.processAllTeams();
                console.log('✅ Hourly progress update completed');
            } catch (error) {
                console.error('❌ Hourly progress update failed:', error);
            }
        });

        this.jobs.push({ name: 'Hourly Progress', job: hourlyProgressJob });

        // Weekly cleanup - runs on Sunday at midnight
        const weeklyCleanupJob = cron.schedule('0 0 * * 0', async () => {
            console.log('⏰ Running weekly cleanup...');
            try {
                await this.cleanupOldInsights();
                console.log('✅ Weekly cleanup completed');
            } catch (error) {
                console.error('❌ Weekly cleanup failed:', error);
            }
        });

        this.jobs.push({ name: 'Weekly Cleanup', job: weeklyCleanupJob });

        console.log(`✅ Started ${this.jobs.length} cron jobs:`);
        this.jobs.forEach(({ name }) => console.log(`   - ${name}`));
    }

    /**
     * Stop all cron jobs
     */
    stop() {
        console.log('🛑 Stopping cron jobs...');
        this.jobs.forEach(({ name, job }) => {
            job.stop();
            console.log(`   ✅ Stopped: ${name}`);
        });
    }

    /**
     * Run progress calculation immediately (for testing)
     */
    async runProgressNow() {
        console.log('▶️  Running progress calculation immediately...');
        try {
            const processed = await progressService.processAllTeams();
            console.log(`✅ Processed ${processed} teams`);
            return processed;
        } catch (error) {
            console.error('❌ Failed to run progress calculation:', error);
            throw error;
        }
    }

    /**
     * Clean up old resolved insights (older than 30 days)
     */
    async cleanupOldInsights() {
        const db = require('../config/database');
        try {
            const [result] = await db.query(`
                DELETE FROM team_insights 
                WHERE resolved_at IS NOT NULL 
                AND resolved_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
            `);
            
            console.log(`🗑️  Cleaned up ${result.affectedRows} old insights`);
            return result.affectedRows;
        } catch (error) {
            console.error('Error cleaning up old insights:', error);
            throw error;
        }
    }

    /**
     * Get status of all cron jobs
     */
    getStatus() {
        return this.jobs.map(({ name, job }) => ({
            name,
            running: job.getStatus() !== 'stopped'
        }));
    }
}

module.exports = new CronService();

