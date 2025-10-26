const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// All routes require authentication (teacher or student)
router.use(authenticateToken);

// Helper function to verify team access
async function verifyTeamAccess(teamId, userId, role) {
    if (role === 'teacher') {
        const [teams] = await db.query(
            'SELECT id FROM teams WHERE id = ? AND created_by = ?',
            [teamId, userId]
        );
        return teams.length > 0;
    } else {
        const [membership] = await db.query(
            'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
            [teamId, userId]
        );
        return membership.length > 0;
    }
}

// Get team messages
router.get('/teams/:teamId/messages', async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [messages] = await db.query(`
            SELECT m.*, u.name as user_name, u.role as user_role
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.team_id = ?
            ORDER BY m.created_at ASC
        `, [teamId]);

        res.json({ messages });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

// Send message
router.post('/teams/:teamId/messages', async (req, res) => {
    try {
        const { teamId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [result] = await db.query(
            'INSERT INTO messages (team_id, user_id, message) VALUES (?, ?, ?)',
            [teamId, userId, message]
        );

        // Get the created message with user info
        const [newMessage] = await db.query(`
            SELECT m.*, u.name as user_name, u.role as user_role
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.id = ?
        `, [result.insertId]);

        res.status(201).json({ 
            message: 'Message sent successfully',
            data: newMessage[0]
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Error sending message' });
    }
});

// Get all team notes
router.get('/teams/:teamId/notes', async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [notes] = await db.query(`
            SELECT n.*, u.name as created_by_name, u2.name as last_edited_by_name
            FROM notes n
            LEFT JOIN users u ON n.created_by = u.id
            LEFT JOIN users u2 ON n.last_edited_by = u2.id
            WHERE n.team_id = ?
            ORDER BY n.updated_at DESC
        `, [teamId]);

        // Get attachments for each note
        for (let note of notes) {
            const [attachments] = await db.query(`
                SELECT id, filename, file_type, file_size, uploaded_at
                FROM note_attachments
                WHERE note_id = ?
            `, [note.id]);
            note.attachments = attachments;
        }

        res.json({ notes });
    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ error: 'Error fetching notes' });
    }
});

// Create new note
router.post('/teams/:teamId/notes', async (req, res) => {
    try {
        const { teamId } = req.params;
        const { title, content } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Note title is required' });
        }

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [result] = await db.query(
            'INSERT INTO notes (team_id, title, content, created_by, last_edited_by) VALUES (?, ?, ?, ?, ?)',
            [teamId, title.trim(), content || '', userId, userId]
        );

        // Get the created note with user info
        const [newNote] = await db.query(`
            SELECT n.*, u.name as created_by_name, u2.name as last_edited_by_name
            FROM notes n
            LEFT JOIN users u ON n.created_by = u.id
            LEFT JOIN users u2 ON n.last_edited_by = u2.id
            WHERE n.id = ?
        `, [result.insertId]);

        res.status(201).json({ 
            message: 'Note created successfully',
            note: newNote[0]
        });
    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ error: 'Error creating note' });
    }
});

// Update existing note
router.put('/teams/:teamId/notes/:noteId', async (req, res) => {
    try {
        const { teamId, noteId } = req.params;
        const { title, content } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Note title is required' });
        }

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Verify note belongs to team
        const [notes] = await db.query(
            'SELECT id FROM notes WHERE id = ? AND team_id = ?',
            [noteId, teamId]
        );

        if (notes.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        await db.query(
            'UPDATE notes SET title = ?, content = ?, last_edited_by = ? WHERE id = ?',
            [title.trim(), content || '', userId, noteId]
        );

        res.json({ message: 'Note updated successfully' });
    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({ error: 'Error updating note' });
    }
});

