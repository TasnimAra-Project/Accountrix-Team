const API_URL = window.location.origin;
let socket;
let currentTeamId = null;
let currentClassId = null;
let selectedTeamId = null; // New: selected team for panel
let user = null;
let token = null;
let progressTracker = null;
let currentTeamsData = []; // Store teams data for filtering

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
    
    // Add Member Form (modal)
    const addMemberForm = document.getElementById('addMemberForm');
    if (addMemberForm) {
        addMemberForm.addEventListener('submit', addMember);
    }
    
    // Add Member Form (inline in panel)
    const addMemberFormInline = document.getElementById('addMemberFormInline');
    if (addMemberFormInline) {
        addMemberFormInline.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('memberEmailInline').value;
            document.getElementById('memberEmailInline').value = '';
            addMemberToTeam(selectedTeamId, email);
        });
    }
    
    // Create Task Form
    document.getElementById('createTaskForm').addEventListener('submit', createTask);
    
    // Search input
    const searchInput = document.getElementById('tdbSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            applyFilters();
        });
    }
    
    // Restore selected team from localStorage
    const savedTeamId = localStorage.getItem('selectedTeamId');
    if (savedTeamId && currentClassId) {
        // Will be restored after teams load
    }
}

function initializeSocketIO() {
    socket = io(API_URL);
    
    socket.on('connect', () => {
        console.log('Connected to socket server');
    });
    
    socket.on('new_message', (data) => {
        // Check if message is for the currently selected team
        const teamId = selectedTeamId || currentTeamId;
        if (teamId && data.teamId === teamId) {
            // Check if this is a duplicate of the optimistic message we just sent
            const isDuplicate = lastOptimisticMessage && 
                                lastOptimisticMessage.message === data.message &&
                                lastOptimisticMessage.user_name === data.user_name &&
                                Date.now() - lastOptimisticMessage.timestamp < 5000; // Within 5 seconds
            
            if (!isDuplicate) {
                appendChatMessage(data);
            } else {
                // Clear the optimistic message flag since we got the real one
                lastOptimisticMessage = null;
            }
        }
    });
}

// ========== CHAT SLIDE-OVER ==========

let chatSlideOverOpen = false;
let chatScrollContainer = null;
let chatIsNearBottom = true; // Track if user is near bottom of chat
let lastOptimisticMessage = null; // Track last optimistic message to avoid duplicates

function toggleChatSlideOver() {
    const slideOver = document.getElementById('chatSlideOver');
    if (!slideOver) return;
    
    const isOpen = slideOver.getAttribute('aria-hidden') === 'false';
    
    if (isOpen) {
        closeChatSlideOver();
    } else {
        openChatSlideOver();
    }
}

