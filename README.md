# SwipeTask - Student & Teacher Collaboration Platform

A modern web application for teachers and students to collaborate on tasks, manage teams, and track progress with an intuitive swipe-based interface.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![MySQL](https://img.shields.io/badge/mysql-8.0-orange.svg)

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Key Features by Role](#key-features-by-role)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

### For Teachers:
- 📚 **Class Management** - Create and manage classes with expiration dates
- 👥 **Team Organization** - Create teams within classes, add/remove students
- ✅ **Task Assignment** - Assign tasks to individuals or entire teams
- 📊 **Submission Viewing** - View all student submissions with files
- 💬 **Team Chat** - Real-time communication with teams
- 📁 **File Sharing** - Upload and share resources with students
- 📈 **Dashboard View** - See team progress, statistics, and activity
- 🤖 **AI Progress Tracking** - Intelligent team performance analysis with risk detection

### For Students:
- 🎯 **Task Management** - View tasks organized by "My Tasks", "Team Tasks", and "Others' Tasks"
- 📝 **Task Submission** - Submit work with text answers and file attachments
- 🔄 **Swipe View** - Manage tasks with intuitive swipe gestures
  - Swipe Right → Complete
  - Swipe Left → Postpone
  - Swipe Up → In Progress
  - Swipe Down → Delete (own tasks only)
- 💬 **Team Chat** - Communicate with team members and teachers
- 📁 **File Access** - Download shared files and resources
- 📓 **Collaborative Notes** - Create and share notes with team
- 🎨 **Theme Customization** - 8 color themes with persistent preferences

### General Features:
- 🔐 **Secure Authentication** - JWT-based authentication
- 🔄 **Real-time Updates** - Socket.IO for instant messaging
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 💾 **Persistent Storage** - MySQL database for all data
- 🎨 **Modern UI** - Clean, intuitive interface with smooth animations

### 🤖 AI Progress Tracking (NEW!):
- **Smart Risk Detection** - Automatically identifies teams that need help
- **Performance Metrics** - Timeliness, velocity, engagement, work balance
- **Visual Heatmaps** - Color-coded team cards (Green/Yellow/Red)
- **Trend Analysis** - Sparkline charts showing 4-week progress trends
- **AI Insights** - Automated recommendations for at-risk teams
- **Real-time Updates** - Instant progress updates via Socket.IO
- **Background Processing** - Daily automated calculations with cron jobs
- **Detailed Reports** - Deep-dive analytics for each team

---

## 🛠️ Tech Stack

### Backend:
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL** - Relational database
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **Multer** - File upload handling
- **bcryptjs** - Password hashing

### Frontend:
- **Vanilla JavaScript** - No framework dependencies
- **HTML5 & CSS3** - Modern web standards
- **Font Awesome** - Icons
- **Socket.IO Client** - Real-time client

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MySQL** (v8.0 or higher) - [Download](https://dev.mysql.com/downloads/)
- **npm** (comes with Node.js)
- **Git** (optional) - [Download](https://git-scm.com/)

---

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd SwipeTask
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Install Required Packages
The following packages will be installed:
```json
{
  "express": "^4.18.2",
  "mysql2": "^3.6.0",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "dotenv": "^16.3.1",
  "cors": "^2.8.5",
  "multer": "^1.4.5-lts.1",
  "socket.io": "^4.6.1",
  "node-cron": "^3.0.2"
}
```

**Note**: `node-cron` is required for AI Progress Tracking background jobs.

---

## ⚙️ Configuration

### 1. Environment Variables

**Option A: Create .env file manually**

Create a `.env` file in the root directory:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=student_teacher_db

# JWT Secret
JWT_SECRET=your_jwt_secret_key_change_this_in_production

# Server Configuration
PORT=3000
```

**Option B: Use default values**

The application uses default values from `backend/config/database.js`:
- Host: `localhost`
- User: `root`
- Password: `zaqmlpP12345@asdf` (change in database.js)
- Database: `student_teacher_db`

⚠️ **Security Note:** Change the default password and JWT secret in production!

---

## 🗄️ Database Setup

### Option 1: Automatic Setup (Recommended)

Run the database migration script:
```bash
node backend/migrate-classes.js
```

This will:
- Connect to MySQL
- Create the database if it doesn't exist
- Create all required tables
- Add necessary columns

### Option 2: Manual Setup

1. **Start MySQL:**
```bash
# Windows
net start MySQL80

# Mac/Linux
sudo systemctl start mysql
```

2. **Login to MySQL:**
```bash
mysql -u root -p
```

3. **Run the schema:**
```bash
# From MySQL prompt
source backend/database/schema.sql
```

### Database Schema

The database includes these tables:

**Core Tables:**
- `users` - Teachers and students
- `classes` - Classes with expiration dates
- `teams` - Student teams within classes
- `team_members` - Team membership
- `tasks` - Assignments and tasks
- `task_assignments` - Task assignments
- `task_submissions` - Student submissions
- `submission_files` - Submission attachments
- `messages` - Team chat messages
- `notes` - Collaborative notes
- `note_attachments` - Note file attachments
- `files` - Shared team files

**AI Progress Tracking Tables:**
- `team_metrics` - Weekly progress scores and risk analysis
- `task_events` - Log of all task-related events for analytics
- `team_insights` - AI-generated insights and recommendations

**Setup AI Progress Tracking:**
```bash
mysql -u root -p < backend/database/progress_schema.sql
```

---

## 🏃 Running the Application

### 1. Start the Server
```bash
npm start
```

The server will start on `http://localhost:3000`

### 2. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Create Your First Account

**Sign Up:**
1. Click "Sign Up"
2. Enter your details
3. Select role: Teacher or Student
4. Click "Create Account"

**Login:**
1. Enter your email and password
2. Click "Login"
3. You'll be redirected to your dashboard

---

## 📁 Project Structure

```
SwipeTask/
├── backend/
│   ├── config/
│   │   └── database.js          # Database connection
│   ├── database/
│   │   └── schema.sql            # Database schema
│   ├── middleware/
│   │   └── auth.js               # JWT authentication
│   ├── routes/
│   │   ├── auth.js               # Authentication routes
│   │   ├── teacher.js            # Teacher-specific routes
│   │   ├── student.js            # Student-specific routes
│   │   └── shared.js             # Shared routes (chat, files)
│   ├── migrate-classes.js        # Database migration script
│   ├── setup-database.js         # Initial setup script
│   ├── test-connection.js        # Connection test script
│   └── server.js                 # Main server file
│
├── frontend/
│   ├── login.html                # Login page
│   ├── signup.html               # Signup page
│   ├── styles.css                # Global styles
│   ├── teacher-dashboard.html    # Teacher interface
│   ├── teacher-dashboard.js      # Teacher logic
│   ├── student-dashboard.html    # Student interface
│   └── student-dashboard.js      # Student logic
│
├── node_modules/                 # Dependencies (auto-generated)
├── .env                          # Environment variables (create this)
├── package.json                  # Project metadata
├── package-lock.json             # Dependency lock file
└── README.md                     # This file
```

---

## 👥 User Roles

### Teacher Role
- Full access to class and team management
- Can create classes, teams, and tasks
- Can view all student submissions
- Can communicate with teams
- Can share files with students

### Student Role
- Access to assigned teams and tasks
- Can submit work for tasks
- Can communicate with team members
- Can access shared files
- Can create personal tasks

---

## 🎯 Key Features by Role

### Teacher Dashboard

**Class Management:**
- Create classes with expiration dates
- View team count per class
- Expired class indicators

**Team Management:**
- Create teams within classes
- Add students via email
- Remove students from teams
- View team statistics

**Task Management:**
- Create tasks for teams
- Assign to specific students or entire team
- Set due dates
- View all submissions
- Download student work

**Communication:**
- Real-time team chat
- Upload and share files
- View team activity

### Student Dashboard

**Dashboard View:**
- Progress timeline
- Upcoming deadlines
- Quick access to tasks, chat, notes

**Task Organization:**
- My Tasks (assigned to me)
- Team Tasks (for whole team)
- Others' Tasks (assigned to teammates)

**Swipe View:**
- Swipe right: Mark complete
- Swipe left: Postpone
- Swipe up: Mark in progress
- Swipe down: Delete (own tasks)

**Task Submission:**
- Text answers
- File attachments
- Submission history

**Team Collaboration:**
- Real-time chat
- Shared notes with attachments
- File downloads

**Theme Customization:**
- 8 color themes
- Persistent preferences
- "Surprise Me!" random theme

---

## 🔌 API Documentation

### Authentication Endpoints

```
POST /api/auth/signup
Body: { name, email, password, role }
Returns: { message, user, token }

POST /api/auth/login
Body: { email, password }
Returns: { message, user, token }
```

### Teacher Endpoints

```
GET    /api/teacher/classes
GET    /api/teacher/classes/:classId
POST   /api/teacher/classes
POST   /api/teacher/teams
GET    /api/teacher/teams/:teamId
POST   /api/teacher/teams/:teamId/members
DELETE /api/teacher/teams/:teamId/members/:userId
POST   /api/teacher/tasks
GET    /api/teacher/tasks/:taskId/submissions
GET    /api/teacher/submission-files/:fileId
GET    /api/teacher/teams/:teamId/dashboard
```

### Student Endpoints

```
GET  /api/student/teams
GET  /api/student/teams/:teamId
POST /api/student/teams/:teamId/tasks
POST /api/student/tasks/:taskId/reassign
POST /api/student/tasks/:taskId/submit
POST /api/student/tasks/:taskId/submit/:submissionId/file
GET  /api/student/teams/:teamId/tasks/organized
PUT  /api/student/tasks/:taskId/status
```

### Shared Endpoints (Chat, Files, Notes)

```
GET  /api/shared/teams/:teamId/messages
POST /api/shared/teams/:teamId/messages
GET  /api/shared/teams/:teamId/notes
POST /api/shared/teams/:teamId/notes
PUT  /api/shared/teams/:teamId/notes/:noteId
DELETE /api/shared/teams/:teamId/notes/:noteId
POST /api/shared/teams/:teamId/notes/:noteId/attachments
GET  /api/shared/teams/:teamId/files
POST /api/shared/teams/:teamId/files
GET  /api/shared/files/:fileId
```

All endpoints (except auth) require:
```
Headers: {
  'Authorization': 'Bearer <jwt_token>'
}
```

---

## 🐛 Troubleshooting

### Server Won't Start

**Problem:** Port 3000 already in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <process_id> /F

# Mac/Linux
lsof -i :3000
kill -9 <process_id>
```

### Database Connection Issues

**Problem:** Can't connect to MySQL
```bash
# Check if MySQL is running
# Windows
sc query MySQL80

# Start MySQL
net start MySQL80
```

**Problem:** Wrong password
- Update `backend/config/database.js` with correct password
- Or set `DB_PASSWORD` in `.env` file

### Migration Fails

**Problem:** Column already exists
```bash
# Drop and recreate database
mysql -u root -p
DROP DATABASE student_teacher_db;
source backend/database/schema.sql
```

### File Upload Issues

**Problem:** Files too large
- Update `backend/routes/shared.js` and `backend/routes/student.js`
- Change `limits: { fileSize: 10 * 1024 * 1024 }` to desired size

### Socket.IO Not Working

**Problem:** Real-time updates not working
- Check browser console for errors
- Verify server is running
- Check firewall settings

---

## 🔧 Development

### Running in Development Mode

```bash
# Install nodemon for auto-restart
npm install -g nodemon

# Run with nodemon
nodemon backend/server.js
```

### Database Test

```bash
# Test database connection
node backend/test-connection.js
```

### Clear Database

```bash
# Login to MySQL
mysql -u root -p

# Drop database
DROP DATABASE student_teacher_db;

# Re-run migration
node backend/migrate-classes.js
```

---

## 📝 Default Credentials

After setup, create accounts through the signup page.

**First Teacher Account:**
- Email: your-email@example.com
- Password: your-password
- Role: Teacher

**First Student Account:**
- Email: student@example.com
- Password: your-password
- Role: Student

---

## 🎨 Theme Customization

Students can customize their dashboard with 8 color themes:
- Blue (default)
- Pink
- Purple
- Green
- Orange
- Red
- Cyan
- Indigo

Theme preferences are saved in `localStorage` and persist across sessions.

---

## 📊 Features Overview

| Feature | Teacher | Student |
|---------|---------|---------|
| Class Management | ✅ | ❌ |
| Team Creation | ✅ | ❌ |
| Task Assignment | ✅ | ✅ (to team members) |
| Task Submission | ❌ | ✅ |
| View Submissions | ✅ | ✅ (team only) |
| Team Chat | ✅ | ✅ |
| File Sharing | ✅ | ✅ |
| Notes | ✅ | ✅ |
| Swipe View | ❌ | ✅ |
| Theme Customization | ❌ | ✅ |
| Dashboard Analytics | ✅ | ✅ |

---

## 🚦 Testing Workflow

### For Teachers:

1. **Create a Class**
   - Login as teacher
   - Click "+ New Class"
   - Enter name, description, expiry date
   - Click "Create Class"

2. **Create a Team**
   - Click on a class
   - Click "+ New Team"
   - Enter team name
   - Click "Create Team"

3. **Add Students**
   - Click "Manage" on a team
   - Enter student email
   - Click "Add Student"

4. **Create a Task**
   - In team management
   - Click "+ Add Task"
   - Fill in details
   - Assign to student or team
   - Click "Create Task"

5. **View Submissions**
   - Click "Submissions" on any task
   - View student work and files
   - Download attachments

6. **Chat & Share Files**
   - Use Team Chat section
   - Upload files in Team Files section

### For Students:

1. **View Dashboard**
   - Login as student
   - See progress timeline
   - View upcoming deadlines

2. **Manage Tasks**
   - Click "All Tasks"
   - View organized tasks
   - Click on task to submit

3. **Submit Work**
   - Click on a task assigned to you
   - Enter answer/notes
   - Attach files
   - Click "Submit"

4. **Use Swipe View**
   - Click "Swipe View"
   - Swipe cards in any direction
   - Manage tasks quickly

5. **Collaborate**
   - Chat with team
   - Create shared notes
   - Download shared files

6. **Customize Theme**
   - Click palette icon
   - Select a color theme
   - Try "Surprise Me!"

---

## 🔒 Security

- Passwords hashed with bcrypt
- JWT tokens for authentication
- SQL injection prevention with parameterized queries
- CORS enabled for cross-origin requests
- File upload validation
- Role-based access control

---

## 📈 Performance

- Connection pooling for database
- Efficient SQL queries with JOINs
- Real-time updates with Socket.IO
- Client-side caching (localStorage)
- Optimized file storage in database (LONGBLOB)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Tasnim Ara Siddique**
- Email: siddiqut@lawrence.edu

---

## 🙏 Acknowledgments

- Font Awesome for icons
- Socket.IO for real-time functionality
- Express.js community
- MySQL team

---

## 📞 Support

For support, please:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review the documentation files:
   - `AI_PROGRESS_TRACKING_GUIDE.md` - **NEW! Complete AI Progress Tracking guide**
   - `QUICK_START_AI_PROGRESS.md` - **NEW! 5-minute AI setup guide**
   - `INSTALLATION.md`
   - `QUICKSTART.md`
   - `TASK_IMPROVEMENTS.md`
   - `FIXES_SUMMARY.md`
   - `TEACHER_FEATURES_ADDED.md`

---

## 🎉 Quick Start Summary

```bash
# 1. Install dependencies
npm install

# 2. Configure database (update password in backend/config/database.js)

# 3. Start MySQL
net start MySQL80

# 4. Run migrations
node backend/migrate-classes.js
mysql -u root -p < backend/database/progress_schema.sql

# 5. Start server
npm start

# 6. Open browser
http://localhost:3000

# 7. Sign up and start using!
```

---

## 🤖 AI Progress Tracking Feature

SwipeTask now includes **intelligent AI-based progress tracking** that helps teachers identify struggling teams before it's too late!

### Quick Overview
- 🟢 **Green Teams** - On track (risk score 0-39)
- 🟡 **Yellow Teams** - Needs attention (risk score 40-69)
- 🔴 **Red Teams** - At risk (risk score 70-100)

### Key Metrics Tracked
1. **Timeliness** - % of tasks completed on time
2. **Velocity** - Tasks completed per week
3. **Engagement** - Chat and submission activity
4. **Work Balance** - Distribution of work (Gini coefficient)
5. **Rework** - % of tasks requiring resubmission
6. **Scope Remaining** - % of incomplete tasks

### Automated Features
- ✅ Daily calculations at 2 AM
- ✅ Hourly updates during work hours
- ✅ Real-time Socket.IO notifications
- ✅ AI-generated insights and recommendations
- ✅ Visual sparkline trend charts

### How to Use
1. Login as teacher
2. Click on any class
3. View "AI Progress Tracking" section
4. See all teams with color-coded risk levels
5. Click "View Details" for in-depth analysis

### Documentation
- **Full Guide**: [`AI_PROGRESS_TRACKING_GUIDE.md`](AI_PROGRESS_TRACKING_GUIDE.md)
- **Quick Start**: [`QUICK_START_AI_PROGRESS.md`](QUICK_START_AI_PROGRESS.md)

### Manual Trigger (for testing)
```bash
node -e "require('./backend/services/cronService').runProgressNow().then(() => process.exit(0));"
```

---

## 🚂 Render Deploy

### Prerequisites
- Render account ([render.com](https://render.com))
- MySQL database provisioned on Render or external service

### Environment Variables

Set the following environment variables in Render Dashboard:

**Required:**
```env
DB_HOST=your-mysql-host
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=your-database-name
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=production
```

**Optional:**
```env
DB_SSL=true  # Enable SSL for external MySQL databases (Render MySQL uses SSL by default)
```

**Note:** If you're using Render's MySQL service, it provides `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`. The app will automatically use these if `DB_*` variables are not set.

### Deployment Steps

1. **Connect Repository to Render**
   - Go to Render dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository (Accountrix-Team)
   - Render will auto-detect Node.js

2. **Configure Environment Variables**
   - In Render service settings → Environment
   - Add all required environment variables listed above
   - If using Render MySQL, you can reference the database service's variables:
     - `DB_HOST` → Reference `MYSQL_HOST` from database service
     - `DB_USER` → Reference `MYSQL_USER` from database service
     - `DB_PASSWORD` → Reference `MYSQL_PASSWORD` from database service
     - `DB_NAME` → Reference `MYSQL_DATABASE` from database service

3. **Provision MySQL Database (if not using external)**
   - In Render dashboard, click "New +" → "PostgreSQL" (or use external MySQL)
   - **Note:** Render provides PostgreSQL by default, but this app uses MySQL
   - Options:
     - Use an external MySQL service (Railway, PlanetScale, etc.)
     - Or provision MySQL on another platform and connect via `DB_HOST`

4. **Run Database Migrations**
   - After first deployment, run migrations:
     - Go to Render service → Shell
     - Run: `npm run migrate`
   - Or use Render's one-off command:
     - Render Dashboard → Your Service → Manual Deploy → Run Command
     - Command: `npm run migrate`

5. **Deploy**
   - Render will use `render.yaml` if present, or auto-detect from `package.json`
   - Start command should be: `npm start`
   - Build command: `npm ci`
   - The app will be available at your Render-provided URL

### Architecture

- **Single Host**: Express serves both static frontend files and API endpoints
- **No CORS Required**: Frontend and API are on same origin
- **Socket.IO**: Attached directly to HTTP server, works behind Render proxy
- **File Uploads**: Uses memory storage (multer) - suitable for production
- **Health Check**: `/healthz` endpoint returns `{ ok: true, version: '2.0.0' }`

### Troubleshooting Render Deploy

**Database connection fails (ECONNREFUSED):**
1. Verify all database environment variables are set correctly
2. Check that MySQL service is running and accessible
3. If using Render MySQL, ensure the database service is in the same region
4. Check network/firewall settings - Render services in same project can communicate
5. Verify database name matches exactly (case-sensitive)
6. Check Render logs for connection errors - they will show which host/port is being used

**Start command error:**
- Ensure `render.yaml` is in the repository root
- Or manually set Start Command to `npm start` in Render dashboard
- Build Command should be `npm ci` (or `npm install`)

**Migrations fail:**
- Ensure database environment variables are set before running migrations
- Check that database exists and user has proper permissions
- Run migrations from Render Shell or via one-off command

**Socket.IO not connecting:**
- Verify `transports: ['websocket', 'polling']` is set in server.js
- Check Render logs for Socket.IO connection errors

---

## 🚂 Railway Deploy

### Prerequisites
- Railway account ([railway.app](https://railway.app))
- MySQL database provisioned on Railway or external service

### Environment Variables

Set the following environment variables in Railway:

```env
DB_HOST=your-mysql-host
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=your-database-name
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=production
PORT=3000
```

**Important Notes:**
- `JWT_SECRET` should be a long, random string for production security
- `NODE_ENV=production` enables production optimizations
- `PORT` is automatically set by Railway, but you can override if needed
- Database credentials are provided when you provision a MySQL service on Railway

### Deployment Steps

1. **Connect Repository to Railway**
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your AccountrixTeam repository

2. **Configure Environment Variables**
   - In Railway project settings, add all required environment variables listed above

3. **Provision MySQL Database**
   - Add MySQL service to your Railway project
   - Railway will automatically provide `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
   - Map these to your env vars:
     - `DB_HOST` = `MYSQL_HOST`
     - `DB_USER` = `MYSQL_USER`
     - `DB_PASSWORD` = `MYSQL_PASSWORD`
     - `DB_NAME` = `MYSQL_DATABASE`

4. **Run Database Migrations**
   - Railway provides a MySQL CLI in the service
   - Or run migrations manually:
     ```bash
     npm run migrate
     ```
   - Or via Railway CLI:
     ```bash
     railway run mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < backend/database/schema.sql
     railway run mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < backend/database/progress_schema.sql
     ```

5. **Deploy**
   - Railway will automatically detect `package.json` and use `npm start`
   - The app will be available at your Railway-provided domain

### Architecture

- **Single Host**: Express serves both static frontend files and API endpoints
- **No CORS Required**: Frontend and API are on same origin
- **Socket.IO**: Attached directly to HTTP server, works behind Railway proxy
- **File Uploads**: Uses memory storage (multer) - suitable for production at moderate scale
- **Health Check**: `/healthz` endpoint returns `{ ok: true, version: '2.0.0' }`

### Production Scripts

- `npm start` or `npm run start:backend` - Start the production server
- `npm run migrate` - Run database migrations (requires MySQL client)

### Troubleshooting Railway Deploy

**Socket.IO not connecting:**
- Verify `transports: ['websocket', 'polling']` is set in server.js
- Check Railway logs for Socket.IO connection errors

**Database connection fails:**
- Verify all DB_* environment variables are set correctly
- Check that MySQL service is running and accessible
- Ensure database name matches exactly

**Static files not loading:**
- Verify `express.static` middleware is configured correctly
- Check that frontend files are in the repository
- Ensure fallback route is after API routes

**Health check fails:**
- Verify `/healthz` endpoint is accessible
- Check that server is listening on correct port

---

**Happy Collaborating! 🚀**

---

*Last Updated: October 2025*
*Version: 2.0.0 (with AI Progress Tracking)*
