const API_URL = window.location.origin;
let socket;
let currentTeamId = null;
let currentClassId = null;
let user = null;
let token = null;
let progressTracker = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeSocketIO();
    setupEventListeners();
});

function checkAuth() {
    token = localStorage.getItem('token');
    user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || user.role !== 'teacher') {
        window.location.href = '/';
        return;
    }
    
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userEmail').textContent = user.email;
    
    loadClasses();
}

function setupEventListeners() {
    // Create Class Form
    document.getElementById('createClassForm').addEventListener('submit', createClass);
    
    // Create Team Form
    document.getElementById('createTeamForm').addEventListener('submit', createTeam);
    
    // Add Member Form
    document.getElementById('addMemberForm').addEventListener('submit', addMember);
    
    // Create Task Form
    document.getElementById('createTaskForm').addEventListener('submit', createTask);
}

function initializeSocketIO() {
    socket = io(API_URL);
    
    socket.on('connect', () => {
        console.log('Connected to socket server');
    });
    
    socket.on('new_message', (data) => {
        if (currentTeamId && data.teamId === currentTeamId) {
            appendChatMessage(data);
        }
    });
}

// ========== CLASSES ==========

async function loadClasses() {
    try {
        const response = await fetch(`${API_URL}/api/teacher/classes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load classes');
        
        const data = await response.json();
        renderClassesOverview(data.classes);
    } catch (error) {
        console.error('Error loading classes:', error);
        alert('Error loading classes');
    }
}

function renderClassesOverview(classes) {
    const classesGrid = document.getElementById('classesGrid');
    
    if (classes.length === 0) {
        classesGrid.innerHTML = `
            <div style="padding: 3rem; text-align: center; color: #6b7280;">
                <i class="fas fa-book" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No classes yet</h3>
                <p>Create your first class to get started!</p>
            </div>
        `;
        return;
    }
    
    classesGrid.innerHTML = classes.map(cls => {
        const expiryDate = cls.expiry_date ? new Date(cls.expiry_date) : null;
        const isExpired = expiryDate && expiryDate < new Date();
        const daysLeft = expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
        
        return `
            <div class="card class-card ${isExpired ? 'expired' : ''}" onclick="openClassDetails(${cls.id})" style="cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">${cls.name}</h3>
                    ${isExpired ? '<span class="badge badge-danger">Expired</span>' : daysLeft !== null && daysLeft <= 7 ? `<span class="badge badge-warning">${daysLeft} days left</span>` : ''}
                </div>
                <p style="color: #6b7280; margin-bottom: 1rem;">${cls.description || 'No description'}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; color: #6b7280;">
                    <div>
                        <i class="fas fa-users"></i> ${cls.team_count || 0} teams
                    </div>
                    <div>
                        ${expiryDate ? `<i class="fas fa-calendar"></i> Expires: ${expiryDate.toLocaleDateString()}` : '<i class="fas fa-infinity"></i> No expiry'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function createClass(e) {
    e.preventDefault();
    
    const name = document.getElementById('className').value;
    const description = document.getElementById('classDescription').value;
    const expiryDate = document.getElementById('classExpiryDate').value;
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/classes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                name, 
                description,
                expiryDate: expiryDate || null
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create class');
        }
        
        closeModal('createClassModal');
        document.getElementById('createClassForm').reset();
        loadClasses();
        alert('Class created successfully!');
    } catch (error) {
        alert('Error creating class: ' + error.message);
    }
}

// ========== CLASS DETAILS ==========

async function openClassDetails(classId) {
    currentClassId = classId;
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/classes/${classId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load class');
        
        const data = await response.json();
        
        // Hide overview, show class details
        document.getElementById('overviewSection').style.display = 'none';
        document.getElementById('classDetailsSection').style.display = 'block';
        
        // Update class details
        document.getElementById('classDetailsName').textContent = data.class.name;
        document.getElementById('classDetailsDescription').textContent = data.class.description || 'No description';
        
        const expiryDate = data.class.expiry_date ? new Date(data.class.expiry_date) : null;
        document.getElementById('classDetailsExpiry').textContent = expiryDate ? expiryDate.toLocaleDateString() : 'No expiry date';
        
        // Render teams
        renderClassTeams(data.teams);
        
        // Initialize progress tracker
        initializeProgressTracker();
        
    } catch (error) {
        console.error('Error loading class:', error);
        alert('Error loading class details');
    }
}

function renderClassTeams(teams) {
    const teamsContainer = document.getElementById('classTeamsContainer');
    
    if (teams.length === 0) {
        teamsContainer.innerHTML = `
            <div style="padding: 3rem; text-align: center; color: #6b7280;">
                <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No teams yet</h3>
                <p>Create your first team for this class!</p>
            </div>
        `;
        return;
    }
    
    teamsContainer.innerHTML = teams.map(team => {
        const progress = team.total_tasks > 0 ? (team.completed_tasks / team.total_tasks) * 100 : 0;
        return `
            <div class="team-card" style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 8px 0;">${team.name}</h3>
                        <p style="color: #6b7280; font-size: 0.875rem; margin: 0;">
                            <i class="fas fa-users"></i> ${team.member_count} members | 
                            <i class="fas fa-tasks"></i> ${team.completed_tasks}/${team.total_tasks} tasks completed
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="openTeamManagement(${team.id})" class="btn btn-secondary btn-small">
                            <i class="fas fa-cog"></i> Manage
                        </button>
                        <button onclick="openTeamDashboard(${team.id})" class="btn btn-primary btn-small">
                            <i class="fas fa-chart-line"></i> View Dashboard
                        </button>
                    </div>
                </div>
                <div class="progress-bar" style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div class="progress-fill" style="background: linear-gradient(90deg, #3b82f6, #2563eb); height: 100%; width: ${progress}%; transition: width 0.5s ease;"></div>
                </div>
                <p style="font-size: 0.875rem; margin: 8px 0 0 0; color: #6b7280;">${Math.round(progress)}% Complete</p>
            </div>
        `;
    }).join('');
}

function backToOverview() {
    document.getElementById('classDetailsSection').style.display = 'none';
    document.getElementById('overviewSection').style.display = 'block';
    currentClassId = null;
    loadClasses();
}

// ========== TEAMS ==========

function openCreateTeamModal() {
    if (!currentClassId) {
        alert('Please select a class first');
        return;
    }
    
    // Set the class ID in hidden field or variable
    document.getElementById('teamClassId').value = currentClassId;
    openModal('createTeamModal');
}

async function createTeam(e) {
    e.preventDefault();
    
    const name = document.getElementById('teamName').value;
    const classId = currentClassId;
    
    if (!classId) {
        alert('No class selected');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, classId })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create team');
        }
        
        closeModal('createTeamModal');
        document.getElementById('createTeamForm').reset();
        openClassDetails(classId); // Refresh class details
        alert('Team created successfully!');
    } catch (error) {
        alert('Error creating team: ' + error.message);
    }
}