function openChatSlideOver() {
    // Check if a team is selected
    const teamId = selectedTeamId || currentTeamId;
    if (!teamId) {
        alert('Please select a team first to use the chat.');
        return;
    }
    
    const slideOver = document.getElementById('chatSlideOver');
    const messagesContainer = document.getElementById('chatSlideOverMessages');
    const originalMessages = document.getElementById('teamChatMessages');
    const slideOverHeader = slideOver?.querySelector('.chat-slide-over-header h2');
    
    if (!slideOver || !messagesContainer) return;
    
    // Update header with team name if available
    const teamName = document.getElementById('selectedTeamName')?.textContent || 'Team Chat';
    if (slideOverHeader) {
        slideOverHeader.innerHTML = `<i class="fas fa-comments"></i> ${teamName}`;
    }
    
    // Load chat if not already loaded, or reuse DOM: clone messages from original container
    if (originalMessages && originalMessages.children.length > 0) {
        messagesContainer.innerHTML = originalMessages.innerHTML;
        chatScrollContainer = messagesContainer;
    } else {
        // Load chat messages for this team
        loadTeamChat(teamId);
        // Show loading or empty state
        messagesContainer.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">Loading messages...</p>';
        chatScrollContainer = messagesContainer;
    }
    
    // Open slide-over
    slideOver.setAttribute('aria-hidden', 'false');
    chatSlideOverOpen = true;
    
    // Focus trap
    setupFocusTrap(slideOver);
    
    // Scroll to bottom on open
    setTimeout(() => {
        scrollChatToBottom(messagesContainer);
        const input = document.getElementById('chatSlideOverInput');
        if (input) input.focus();
    }, 100);
    
    // Update URL hash
    if (window.location.hash !== '#chat') {
        window.history.pushState(null, '', '#chat');
    }
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

function closeChatSlideOver() {
    const slideOver = document.getElementById('chatSlideOver');
    if (!slideOver) return;
    
    slideOver.setAttribute('aria-hidden', 'true');
    chatSlideOverOpen = false;
    
    // Remove focus trap
    removeFocusTrap();
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Update URL hash
    if (window.location.hash === '#chat') {
        window.history.replaceState(null, '', window.location.pathname);
    }
}

// Focus trap implementation
let focusTrapElements = [];
let focusTrapActive = false;

function setupFocusTrap(container) {
    if (focusTrapActive) return;
    
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(container.querySelectorAll(focusableSelectors))
        .filter(el => !el.disabled && el.offsetParent !== null);
    
    if (focusableElements.length === 0) return;
    
    focusTrapElements = focusableElements;
    focusTrapActive = true;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleTabKey = (e) => {
        if (!focusTrapActive || e.key !== 'Tab') return;
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    };
    
    container.addEventListener('keydown', handleTabKey);
    container._focusTrapHandler = handleTabKey;
    
    // Focus first element
    firstElement.focus();
}

function removeFocusTrap() {
    focusTrapActive = false;
    focusTrapElements = [];
}

// Auto-scroll chat to bottom
function scrollChatToBottom(container) {
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    chatIsNearBottom = true;
}

// Check if user is near bottom of chat (within 100px)
function isNearBottom(container) {
    if (!container) return true;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

// Monitor scroll position to track if user is near bottom
function setupChatScrollMonitor(container) {
    if (!container) return;
    
    container.addEventListener('scroll', () => {
        chatIsNearBottom = isNearBottom(container);
    }, { passive: true });
}

// Enhanced appendChatMessage to work with both containers
function appendChatMessage(msg) {
    const originalContainer = document.getElementById('teamChatMessages');
    const slideOverContainer = document.getElementById('chatSlideOverMessages');
    
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
            <span style="font-size: 0.75rem; color: #6b7280;">${new Date(msg.created_at || Date.now()).toLocaleString()}</span>
        </div>
        <div style="color: #374151;">${msg.message}</div>
    `;
    
    // Append to original container
    if (originalContainer) {
        originalContainer.appendChild(messageDiv.cloneNode(true));
        originalContainer.scrollTop = originalContainer.scrollHeight;
    }
    
    // Append to slide-over container if open
    if (slideOverContainer && chatSlideOverOpen) {
        slideOverContainer.appendChild(messageDiv);
        
        // Auto-scroll only if user is near bottom
        if (chatIsNearBottom) {
            scrollChatToBottom(slideOverContainer);
        }
    }
    
    // Setup scroll monitor for slide-over
    if (slideOverContainer && !slideOverContainer._scrollMonitorSetup) {
        setupChatScrollMonitor(slideOverContainer);
        slideOverContainer._scrollMonitorSetup = true;
    }
}

// Send message from slide-over
function sendChatMessageFromSlideOver() {
    const input = document.getElementById('chatSlideOverInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Use the same send function but clear slide-over input
    sendChatMessageInternal(message);
    input.value = '';
}

// Refactored send message to work with both inputs
function sendChatMessageInternal(message) {
    // Use selectedTeamId or currentTeamId, whichever is available
    const teamId = selectedTeamId || currentTeamId;
    if (!message || !teamId) {
        alert('Please select a team first to send messages.');
        return;
    }
    
    // Optimistic update: show message immediately
    const optimisticMessage = {
        message: message,
        user_name: user.name,
        user_role: user.role,
        created_at: new Date().toISOString()
    };
    lastOptimisticMessage = { message: message, user_name: user.name, timestamp: Date.now() };
    appendChatMessage(optimisticMessage);
    
    fetch(`${API_URL}/api/shared/teams/${teamId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to send message');
        
        // Get the actual message from the response if available
        return response.json().then(data => {
            // The API might return the created message
            if (data.message) {
                // Remove optimistic message and add the real one
                // (or just update it - for now we'll keep the optimistic one)
                // The socket event will also fire, but we'll handle duplicates
            }
            
            // Emit socket event
            if (socket) {
                socket.emit('send_message', {
                    teamId: teamId,
                    message: message,
                    userName: user.name,
                    userRole: user.role
                });
            }
        });
    })
    .catch(error => {
        // Remove optimistic message on error
        const originalContainer = document.getElementById('teamChatMessages');
        const slideOverContainer = document.getElementById('chatSlideOverMessages');
        
        if (originalContainer && originalContainer.lastChild) {
            originalContainer.removeChild(originalContainer.lastChild);
        }
        if (slideOverContainer && slideOverContainer.lastChild) {
            slideOverContainer.removeChild(slideOverContainer.lastChild);
        }
        
        alert('Error sending message: ' + error.message);
    });
}

// Update original sendChatMessage to use internal function
async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    if (!input) return;
    
    const message = input.value.trim();
    sendChatMessageInternal(message);
    input.value = '';
}

// ========== CHAT SECTION COLLAPSE ==========

function toggleChatSection() {
    const container = document.getElementById('teamChatContainer');
    const caret = document.getElementById('chatSectionCaret');
    
    if (!container || !caret) return;
    
    const isCollapsed = container.style.display === 'none';
    
    if (isCollapsed) {
        container.style.display = 'block';
        caret.style.transform = 'rotate(0deg)';
    } else {
        container.style.display = 'none';
        caret.style.transform = 'rotate(-90deg)';
    }
}

// ========== QUICK JUMP ==========

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) {
        // Try to find section by class or other means
        console.warn(`Section ${sectionId} not found`);
        return;
    }
    
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToTab(tabName) {
    // If a team is selected, switch to that tab
    if (selectedTeamId) {
        switchTab(tabName);
        // Scroll the selected team panel into view
        const panel = document.getElementById('selectedTeamPanel');
        if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else {
        // Otherwise, just scroll to class details section
        scrollToSection('classDetailsSection');
    }
}

// ========== KEYBOARD SHORTCUTS & DEEP LINKS ==========

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only handle if not typing in an input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // C key to toggle chat
        if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            toggleChatSlideOver();
        }
        
        // ESC to close chat slide-over
        if (e.key === 'Escape' && chatSlideOverOpen) {
            closeChatSlideOver();
        }
    });
}

