const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes require student authentication
router.use(authenticateToken);
router.use(requireRole('student'));

// Get student dashboard data
router.get('/dashboard', async (req, res) => {
    try {
        const studentId = req.user.id;

        // Get teams student is part of
        const [teams] = await db.query(`
            SELECT 
                t.id,
                t.name,
                c.name as class_name,
                u.name as teacher_name,
                COUNT(DISTINCT tk.id) as total_tasks,
                SUM(CASE WHEN tk.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
            FROM team_members tm
            JOIN teams t ON tm.team_id = t.id
            JOIN classes c ON t.class_id = c.id
            JOIN users u ON t.created_by = u.id
            LEFT JOIN tasks tk ON t.id = tk.team_id
            WHERE tm.user_id = ?
            GROUP BY t.id, t.name, c.name, u.name
            ORDER BY t.created_at DESC
        `, [studentId]);

        // Get all tasks for student's teams
        const [tasks] = await db.query(`
            SELECT 
                tk.*,
                t.name as team_name,
                u.name as created_by_name
            FROM tasks tk
            JOIN teams t ON tk.team_id = t.id
            JOIN users u ON tk.created_by = u.id
            WHERE t.id IN (
                SELECT team_id FROM team_members WHERE user_id = ?
            )
            AND (tk.assigned_to IS NULL OR tk.assigned_to = ?)
            ORDER BY tk.due_date ASC
        `, [studentId, studentId]);

        // Get today's tasks
        const today = new Date().toISOString().split('T')[0];
        const [todayTasks] = await db.query(`
            SELECT 
                tk.*,
                t.name as team_name
            FROM tasks tk
            JOIN teams t ON tk.team_id = t.id
            WHERE t.id IN (
                SELECT team_id FROM team_members WHERE user_id = ?
            )
            AND (tk.assigned_to IS NULL OR tk.assigned_to = ?)
            AND tk.due_date = ?
            AND tk.status != 'completed'
        `, [studentId, studentId, today]);

        res.json({ 
            teams, 
            tasks,
            todayTasks 
        });
    } catch (error) {
        console.error('Student dashboard error:', error);
        res.status(500).json({ error: 'Error fetching dashboard data' });
    }
});

// Get specific team details
router.get('/teams/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const studentId = req.user.id;

        // Verify student is in team
        const [membership] = await db.query(
            'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
            [teamId, studentId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get team info
        const [teams] = await db.query(`
            SELECT t.*, c.name as class_name, u.name as teacher_name
            FROM teams t
            JOIN classes c ON t.class_id = c.id
            JOIN users u ON t.created_by = u.id
            WHERE t.id = ?
        `, [teamId]);

        // Get team members
        const [members] = await db.query(`
            SELECT u.id, u.name, u.email, u.role
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
        `, [teamId]);

        // Get tasks
        const [tasks] = await db.query(`
            SELECT t.*, u.name as assigned_to_name, c.name as created_by_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users c ON t.created_by = c.id
            WHERE t.team_id = ?
            ORDER BY t.due_date ASC
        `, [teamId]);

        res.json({
            team: teams[0],
            members,
            tasks
        });
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Error fetching team details' });
    }
});

// Get team members for assignment
router.get('/teams/:teamId/members', async (req, res) => {
    try {
        const { teamId } = req.params;
        const studentId = req.user.id;

        // Verify student is in team
        const [membership] = await db.query(
            'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
            [teamId, studentId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get team members
        const [members] = await db.query(`
            SELECT u.id as user_id, u.name, u.email
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
            ORDER BY u.name
        `, [teamId]);

        res.json(members);
    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ error: 'Error fetching team members' });
    }
});