// ========== TEAM MANAGEMENT ==========

async function openTeamManagement(teamId) {
    currentTeamId = teamId;
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/teams/${teamId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load team');
        
        const data = await response.json();
        
        document.getElementById('teamManagementTitle').textContent = data.team.name;
        
        // Render members
        const membersList = document.getElementById('teamMembersList');
        membersList.innerHTML = data.members.length > 0 
            ? data.members.map(m => `
                <div style="padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${m.name}</strong>
                        <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 0.875rem;">${m.email}</p>
                    </div>
                    <button onclick="removeMember(${teamId}, ${m.id})" class="btn btn-danger btn-small">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('')
            : '<p style="color: #6b7280;">No members yet</p>';
        
        // Populate assign-to dropdown
        const assignSelect = document.getElementById('taskAssignedTo');
        assignSelect.innerHTML = '<option value="">All team members</option>' +
            data.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        
        // Render tasks
        const tasksList = document.getElementById('teamTasksList');
        tasksList.innerHTML = data.tasks.length > 0
            ? data.tasks.map(t => {
                const statusClass = t.status === 'completed' ? 'badge-success' : t.status === 'in_progress' ? 'badge-warning' : 'badge-secondary';
                return `
                    <div class="task-item" style="padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 8px 0;">${t.title}</h4>
                                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 0.875rem;">${t.description || 'No description'}</p>
                                <div style="display: flex; gap: 12px; font-size: 0.875rem; color: #6b7280;">
                                    <span><i class="fas fa-calendar"></i> ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'}</span>
                                    ${t.assigned_to_name ? `<span><i class="fas fa-user"></i> Assigned to: ${t.assigned_to_name}</span>` : '<span><i class="fas fa-users"></i> Team task</span>'}
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <button onclick="viewTaskSubmissions(${t.id})" class="btn btn-secondary btn-small" title="View submissions">
                                    <i class="fas fa-eye"></i> Submissions
                                </button>
                                <span class="badge ${statusClass}">${t.status.replace('_', ' ')}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')
            : '<p style="color: #6b7280;">No tasks yet</p>';
        
        // Load team chat
        loadTeamChat(teamId);
        
        // Load team files
        loadTeamFiles(teamId);
        
        // Join socket room
        socket.emit('join_team', teamId);
        
        openModal('teamManagementModal');
    } catch (error) {
        console.error('Error loading team:', error);
        alert('Error loading team management');
    }
}

async function addMember(e) {
    e.preventDefault();
    
    const studentEmail = document.getElementById('memberEmail').value;
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/teams/${currentTeamId}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ studentEmail })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to add member');
        }
        
        document.getElementById('memberEmail').value = '';
        openTeamManagement(currentTeamId); // Refresh
        alert('Student added successfully!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function removeMember(teamId, userId) {
    if (!confirm('Are you sure you want to remove this student from the team?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/teams/${teamId}/members/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove member');
        }
        
        openTeamManagement(teamId); // Refresh
        alert('Student removed successfully!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function showCreateTaskForm() {
    document.getElementById('createTaskFormContainer').style.display = 'block';
}

function hideCreateTaskForm() {
    document.getElementById('createTaskFormContainer').style.display = 'none';
    document.getElementById('createTaskForm').reset();
}

async function createTask(e) {
    e.preventDefault();
    
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const assignedTo = document.getElementById('taskAssignedTo').value;
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                description,
                dueDate: dueDate || null,
                teamId: currentTeamId,
                assignedTo: assignedTo || null
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create task');
        }
        
        hideCreateTaskForm();
        openTeamManagement(currentTeamId); // Refresh
        alert('Task created successfully!');
    } catch (error) {
        alert('Error creating task: ' + error.message);
    }
}

