# SwipeTask - File Descriptions

This document provides a short description of each file and its role in the application.

---

## 📦 Configuration & Setup Files

### Root Level Files

#### `package.json`
**Role:** Node.js project configuration file  
**Contains:** 
- Project metadata (name, version, description)
- Dependencies (express, mysql2, socket.io, etc.)
- Scripts for starting the server (`npm start`, `npm run dev`)

#### `package-lock.json`
**Role:** Dependency lock file  
**Contains:** Exact versions of all installed packages for reproducible builds

#### `README.md`
**Role:** Project documentation  
**Contains:** Complete documentation including features, installation guide, API endpoints, troubleshooting, and usage instructions

#### `INSTALLATION.md`
**Role:** Installation guide  
**Contains:** Step-by-step instructions for setting up the project, database configuration, and first-time setup

#### `AI_PROGRESS_FEATURE_SUMMARY.md`
**Role:** Feature documentation  
**Contains:** Detailed summary of the AI Progress Tracking feature implementation

---

## 🗄️ Database Files

### `backend/database/schema.sql`
**Role:** Main database schema  
**Contains:** 
- Creates `student_teacher_db` database
- Core tables: `users`, `classes`, `teams`, `team_members`, `tasks`, `task_submissions`, `submission_files`, `messages`, `notes`, `note_attachments`, `files`
- Foreign keys and indexes

### `backend/database/progress_schema.sql`
**Role:** AI Progress Tracking schema  
**Contains:** 
- Additional tables for progress tracking: `team_metrics`, `task_events`, `team_insights`
- Stores weekly progress snapshots, analytics events, and AI-generated insights

### `CLEANUP_PROGRESS_DATA.sql`
**Role:** Database cleanup script  
**Contains:** SQL commands to delete all progress tracking data (for resetting/fixing issues)

### `update_classes_schema.sql`
**Role:** Database migration script  
**Contains:** SQL to add `expiry_date` column to classes table

---

## 🖥️ Backend Files

### Core Server

#### `backend/server.js`
**Role:** Main application entry point  
**Contains:** 
- Express server setup
- Socket.IO configuration for real-time communication
- Route mounting (`/api/auth`, `/api/teacher`, `/api/student`, `/api/shared`, `/api/progress`)
- Static file serving
- Cron job initialization
- Server startup and graceful shutdown

### Configuration

#### `backend/config/database.js`
**Role:** Database connection configuration  
**Contains:** 
- MySQL connection pool setup
- Database credentials from environment variables
- Exports promise-based database pool for async operations

### Middleware

#### `backend/middleware/auth.js`
**Role:** Authentication middleware  
**Contains:** 
- JWT token verification (`authenticateToken`)
- Role-based access control (`requireRole`)
- Protects routes that require authentication

### Routes

#### `backend/routes/auth.js`
**Role:** Authentication endpoints  
**Contains:** 
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- Password hashing with bcrypt, JWT token generation

#### `backend/routes/teacher.js`
**Role:** Teacher-specific API endpoints  
**Contains:** 
- Class management (create, list, get details)
- Team management (create, add/remove members)
- Task assignment (create, view submissions)
- Team dashboard data
- All routes require teacher role

