const API_URL = window.location.origin;
let socket;
let currentTeamId = null;
let user = null;
let token = null;
let allTasks = [];
let allTeams = [];
let currentFilter = 'all';

// Theme system
const themes = {
    blue: { name: 'Blue', class: 'theme-blue' },
    pink: { name: 'Pink', class: 'theme-pink' },
    purple: { name: 'Purple', class: 'theme-purple' },
    green: { name: 'Green', class: 'theme-green' },
    orange: { name: 'Orange', class: 'theme-orange' },
    red: { name: 'Red', class: 'theme-red' },
    cyan: { name: 'Cyan', class: 'theme-cyan' },
    indigo: { name: 'Indigo', class: 'theme-indigo' }
};

let currentTheme = 'blue';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    checkAuth();
    initializeSocketIO();
    setupEventListeners();
});

function checkAuth() {
    token = localStorage.getItem('token');
    user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || user.role !== 'student') {
        window.location.href = '/';
        return;
    }
    
    document.getElementById('user-name').textContent = user.name;
    loadDashboard();
}

function initializeSocketIO() {
    socket = io(API_URL);
    
    socket.on('connect', () => {
        console.log('Connected to socket server');
    });
    
    socket.on('new_message', (data) => {
        appendChatMessage(data);
    });
    
    socket.on('task_update', () => {
        if (currentTeamId) {
            loadTeamDetails(currentTeamId);
        }
    });
}

function setupEventListeners() {
    // View toggle
    document.getElementById('clean-view-btn').addEventListener('click', () => switchView('clean'));
    document.getElementById('tasks-org-view-btn').addEventListener('click', () => switchView('tasks-org'));
    document.getElementById('swipe-view-btn').addEventListener('click', () => switchView('swipe'));
    
    // User dropdown
    document.getElementById('user-dropdown').addEventListener('click', () => {
        document.getElementById('user-dropdown-menu').classList.toggle('show');
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu')) {
            document.getElementById('user-dropdown-menu').classList.remove('show');
        }
        if (!e.target.closest('.theme-picker')) {
            document.getElementById('theme-dropdown-menu').classList.remove('show');
        }
    });
    
    // Theme dropdown
    document.getElementById('theme-dropdown').addEventListener('click', () => {
        document.getElementById('theme-dropdown-menu').classList.toggle('show');
    });

    // Theme options
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = option.dataset.theme;
            if (theme === 'surprise') {
                setRandomTheme();
            } else {
                setTheme(theme);
            }
            document.getElementById('theme-dropdown-menu').classList.remove('show');
        });
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    // Add task button
    document.getElementById('add-task-btn').addEventListener('click', () => {
        openAddTaskModal();
    });
    
    
    // Send message
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(`${tab}-tab`).classList.add('active');
        });
    });
    
    // Notes - new system doesn't need this event listener
    
    // Files
    document.getElementById('upload-file-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    document.getElementById('file-input').addEventListener('change', uploadFile);
    
    // Add task form submission
    document.getElementById('add-task-form').addEventListener('submit', submitNewTask);
    
    // Submission file input change
    document.getElementById('submission-file-input').addEventListener('change', updateSelectedFiles);
    
    // Note file input change handlers
    document.getElementById('note-file-input').addEventListener('change', function(e) {
        selectedNoteFiles = Array.from(e.target.files);
        updateNoteSelectedFiles();
    });
    
    document.getElementById('edit-note-file-input').addEventListener('change', function(e) {
        selectedEditNoteFiles = Array.from(e.target.files);
        updateEditNoteSelectedFiles();
    });
}

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/api/student/dashboard`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load dashboard');
        
        const data = await response.json();
        allTeams = data.teams;
        allTasks = data.tasks;
        
        renderTeamsList(data.teams);
        
        // Show daily tasks popup if needed
        if (data.todayTasks.length > 0 && !localStorage.getItem('dailyTasksShown_' + new Date().toDateString())) {
            showDailyTasksNotification(data.todayTasks);
            localStorage.setItem('dailyTasksShown_' + new Date().toDateString(), 'true');
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        alert('Error loading dashboard');
    }
}

function renderTeamsList(teams) {
    const teamsList = document.getElementById('teams-list');
    
    if (teams.length === 0) {
        teamsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users-slash"></i>
                <p>You are not assigned to any teams yet.</p>
                <p style="font-size: 0.875rem;">Wait for your teacher to add you.</p>
            </div>
        `;
        return;
    }
    
    teamsList.innerHTML = teams.map(team => {
        const progress = team.total_tasks > 0 ? Math.round((team.completed_tasks / team.total_tasks) * 100) : 0;
        return `
            <div class="team-item" onclick="selectTeam(${team.id})" data-team-id="${team.id}">
                <h4>${team.name}</h4>
                <p>${team.class_name}</p>
                <p style="margin-top: 4px;"><i class="fas fa-user-tie"></i> ${team.teacher_name}</p>
                <span class="team-badge">${progress}% Complete</span>
            </div>
        `;
    }).join('');
}