// ========== TEAM DASHBOARD VIEW ==========

async function openTeamDashboard(teamId) {
    try {
        const response = await fetch(`${API_URL}/api/teacher/teams/${teamId}/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load team dashboard');
        
        const data = await response.json();
        
        // Update dashboard title
        document.getElementById('teamDashboardTitle').textContent = `${data.team.name} - Dashboard`;
        
        // Render progress timeline
        renderTeamTimeline(data.tasks);
        
        // Render upcoming deadlines
        renderTeamDeadlines(data.tasks);
        
        // Render team stats
        renderTeamStats(data);
        
        // Render recent activity
        renderTeamActivity(data.tasks, data.members);
        
        openModal('teamDashboardModal');
    } catch (error) {
        console.error('Error loading team dashboard:', error);
        alert('Error loading team dashboard');
    }
}

function renderTeamTimeline(tasks) {
    const timeline = document.getElementById('teamTimeline');
    
    if (tasks.length === 0) {
        timeline.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">No tasks yet</p>';
        return;
    }
    
    const sortedTasks = tasks.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    timeline.innerHTML = sortedTasks.map(task => {
        const statusIcon = task.status === 'completed' ? 'fa-check-circle' : task.status === 'in_progress' ? 'fa-spinner' : 'fa-circle';
        const statusColor = task.status === 'completed' ? '#10b981' : task.status === 'in_progress' ? '#f59e0b' : '#6b7280';
        
        return `
            <div class="timeline-item" style="display: flex; gap: 16px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
                <div style="flex-shrink: 0;">
                    <i class="fas ${statusIcon}" style="color: ${statusColor}; font-size: 1.5rem;"></i>
                </div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 8px 0;">${task.title}</h4>
                    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 0.875rem;">${task.description || 'No description'}</p>
                    <div style="display: flex; gap: 16px; font-size: 0.875rem; color: #6b7280;">
                        <span><i class="fas fa-calendar"></i> ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                        <span><i class="fas fa-user"></i> ${task.assigned_to_name || 'Team task'}</span>
                        <span class="badge ${task.status === 'completed' ? 'badge-success' : task.status === 'in_progress' ? 'badge-warning' : 'badge-secondary'}">${task.status.replace('_', ' ')}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderTeamDeadlines(tasks) {
    const deadlinesContainer = document.getElementById('teamDeadlines');
    
    const upcomingTasks = tasks
        .filter(t => t.due_date && t.status !== 'completed')
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 5);
    
    if (upcomingTasks.length === 0) {
        deadlinesContainer.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 1rem;">No upcoming deadlines</p>';
        return;
    }
    
    deadlinesContainer.innerHTML = upcomingTasks.map(task => {
        const dueDate = new Date(task.due_date);
        const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
        const isUrgent = daysLeft <= 3;
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: ${isUrgent ? '#fef3c7' : '#f9fafb'}; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${isUrgent ? '#f59e0b' : '#3b82f6'};">
                <div>
                    <strong>${task.title}</strong>
                    <p style="margin: 4px 0 0 0; font-size: 0.875rem; color: #6b7280;">${task.assigned_to_name || 'Team task'}</p>
                </div>
                <div style="text-align: right;">
                    <div style="color: ${isUrgent ? '#d97706' : '#3b82f6'}; font-weight: 600; font-size: 0.875rem;">${dueDate.toLocaleDateString()}</div>
                    <div style="font-size: 0.75rem; color: #6b7280;">${daysLeft} days left</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderTeamStats(data) {
    const statsContainer = document.getElementById('teamStats');
    
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = data.tasks.filter(t => t.status === 'in_progress').length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    statsContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="font-size: 2rem; font-weight: 700; color: #3b82f6;">${data.members.length}</div>
                <div style="color: #6b7280; font-size: 0.875rem; margin-top: 4px;">Team Members</div>
            </div>
            <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="font-size: 2rem; font-weight: 700; color: #10b981;">${completedTasks}/${totalTasks}</div>
                <div style="color: #6b7280; font-size: 0.875rem; margin-top: 4px;">Tasks Completed</div>
            </div>
            <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="font-size: 2rem; font-weight: 700; color: #f59e0b;">${inProgressTasks}</div>
                <div style="color: #6b7280; font-size: 0.875rem; margin-top: 4px;">In Progress</div>
            </div>
            <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="font-size: 2rem; font-weight: 700; color: #8b5cf6;">${Math.round(progress)}%</div>
                <div style="color: #6b7280; font-size: 0.875rem; margin-top: 4px;">Overall Progress</div>
            </div>
        </div>
    `;
}

function renderTeamActivity(tasks, members) {
    const activityContainer = document.getElementById('teamActivity');
    
    // Create activity feed from recent task updates
    const recentTasks = tasks
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0, 10);
    
    if (recentTasks.length === 0) {
        activityContainer.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 1rem;">No recent activity</p>';
        return;
    }
    
    activityContainer.innerHTML = recentTasks.map(task => {
        const date = new Date(task.updated_at || task.created_at);
        return `
            <div style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <strong>${task.title}</strong>
                        <p style="margin: 4px 0 0 0; font-size: 0.875rem; color: #6b7280;">
                            ${task.status === 'completed' ? '✅ Completed' : task.status === 'in_progress' ? '🔄 In Progress' : '📝 Created'}
                            ${task.assigned_to_name ? ` by ${task.assigned_to_name}` : ''}
                        </p>
                    </div>
                    <span style="font-size: 0.75rem; color: #6b7280;">${date.toLocaleDateString()}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ========== MODALS ==========

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    
    if (modalId === 'teamManagementModal' && currentTeamId) {
        socket.emit('leave_team', currentTeamId);
        currentTeamId = null;
    }
}

// ========== CHAT & FILES ==========

async function loadTeamChat(teamId) {
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${teamId}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load chat');
        
        const data = await response.json();
        const messages = data.messages || [];
        const chatContainer = document.getElementById('teamChatMessages');
        chatContainer.innerHTML = '';
        
        if (messages.length === 0) {
            chatContainer.innerHTML = '<p style="color: #6b7280; text-align: center;">No messages yet</p>';
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

function appendChatMessage(msg) {
    const chatContainer = document.getElementById('teamChatMessages');
    const messageDiv = document.createElement('div');
    const isTeacher = msg.user_role === 'teacher';
    
    messageDiv.style.cssText = `
        padding: 12px;
        background: ${isTeacher ? '#dbeafe' : '#f9fafb'};
        border-radius: 8px;
        border-left: 4px solid ${isTeacher ? '#3b82f6' : '#6b7280'};
    `;
    
    messageDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: ${isTeacher ? '#1e40af' : '#374151'};">
                ${msg.user_name || 'Unknown'}
                ${isTeacher ? '<span style="background: #3b82f6; color: white; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Teacher</span>' : ''}
            </strong>
            <span style="font-size: 0.75rem; color: #6b7280;">${new Date(msg.created_at).toLocaleString()}</span>
        </div>
        <div style="color: #374151;">${msg.message}</div>
    `;
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    
    if (!message || !currentTeamId) return;
    
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
        
        // Emit socket event
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

async function loadTeamFiles(teamId) {
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${teamId}/files`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load files');
        
        const data = await response.json();
        const files = data.files || [];
        renderTeamFiles(files);
        
        // Setup file upload
        const fileInput = document.getElementById('teamFileInput');
        fileInput.onchange = async (e) => {
            await uploadTeamFiles(teamId, e.target.files);
            fileInput.value = ''; // Reset input
        };
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

function renderTeamFiles(files) {
    const filesList = document.getElementById('teamFilesList');
    
    if (files.length === 0) {
        filesList.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 1rem;">No files uploaded yet</p>';
        return;
    }
    
    filesList.innerHTML = files.map(file => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <i class="fas fa-file" style="color: #3b82f6; font-size: 1.5rem;"></i>
                <div>
                    <div style="font-weight: 500;">${file.filename}</div>
                    <div style="font-size: 0.875rem; color: #6b7280;">
                        Uploaded by ${file.uploaded_by_name} • ${new Date(file.uploaded_at).toLocaleDateString()}
                    </div>
                </div>
            </div>
            <button onclick="downloadFile(${file.id}, '${file.filename}')" class="btn btn-secondary btn-small">
                <i class="fas fa-download"></i>
            </button>
        </div>
    `).join('');
}

async function uploadTeamFiles(teamId, files) {
    if (files.length === 0) return;
    
    try {
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${API_URL}/api/shared/teams/${teamId}/files`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
        }
        
        // Reload files
        await loadTeamFiles(teamId);
        alert('Files uploaded successfully!');
    } catch (error) {
        alert('Error uploading files: ' + error.message);
    }
}

async function downloadFile(fileId, filename) {
    try {
        const response = await fetch(`${API_URL}/api/shared/files/${fileId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to download file');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert('Error downloading file: ' + error.message);
    }
}

// ========== TASK SUBMISSIONS ==========

async function viewTaskSubmissions(taskId) {
    try {
        const response = await fetch(`${API_URL}/api/teacher/tasks/${taskId}/submissions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load submissions');
        
        const data = await response.json();
        
        document.getElementById('submissionsTaskTitle').textContent = `Submissions: ${data.task.title}`;
        
        const submissionsContent = document.getElementById('taskSubmissionsContent');
        
        if (data.submissions.length === 0) {
            submissionsContent.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: #6b7280;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>No submissions yet</h3>
                    <p>Students haven't submitted their work for this task.</p>
                </div>
            `;
        } else {
            submissionsContent.innerHTML = data.submissions.map(sub => `
                <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; border-left: 4px solid #3b82f6;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                        <div>
                            <h3 style="margin: 0 0 8px 0;">${sub.user_name}</h3>
                            <p style="margin: 0; font-size: 0.875rem; color: #6b7280;">
                                <i class="fas fa-clock"></i> Submitted: ${new Date(sub.submitted_at).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    
                    ${sub.submission_text ? `
                        <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                            <strong style="display: block; margin-bottom: 8px; color: #374151;">Answer/Notes:</strong>
                            <div style="white-space: pre-wrap; color: #374151;">${sub.submission_text}</div>
                        </div>
                    ` : ''}
                    
                    ${sub.files && sub.files.length > 0 ? `
                        <div>
                            <strong style="display: block; margin-bottom: 8px; color: #374151;">
                                <i class="fas fa-paperclip"></i> Attached Files (${sub.files.length}):
                            </strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${sub.files.map(file => `
                                    <button onclick="downloadSubmissionFile(${file.id}, '${file.filename}')" 
                                            style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #dbeafe; color: #1e40af; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">
                                        <i class="fas fa-file"></i> ${file.filename}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
        
        openModal('taskSubmissionsModal');
    } catch (error) {
        console.error('Error loading submissions:', error);
        alert('Error loading task submissions');
    }
}

async function downloadSubmissionFile(fileId, filename) {
    try {
        const response = await fetch(`${API_URL}/api/teacher/submission-files/${fileId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to download file');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert('Error downloading file: ' + error.message);
    }
}

// ========== PROGRESS TRACKER ==========

function initializeProgressTracker() {
    if (!currentClassId) return;
    
    // Initialize progress tracker if not already done
    if (!progressTracker) {
        progressTracker = new ProgressTracker('progressTrackerContainer', {
            apiUrl: `${API_URL}/api/progress`,
            socket: socket
        });
    }
    
    // Load progress for current class
    progressTracker.initialize(currentClassId);
}

function refreshProgress() {
    if (progressTracker) {
        progressTracker.refresh();
    }
}

// Trigger progress recalculation when tasks are updated
function triggerProgressUpdate(teamId) {
    if (socket && currentClassId) {
        socket.emit('progress_updated', {
            teamId: teamId,
            classId: currentClassId
        });
    }
}

// ========== UTILITY ==========

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