// Delete note
router.delete('/teams/:teamId/notes/:noteId', async (req, res) => {
    try {
        const { teamId, noteId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Verify note belongs to team
        const [notes] = await db.query(
            'SELECT id FROM notes WHERE id = ? AND team_id = ?',
            [noteId, teamId]
        );

        if (notes.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        await db.query('DELETE FROM notes WHERE id = ?', [noteId]);

        res.json({ message: 'Note deleted successfully' });
    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({ error: 'Error deleting note' });
    }
});

// Upload attachment to note
router.post('/teams/:teamId/notes/:noteId/attachments', upload.single('file'), async (req, res) => {
    try {
        const { teamId, noteId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Verify note belongs to team
        const [notes] = await db.query(
            'SELECT id FROM notes WHERE id = ? AND team_id = ?',
            [noteId, teamId]
        );

        if (notes.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Insert attachment
        await db.query(
            `INSERT INTO note_attachments (note_id, filename, file_type, file_size, file_data)
             VALUES (?, ?, ?, ?, ?)`,
            [noteId, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer]
        );

        res.json({ message: 'Attachment uploaded successfully' });
    } catch (error) {
        console.error('Upload attachment error:', error);
        res.status(500).json({ error: 'Error uploading attachment' });
    }
});

// Download note attachment
router.get('/teams/:teamId/notes/:noteId/attachments/:attachmentId', async (req, res) => {
    try {
        const { teamId, noteId, attachmentId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get attachment and verify it belongs to the note and team
        const [attachments] = await db.query(`
            SELECT na.*
            FROM note_attachments na
            JOIN notes n ON na.note_id = n.id
            WHERE na.id = ? AND n.id = ? AND n.team_id = ?
        `, [attachmentId, noteId, teamId]);

        if (attachments.length === 0) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        const attachment = attachments[0];
        res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
        res.send(attachment.file_data);
    } catch (error) {
        console.error('Download attachment error:', error);
        res.status(500).json({ error: 'Error downloading attachment' });
    }
});

// Upload file
router.post('/teams/:teamId/files', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [result] = await db.query(
            'INSERT INTO files (team_id, uploaded_by, filename, file_type, file_size, file_data) VALUES (?, ?, ?, ?, ?, ?)',
            [teamId, userId, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer]
        );

        res.status(201).json({
            message: 'File uploaded successfully',
            fileId: result.insertId,
            filename: req.file.originalname
        });
    } catch (error) {
        console.error('Upload file error:', error);
        res.status(500).json({ error: 'Error uploading file' });
    }
});

// Get files list
router.get('/teams/:teamId/files', authenticateToken, async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [files] = await db.query(`
            SELECT f.id, f.filename, f.file_type, f.file_size, f.created_at, u.name as uploaded_by_name
            FROM files f
            JOIN users u ON f.uploaded_by = u.id
            WHERE f.team_id = ?
            ORDER BY f.created_at DESC
        `, [teamId]);

        res.json({ files });
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ error: 'Error fetching files' });
    }
});

// Download file
router.get('/teams/:teamId/files/:fileId', authenticateToken, async (req, res) => {
    try {
        const { teamId, fileId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        // Verify access
        const hasAccess = await verifyTeamAccess(teamId, userId, role);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [files] = await db.query(
            'SELECT filename, file_type, file_data FROM files WHERE id = ? AND team_id = ?',
            [fileId, teamId]
        );

        if (files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = files[0];
        res.setHeader('Content-Type', file.file_type);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.send(file.file_data);
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({ error: 'Error downloading file' });
    }
});

// Delete file
router.delete('/teams/:teamId/files/:fileId', authenticateToken, async (req, res) => {
    try {
        const { teamId, fileId } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        // Verify the user uploaded the file or is the teacher
        const [files] = await db.query(
            'SELECT uploaded_by FROM files WHERE id = ? AND team_id = ?',
            [fileId, teamId]
        );

        if (files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (role === 'student' && files[0].uploaded_by !== userId) {
            return res.status(403).json({ error: 'You can only delete files you uploaded' });
        }

        await db.query('DELETE FROM files WHERE id = ?', [fileId]);

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Error deleting file' });
    }
});

module.exports = router;

