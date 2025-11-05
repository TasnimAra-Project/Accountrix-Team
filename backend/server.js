const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Fallback environment variables (only for development, not production)
if (process.env.NODE_ENV !== 'production') {
    if (!process.env.DB_HOST) process.env.DB_HOST = 'localhost';
    if (!process.env.DB_USER) process.env.DB_USER = 'root';
    if (!process.env.DB_PASSWORD) process.env.DB_PASSWORD = 'zaqmlpP12345@asdf';
    if (!process.env.DB_NAME) process.env.DB_NAME = 'student_teacher_db';
    if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production_12345';
}
if (!process.env.PORT) process.env.PORT = '8080';

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const sharedRoutes = require('./routes/shared');
const progressRoutes = require('./routes/progress');
const cronService = require('./services/cronService');

const app = express();
const server = http.createServer(app);
// Socket.IO configuration
// For single-host deployment, CORS is not strictly needed but keeping for compatibility
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Ensure Socket.IO works behind Railway's proxy
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 8080;

// Debug: Check if environment variables are loaded
console.log('Environment variables loaded:');
console.log('- DB_NAME:', process.env.DB_NAME);
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'SET ✓' : 'NOT SET ✗');
console.log('- PORT:', PORT);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check endpoint
app.get('/healthz', (req, res) => {
    res.json({ ok: true, version: '2.0.0' });
});

// API Routes (must be defined BEFORE the catch-all route)
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/shared', sharedRoutes);
app.use('/api/progress', progressRoutes);

// Socket.io for real-time chat
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join team room
    socket.on('join_team', (teamId) => {
        socket.join(`team_${teamId}`);
        console.log(`Socket ${socket.id} joined team_${teamId}`);
    });

    // Leave team room
    socket.on('leave_team', (teamId) => {
        socket.leave(`team_${teamId}`);
        console.log(`Socket ${socket.id} left team_${teamId}`);
    });

    // Send message to team
    socket.on('send_message', (data) => {
        const { teamId, message, userName, userRole } = data;
        io.to(`team_${teamId}`).emit('new_message', {
            message,
            user_name: userName,
            user_role: userRole,
            created_at: new Date().toISOString()
        });
    });

    // Notify task update
    socket.on('task_updated', (data) => {
        const { teamId } = data;
        io.to(`team_${teamId}`).emit('task_update', data);
    });

    // Notify progress update
    socket.on('progress_updated', (data) => {
        const { teamId, classId } = data;
        if (teamId) {
            io.to(`team_${teamId}`).emit('progress_update', data);
        }
        if (classId) {
            io.to(`class_${classId}`).emit('progress_update', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Make io accessible to routes
app.set('io', io);

// Serve frontend pages (specific routes first)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'intro.html'));
});

app.get('/intro', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'intro.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'signup.html'));
});

app.get('/teacher/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'teacher-dashboard.html'));
});

app.get('/student/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'student-dashboard.html'));
});

// Fallback route for client-side routing (SPA fallback)
// This must be LAST, after all API routes and static files
app.get('*', (req, res) => {
    // If the request is for an API route that wasn't matched, return 404 JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    // Otherwise, serve the login page (allows client-side routing to work)
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// Start server - bind to 0.0.0.0 for cloud hosting (Render, Railway, etc.)
server.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port', PORT);
    
    // Start cron jobs for AI progress tracking
    cronService.start();
    
    console.log('📊 AI Progress Tracking is active');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    cronService.stop();
    server.close(() => {
        console.log('HTTP server closed');
    });
});

