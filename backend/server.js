const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Fallback environment variables if .env doesn't load properly
if (!process.env.DB_HOST) process.env.DB_HOST = 'localhost';
if (!process.env.DB_USER) process.env.DB_USER = 'root';
if (!process.env.DB_PASSWORD) process.env.DB_PASSWORD = 'zaqmlpP12345@asdf';
if (!process.env.DB_NAME) process.env.DB_NAME = 'student_teacher_db';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production_12345';
if (!process.env.PORT) process.env.PORT = '3000';

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const sharedRoutes = require('./routes/shared');
const progressRoutes = require('./routes/progress');
const cronService = require('./services/cronService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

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

// API Routes
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

// Serve frontend pages
app.get('/', (req, res) => {
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

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
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