#### `backend/routes/student.js`
**Role:** Student-specific API endpoints  
**Contains:** 
- Student dashboard data
- Team details and tasks
- Task creation (for team members)
- Task status updates (pending, in_progress, completed, postponed)
- Task reassignment to team members
- Task submissions with file uploads
- Organized tasks view (My Tasks, Team Tasks, Others' Tasks)

#### `backend/routes/shared.js`
**Role:** Shared features for both teachers and students  
**Contains:** 
- Team chat messages (send, receive)
- Collaborative notes (create, read, update, delete)
- Note attachments (upload, download)
- Team file sharing (upload, download, list, delete)
- File upload handling with Multer

#### `backend/routes/progress.js`
**Role:** AI Progress Tracking API endpoints  
**Contains:** 
- Teacher endpoints: Get class progress, team progress, manual calculation
- Student endpoints: View team progress (limited)
- Admin endpoints: Run progress calculation for all teams

### Services

#### `backend/services/progressService.js`
**Role:** AI Progress Tracking business logic  
**Contains:** 
- Calculates 6 core metrics (timeliness, velocity, engagement, work balance, rework, scope remaining)
- Computes composite scores (progress_score, risk_score)
- Assigns risk bands (green/yellow/red)
- Generates risk reasons and AI insights
- Stores metrics in database
- Processes all teams

#### `backend/services/cronService.js`
**Role:** Scheduled background jobs  
**Contains:** 
- Daily progress calculation (2 AM)
- Hourly progress updates (8 AM - 8 PM)
- Weekly cleanup (Sunday midnight)
- Manual trigger for testing
- Job management (start/stop)

### Database Setup Scripts

#### `backend/migrate-classes.js`
**Role:** Database migration script  
**Contains:** Adds `expiry_date` column to classes table if it doesn't exist

#### `backend/setup-database.js`
**Role:** Database initialization script  
**Purpose:** Sets up initial database structure

#### `backend/setup-progress-tracking.js`
**Role:** Progress tracking setup script  
**Purpose:** Initializes progress tracking tables and features

#### `backend/test-connection.js`
**Role:** Database connection test script  
**Purpose:** Tests MySQL database connectivity

---

## 🎨 Frontend Files

### HTML Pages

#### `frontend/login.html`
**Role:** User login page  
**Contains:** Login form, redirects to appropriate dashboard based on user role

#### `frontend/signup.html`
**Role:** User registration page  
**Contains:** Signup form for creating new teacher/student accounts

#### `frontend/student-dashboard.html`
**Role:** Student interface HTML structure  
**Contains:** 
- Dashboard layout with sidebar navigation
- Team cards, task lists, chat interface
- Swipe view container
- Theme customization UI
- Multiple view modes (Dashboard, Tasks, Swipe, Chat, Notes, Files)

#### `frontend/teacher-dashboard.html`
**Role:** Teacher interface HTML structure  
**Contains:** 
- Class management interface
- Team management UI
- Task assignment forms
- Submission viewing interface
- AI Progress Tracking section
- Chat and file sharing UI

### JavaScript Files

#### `frontend/student-dashboard.js`
**Role:** Student dashboard logic and API interactions  
**Contains:** 
- Authentication check
- Socket.IO connection for real-time chat
- Dashboard data loading (teams, tasks, today's tasks)
- Task management (view, submit, update status)
- Swipe view functionality (swipe gestures)
- Theme customization (8 color themes)
- Chat message handling
- Notes CRUD operations
- File upload/download
- Task organization (My Tasks, Team Tasks, Others' Tasks)

#### `frontend/teacher-dashboard.js`
**Role:** Teacher dashboard logic and API interactions  
**Contains:** 
- Authentication check
- Socket.IO connection
- Class management (create, view, list)
- Team management (create, add members, view details)
- Task assignment (create, view submissions)
- Submission file downloads
- Team dashboard data display
- AI Progress Tracking integration
- Chat functionality

#### `frontend/progress-tracker.js`
**Role:** AI Progress Tracking visualization component  
**Contains:** 
- ProgressTracker class for rendering progress heatmaps
- Team cards with risk indicators (green/yellow/red)
- Sparkline charts for 4-week trend visualization
- Team detail modal with metrics breakdown
- Socket.IO integration for real-time updates
- Progress score calculations display
- Risk reasons and recommendations display

### Stylesheets

#### `frontend/styles.css`
**Role:** Global stylesheet  
**Contains:** 
- Base styling for all pages
- Component styles (cards, buttons, forms)
- Layout styles (sidebar, main content)
- Theme color variables (8 themes)
- Responsive design rules
- Animation styles

#### `frontend/progress-tracker.css`
**Role:** Progress tracking specific styles  
**Contains:** 
- Heatmap card styles
- Risk band color coding (green/yellow/red)
- Sparkline chart styles
- Progress metrics display
- Modal styles for team details

### Test Files (Root)

#### `test-env.js`, `test-env2.js`
**Role:** Environment variable testing scripts  
**Purpose:** Test if environment variables are loaded correctly

#### `test-mysql-connection.js`
**Role:** MySQL connection test script  
**Purpose:** Verify database connectivity

#### `test-server.js`
**Role:** Server testing script  
**Purpose:** Test server startup and basic functionality

#### `theme-demo.html`
**Role:** Theme preview page  
**Purpose:** Demonstrates all available color themes

---

## 📊 File Organization Summary

### Backend Structure
```
backend/
├── config/          # Configuration (database connection)
├── database/        # SQL schema files
├── middleware/      # Auth middleware
├── routes/          # API route handlers
├── services/        # Business logic services
└── server.js        # Main entry point
```

### Frontend Structure
```
frontend/
├── *.html           # Page templates
├── *.js             # Client-side logic
└── *.css            # Stylesheets
```

### Root Files
- Configuration: `package.json`, `package-lock.json`
- Documentation: `README.md`, `INSTALLATION.md`, `AI_PROGRESS_FEATURE_SUMMARY.md`
- Database: SQL scripts for setup and migrations
- Tests: Various test scripts for debugging

---

## 🔄 Data Flow

1. **User Request** → `frontend/*.html` or `frontend/*.js`
2. **API Call** → `backend/routes/*.js`
3. **Authentication** → `backend/middleware/auth.js`
4. **Business Logic** → `backend/services/*.js` (if needed)
5. **Database** → `backend/config/database.js` → MySQL
6. **Response** → Frontend updates UI

---

## 🎯 Key Features by File Category

### Authentication & Security
- `backend/middleware/auth.js` - Protects routes
- `backend/routes/auth.js` - Login/signup

### Core Functionality
- `backend/routes/teacher.js` - Teacher features
- `backend/routes/student.js` - Student features
- `backend/routes/shared.js` - Chat, notes, files

### AI Progress Tracking
- `backend/services/progressService.js` - Metrics calculation
- `backend/services/cronService.js` - Scheduled jobs
- `backend/routes/progress.js` - Progress API
- `frontend/progress-tracker.js` - Visualization

### Real-time Communication
- `backend/server.js` - Socket.IO setup
- Frontend JS files - Socket.IO clients

---

*Last Updated: Based on current project structure*

