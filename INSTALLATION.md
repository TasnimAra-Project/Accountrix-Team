# Installation Guide

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **MySQL** (v5.7 or higher) - [Download here](https://dev.mysql.com/downloads/mysql/)
- A text editor or IDE (VS Code recommended)

## Step-by-Step Installation

### 1. Install Dependencies

Open your terminal in the project directory and run:

```bash
npm install
```

This will install all required packages:
- express (web server)
- mysql2 (database driver)
- bcryptjs (password hashing)
- jsonwebtoken (authentication)
- cors (cross-origin requests)
- dotenv (environment variables)
- socket.io (real-time chat)

### 2. Setup MySQL Database

#### Option A: Using MySQL Workbench (GUI)
1. Open MySQL Workbench
2. Connect to your local MySQL server
3. Open the file `backend/database/schema.sql`
4. Execute the script (click the lightning bolt icon)

#### Option B: Using Command Line
1. Open your terminal
2. Login to MySQL:
   ```bash
   mysql -u root -p
   ```
3. Enter your MySQL password
4. Run the schema file:
   ```bash
   source backend/database/schema.sql
   ```
   Or on Windows PowerShell:
   ```bash
   Get-Content backend/database/schema.sql | mysql -u root -p
   ```

### 3. Configure Environment Variables

The `.env` file has been created with default values. Update it if needed:

```env
DB_HOST=localhost          # Your MySQL host
DB_USER=root              # Your MySQL username
DB_PASSWORD=              # Your MySQL password (leave empty if no password)
DB_NAME=student_teacher_db
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_12345
PORT=3000
```

**Important:** Change `JWT_SECRET` to a random, secure string in production!

### 4. Start the Application

Run the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

You should see:
```
Server running on http://localhost:3000
```

### 5. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

You'll be redirected to the login page.

## First-Time Setup

### Create Your First Account

1. Click "Sign up here" on the login page
2. Fill in your details:
   - **Name**: Your full name
   - **Email**: A valid email address
   - **Password**: At least 6 characters
   - **Role**: Choose "Teacher" or "Student"
3. Click "Sign Up"
4. You'll be redirected to the login page

### For Teachers

1. Login with your teacher account
2. Create a class:
   - Click "+ New Class"
   - Enter class name and description
3. Create teams within your class:
   - Click "+ New Team"
   - Select the class
   - Enter team name
4. Add students to teams:
   - Click on a team card
   - Enter student email addresses
   - Students must have signed up first!
5. Assign tasks to teams

### For Students

1. Login with your student account
2. Wait for your teacher to add you to a team
3. Once added, you'll see:
   - Your teams
   - Assigned tasks
   - Team chat
   - Shared notes
4. Try the **Swipe View**:
   - Go to "Tasks" → "Swipe View"
   - Swipe right ✅ to complete
   - Swipe left ⏰ to postpone
   - Swipe up 🗒️ for details
   - Swipe down ❌ to delete (only your tasks)

## Troubleshooting

### Cannot connect to database

**Error:** `ER_ACCESS_DENIED_ERROR` or `ECONNREFUSED`

**Solution:**
1. Check if MySQL is running:
   ```bash
   # Windows
   net start MySQL80
   
   # Mac
   mysql.server start
   
   # Linux
   sudo systemctl start mysql
   ```
2. Verify credentials in `.env` file
3. Test MySQL connection:
   ```bash
   mysql -u root -p
   ```

### Port 3000 already in use

**Solution:**
1. Change the PORT in `.env` file to another number (e.g., 3001)
2. Or kill the process using port 3000:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # Mac/Linux
   lsof -ti:3000 | xargs kill
   ```

### Database tables not created

**Solution:**
1. Login to MySQL:
   ```bash
   mysql -u root -p
   ```
2. Check if database exists:
   ```sql
   SHOW DATABASES;
   ```
3. If not, run the schema file again
4. Check if tables were created:
   ```sql
   USE student_teacher_db;
   SHOW TABLES;
   ```

### "Invalid token" or "Access denied" errors

**Solution:**
1. Logout and login again
2. Clear browser localStorage:
   - Open browser DevTools (F12)
   - Go to Application → Local Storage
   - Clear all items
3. Try signing up a new account

### Real-time chat not working

**Solution:**
1. Make sure Socket.io is properly loaded (check browser console)
2. Refresh the page
3. Check if the WebSocket connection is established:
   - Open browser DevTools
   - Go to Network tab
   - Look for "socket.io" connections

## Testing the Application

### Quick Test Scenario

1. **Create Teacher Account**
   - Email: teacher@test.com
   - Password: teacher123

2. **Create Student Accounts**
   - Email: student1@test.com
   - Password: student123
   - Email: student2@test.com
   - Password: student123

3. **As Teacher:**
   - Create class: "Computer Science 101"
   - Create team: "Team Alpha"
   - Add student1@test.com and student2@test.com
   - Create task: "Complete Project Report"

4. **As Student:**
   - Login as student1
   - View team and tasks
   - Try swipe view
   - Send chat message
   - Edit shared notes

## Additional Features

### Daily Tasks Popup
- Shows automatically when you have tasks due today
- Only shows once per day

### Progress Tracking
- Visual progress bars on team cards
- Shows completion percentage

### Collaborative Notes
- Edit shared notes with your team
- Changes are saved to database

### Real-time Chat
- Send messages instantly
- Teacher messages are highlighted

### Task Status Options
- **Pending**: Not started yet
- **In Progress**: Currently working on it
- **Completed**: Finished ✅
- **Postponed**: Delayed for later

## Security Notes

1. **Change JWT_SECRET** in production
2. **Use HTTPS** in production
3. **Set strong passwords** for MySQL
4. **Enable CORS** only for trusted domains in production
5. **Validate all inputs** server-side

## Getting Help

If you encounter issues:
1. Check the server console for error messages
2. Check browser console (F12) for frontend errors
3. Verify database connection
4. Ensure all dependencies are installed

## Next Steps

- Customize the UI colors in `frontend/styles.css`
- Add email notifications
- Implement file attachments for tasks
- Add profile pictures
- Create a teacher analytics dashboard

Enjoy your Student-Teacher Collaboration Platform! 🎓