async function selectTeam(teamId) {
    // Update active state
    document.querySelectorAll('.team-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-team-id="${teamId}"]`).classList.add('active');
    
    currentTeamId = teamId;
    
    // Show loading
    document.getElementById('no-project-selected').style.display = 'none';
    document.getElementById('project-dashboard').style.display = 'block';
    
    await loadTeamDetails(teamId);
    
    // Join socket room
    socket.emit('join_team', teamId);
}

async function loadTeamDetails(teamId) {
    try {
        const response = await fetch(`${API_URL}/api/student/teams/${teamId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load team');
        
        const data = await response.json();
        
        // Update header
        document.getElementById('project-title').textContent = data.team.name;
        document.getElementById('project-description').textContent = `${data.team.class_name} • ${data.team.teacher_name}`;
        
        // Store tasks for this team
        allTasks = data.tasks;
        
        // Render components
        renderProgress(data.tasks);
        renderTasks();
        renderDeadlines(data.tasks);
        loadTeamChat(teamId);
        loadTeamFiles(teamId);
    } catch (error) {
        console.error('Load team error:', error);
        alert('Error loading team details');
    }
}

function renderProgress(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending' || t.status === 'postponed').length;
    const myTasks = tasks.filter(t => t.assigned_to === user.id).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${progress}% Complete`;
    
    // Update stats
    document.getElementById('total-tasks-count').textContent = total;
    document.getElementById('completed-tasks-count').textContent = completed;
    document.getElementById('pending-tasks-count').textContent = pending;
    document.getElementById('my-tasks-stat').textContent = myTasks;
}

function renderTasks() {
    // Tasks are no longer rendered in the main view
    // They are only shown in the "All Tasks" organized view
    // This function is kept for compatibility but does nothing
}

function renderDeadlines(tasks) {
    const deadlinesList = document.getElementById('deadlines-list');
    
    // Filter tasks with due dates and not completed
    const upcomingTasks = tasks
        .filter(t => t.due_date && t.status !== 'completed')
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 10);
    
    if (upcomingTasks.length === 0) {
        deadlinesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-check"></i>
                <p>No upcoming deadlines</p>
            </div>
        `;
        return;
    }
    
    deadlinesList.innerHTML = upcomingTasks.map(task => {
        const dueDate = new Date(task.due_date);
        const isOverdue = dueDate < new Date();
        const daysUntil = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
        
        return `
            <div class="deadline-item" onclick="openTaskDetail(${task.id})" style="cursor: pointer;">
                <div>
                    <h5>${task.title}</h5>
                    <p style="margin-bottom: 4px;">${task.description || 'No description'}</p>
                    <span class="task-status ${task.status}" style="font-size: 0.7rem;">${task.status.replace('_', ' ')}</span>
                </div>
                <div style="text-align: right;">
                    <div class="deadline-date" style="${isOverdue ? 'color: #ef4444;' : ''}">
                        <i class="fas fa-clock"></i> ${dueDate.toLocaleDateString()}
                    </div>
                    <div style="font-size: 0.75rem; color: ${isOverdue ? '#ef4444' : '#6b7280'}; margin-top: 4px;">
                        ${isOverdue ? 'Overdue!' : daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `${daysUntil} days`}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function updateTaskStatus(taskId, status) {
    try {
        const response = await fetch(`${API_URL}/api/student/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) throw new Error('Failed to update task');
        
        // Update local task
        const task = allTasks.find(t => t.id === taskId);
        if (task) task.status = status;
        
        // Re-render
        renderProgress(allTasks);
        renderTasks();
        renderDeadlines(allTasks);
        
        // Notify via socket
        socket.emit('task_updated', { teamId: currentTeamId });
    } catch (error) {
        alert('Error updating task: ' + error.message);
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/student/tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to delete task');
        
        // Remove from local array
        allTasks = allTasks.filter(t => t.id !== taskId);
        
        // Re-render
        renderProgress(allTasks);
        renderTasks();
        renderDeadlines(allTasks);
    } catch (error) {
        alert('Error deleting task: ' + error.message);
    }
}

// Chat functions
async function loadTeamChat(teamId) {
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${teamId}/messages`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load chat');
        
        const data = await response.json();
        const messages = data.messages || [];
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.innerHTML = '';
        
        if (messages.length === 0) {
            chatContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `;
        } else {
            messages.forEach(msg => {
                appendChatMessage(msg);
            });
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    } catch (error) {
        console.error('Chat error:', error);
    }
}

function appendChatMessage(msg) {
    const chatContainer = document.getElementById('chat-messages');
    
    // Remove empty state if present
    const emptyState = chatContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-item';
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-sender">
                ${msg.user_name || 'Unknown'}
                ${msg.user_role === 'teacher' ? '<span class="teacher-badge-inline">Teacher</span>' : ''}
            </span>
            <span class="message-time">${new Date(msg.created_at).toLocaleString()}</span>
        </div>
        <div class="message-text">${msg.message}</div>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) throw new Error('Failed to send message');
        
        socket.emit('send_message', {
            teamId: currentTeamId,
            message: message,
            userName: user.name,
            userRole: user.role
        });
        
        input.value = '';
    } catch (error) {
        alert('Error sending message: ' + error.message);
    }
}

// View switching
function switchView(view) {
    const cleanView = document.getElementById('clean-view');
    const tasksOrgView = document.getElementById('tasks-org-view');
    const swipeView = document.getElementById('swipe-view');
    const notesPage = document.getElementById('notes-page');
    const chatPage = document.getElementById('chat-page');
    const filesPage = document.getElementById('files-page');
    
    const cleanBtn = document.getElementById('clean-view-btn');
    const tasksOrgBtn = document.getElementById('tasks-org-view-btn');
    const swipeBtn = document.getElementById('swipe-view-btn');
    
    // Hide all views
    cleanView.style.display = 'none';
    tasksOrgView.style.display = 'none';
    swipeView.style.display = 'none';
    if (notesPage) notesPage.style.display = 'none';
    if (chatPage) chatPage.style.display = 'none';
    if (filesPage) filesPage.style.display = 'none';
    
    // Remove active from all buttons
    cleanBtn.classList.remove('active');
    tasksOrgBtn.classList.remove('active');
    swipeBtn.classList.remove('active');
    
    // Show selected view
    if (view === 'clean') {
        cleanView.style.display = 'flex';
        cleanBtn.classList.add('active');
    } else if (view === 'tasks-org') {
        tasksOrgView.style.display = 'block';
        tasksOrgBtn.classList.add('active');
        loadTasksOrganizationView();
    } else if (view === 'swipe') {
        swipeView.style.display = 'block';
        swipeBtn.classList.add('active');
        // Delay initialization to ensure view is visible
        setTimeout(() => {
            initializeSwipeView();
        }, 100);
    }
}

// Show individual pages
function showNotesPage() {
    const cleanView = document.getElementById('clean-view');
    const notesPage = document.getElementById('notes-page');
    const tasksOrgView = document.getElementById('tasks-org-view');
    const swipeView = document.getElementById('swipe-view');
    const chatPage = document.getElementById('chat-page');
    const filesPage = document.getElementById('files-page');
    
    cleanView.style.display = 'none';
    tasksOrgView.style.display = 'none';
    swipeView.style.display = 'none';
    if (chatPage) chatPage.style.display = 'none';
    if (filesPage) filesPage.style.display = 'none';
    
    notesPage.style.display = 'block';
    
    // Load notes if we have a team selected
    if (currentTeamId) {
        loadNotes();
    }
}

function showChatPage() {
    const cleanView = document.getElementById('clean-view');
    const chatPage = document.getElementById('chat-page');
    const tasksOrgView = document.getElementById('tasks-org-view');
    const swipeView = document.getElementById('swipe-view');
    const notesPage = document.getElementById('notes-page');
    const filesPage = document.getElementById('files-page');
    
    cleanView.style.display = 'none';
    tasksOrgView.style.display = 'none';
    swipeView.style.display = 'none';
    if (notesPage) notesPage.style.display = 'none';
    if (filesPage) filesPage.style.display = 'none';
    
    chatPage.style.display = 'block';
    
    // Load chat if we have a team selected
    if (currentTeamId) {
        loadChatAlone();
    }
}

function showFilesPage() {
    const cleanView = document.getElementById('clean-view');
    const filesPage = document.getElementById('files-page');
    const tasksOrgView = document.getElementById('tasks-org-view');
    const swipeView = document.getElementById('swipe-view');
    const notesPage = document.getElementById('notes-page');
    const chatPage = document.getElementById('chat-page');
    
    cleanView.style.display = 'none';
    tasksOrgView.style.display = 'none';
    swipeView.style.display = 'none';
    if (notesPage) notesPage.style.display = 'none';
    if (chatPage) chatPage.style.display = 'none';
    
    filesPage.style.display = 'block';
    
    // Load files if we have a team selected
    if (currentTeamId) {
        loadFilesAlone();
    }
}

// Add Task Modal Functions
function openAddTaskModal() {
    if (!currentTeamId) {
        alert('Please select a team first');
        return;
    }
    
    // Reset form
    document.getElementById('add-task-form').reset();
    
    // Load team members for assignment dropdown
    loadTeamMembersForAssignment();
    
    // Show modal
    const modal = document.getElementById('add-task-modal');
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function closeAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    modal.classList.remove('active');
    modal.style.display = 'none';
}

async function loadTeamMembersForAssignment() {
    try {
        const response = await fetch(`${API_URL}/api/student/teams/${currentTeamId}/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const members = await response.json();
        
        const select = document.getElementById('new-task-assign-to');
        select.innerHTML = '<option value="">Unassigned (Team Task)</option>';
        
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.user_id;
            option.textContent = member.name + (member.user_id === user.id ? ' (You)' : '');
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading team members:', error);
    }
}

async function submitNewTask(e) {
    e.preventDefault();
    
    const title = document.getElementById('new-task-title').value.trim();
    const description = document.getElementById('new-task-description').value.trim();
    const dueDate = document.getElementById('new-task-due-date').value;
    const assignTo = document.getElementById('new-task-assign-to').value;
    
    if (!title) {
        alert('Please enter a task title');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/student/teams/${currentTeamId}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                description,
                due_date: dueDate || null,
                assigned_to: assignTo || null
            })
        });
        
        if (response.ok) {
            closeAddTaskModal();
            await loadTeamDetails(currentTeamId);
            alert('Task created successfully!');
        } else {
            const error = await response.json();
            alert('Error creating task: ' + (error.error || error.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating task:', error);
        alert('Error creating task. Please try again.');
    }
}

// Notes functionality
let selectedNoteFiles = [];
let selectedEditNoteFiles = [];

// Modal functions for notes
function openNewNoteModal() {
    const modal = document.getElementById('new-note-modal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
    
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    selectedNoteFiles = [];
    updateNoteSelectedFiles();
}

function closeNewNoteModal() {
    const modal = document.getElementById('new-note-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function openEditNoteModal(noteId) {
    const modal = document.getElementById('edit-note-modal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
    document.getElementById('edit-note-id').value = noteId;
    selectedEditNoteFiles = [];
    updateEditNoteSelectedFiles();
    loadNoteForEdit(noteId);
}

function closeEditNoteModal() {
    const modal = document.getElementById('edit-note-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

// Load all team notes
async function loadNotes() {
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/notes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load notes');
        
        const data = await response.json();
        const notesList = document.getElementById('notes-list');
        
        if (data.notes.length === 0) {
            notesList.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #6b7280;">
                    <i class="fas fa-sticky-note" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>No notes yet</h3>
                    <p>Create your first team note to get started!</p>
                </div>
            `;
        } else {
            notesList.innerHTML = data.notes.map(note => `
                <div class="note-card" style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 1.25rem;">${note.title}</h3>
                            <div style="display: flex; gap: 16px; font-size: 0.875rem; color: #6b7280;">
                                <span><i class="fas fa-user"></i> Created by ${note.created_by_name}</span>
                                <span><i class="fas fa-clock"></i> ${new Date(note.created_at).toLocaleDateString()}</span>
                                ${note.last_edited_by_name ? `<span><i class="fas fa-edit"></i> Last edited by ${note.last_edited_by_name}</span>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="editNote(${note.id})" class="btn btn-small btn-secondary">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteNote(${note.id})" class="btn btn-small btn-danger">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <div style="white-space: pre-wrap; color: #374151; line-height: 1.6;">${note.content || '<em>No content</em>'}</div>
                    </div>
                    ${note.attachments && note.attachments.length > 0 ? `
                        <div style="border-top: 1px solid #e5e7eb; padding-top: 1rem;">
                            <strong style="font-size: 0.875rem; color: #6b7280; margin-bottom: 8px; display: block;">
                                <i class="fas fa-paperclip"></i> Attachments (${note.attachments.length}):
                            </strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${note.attachments.map(attachment => `
                                    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                                        <i class="fas fa-file" style="color: #3b82f6;"></i>
                                        <a href="#" onclick="downloadNoteAttachment(${note.id}, ${attachment.id}, '${attachment.filename}'); return false;" style="color: #3b82f6; text-decoration: none; font-size: 0.875rem;">
                                            ${attachment.filename}
                                        </a>
                                        <span style="font-size: 0.75rem; color: #6b7280;">${formatFileSize(attachment.file_size)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Notes error:', error);
        document.getElementById('notes-list').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #dc2626;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h3>Error loading notes</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

// Load note for editing
async function loadNoteForEdit(noteId) {
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/notes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load notes');
        
        const data = await response.json();
        const note = data.notes.find(n => n.id == noteId);
        
        if (note) {
            document.getElementById('edit-note-title').value = note.title;
            document.getElementById('edit-note-content').value = note.content || '';
            
            // Show existing attachments
            const existingFilesDiv = document.getElementById('edit-note-existing-files');
            if (note.attachments && note.attachments.length > 0) {
                existingFilesDiv.innerHTML = `
                    <strong style="font-size: 0.875rem; color: #6b7280; margin-bottom: 8px; display: block;">
                        <i class="fas fa-paperclip"></i> Current Attachments:
                    </strong>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${note.attachments.map(attachment => `
                            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f0f9ff; border-radius: 6px; border: 1px solid #0ea5e9;">
                                <i class="fas fa-file" style="color: #0ea5e9;"></i>
                                <span style="font-size: 0.875rem; color: #0c4a6e;">${attachment.filename}</span>
                                <span style="font-size: 0.75rem; color: #6b7280;">${formatFileSize(attachment.file_size)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                existingFilesDiv.innerHTML = '';
            }
        }
    } catch (error) {
        console.error('Error loading note for edit:', error);
        alert('Error loading note. Please try again.');
    }
}

function updateNoteSelectedFiles() {
    const infoSpan = document.getElementById('note-selected-files-info');
    const listDiv = document.getElementById('note-selected-files-list');
    
    if (selectedNoteFiles.length === 0) {
        infoSpan.textContent = 'No files selected';
        listDiv.innerHTML = '';
    } else {
        infoSpan.textContent = `${selectedNoteFiles.length} file(s) selected`;
        listDiv.innerHTML = selectedNoteFiles.map(file => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f9fafb; border-radius: 6px; margin-top: 4px;">
                <i class="fas fa-file" style="color: #3b82f6;"></i>
                <span style="font-size: 0.875rem; color: #374151;">${file.name}</span>
                <span style="font-size: 0.75rem; color: #6b7280;">${formatFileSize(file.size)}</span>
            </div>
        `).join('');
    }
}

function updateEditNoteSelectedFiles() {
    const infoSpan = document.getElementById('edit-note-selected-files-info');
    const listDiv = document.getElementById('edit-note-selected-files-list');
    
    if (selectedEditNoteFiles.length === 0) {
        infoSpan.textContent = 'No files selected';
        listDiv.innerHTML = '';
    } else {
        infoSpan.textContent = `${selectedEditNoteFiles.length} file(s) selected`;
        listDiv.innerHTML = selectedEditNoteFiles.map(file => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f9fafb; border-radius: 6px; margin-top: 4px;">
                <i class="fas fa-file" style="color: #3b82f6;"></i>
                <span style="font-size: 0.875rem; color: #374151;">${file.name}</span>
                <span style="font-size: 0.75rem; color: #6b7280;">${formatFileSize(file.size)}</span>
            </div>
        `).join('');
    }
}

// Create new note
async function createNewNote() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    
    if (!title) {
        alert('Please enter a note title');
        return;
    }
    
    try {
        // Create the note
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, content })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create note');
        }
        
        const data = await response.json();
        const noteId = data.note.id;
        
        // Upload files if any
        if (selectedNoteFiles.length > 0) {
            for (const file of selectedNoteFiles) {
                const formData = new FormData();
                formData.append('file', file);
                
                await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/notes/${noteId}/attachments`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
            }
        }
        
        closeNewNoteModal();
        loadNotes(); // Refresh the notes list
        alert('Note created successfully!');
        
    } catch (error) {
        console.error('Error creating note:', error);
        alert('Error creating note: ' + error.message);
    }
}

// Edit note
function editNote(noteId) {
    openEditNoteModal(noteId);
}

// Update note
async function updateNote() {
    const noteId = document.getElementById('edit-note-id').value;
    const title = document.getElementById('edit-note-title').value.trim();
    const content = document.getElementById('edit-note-content').value.trim();
    
    if (!title) {
        alert('Please enter a note title');
        return;
    }
    
    try {
        // Update the note
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, content })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update note');
        }
        
        // Upload new files if any
        if (selectedEditNoteFiles.length > 0) {
            for (const file of selectedEditNoteFiles) {
                const formData = new FormData();
                formData.append('file', file);
                
                await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/notes/${noteId}/attachments`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
            }
        }
        
        closeEditNoteModal();
        loadNotes(); // Refresh the notes list
        alert('Note updated successfully!');
        
    } catch (error) {
        console.error('Error updating note:', error);
        alert('Error updating note: ' + error.message);
    }
}

// Delete note
async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/notes/${noteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete note');
        }
        
        loadNotes(); // Refresh the notes list
        alert('Note deleted successfully!');
        
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Error deleting note: ' + error.message);
    }
}


async function loadChatAlone() {
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load chat');
        
        const data = await response.json();
        const messages = data.messages || [];
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.innerHTML = '';
        
        if (messages.length === 0) {
            chatContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `;
        } else {
            messages.forEach(msg => {
                appendChatMessage(msg);
            });
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading chat:', error);
    }
}

async function loadFilesAlone() {
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/files`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load files');
        
        const data = await response.json();
        const files = data.files || [];
        renderFiles(files);
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

// Swipe View Implementation
function initializeSwipeView() {
    console.log('Initializing swipe view...');
    
    const container = document.getElementById('swipe-container');
    if (!container) {
        console.error('Swipe container not found');
        return;
    }
    
    // If no team is selected, try to get tasks from the first available team
    if (!currentTeamId && allTeams.length > 0) {
        currentTeamId = allTeams[0].id;
    }
    
    // If we still don't have tasks, load them
    if (allTasks.length === 0 && currentTeamId) {
        loadTeamDetails(currentTeamId).then(() => {
            initializeSwipeView(); // Recursive call after loading tasks
        });
        return;
    }
    
    const pendingTasks = allTasks.filter(t => t.status !== 'completed');
    
    if (pendingTasks.length === 0) {
        document.getElementById('no-tasks-message').style.display = 'block';
        return;
    }
    
    document.getElementById('no-tasks-message').style.display = 'none';
    
    // Clear existing cards
    container.querySelectorAll('.task-card').forEach(card => card.remove());
    
    // Show only top 5 tasks to avoid overwhelming
    const topTasks = pendingTasks.slice(0, 5);
    
    container.innerHTML = topTasks.map((task, index) => {
        const dueDate = task.due_date ? 
            new Date(task.due_date).toLocaleDateString() : 'No due date';
        
        return `
            <div class="task-card" data-task-id="${task.id}" style="z-index: ${topTasks.length - index}">
                <h2>${task.title}</h2>
                <div class="task-description">
                    <p>${task.description || 'No description provided'}</p>
                </div>
                <div class="task-meta">
                    <p><strong>Team:</strong> ${task.team_name || 'N/A'}</p>
                    <p><strong>Due Date:</strong> ${dueDate}</p>
                    <p><strong>Created by:</strong> ${task.created_by_name}</p>
                    <span class="task-status ${task.status}">${task.status.replace('_', ' ')}</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Add swipe functionality to cards
    document.querySelectorAll('.task-card').forEach(card => {
        addSwipeListeners(card);
    });
    
    console.log('Swipe view initialized with', topTasks.length, 'cards');
}

function addSwipeListeners(card) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;
    
    // Mouse events
    card.addEventListener('mousedown', startSwipe);
    document.addEventListener('mousemove', handleSwipe);
    document.addEventListener('mouseup', endSwipe);
    
    // Touch events
    card.addEventListener('touchstart', startSwipe, { passive: false });
    document.addEventListener('touchmove', handleSwipe);
    document.addEventListener('touchend', endSwipe);
    
    function startSwipe(e) {
        // Only allow swiping the top card (highest z-index)
        const allCards = document.querySelectorAll('.task-card');
        const topCard = Array.from(allCards).reduce((prev, current) => {
            return parseInt(prev.style.zIndex) > parseInt(current.style.zIndex) ? prev : current;
        });
        
        if (card !== topCard) {
            return; // Don't allow swiping non-top cards
        }
        
        isDragging = true;
        card.classList.add('swiping');
        
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        startX = clientX;
        startY = clientY;
        currentX = clientX;
        currentY = clientY;
    }
    
    function handleSwipe(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        currentX = clientX;
        currentY = clientY;
        
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        
        const rotation = deltaX * 0.1;
        
        card.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;
        
        // Add visual feedback
        const opacity = 1 - Math.abs(deltaX) / 300;
        card.style.opacity = Math.max(opacity, 0.5);
        
        // Color feedback
        const threshold = 50;
        card.style.border = 'none';
        if (deltaX > threshold) {
            card.style.borderLeft = '5px solid #10b981'; // Green for complete
        } else if (deltaX < -threshold) {
            card.style.borderLeft = '5px solid #f59e0b'; // Orange for postpone
        } else if (deltaY < -threshold) {
            card.style.borderTop = '5px solid #3b82f6'; // Blue for in progress
        } else if (deltaY > threshold) {
            card.style.borderTop = '5px solid #ef4444'; // Red for delete
        }
    }
    
    function endSwipe(e) {
        if (!isDragging) return;
        
        isDragging = false;
        card.classList.remove('swiping');
        
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        const threshold = 100;
        
        const taskId = parseInt(card.dataset.taskId);
        
        if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
            // Determine swipe direction
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (deltaX > 0) {
                    // Swipe right - complete task
                    handleSwipeAction(taskId, 'completed');
                } else {
                    // Swipe left - postpone task
                    handleSwipeAction(taskId, 'postponed');
                }
            } else {
                // Vertical swipe
                if (deltaY < 0) {
                    // Swipe up - in progress
                    handleSwipeAction(taskId, 'in_progress');
                } else {
                    // Swipe down - delete task
                    const task = allTasks.find(t => t.id === taskId);
                    if (task && task.created_by === user.id) {
                        handleSwipeAction(taskId, 'delete');
                    } else {
                        alert('You can only delete tasks you created');
                        resetCard();
                        return;
                    }
                }
            }
            
            // Animate card away
            card.style.transform = `translate(${deltaX * 3}px, ${deltaY * 3}px) rotate(${deltaX * 0.3}deg)`;
            card.style.opacity = '0';
            
            setTimeout(() => {
                card.remove();
                checkIfMoreCards();
            }, 300);
        } else {
            // Snap back
            resetCard();
        }
    }
    
    function resetCard() {
        card.style.transform = '';
        card.style.opacity = '';
        card.style.border = '';
    }
}

async function handleSwipeAction(taskId, action) {
    try {
        if (action === 'delete') {
            await deleteTask(taskId);
        } else {
            await updateTaskStatus(taskId, action);
        }
        
        // Update the task in our local array
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            if (action === 'delete') {
                allTasks = allTasks.filter(t => t.id !== taskId);
            } else {
                task.status = action;
            }
        }
        
    } catch (error) {
        console.error('Swipe action error:', error);
        alert('Action failed: ' + error.message);
    }
}

function checkIfMoreCards() {
    const remainingCards = document.querySelectorAll('.task-card');
    if (remainingCards.length === 0) {
        document.getElementById('no-tasks-message').style.display = 'block';
    }
}

function showDailyTasksNotification(tasks) {
    if (window.Notification && Notification.permission === 'granted') {
        new Notification('Daily Tasks Reminder', {
            body: `You have ${tasks.length} task(s) due today!`,
            icon: '/favicon.ico'
        });
    }
}

// Old notes functions removed - using new individual notes system

// Files functions
async function loadTeamFiles(teamId) {
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${teamId}/files`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load files');
        
        const data = await response.json();
        const files = data.files || [];
        renderFiles(files);
    } catch (error) {
        console.error('Files error:', error);
    }
}

function renderFiles(files) {
    const filesList = document.getElementById('files-list');
    
    if (files.length === 0) {
        filesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>No files uploaded yet</p>
            </div>
        `;
        return;
    }
    
    filesList.innerHTML = files.map(file => {
        const fileIcon = getFileIcon(file.file_type);
        const fileSize = formatFileSize(file.file_size);
        const uploadDate = new Date(file.created_at).toLocaleDateString();
        
        return `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-icon">
                        <i class="${fileIcon}"></i>
                    </div>
                    <div class="file-details">
                        <h5>${file.filename}</h5>
                        <p>${fileSize} • Uploaded by ${file.uploaded_by_name} • ${uploadDate}</p>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-icon btn-info" onclick="downloadFile(${file.id}, '${file.filename}')">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteFile(${file.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function uploadFile() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const uploadBtn = document.getElementById('upload-file-btn');
        const originalText = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        uploadBtn.disabled = true;
        
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/files`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) throw new Error('Failed to upload file');
        
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
        fileInput.value = '';
        
        // Reload files list
        await loadTeamFiles(currentTeamId);
    } catch (error) {
        alert('Error uploading file: ' + error.message);
        const uploadBtn = document.getElementById('upload-file-btn');
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload File';
        uploadBtn.disabled = false;
    }
}

async function downloadFile(fileId, filename) {
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/files/${fileId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to download file');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        alert('Error downloading file: ' + error.message);
    }
}

async function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${currentTeamId}/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete file');
        }
        
        // Reload files list
        await loadTeamFiles(currentTeamId);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function getFileIcon(fileType) {
    if (!fileType) return 'fas fa-file';
    
    if (fileType.includes('pdf')) return 'fas fa-file-pdf';
    if (fileType.includes('word') || fileType.includes('document')) return 'fas fa-file-word';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fas fa-file-excel';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'fas fa-file-powerpoint';
    if (fileType.includes('image')) return 'fas fa-file-image';
    if (fileType.includes('video')) return 'fas fa-file-video';
    if (fileType.includes('audio')) return 'fas fa-file-audio';
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('compressed')) return 'fas fa-file-archive';
    if (fileType.includes('text')) return 'fas fa-file-alt';
    
    return 'fas fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Tasks Organization View
let organizationMembers = [];
let currentDetailTaskId = null;

function loadTasksOrganizationView() {
    // Populate team selector
    const selector = document.getElementById('org-team-selector');
    selector.innerHTML = '<option value="">Choose a team...</option>' +
        allTeams.map(team => `<option value="${team.id}">${team.name}</option>`).join('');
    
    // Add change listener
    selector.onchange = (e) => {
        const teamId = e.target.value;
        if (teamId) {
            loadOrganizedTasks(teamId);
        } else {
            document.getElementById('organized-tasks-content').style.display = 'none';
            document.getElementById('no-team-selected').style.display = 'block';
        }
    };
}

async function loadOrganizedTasks(teamId) {
    try {
        const response = await fetch(`${API_URL}/api/student/teams/${teamId}/tasks/organized`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load organized tasks');
        
        const data = await response.json();
        organizationMembers = data.members;
        
        // **FIX: Update allTasks with all tasks from this team**
        allTasks = [...data.myTasks, ...data.teamTasks, ...data.othersTasks];
        
        document.getElementById('no-team-selected').style.display = 'none';
        document.getElementById('organized-tasks-content').style.display = 'block';
        
        // Render each section
        renderOrganizedTaskSection(data.myTasks, 'my-tasks-list', 'my', data.members);
        renderOrganizedTaskSection(data.teamTasks, 'team-tasks-list', 'team', data.members);
        renderOrganizedTaskSection(data.othersTasks, 'others-tasks-list', 'others', data.members);
        
        // Update counts
        document.getElementById('my-tasks-count').textContent = data.myTasks.length;
        document.getElementById('team-tasks-count').textContent = data.teamTasks.length;
        document.getElementById('others-tasks-count').textContent = data.othersTasks.length;
    } catch (error) {
        console.error('Load organized tasks error:', error);
        alert('Error loading tasks');
    }
}

function renderOrganizedTaskSection(tasks, containerId, type, members) {
    const container = document.getElementById(containerId);
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 2rem;">
                <i class="fas fa-clipboard-check" style="font-size: 2rem; color: #9ca3af;"></i>
                <p style="color: #9ca3af; margin-top: 0.5rem;">No tasks here</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
        
        return `
            <div class="org-task-card" onclick="openTaskDetail(${task.id})">
                <div class="org-task-header">
                    <div>
                        <h4 class="org-task-title">${task.title}</h4>
                        <p style="color: #6b7280; font-size: 0.875rem; margin: 0;">${task.description || 'No description'}</p>
                    </div>
                    <span class="task-status ${task.status}">${task.status.replace('_', ' ')}</span>
                </div>
                
                <div class="org-task-meta">
                    <span><i class="fas fa-calendar"></i> ${dueDate}</span>
                    ${isOverdue ? '<span style="color: #ef4444;"><i class="fas fa-exclamation-circle"></i> Overdue</span>' : ''}
                    <span><i class="fas fa-user"></i> Created by ${task.created_by_name}</span>
                    ${type === 'others' ? `<span><i class="fas fa-arrow-right"></i> Assigned to ${task.assigned_to_name}</span>` : ''}
                    ${task.submission_count > 0 ? `<span><i class="fas fa-check-circle" style="color: #10b981;"></i> ${task.submission_count} submission(s)</span>` : ''}
                </div>
                
                ${type === 'team' ? `
                    <div class="org-task-actions" onclick="event.stopPropagation();">
                        <select class="assign-dropdown" onchange="reassignTask(${task.id}, this.value)">
                            <option value="">Assign to someone...</option>
                            ${members.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                        </select>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function reassignTask(taskId, assignedTo) {
    if (!assignedTo) return;
    
    try {
        const response = await fetch(`${API_URL}/api/student/tasks/${taskId}/assign`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ assignedTo: parseInt(assignedTo) })
        });
        
        if (!response.ok) throw new Error('Failed to reassign task');
        
        // Reload organized tasks
        const teamId = document.getElementById('org-team-selector').value;
        if (teamId) {
            await loadOrganizedTasks(teamId);
        }
    } catch (error) {
        alert('Error reassigning task: ' + error.message);
    }
}

// Task Detail Modal
async function openTaskDetail(taskId) {
    currentDetailTaskId = taskId;
    
    // Find task in all tasks
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('task-detail-title').textContent = task.title;
    
    const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';
    
    // Determine if the current user is assigned to this task
    const isAssignedToMe = task.assigned_to === user.id;
    const isUnassigned = !task.assigned_to; // Team task
    const canSubmit = isAssignedToMe || isUnassigned;
    
    document.getElementById('task-detail-content').innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <h4 style="color: #111827; margin-bottom: 8px;">Description:</h4>
            <p style="color: #374151;">${task.description || 'No description provided'}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <div>
                <strong style="color: #6b7280;">Status:</strong>
                <span class="task-status ${task.status}" style="margin-left: 8px;">${task.status.replace('_', ' ')}</span>
            </div>
            <div>
                <strong style="color: #6b7280;">Due Date:</strong>
                <span style="color: #374151; margin-left: 8px;">${dueDate}</span>
            </div>
            <div>
                <strong style="color: #6b7280;">Created By:</strong>
                <span style="color: #374151; margin-left: 8px;">${task.created_by_name}</span>
            </div>
            <div>
                <strong style="color: #6b7280;">Team:</strong>
                <span style="color: #374151; margin-left: 8px;">${task.team_name || 'N/A'}</span>
            </div>
            <div>
                <strong style="color: #6b7280;">Assigned To:</strong>
                <span style="color: #374151; margin-left: 8px;">${task.assigned_to_name || 'Unassigned (Team Task)'}</span>
            </div>
        </div>
    `;
    
    // Show or hide submission section based on assignment
    const submissionFormContainer = document.getElementById('submission-form-container');
    const notAssignedMessage = document.getElementById('not-assigned-message');
    const notAssignedText = document.getElementById('not-assigned-text');
    
    if (canSubmit) {
        // Show submission form, hide message
        if (submissionFormContainer) submissionFormContainer.style.display = 'block';
        if (notAssignedMessage) notAssignedMessage.style.display = 'none';
        
        // Clear submission form
        document.getElementById('submission-text').value = '';
        document.getElementById('submission-file-input').value = '';
        document.getElementById('selected-files-info').textContent = 'No files selected';
        document.getElementById('selected-files-list').innerHTML = '';
    } else {
        // Hide submission form, show message
        if (submissionFormContainer) submissionFormContainer.style.display = 'none';
        if (notAssignedMessage) notAssignedMessage.style.display = 'block';
        if (notAssignedText) {
            notAssignedText.innerHTML = `
                <strong>This task is assigned to ${task.assigned_to_name}.</strong><br>
                Only the assigned person can submit work for this task.
            `;
        }
    }
    
    // Load submissions
    await loadTaskSubmissions(taskId);
    
    // Show modal
    document.getElementById('task-detail-modal').style.display = 'flex';
}

function closeTaskDetailModal() {
    document.getElementById('task-detail-modal').style.display = 'none';
    currentDetailTaskId = null;
}

function updateSelectedFiles() {
    const fileInput = document.getElementById('submission-file-input');
    const files = fileInput.files;
    const infoSpan = document.getElementById('selected-files-info');
    const filesList = document.getElementById('selected-files-list');
    
    if (files.length === 0) {
        infoSpan.textContent = 'No files selected';
        filesList.innerHTML = '';
    } else {
        infoSpan.textContent = `${files.length} file(s) selected`;
        filesList.innerHTML = Array.from(files).map((file, index) => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 6px; background: #f9fafb; border-radius: 6px; margin-top: 4px;">
                <i class="fas fa-file" style="color: #6b7280;"></i>
                <span style="font-size: 0.875rem; color: #374151;">${file.name} (${formatFileSize(file.size)})</span>
            </div>
        `).join('');
    }
}

async function loadTaskSubmissions(taskId) {
    try {
        const response = await fetch(`${API_URL}/api/student/tasks/${taskId}/submissions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load submissions');
        
        const data = await response.json();
        console.log('Submissions data received:', data);
        const submissionsList = document.getElementById('submissions-list');
        
        if (data.submissions.length === 0) {
            submissionsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No submissions yet</p>
                </div>
            `;
        } else {
            submissionsList.innerHTML = data.submissions.map(sub => {
                console.log('Submission:', sub); // Debug log
                return `
                    <div class="submission-item">
                        <div class="submission-header">
                            <span class="submission-author">${sub.submitted_by_name}</span>
                            <span class="submission-time">${new Date(sub.submitted_at).toLocaleString()}</span>
                        </div>
                        ${sub.submission_text ? `
                            <div class="submission-text">${sub.submission_text}</div>
                        ` : ''}
                        ${sub.files && sub.files.length > 0 ? `
                            <div style="margin-top: ${sub.submission_text ? '12px' : '0'}; padding-top: ${sub.submission_text ? '12px' : '0'}; ${sub.submission_text ? 'border-top: 1px solid #e5e7eb;' : ''}">
                                <strong style="font-size: 0.875rem; color: #6b7280;"><i class="fas fa-paperclip"></i> Attachments (${sub.files.length}):</strong>
                                <div style="margin-top: 8px;">
                                    ${sub.files.map(file => `
                                        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f9fafb; border-radius: 6px; margin-top: 4px;">
                                            <i class="fas fa-file" style="color: #2563eb;"></i>
                                            <a href="#" onclick="downloadSubmissionFile(${file.id}, '${file.filename}'); return false;" style="color: #2563eb; text-decoration: none; font-size: 0.875rem; flex: 1;">
                                                ${file.filename}
                                            </a>
                                            <span style="font-size: 0.75rem; color: #6b7280;">${formatFileSize(file.file_size)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${!sub.submission_text && (!sub.files || sub.files.length === 0) ? `
                            <div class="submission-text"><em>No submission content</em></div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Load submissions error:', error);
    }
}

async function submitTask() {
    const submissionText = document.getElementById('submission-text').value.trim();
    const fileInput = document.getElementById('submission-file-input');
    const files = fileInput.files;
    
    if (!submissionText && files.length === 0) {
        alert('Please write something or attach files before submitting');
        return;
    }
    
    try {
        // First, submit the text
        const response = await fetch(`${API_URL}/api/student/tasks/${currentDetailTaskId}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ submissionText: submissionText || '' })
        });
        
        if (!response.ok) throw new Error('Failed to submit task');
        
        const data = await response.json();
        const submissionId = data.submissionId;
        
        // Upload files if any
        if (files.length > 0) {
            let uploadedCount = 0;
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('file', files[i]);
                
                const fileResponse = await fetch(`${API_URL}/api/student/tasks/${currentDetailTaskId}/submit/${submissionId}/file`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                if (fileResponse.ok) {
                    uploadedCount++;
                    console.log(`Uploaded ${files[i].name}`);
                } else {
                    console.error(`Failed to upload ${files[i].name}`);
                }
            }
            console.log(`Successfully uploaded ${uploadedCount}/${files.length} files`);
        }
        
        alert('✓ Submitted successfully!');
        document.getElementById('submission-text').value = '';
        fileInput.value = '';
        document.getElementById('selected-files-info').textContent = 'No files selected';
        document.getElementById('selected-files-list').innerHTML = '';
        
        // Reload submissions after a short delay to ensure files are saved
        setTimeout(async () => {
            await loadTaskSubmissions(currentDetailTaskId);
        }, 500);
    } catch (error) {
        alert('Error submitting: ' + error.message);
    }
}

async function downloadSubmissionFile(fileId, filename) {
    try {
        const response = await fetch(`${API_URL}/api/student/submission-files/${fileId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to download file');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        alert('Error downloading file: ' + error.message);
    }
}

async function markComplete() {
    if (!confirm('Mark this task as complete?')) return;
    
    try {
        await updateTaskStatus(currentDetailTaskId, 'completed');
        closeTaskDetailModal();
        
        // Reload current view
        if (document.getElementById('tasks-org-view').style.display !== 'none') {
            const teamId = document.getElementById('org-team-selector').value;
            if (teamId) await loadOrganizedTasks(teamId);
        } else {
            await loadTeamDetails(currentTeamId);
        }
    } catch (error) {
        alert('Error marking complete: ' + error.message);
    }
}

// Theme Functions
function initializeTheme() {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('dashboard-theme') || 'blue';
    setTheme(savedTheme);
}

function setTheme(themeKey) {
    // Remove existing theme class
    document.body.classList.remove(...Object.values(themes).map(t => t.class));
    
    // Add new theme class
    if (themes[themeKey]) {
        document.body.classList.add(themes[themeKey].class);
        currentTheme = themeKey;
        
        // Update UI
        document.getElementById('current-theme').textContent = themes[themeKey].name;
        
        // Save to localStorage
        localStorage.setItem('dashboard-theme', themeKey);
        
        // Add visual feedback
        showThemeChangeEffect();
    }
}

function setRandomTheme() {
    const themeKeys = Object.keys(themes);
    const randomKey = themeKeys[Math.floor(Math.random() * themeKeys.length)];
    setTheme(randomKey);
}

function showThemeChangeEffect() {
    // Add a subtle animation to show theme change
    document.body.style.transition = 'all 0.3s ease';
    
    setTimeout(() => {
        document.body.style.transition = '';
    }, 300);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