// Create task
router.post('/teams/:teamId/tasks', async (req, res) => {
    try {
        const { teamId } = req.params;
        const { title, description, due_date, assigned_to } = req.body;
        const studentId = req.user.id;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Verify student is in team
        const [membership] = await db.query(
            'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
            [teamId, studentId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // If assigned_to is specified, verify they're in the team
        if (assigned_to) {
            const [assigneeMembership] = await db.query(
                'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
                [teamId, assigned_to]
            );

            if (assigneeMembership.length === 0) {
                return res.status(400).json({ error: 'Assigned user is not in this team' });
            }
        }

        // Create task
        const [result] = await db.query(
            `INSERT INTO tasks (title, description, due_date, status, assigned_to, team_id, created_by)
             VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
            [title, description || null, due_date || null, assigned_to || null, teamId, studentId]
        );

        res.json({ 
            message: 'Task created successfully',
            taskId: result.insertId 
        });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Error creating task' });
    }
});

// Update task status
router.patch('/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        const studentId = req.user.id;

        if (!status || !['pending', 'in_progress', 'completed', 'postponed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Verify student has access to this task
        const [tasks] = await db.query(`
            SELECT t.id 
            FROM tasks t
            JOIN teams tm ON t.team_id = tm.id
            JOIN team_members tmm ON tm.id = tmm.team_id
            WHERE t.id = ? AND tmm.user_id = ?
        `, [taskId, studentId]);

        if (tasks.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.query(
            'UPDATE tasks SET status = ? WHERE id = ?',
            [status, taskId]
        );

        res.json({ message: 'Task status updated successfully' });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Error updating task' });
    }
});

// Create personal task
// Delete task (only if created by student)
router.delete('/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const studentId = req.user.id;

        // Verify task was created by student
        const [tasks] = await db.query(
            'SELECT id FROM tasks WHERE id = ? AND created_by = ?',
            [taskId, studentId]
        );

        if (tasks.length === 0) {
            return res.status(403).json({ error: 'Access denied. You can only delete tasks you created.' });
        }

        await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Error deleting task' });
    }
});

// Re-assign task to specific team member
router.patch('/tasks/:taskId/assign', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { assignedTo } = req.body;
        const studentId = req.user.id;

        // Verify student has access to this task
        const [tasks] = await db.query(`
            SELECT t.id, t.team_id, t.assigned_to
            FROM tasks t
            JOIN teams tm ON t.team_id = tm.id
            JOIN team_members tmm ON tm.id = tmm.team_id
            WHERE t.id = ? AND tmm.user_id = ?
        `, [taskId, studentId]);

        if (tasks.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Verify the person being assigned to is in the team
        if (assignedTo) {
            const [members] = await db.query(
                'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
                [tasks[0].team_id, assignedTo]
            );

            if (members.length === 0) {
                return res.status(400).json({ error: 'User is not in this team' });
            }
        }

        await db.query(
            'UPDATE tasks SET assigned_to = ? WHERE id = ?',
            [assignedTo || null, taskId]
        );

        res.json({ message: 'Task reassigned successfully' });
    } catch (error) {
        console.error('Reassign task error:', error);
        res.status(500).json({ error: 'Error reassigning task' });
    }
});

// Submit task work
router.post('/tasks/:taskId/submit', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { submissionText } = req.body;
        const studentId = req.user.id;

        // Verify student has access to this task
        const [tasks] = await db.query(`
            SELECT t.id 
            FROM tasks t
            JOIN teams tm ON t.team_id = tm.id
            JOIN team_members tmm ON tm.id = tmm.team_id
            WHERE t.id = ? AND tmm.user_id = ?
        `, [taskId, studentId]);

        if (tasks.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [result] = await db.query(
            'INSERT INTO task_submissions (task_id, submitted_by, submission_text) VALUES (?, ?, ?)',
            [taskId, studentId, submissionText || '']
        );

        res.status(201).json({
            message: 'Submission created successfully',
            submissionId: result.insertId
        });
    } catch (error) {
        console.error('Submit task error:', error);
        res.status(500).json({ error: 'Error submitting task' });
    }
});

// Upload submission file
const multer = require('multer');
const submissionStorage = multer.memoryStorage();
const submissionUpload = multer({
    storage: submissionStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post('/tasks/:taskId/submit/:submissionId/file', submissionUpload.single('file'), async (req, res) => {
    try {
        const { taskId, submissionId } = req.params;
        const studentId = req.user.id;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Verify submission belongs to student
        const [submissions] = await db.query(
            'SELECT id FROM task_submissions WHERE id = ? AND submitted_by = ?',
            [submissionId, studentId]
        );

        if (submissions.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Insert file into database
        await db.query(
            `INSERT INTO submission_files (submission_id, filename, file_type, file_size, file_data)
             VALUES (?, ?, ?, ?, ?)`,
            [submissionId, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer]
        );

        res.json({ message: 'File uploaded successfully' });
    } catch (error) {
        console.error('Upload submission file error:', error);
        res.status(500).json({ error: 'Error uploading file' });
    }
});

// Get task submissions
router.get('/tasks/:taskId/submissions', async (req, res) => {
    try {
        const { taskId } = req.params;
        const studentId = req.user.id;

        // Verify student has access to this task
        const [tasks] = await db.query(`
            SELECT t.id 
            FROM tasks t
            JOIN teams tm ON t.team_id = tm.id
            JOIN team_members tmm ON tm.id = tmm.team_id
            WHERE t.id = ? AND tmm.user_id = ?
        `, [taskId, studentId]);

        if (tasks.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [submissions] = await db.query(`
            SELECT ts.*, u.name as submitted_by_name
            FROM task_submissions ts
            JOIN users u ON ts.submitted_by = u.id
            WHERE ts.task_id = ?
            ORDER BY ts.submitted_at DESC
        `, [taskId]);
        
        // Get files for each submission
        for (let submission of submissions) {
            const [files] = await db.query(`
                SELECT id, filename, file_type, file_size, uploaded_at
                FROM submission_files
                WHERE submission_id = ?
            `, [submission.id]);
            submission.files = files;
        }

        res.json({ submissions });
    } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({ error: 'Error fetching submissions' });
    }
});

// Download submission file
router.get('/submission-files/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const studentId = req.user.id;
        
        // Get file and verify access (must be in same team as the submission)
        const [files] = await db.query(`
            SELECT sf.*, ts.task_id
            FROM submission_files sf
            JOIN task_submissions ts ON sf.submission_id = ts.id
            JOIN tasks t ON ts.task_id = t.id
            JOIN teams tm ON t.team_id = tm.id
            JOIN team_members tmm ON tm.id = tmm.team_id
            WHERE sf.id = ? AND tmm.user_id = ?
        `, [fileId, studentId]);
        
        if (files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const file = files[0];
        
        res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.send(file.file_data);
    } catch (error) {
        console.error('Download submission file error:', error);
        res.status(500).json({ error: 'Error downloading file' });
    }
});

// Get organized tasks view (my tasks, team tasks, others' tasks)
router.get('/teams/:teamId/tasks/organized', async (req, res) => {
    try {
        const { teamId } = req.params;
        const studentId = req.user.id;

        // Verify student is in team
        const [membership] = await db.query(
            'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
            [teamId, studentId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get my tasks (assigned to me)
        const [myTasks] = await db.query(`
            SELECT t.*, u.name as created_by_name,
                   (SELECT COUNT(*) FROM task_submissions WHERE task_id = t.id) as submission_count
            FROM tasks t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.team_id = ? AND t.assigned_to = ?
            ORDER BY t.due_date ASC
        `, [teamId, studentId]);

        // Get team tasks (assigned to whole team, no specific person)
        const [teamTasks] = await db.query(`
            SELECT t.*, u.name as created_by_name,
                   (SELECT COUNT(*) FROM task_submissions WHERE task_id = t.id) as submission_count
            FROM tasks t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.team_id = ? AND t.assigned_to IS NULL
            ORDER BY t.due_date ASC
        `, [teamId]);

        // Get other members' tasks
        const [othersTasks] = await db.query(`
            SELECT t.*, u.name as created_by_name, a.name as assigned_to_name,
                   (SELECT COUNT(*) FROM task_submissions WHERE task_id = t.id) as submission_count
            FROM tasks t
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN users a ON t.assigned_to = a.id
            WHERE t.team_id = ? AND t.assigned_to IS NOT NULL AND t.assigned_to != ?
            ORDER BY a.name, t.due_date ASC
        `, [teamId, studentId]);

        // Get team members for assignment dropdown
        const [members] = await db.query(`
            SELECT u.id, u.name, u.email
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
        `, [teamId]);

        res.json({
            myTasks,
            teamTasks,
            othersTasks,
            members
        });
    } catch (error) {
        console.error('Get organized tasks error:', error);
        res.status(500).json({ error: 'Error fetching organized tasks' });
    }
});

module.exports = router;

