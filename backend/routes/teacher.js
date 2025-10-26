const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes require teacher authentication
router.use(authenticateToken);
router.use(requireRole('teacher'));

// Get all classes for teacher
router.get('/classes', async (req, res) => {
    try {
        const teacherId = req.user.id;

        // Get classes with team count
        const [classes] = await db.query(`
            SELECT 
                c.*,
                COUNT(DISTINCT t.id) as team_count
            FROM classes c
            LEFT JOIN teams t ON c.id = t.class_id
            WHERE c.teacher_id = ?
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, [teacherId]);

        res.json({ classes });
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ error: 'Error fetching classes' });
    }
});

// Get single class details
router.get('/classes/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const teacherId = req.user.id;

        // Get class
        const [classes] = await db.query(
            'SELECT * FROM classes WHERE id = ? AND teacher_id = ?',
            [classId, teacherId]
        );

        if (classes.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Get teams for this class
        const [teams] = await db.query(`
            SELECT 
                t.id,
                t.name,
                t.created_at,
                COUNT(DISTINCT tm.user_id) as member_count,
                COUNT(DISTINCT tk.id) as total_tasks,
                COUNT(DISTINCT CASE WHEN tk.status = 'completed' THEN tk.id END) as completed_tasks
            FROM teams t
            LEFT JOIN team_members tm ON t.id = tm.team_id
            LEFT JOIN tasks tk ON t.id = tk.team_id
            WHERE t.class_id = ?
            GROUP BY t.id, t.name, t.created_at
            ORDER BY t.created_at DESC
        `, [classId]);

        res.json({ 
            class: classes[0],
            teams 
        });
    } catch (error) {
        console.error('Get class error:', error);
        res.status(500).json({ error: 'Error fetching class details' });
    }
});

// Create a new class
router.post('/classes', async (req, res) => {
    try {
        const { name, description, expiryDate } = req.body;
        const teacherId = req.user.id;

        if (!name) {
            return res.status(400).json({ error: 'Class name is required' });
        }

        const [result] = await db.query(
            'INSERT INTO classes (name, description, teacher_id, expiry_date) VALUES (?, ?, ?, ?)',
            [name, description || '', teacherId, expiryDate || null]
        );

        res.status(201).json({
            message: 'Class created successfully',
            classId: result.insertId
        });
    } catch (error) {
        console.error('Create class error:', error);
        res.status(500).json({ error: 'Error creating class' });
    }
});

// Create a new team
router.post('/teams', async (req, res) => {
    try {
        const { name, classId } = req.body;
        const teacherId = req.user.id;

        if (!name || !classId) {
            return res.status(400).json({ error: 'Team name and class ID are required' });
        }

        // Verify class belongs to teacher
        const [classes] = await db.query(
            'SELECT id FROM classes WHERE id = ? AND teacher_id = ?',
            [classId, teacherId]
        );

        if (classes.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        const [result] = await db.query(
            'INSERT INTO teams (name, class_id, created_by) VALUES (?, ?, ?)',
            [name, classId, teacherId]
        );

        res.status(201).json({
            message: 'Team created successfully',
            teamId: result.insertId
        });
    } catch (error) {
        console.error('Create team error:', error);
        res.status(500).json({ error: 'Error creating team' });
    }
});

// Add student to team
router.post('/teams/:teamId/members', async (req, res) => {
    try {
        const { teamId } = req.params;
        const { studentEmail } = req.body;
        const teacherId = req.user.id;

        if (!studentEmail) {
            return res.status(400).json({ error: 'Student email is required' });
        }

        // Verify team belongs to teacher
        const [teams] = await db.query(
            'SELECT id FROM teams WHERE id = ? AND created_by = ?',
            [teamId, teacherId]
        );

        if (teams.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Find student by email
        const [students] = await db.query(
            'SELECT id, role FROM users WHERE email = ?',
            [studentEmail]
        );

        if (students.length === 0) {
            return res.status(404).json({ error: 'Student not found with that email' });
        }

        const student = students[0];

        if (student.role !== 'student') {
            return res.status(400).json({ error: 'User is not a student' });
        }

        // Check if already in team
        const [existing] = await db.query(
            'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
            [teamId, student.id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Student already in this team' });
        }

        // Add to team
        await db.query(
            'INSERT INTO team_members (team_id, user_id) VALUES (?, ?)',
            [teamId, student.id]
        );

        res.status(201).json({ message: 'Student added to team successfully' });
    } catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({ error: 'Error adding student to team' });
    }
});

// Get team details with members
router.get('/teams/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const teacherId = req.user.id;

        // Verify team belongs to teacher
        const [teams] = await db.query(
            'SELECT * FROM teams WHERE id = ? AND created_by = ?',
            [teamId, teacherId]
        );

        if (teams.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Get team members
        const [members] = await db.query(`
            SELECT u.id, u.name, u.email
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
        `, [teamId]);

        // Get tasks
        const [tasks] = await db.query(`
            SELECT t.*, u.name as assigned_to_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
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

// Create/Assign task
router.post('/tasks', async (req, res) => {
    try {
        const { title, description, dueDate, teamId, assignedTo } = req.body;
        const teacherId = req.user.id;

        if (!title || !teamId) {
            return res.status(400).json({ error: 'Title and team ID are required' });
        }

        // Verify team belongs to teacher
        const [teams] = await db.query(
            'SELECT id FROM teams WHERE id = ? AND created_by = ?',
            [teamId, teacherId]
        );

        if (teams.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // If assignedTo is provided, verify they're in the team
        if (assignedTo) {
            const [members] = await db.query(
                'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
                [teamId, assignedTo]
            );

            if (members.length === 0) {
                return res.status(400).json({ error: 'Assigned user is not in this team' });
            }
        }

        const [result] = await db.query(
            'INSERT INTO tasks (title, description, due_date, team_id, assigned_to, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description || '', dueDate || null, teamId, assignedTo || null, teacherId]
        );

        res.status(201).json({
            message: 'Task created successfully',
            taskId: result.insertId
        });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Error creating task' });
    }
});

// Remove member from team
router.delete('/teams/:teamId/members/:userId', async (req, res) => {
    try {
        const { teamId, userId } = req.params;
        const teacherId = req.user.id;

        // Verify team belongs to teacher
        const [teams] = await db.query(
            'SELECT id FROM teams WHERE id = ? AND created_by = ?',
            [teamId, teacherId]
        );

        if (teams.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Remove from team
        await db.query(
            'DELETE FROM team_members WHERE team_id = ? AND user_id = ?',
            [teamId, userId]
        );

        res.json({ message: 'Student removed from team successfully' });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Error removing student from team' });
    }
});

// Get team dashboard view
router.get('/teams/:teamId/dashboard', async (req, res) => {
    try {
        const { teamId } = req.params;
        const teacherId = req.user.id;

        // Verify team belongs to teacher
        const [teams] = await db.query(
            'SELECT * FROM teams WHERE id = ? AND created_by = ?',
            [teamId, teacherId]
        );

        if (teams.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Get team members
        const [members] = await db.query(`
            SELECT u.id, u.name, u.email
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
            ORDER BY u.name
        `, [teamId]);

        // Get all tasks with full details
        const [tasks] = await db.query(`
            SELECT 
                t.*,
                u.name as assigned_to_name,
                creator.name as created_by_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users creator ON t.created_by = creator.id
            WHERE t.team_id = ?
            ORDER BY t.created_at DESC
        `, [teamId]);

        res.json({ 
            team: teams[0],
            members,
            tasks
        });
    } catch (error) {
        console.error('Team dashboard error:', error);
        res.status(500).json({ error: 'Error fetching team dashboard' });
    }
});

// Get task submissions (for teachers)
router.get('/tasks/:taskId/submissions', async (req, res) => {
    try {
        const { taskId } = req.params;
        const teacherId = req.user.id;

        // Verify teacher owns the team this task belongs to
        const [tasks] = await db.query(`
            SELECT t.*, tm.created_by
            FROM tasks t
            JOIN teams tm ON t.team_id = tm.id
            WHERE t.id = ? AND tm.created_by = ?
        `, [taskId, teacherId]);

        if (tasks.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get all submissions for this task
        const [submissions] = await db.query(`
            SELECT ts.*, u.name as user_name
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

        res.json({ 
            task: tasks[0],
            submissions 
        });
    } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({ error: 'Error fetching submissions' });
    }
});

// Download submission file (for teachers)
router.get('/submission-files/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const teacherId = req.user.id;
        
        // Get file and verify teacher owns the team
        const [files] = await db.query(`
            SELECT sf.*
            FROM submission_files sf
            JOIN task_submissions ts ON sf.submission_id = ts.id
            JOIN tasks t ON ts.task_id = t.id
            JOIN teams tm ON t.team_id = tm.id
            WHERE sf.id = ? AND tm.created_by = ?
        `, [fileId, teacherId]);
        
        if (files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const file = files[0];
        
        // Send file
        res.setHeader('Content-Type', file.file_type);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.send(file.file_data);
    } catch (error) {
        console.error('Download submission file error:', error);
        res.status(500).json({ error: 'Error downloading file' });
    }
});

module.exports = router;