function setupDeepLinks() {
    // Check hash on load - but only open if team is selected
    if (window.location.hash === '#chat') {
        // Delay to ensure DOM is ready and team might be loaded
        setTimeout(() => {
            const teamId = selectedTeamId || currentTeamId;
            if (teamId) {
                openChatSlideOver();
            } else {
                // Remove hash if no team is selected
                window.history.replaceState(null, '', window.location.pathname);
            }
        }, 500);
    }
    
    // Handle hash changes
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#chat' && !chatSlideOverOpen) {
            const teamId = selectedTeamId || currentTeamId;
            if (teamId) {
                openChatSlideOver();
            } else {
                alert('Please select a team first to use the chat.');
                window.history.replaceState(null, '', window.location.pathname);
            }
        } else if (window.location.hash !== '#chat' && chatSlideOverOpen) {
            closeChatSlideOver();
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
            <div class="tdb-empty-state">
                <i class="fas fa-book tdb-empty-state-icon"></i>
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
            <div class="tdb-card tdb-metric-card" onclick="openClassDetails(${cls.id})" style="cursor: pointer;">
                <h3 style="margin: 0 0 8px 0;">${cls.name}</h3>
                <p style="color: #6b7280; font-size: 0.875rem; margin-bottom: 12px;">${cls.description || 'No description'}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; color: #6b7280; margin-top: auto;">
                    <div>
                        <i class="fas fa-users"></i> ${cls.team_count || 0} teams
                    </div>
                    ${isExpired ? '<span class="tdb-status-pill tdb-status-pill-red">Expired</span>' : daysLeft !== null && daysLeft <= 7 ? `<span class="tdb-status-pill tdb-status-pill-yellow">${daysLeft} days left</span>` : ''}
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
    selectedTeamId = null; // Reset selected team
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/classes/${classId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load class');
        
        const data = await response.json();
        
        // Hide overview, show class details
        document.getElementById('overviewSection').style.display = 'none';
        document.getElementById('classDetailsSection').style.display = 'block';
        
        // Update header
        document.getElementById('tdbHeaderTitle').textContent = data.class.name;
        document.getElementById('tdbBreadcrumbSeparator').style.display = 'inline';
        document.getElementById('tdbBreadcrumbClass').textContent = data.class.name;
        document.getElementById('tdbBreadcrumbClass').style.display = 'inline';
        document.getElementById('tdbNewClassBtn').style.display = 'none';
        document.getElementById('tdbNewTeamBtn').style.display = 'inline-flex';
        
        // Update class details
        document.getElementById('classDetailsName').textContent = data.class.name;
        document.getElementById('classDetailsDescription').textContent = data.class.description || 'No description';
        
        // Render class overview metrics
        renderClassOverviewMetrics(data);
        
        // Store teams data for filtering
        currentTeamsData = data.teams;
        
        // Render teams
        renderClassTeams(data.teams);
        
        // Hide selected team panel
        document.getElementById('selectedTeamPanel').classList.remove('active');
        
        // Show aside sections
        document.getElementById('filtersSection').style.display = 'block';
        document.getElementById('aiInsightsSection').style.display = 'block';
        document.getElementById('recentActivitySection').style.display = 'block';
        document.getElementById('asideNewTeamBtn').style.display = 'block';
        document.getElementById('asideNewTaskBtn').style.display = 'none';
        document.getElementById('asideAddStudentBtn').style.display = 'none';
        
        // Initialize progress tracker
        initializeProgressTracker();
        
        // Populate aside sections
        populateAIInsights(data);
        populateRecentActivity(data);
        
    } catch (error) {
        console.error('Error loading class:', error);
        alert('Error loading class details');
    }
}

function renderClassTeams(teams) {
    const teamsContainer = document.getElementById('classTeamsContainer');
    
    if (teams.length === 0) {
        teamsContainer.innerHTML = `
            <div class="tdb-empty-state">
                <i class="fas fa-users tdb-empty-state-icon"></i>
                <h3>No teams yet</h3>
                <p>Create your first team for this class!</p>
            </div>
        `;
        return;
    }
    
    teamsContainer.innerHTML = teams.map(team => {
        const progress = team.total_tasks > 0 ? (team.completed_tasks / team.total_tasks) * 100 : 0;
        const isSelected = selectedTeamId === team.id;
        // Determine risk level (simplified - can be enhanced with AI data)
        let riskLevel = 'green';
        if (progress < 50) riskLevel = 'red';
        else if (progress < 75) riskLevel = 'yellow';
        
        return `
            <div class="tdb-team-card ${isSelected ? 'active' : ''}" onclick="selectTeam(${team.id})" data-team-id="${team.id}" data-risk="${riskLevel}">
                <div class="tdb-team-header">
                    <div style="flex: 1;">
                        <h3 class="tdb-team-name">${team.name}</h3>
                        <div class="tdb-team-meta">
                            <span><i class="fas fa-users"></i> ${team.member_count} members</span>
                            <span><i class="fas fa-tasks"></i> ${team.completed_tasks}/${team.total_tasks} tasks</span>
                        </div>
                    </div>
                    <div class="tdb-team-actions" onclick="event.stopPropagation();">
                        <button onclick="openTeamManagement(${team.id})" class="tdb-btn tdb-btn-secondary tdb-btn-small">
                            <i class="fas fa-cog"></i> Manage
                        </button>
                        <button onclick="openTeamDashboard(${team.id})" class="tdb-btn tdb-btn-primary tdb-btn-small">
                            <i class="fas fa-chart-line"></i> Dashboard
                        </button>
                    </div>
                </div>
                <div class="tdb-progress">
                    <span style="width: ${progress}%;"></span>
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
    selectedTeamId = null;
    
    // Reset header
    document.getElementById('tdbHeaderTitle').textContent = 'Teacher Dashboard';
    document.getElementById('tdbBreadcrumbSeparator').style.display = 'none';
    document.getElementById('tdbBreadcrumbClass').style.display = 'none';
    document.getElementById('tdbNewClassBtn').style.display = 'inline-flex';
    document.getElementById('tdbNewTeamBtn').style.display = 'none';
    
    // Hide selected team panel
    document.getElementById('selectedTeamPanel').classList.remove('active');
    
    // Hide aside sections
    document.getElementById('filtersSection').style.display = 'none';
    document.getElementById('aiInsightsSection').style.display = 'none';
    document.getElementById('recentActivitySection').style.display = 'none';
    document.getElementById('asideNewTeamBtn').style.display = 'none';
    document.getElementById('asideNewTaskBtn').style.display = 'none';
    document.getElementById('asideAddStudentBtn').style.display = 'none';
    document.getElementById('shortcutViewDashboard').style.display = 'none';
    document.getElementById('shortcutManageTeam').style.display = 'none';
    document.getElementById('shortcutExport').style.display = 'none';
    
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
        
        // Refresh class details to show new team
        if (currentClassId === classId) {
            openClassDetails(classId);
        } else {
            openClassDetails(classId);
        }
        
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
        
        // Join socket room
        socket.emit('join_team', teamId);
        
        openModal('teamManagementModal');
        
        // Load team files AFTER modal is opened (for modal)
        if (teamId) {
            // Small delay to ensure modal is fully rendered
            setTimeout(() => {
                loadTeamFiles(teamId);
            }, 100);
        }
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

// Show team selection modal for task creation
function showTeamSelectionForTask() {
    // Check if a team is already selected
    const teamId = selectedTeamId || currentTeamId;
    if (teamId) {
        // Team is already selected, go directly to create task form
        selectTeamAndShowTaskForm(teamId);
        return;
    }
    
    // No team selected, show team selection modal
    loadTeamsForSelection();
    openModal('teamSelectionModal');
}

// Load teams for selection in the modal
async function loadTeamsForSelection() {
    const teamListContainer = document.getElementById('teamSelectionList');
    if (!teamListContainer) return;
    
    teamListContainer.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">Loading teams...</p>';
    
    try {
        // Get all classes and their teams
        const response = await fetch(`${API_URL}/api/teacher/classes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to load classes');
        }
        
        const data = await response.json();
        // API returns { classes: [...] }, not array directly
        const classes = data.classes || data || [];
        const allTeams = [];
        
        // Collect teams from all classes
        for (const classItem of classes) {
            try {
                // Use the class details endpoint which includes teams
                const classResponse = await fetch(`${API_URL}/api/teacher/classes/${classItem.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (classResponse.ok) {
                    const classData = await classResponse.json();
                    // API returns { class: {...}, teams: [...] }
                    const teams = classData.teams || [];
                    if (Array.isArray(teams)) {
                        teams.forEach(team => {
                            allTeams.push({
                                ...team,
                                className: classItem.name,
                                classId: classItem.id
                            });
                        });
                    }
                } else {
                    // Log but don't fail completely if one class fails
                    const errorText = await classResponse.text();
                    console.warn(`Failed to load class ${classItem.id}:`, errorText);
                }
            } catch (error) {
                console.error(`Error loading class ${classItem.id}:`, error);
            }
        }
        
        if (allTeams.length === 0) {
            teamListContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <i class="fas fa-users" style="font-size: 3rem; color: #d1d5db; margin-bottom: 1rem;"></i>
                    <p style="color: #6b7280;">No teams found. Create a team first!</p>
                </div>
            `;
            return;
        }
        
        // Render team list
        teamListContainer.innerHTML = allTeams.map(team => {
            const progress = team.total_tasks > 0 ? (team.completed_tasks / team.total_tasks) * 100 : 0;
            const safeTeamName = (team.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `
                <div class="tdb-team-card" onclick="selectTeamForTask(${team.id}, ${team.classId}, '${safeTeamName}')" style="cursor: pointer; margin-bottom: 12px;">
                    <div class="tdb-team-header">
                        <div style="flex: 1;">
                            <h3 class="tdb-team-name">${team.name}</h3>
                            <div class="tdb-team-meta">
                                <span><i class="fas fa-graduation-cap"></i> ${team.className}</span>
                                <span><i class="fas fa-users"></i> ${team.member_count} members</span>
                                <span><i class="fas fa-tasks"></i> ${team.completed_tasks}/${team.total_tasks} tasks</span>
                            </div>
                        </div>
                        <div class="tdb-team-progress">
                            <div class="tdb-progress-bar">
                                <div class="tdb-progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <span class="tdb-progress-text">${Math.round(progress)}%</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading teams:', error);
        teamListContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #ef4444;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Error loading teams: ${error.message || 'Please try again.'}</p>
                <button onclick="loadTeamsForSelection()" class="tdb-btn tdb-btn-primary tdb-btn-small" style="margin-top: 1rem;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Select team for task creation
function selectTeamForTask(teamId, classId, teamName) {
    // Set the selected team
    selectedTeamId = teamId;
    currentTeamId = teamId;
    localStorage.setItem('selectedTeamId', teamId.toString());
    
    // Close the team selection modal
    closeModal('teamSelectionModal');
    
    // If class details section is not visible, open the class first
    const classDetailsSection = document.getElementById('classDetailsSection');
    if (classDetailsSection && classDetailsSection.style.display === 'none') {
        // Open the class that contains this team
        openClassDetails(classId).then(() => {
            // After class is loaded, select the team and show task form
            selectTeamAndShowTaskForm(teamId);
        });
    } else {
        // Class is already open, just select the team and show task form
        selectTeamAndShowTaskForm(teamId);
    }
}

// Helper function to select team and show task form
function selectTeamAndShowTaskForm(teamId) {
    // Select the team (this will load team data and show the panel)
    selectTeam(teamId).then(() => {
        // Switch to tasks tab
        switchTab('tasks');
        
        // Scroll to the create task form
        setTimeout(() => {
            showCreateTaskForm();
            // Scroll the form into view
            const formContainer = document.getElementById('createTaskFormContainer');
            if (formContainer) {
                formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 500);
    });
}

function showCreateTaskForm() {
    const formContainer = document.getElementById('createTaskFormContainer');
    if (formContainer) {
        formContainer.style.display = 'block';
        
        // Load team members for assignment dropdown if team is selected
        const teamId = selectedTeamId || currentTeamId;
        if (teamId) {
            loadTeamMembersForTask(teamId);
        }
    }
}

function hideCreateTaskForm() {
    const formContainer = document.getElementById('createTaskFormContainer');
    if (formContainer) {
        formContainer.style.display = 'none';
        const form = document.getElementById('createTaskForm');
        if (form) {
            form.reset();
        }
    }
}

// Load team members for the task assignment dropdown
async function loadTeamMembersForTask(teamId) {
    const assignSelect = document.getElementById('taskAssignedTo');
    if (!assignSelect) return;
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/teams/${teamId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        assignSelect.innerHTML = '<option value="">All team members</option>' +
            data.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading team members:', error);
    }
}

async function createTask(e) {
    e.preventDefault();
    
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const assignedTo = document.getElementById('taskAssignedTo').value;
    const teamId = selectedTeamId || currentTeamId;
    
    if (!teamId) {
        alert('Please select a team first');
        return;
    }
    
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
                teamId: teamId,
                assignedTo: assignedTo || null
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create task');
        }
        
        hideCreateTaskForm();
        
        // Refresh selected team panel if open, otherwise refresh modal
        if (selectedTeamId) {
            selectTeam(selectedTeamId);
        } else if (currentTeamId) {
            openTeamManagement(currentTeamId);
        }
        
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
        const originalContainer = document.getElementById('teamChatMessages');
        const slideOverContainer = document.getElementById('chatSlideOverMessages');
        
        // Clear both containers
        if (originalContainer) {
            originalContainer.innerHTML = '';
        }
        if (slideOverContainer) {
            slideOverContainer.innerHTML = '';
        }
        
        if (messages.length === 0) {
            const emptyMsg = '<p style="color: #6b7280; text-align: center;">No messages yet</p>';
            if (originalContainer) originalContainer.innerHTML = emptyMsg;
            if (slideOverContainer && chatSlideOverOpen) slideOverContainer.innerHTML = emptyMsg;
        } else {
            messages.forEach(msg => {
                appendChatMessage(msg);
            });
            
            // Scroll to bottom
            if (originalContainer) {
                originalContainer.scrollTop = originalContainer.scrollHeight;
            }
            if (slideOverContainer && chatSlideOverOpen) {
                scrollChatToBottom(slideOverContainer);
            }
        }
    } catch (error) {
        console.error('Error loading chat:', error);
    }
}

async function loadTeamFiles(teamId) {
    if (!teamId) {
        console.warn('loadTeamFiles called without teamId');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${teamId}/files`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load files');
        
        const data = await response.json();
        console.log('Files API response:', data); // Debug log
        
        // Handle different response structures - API returns {files: [...]}
        const files = data.files || (Array.isArray(data) ? data : []);
        console.log('Files to render:', files, 'Type:', typeof files, 'Is Array:', Array.isArray(files)); // Debug log
        
        // Ensure files is an array
        const filesArray = Array.isArray(files) ? files : [];
        
        // Render to both panel and modal if they exist (so files show in whichever is visible)
        const panelFilesList = document.getElementById('teamFilesListPanel');
        const modalFilesList = document.getElementById('teamFilesList');
        
        if (panelFilesList) {
            renderFilesToContainer(filesArray, panelFilesList);
        }
        
        if (modalFilesList) {
            renderFilesToContainer(filesArray, modalFilesList);
        }
        
        // Setup file upload handler for panel (new layout) and modal (old layout)
        const fileInputPanel = document.getElementById('teamFileInputPanel');
        const fileInputModal = document.getElementById('teamFileInput');
        
        const setupFileInput = (fileInput) => {
            if (fileInput) {
                // Remove old handler if any
                fileInput.onchange = null;
                // Add new handler with current teamId
                fileInput.onchange = async (e) => {
                    const uploadTeamId = selectedTeamId || currentTeamId || teamId;
                    if (uploadTeamId && e.target.files && e.target.files.length > 0) {
                        await uploadTeamFiles(uploadTeamId, e.target.files);
                        e.target.value = ''; // Reset input
                    }
                };
            }
        };
        
        // Setup both if they exist
        setupFileInput(fileInputPanel);
        setupFileInput(fileInputModal);
        
    } catch (error) {
        console.error('Error loading files:', error);
        // Show error in files list (try panel first, then modal)
        let filesList = document.getElementById('teamFilesListPanel');
        if (!filesList) {
            filesList = document.getElementById('teamFilesList');
        }
        if (filesList) {
            filesList.innerHTML = `<p style="color: #ef4444; padding: 12px;">Error loading files: ${error.message}</p>`;
        }
    }
}

// Handle file upload button click
function handleFileUploadClick() {
    // Try panel input first (new layout), then modal input (old layout)
    let fileInput = document.getElementById('teamFileInputPanel');
    if (!fileInput) {
        fileInput = document.getElementById('teamFileInput');
    }
    
    if (!fileInput) {
        console.error('teamFileInput not found (neither panel nor modal)');
        return;
    }
    
    // Make sure we have a team selected
    const uploadTeamId = selectedTeamId || currentTeamId;
    if (!uploadTeamId) {
        alert('Please select a team first');
        return;
    }
    
    // Setup the handler if not already set
    if (!fileInput.onchange) {
        fileInput.onchange = async (e) => {
            if (e.target.files && e.target.files.length > 0) {
                await uploadTeamFiles(uploadTeamId, e.target.files);
                e.target.value = ''; // Reset input
            }
        };
    }
    
    // Trigger file picker
    fileInput.click();
}

function renderTeamFiles(files, teamId = null) {
    // Always render to both panel and modal containers if they exist
    const panelFilesList = document.getElementById('teamFilesListPanel');
    const modalFilesList = document.getElementById('teamFilesList');
    
    // Ensure files is an array - handle {files: [...]} structure
    let filesArray = files;
    if (files && typeof files === 'object' && !Array.isArray(files)) {
        filesArray = files.files || [];
    }
    
    if (!Array.isArray(filesArray)) {
        filesArray = [];
    }
    
    console.log('renderTeamFiles called - Files array length:', filesArray.length, 'Panel exists:', !!panelFilesList, 'Modal exists:', !!modalFilesList);
    
    // Render to panel if it exists
    if (panelFilesList) {
        renderFilesToContainer(filesArray, panelFilesList);
    }
    
    // Render to modal if it exists
    if (modalFilesList) {
        renderFilesToContainer(filesArray, modalFilesList);
    }
}

// Helper function to render files to a specific container
function renderFilesToContainer(filesArray, container) {
    if (!container) return;
    
    if (!filesArray || !Array.isArray(filesArray) || filesArray.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 1rem;">No files uploaded yet</p>';
        return;
    }
    
    container.innerHTML = filesArray.map(file => {
        // Escape filename for use in onclick - handle more special characters
        const safeFilename = (file.filename || file.name || 'file')
            .replace(/'/g, "\\'")
            .replace(/"/g, '&quot;')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '');
        
        const fileId = file.id || file.file_id || 0;
        const fileName = file.filename || file.name || 'Unknown file';
        const uploadedBy = file.uploaded_by_name || file.uploaded_by || 'Unknown';
        // API returns created_at, not uploaded_at
        const uploadedAt = file.created_at || file.uploaded_at || file.upload_date || new Date().toISOString();
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                    <i class="fas fa-file" style="color: #3b82f6; font-size: 1.5rem;"></i>
                    <div>
                        <div style="font-weight: 500;">${fileName}</div>
                        <div style="font-size: 0.875rem; color: #6b7280;">
                            Uploaded by ${uploadedBy} • ${new Date(uploadedAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>
                <button onclick="downloadFile(${fileId}, '${safeFilename}')" class="tdb-btn tdb-btn-secondary tdb-btn-small" title="Download ${safeFilename}">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;
    }).join('');
    
    console.log('Files rendered successfully to container:', container.id || 'unknown'); // Debug log
}

async function uploadTeamFiles(teamId, files) {
    if (!teamId) {
        alert('No team selected');
        return;
    }
    
    if (!files || files.length === 0) {
        console.warn('No files to upload');
        return;
    }
    
    try {
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${API_URL}/api/shared/teams/${teamId}/files`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to upload ${file.name}`);
            }
        }
        
        // Reload files after successful upload
        await loadTeamFiles(teamId);
        
        // If Files tab is not active, switch to it so user can see the uploaded files
        const filesTab = document.getElementById('tab-files');
        if (filesTab && filesTab.getAttribute('aria-hidden') === 'true') {
            switchTab('files');
        }
        
        alert('Files uploaded successfully!');
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Error uploading files: ' + error.message);
    }
}

async function downloadFile(fileId, filename) {
    if (!selectedTeamId && !currentTeamId) {
        alert('No team selected');
        return;
    }
    
    const teamId = selectedTeamId || currentTeamId;
    
    try {
        const response = await fetch(`${API_URL}/api/shared/teams/${teamId}/files/${fileId}`, {
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
        console.error('Download error:', error);
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

// ========== NEW LAYOUT FUNCTIONS ==========

// Select a team and show the panel
async function selectTeam(teamId) {
    selectedTeamId = teamId;
    currentTeamId = teamId; // Also set for backward compatibility
    localStorage.setItem('selectedTeamId', teamId.toString());
    
    // Update team cards to show selected state
    document.querySelectorAll('.tdb-team-card').forEach(card => {
        if (parseInt(card.dataset.teamId) === teamId) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
    
    // Show selected team panel
    const panel = document.getElementById('selectedTeamPanel');
    panel.classList.add('active');
    
    // Load team data
    try {
        const response = await fetch(`${API_URL}/api/teacher/teams/${teamId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load team');
        
        const data = await response.json();
        
        // Update panel title
        document.getElementById('selectedTeamName').textContent = data.team.name;
        
        // Render members
        renderSelectedTeamMembers(data.members);
        
        // Render tasks
        renderSelectedTeamTasks(data.tasks, data.members);
        
        // Load submissions
        renderSelectedTeamSubmissions(data.tasks);
        
        // Switch to Members tab by default
        switchTab('members');
        
        // Load chat for this team
        if (teamId) {
            loadTeamChat(teamId);
        }
        
        // Load files - make sure we're loading for the selected team
        if (teamId) {
            // Load files immediately but Files tab will reload when switched to
            loadTeamFiles(teamId);
        }
        
        // Update aside buttons
        document.getElementById('asideNewTaskBtn').style.display = 'block';
        document.getElementById('asideAddStudentBtn').style.display = 'block';
        document.getElementById('shortcutViewDashboard').style.display = 'block';
        document.getElementById('shortcutManageTeam').style.display = 'block';
        document.getElementById('shortcutExport').style.display = 'block';
        
        // Join socket room
        if (socket) {
            socket.emit('join_team', teamId);
        }
        
        // Scroll panel into view
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch (error) {
        console.error('Error loading team:', error);
        alert('Error loading team details');
    }
}

// Switch tabs in selected team panel
function switchTab(tabName) {
    // Update tab buttons
    ['members', 'tasks', 'submissions', 'files'].forEach(tab => {
        const btn = document.getElementById(`tab-btn-${tab}`);
        const panel = document.getElementById(`tab-${tab}`);
        
        if (!btn || !panel) {
            console.warn(`Tab ${tab} not found`);
            return;
        }
        
        if (tab === tabName) {
            btn.setAttribute('aria-selected', 'true');
            panel.setAttribute('aria-hidden', 'false');
            panel.style.display = 'block'; // Ensure panel is visible
            
            // Reload files when switching to Files tab
            if (tab === 'files' && selectedTeamId) {
                console.log('Switching to Files tab, loading files for team:', selectedTeamId);
                loadTeamFiles(selectedTeamId);
            }
        } else {
            btn.setAttribute('aria-selected', 'false');
            panel.setAttribute('aria-hidden', 'true');
            panel.style.display = 'none'; // Hide other panels
        }
    });
}

// Render class overview metrics
function renderClassOverviewMetrics(data) {
    const metricsContainer = document.getElementById('classOverviewMetrics');
    const totalTeams = data.teams.length;
    const totalMembers = data.teams.reduce((sum, t) => sum + (t.member_count || 0), 0);
    const totalTasks = data.teams.reduce((sum, t) => sum + (t.total_tasks || 0), 0);
    const completedTasks = data.teams.reduce((sum, t) => sum + (t.completed_tasks || 0), 0);
    const avgProgress = totalTeams > 0 ? data.teams.reduce((sum, t) => {
        const progress = t.total_tasks > 0 ? (t.completed_tasks / t.total_tasks) * 100 : 0;
        return sum + progress;
    }, 0) / totalTeams : 0;
    
    metricsContainer.innerHTML = `
        <div class="tdb-metric-card">
            <div class="tdb-metric-value">${totalTeams}</div>
            <div class="tdb-metric-label">Total Teams</div>
        </div>
        <div class="tdb-metric-card">
            <div class="tdb-metric-value">${totalMembers}</div>
            <div class="tdb-metric-label">Total Members</div>
        </div>
        <div class="tdb-metric-card">
            <div class="tdb-metric-value">${completedTasks}/${totalTasks}</div>
            <div class="tdb-metric-label">Tasks Completed</div>
        </div>
        <div class="tdb-metric-card">
            <div class="tdb-metric-value">${Math.round(avgProgress)}%</div>
            <div class="tdb-metric-label">Average Progress</div>
        </div>
    `;
}

// Populate AI Insights
function populateAIInsights(data) {
    const insightsList = document.getElementById('aiInsightsList');
    const insights = [];
    
    // Generate insights from team data
    data.teams.forEach(team => {
        const progress = team.total_tasks > 0 ? (team.completed_tasks / team.total_tasks) * 100 : 0;
        if (progress < 50) {
            insights.push({
                team: team.name,
                message: `${team.name} is at risk - only ${Math.round(progress)}% complete`
            });
        }
    });
    
    if (insights.length === 0) {
        insightsList.innerHTML = '<p style="color: #6b7280; font-size: 0.875rem; padding: 12px;">No risk alerts at this time</p>';
        return;
    }
    
    insightsList.innerHTML = insights.slice(0, 3).map(insight => `
        <div class="tdb-insight-item">
            <strong>${insight.team}</strong>
            <p style="margin: 4px 0 0 0; font-size: 0.8125rem;">${insight.message}</p>
        </div>
    `).join('');
}

// Populate Recent Activity
function populateRecentActivity(data) {
    const activityList = document.getElementById('recentActivityList');
    const activities = [];
    
    // Collect activities from teams
    data.teams.forEach(team => {
        activities.push({
            type: 'team',
            message: `Team "${team.name}" created`,
            time: new Date().toLocaleDateString()
        });
    });
    
    if (activities.length === 0) {
        activityList.innerHTML = '<p style="color: #6b7280; font-size: 0.875rem; padding: 12px;">No recent activity</p>';
        return;
    }
    
    activityList.innerHTML = activities.slice(0, 5).map(activity => `
        <div class="tdb-activity-item">
            <div>${activity.message}</div>
            <div class="tdb-activity-time">${activity.time}</div>
        </div>
    `).join('');
}

// Render selected team members
function renderSelectedTeamMembers(members) {
    const membersList = document.getElementById('selectedTeamMembersList');
    
    if (members.length === 0) {
        membersList.innerHTML = '<p style="color: #6b7280; padding: 12px;">No members yet</p>';
        return;
    }
    
    membersList.innerHTML = members.map(m => `
        <div style="padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>${m.name}</strong>
                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 0.875rem;">${m.email}</p>
            </div>
            <button onclick="removeMember(${selectedTeamId}, ${m.id})" class="tdb-btn tdb-btn-danger tdb-btn-small">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// Render selected team tasks
function renderSelectedTeamTasks(tasks, members) {
    const tasksList = document.getElementById('selectedTeamTasksList');
    
    // Populate assign-to dropdown
    const assignSelect = document.getElementById('taskAssignedTo');
    assignSelect.innerHTML = '<option value="">All team members</option>' +
        members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    
    if (tasks.length === 0) {
        tasksList.innerHTML = '<p style="color: #6b7280; padding: 12px;">No tasks yet</p>';
        return;
    }
    
    tasksList.innerHTML = tasks.map(t => {
        const statusClass = t.status === 'completed' ? 'tdb-status-pill-green' : t.status === 'in_progress' ? 'tdb-status-pill-yellow' : 'tdb-status-pill';
        return `
            <div style="padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 8px 0;">${t.title}</h4>
                        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 0.875rem;">${t.description || 'No description'}</p>
                        <div style="display: flex; gap: 12px; font-size: 0.875rem; color: #6b7280;">
                            <span><i class="fas fa-calendar"></i> ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'}</span>
                            ${t.assigned_to_name ? `<span><i class="fas fa-user"></i> ${t.assigned_to_name}</span>` : '<span><i class="fas fa-users"></i> Team task</span>'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button onclick="viewTaskSubmissions(${t.id})" class="tdb-btn tdb-btn-secondary tdb-btn-small" title="View submissions">
                            <i class="fas fa-eye"></i>
                        </button>
                        <span class="tdb-status-pill ${statusClass}">${t.status.replace('_', ' ')}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render selected team submissions
function renderSelectedTeamSubmissions(tasks) {
    const submissionsList = document.getElementById('selectedTeamSubmissionsList');
    // This would need to fetch submissions - for now show placeholder
    submissionsList.innerHTML = '<p style="color: #6b7280; padding: 12px;">Select a task to view submissions</p>';
}

// Toggle collapsible section
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const content = section.querySelector('.tdb-aside-section-header + *');
    const btn = section.querySelector('.tdb-collapse-btn i');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.classList.remove('fa-chevron-down');
        btn.classList.add('fa-chevron-up');
        localStorage.setItem(`section_${sectionId}`, 'open');
    } else {
        content.style.display = 'none';
        btn.classList.remove('fa-chevron-up');
        btn.classList.add('fa-chevron-down');
        localStorage.setItem(`section_${sectionId}`, 'closed');
    }
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('tdbSearch').value.toLowerCase();
    const filterRiskGreen = document.getElementById('filterRiskGreen')?.checked;
    const filterRiskYellow = document.getElementById('filterRiskYellow')?.checked;
    const filterRiskRed = document.getElementById('filterRiskRed')?.checked;
    const filterOverdue = document.getElementById('filterOverdue')?.checked;
    
    const teamCards = document.querySelectorAll('.tdb-team-card');
    
    teamCards.forEach(card => {
        const teamName = card.querySelector('.tdb-team-name').textContent.toLowerCase();
        const risk = card.dataset.risk;
        let show = true;
        
        // Search filter
        if (searchTerm && !teamName.includes(searchTerm)) {
            show = false;
        }
        
        // Risk filter
        if (show && (filterRiskGreen || filterRiskYellow || filterRiskRed)) {
            if (risk === 'green' && !filterRiskGreen) show = false;
            if (risk === 'yellow' && !filterRiskYellow) show = false;
            if (risk === 'red' && !filterRiskRed) show = false;
        }
        
        // Overdue filter (simplified - would need due date data)
        // if (show && filterOverdue) { ... }
        
        card.style.display = show ? 'block' : 'none';
    });
}

// Helper: Add member to team
async function addMemberToTeam(teamId, email) {
    if (!teamId) return;
    
    try {
        const response = await fetch(`${API_URL}/api/teacher/teams/${teamId}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ studentEmail: email })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to add member');
        }
        
        // Refresh team data
        selectTeam(teamId);
        alert('Student added successfully!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Helper: Add member to selected team (for aside button)
function addMemberToSelectedTeam() {
    const email = prompt('Enter student email:');
    if (email) {
        addMemberToTeam(selectedTeamId, email);
    }
}

// Export class data
function exportClassData() {
    // Placeholder - would generate CSV from currentTeamsData
    alert('Export functionality coming soon!');
}

// ========== UTILITY ==========

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedTeamId');
    window.location.href = '/';
}

