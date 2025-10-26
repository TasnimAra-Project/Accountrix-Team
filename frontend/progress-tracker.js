/**
 * Progress Tracker - AI-based team progress visualization
 * Displays heatmaps, sparklines, and insights for teacher dashboard
 */

class ProgressTracker {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            apiUrl: options.apiUrl || 'http://localhost:3000/api/progress',
            socket: options.socket || null,
            onTeamClick: options.onTeamClick || null,
            ...options
        };
        
        this.teamsData = [];
        this.currentClassId = null;
    }

    /**
     * Initialize the progress tracker
     */
    async initialize(classId) {
        this.currentClassId = classId;
        await this.loadProgress();
        this.setupSocketListeners();
    }

    /**
     * Load progress data for all teams in a class
     */
    async loadProgress() {
        try {
            this.showLoading();

            const token = localStorage.getItem('token');
            const response = await fetch(
                `${this.options.apiUrl}/teacher/classes/${this.currentClassId}/progress`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load progress data');
            }

            const data = await response.json();
            this.teamsData = data.teams;
            this.renderHeatmap(data);

        } catch (error) {
            console.error('Error loading progress:', error);
            this.showError('Failed to load progress data');
        }
    }

    /**
     * Render the progress heatmap
     */
    renderHeatmap(data) {
        if (!this.container) return;

        const { teams, summary } = data;

        if (teams.length === 0) {
            this.showEmpty();
            return;
        }

        const html = `
            <div class="progress-tracker">
                <div class="progress-header">
                    <h2>Team Progress Overview</h2>
                    <div class="progress-summary">
                        <div class="summary-badge green">
                            <i class="fas fa-check-circle"></i>
                            <span>On Track: <span class="count">${summary.on_track || 0}</span></span>
                        </div>
                        <div class="summary-badge yellow">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Needs Attention: <span class="count">${summary.needs_attention || 0}</span></span>
                        </div>
                        <div class="summary-badge red">
                            <i class="fas fa-times-circle"></i>
                            <span>At Risk: <span class="count">${summary.at_risk || 0}</span></span>
                        </div>
                    </div>
                </div>
                <div class="progress-heatmap">
                    ${teams.map(team => this.renderTeamCard(team)).join('')}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachEventListeners();
        this.renderSparklines();
    }

    /**
     * Render individual team card
     */
    renderTeamCard(team) {
        const riskBand = team.risk_band || 'green';
        const progressScore = team.progress_score || 0;
        const riskReasons = team.risk_reasons || [];

        return `
            <div class="team-card risk-${riskBand}" data-team-id="${team.team_id}">
                <div class="team-card-header">
                    <h3 class="team-name">${team.team_name}</h3>
                    <span class="risk-badge ${riskBand}">${riskBand}</span>
                </div>

                <div class="progress-score">
                    <div class="score-circle">
                        <svg width="60" height="60">
                            <circle class="score-circle-bg" cx="30" cy="30" r="26"></circle>
                            <circle class="score-circle-progress ${riskBand}" 
                                    cx="30" cy="30" r="26"
                                    data-progress="${progressScore}"></circle>
                        </svg>
                        <div class="score-value">${progressScore}</div>
                    </div>
                    <div class="score-details">
                        <div class="score-label">Progress Score</div>
                        <div class="score-number">${progressScore}/100</div>
                    </div>
                </div>

                <div class="metrics-grid">
                    <div class="metric-item">
                        <span class="metric-value">${team.timeliness || 0}%</span>
                        <span class="metric-label">Timeliness</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${team.velocity || 0}</span>
                        <span class="metric-label">Velocity</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${team.engagement || 0}%</span>
                        <span class="metric-label">Engagement</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${team.completed_tasks || 0}/${team.total_tasks || 0}</span>
                        <span class="metric-label">Tasks</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${team.overdue_tasks || 0}</span>
                        <span class="metric-label">Overdue</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${team.active_members || 0}</span>
                        <span class="metric-label">Members</span>
                    </div>
                </div>

                <div class="sparkline-container">
                    <div class="sparkline-label">Last 4 Weeks Trend</div>
                    <svg class="sparkline" data-team-id="${team.team_id}"></svg>
                </div>

                ${riskReasons.length > 0 ? `
                    <div class="risk-reasons">
                        ${riskReasons.slice(0, 2).map(reason => `
                            <div class="risk-reason">
                                <i class="fas fa-exclamation-circle risk-reason-icon ${reason.severity}"></i>
                                <span class="risk-reason-text">${reason.message}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="team-actions">
                    <button class="btn-view-details" data-team-id="${team.team_id}">
                        <i class="fas fa-chart-line"></i> View Details
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render sparkline charts
     */
    renderSparklines() {
        this.teamsData.forEach(team => {
            if (team.history && team.history.length > 0) {
                const svg = this.container.querySelector(`svg.sparkline[data-team-id="${team.team_id}"]`);
                if (svg) {
                    this.drawSparkline(svg, team.history.map(h => h.progress));
                }
            }
        });

        // Animate progress circles
        this.container.querySelectorAll('.score-circle-progress').forEach(circle => {
            const progress = parseFloat(circle.dataset.progress);
            const circumference = 2 * Math.PI * 26; // r = 26
            const offset = circumference - (progress / 100) * circumference;
            
            circle.style.strokeDasharray = circumference;
            circle.style.strokeDashoffset = circumference;
            
            setTimeout(() => {
                circle.style.strokeDashoffset = offset;
            }, 100);
        });
    }

    /**
     * Draw sparkline chart
     */
    drawSparkline(svg, data) {
        if (!data || data.length === 0) return;

        const width = svg.clientWidth || 240;
        const height = 40;
        const padding = 4;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Filter out null/undefined values and convert to numbers
        const cleanData = data.map(v => v == null ? 0 : Number(v));
        
        const max = Math.max(...cleanData, 100);
        const min = Math.min(...cleanData, 0);
        const range = max - min || 1;

        const points = cleanData.map((value, index) => {
            const x = padding + (index / (cleanData.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((value - min) / range) * (height - 2 * padding);
            // Ensure no NaN values
            if (isNaN(x) || isNaN(y)) return '';
            return `${x},${y}`;
        }).filter(p => p).join(' ');

        // Create gradient
        const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;
        const gradient = `
            <defs>
                <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#007bff;stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:#007bff;stop-opacity:0" />
                </linearGradient>
            </defs>
        `;

        // Create area
        const areaPoints = `${padding},${height} ${points} ${width - padding},${height}`;
        
        svg.innerHTML = `
            ${gradient}
            <polyline points="${areaPoints}" fill="url(#${gradientId})" stroke="none"/>
            <polyline points="${points}" fill="none" stroke="#007bff" stroke-width="2"/>
            ${cleanData.map((value, index) => {
                const x = padding + (index / (cleanData.length - 1)) * (width - 2 * padding);
                const y = height - padding - ((value - min) / range) * (height - 2 * padding);
                // Skip if NaN
                if (isNaN(x) || isNaN(y)) return '';
                return `<circle cx="${x}" cy="${y}" r="2" fill="#007bff"/>`;
            }).join('')}
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        this.container.querySelectorAll('.btn-view-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const teamId = e.target.closest('button').dataset.teamId;
                this.showTeamDetails(teamId);
            });
        });
    }

    /**
     * Show detailed progress for a team
     */
    async showTeamDetails(teamId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${this.options.apiUrl}/teacher/teams/${teamId}/progress`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load team details');
            }

            const data = await response.json();
            this.renderDetailModal(data);

        } catch (error) {
            console.error('Error loading team details:', error);
            alert('Failed to load team details');
        }
    }

    /**
     * Render detail modal
     */
    renderDetailModal(data) {
        const modal = document.createElement('div');
        modal.className = 'progress-detail-modal active';
        modal.innerHTML = `
            <div class="progress-detail-content">
                <div class="progress-detail-header">
                    <h2>Detailed Progress Report</h2>
                    <button class="close-detail-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                ${data.current ? `
                    <div class="metrics-grid">
                        <div class="metric-item">
                            <span class="metric-value">${data.current.timeliness}%</span>
                            <span class="metric-label">Timeliness</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${data.current.velocity}</span>
                            <span class="metric-label">Velocity</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${data.current.engagement}%</span>
                            <span class="metric-label">Engagement</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${data.current.work_balance}%</span>
                            <span class="metric-label">Work Balance (Gini)</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${data.current.rework}%</span>
                            <span class="metric-label">Rework</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${data.current.scope_remaining}%</span>
                            <span class="metric-label">Remaining</span>
                        </div>
                    </div>

                    ${data.current.risk_reasons && data.current.risk_reasons.length > 0 ? `
                        <div class="risk-reasons">
                            <h3>Risk Analysis</h3>
                            ${data.current.risk_reasons.map(reason => `
                                <div class="risk-reason">
                                    <i class="fas fa-exclamation-circle risk-reason-icon ${reason.severity}"></i>
                                    <div class="risk-reason-text">
                                        <strong>${reason.message}</strong><br>
                                        <small>${reason.recommendation}</small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                ` : '<p>No data available</p>'}

                ${data.historical && data.historical.length > 0 ? `
                    <div class="historical-chart">
                        <h3 class="chart-title">Progress Over Time (Last 8 Weeks)</h3>
                        <svg class="detailed-sparkline" style="width: 100%; height: 200px;"></svg>
                    </div>
                ` : ''}

                ${data.insights && data.insights.length > 0 ? `
                    <div class="insights-list">
                        <h3>AI-Generated Insights</h3>
                        ${data.insights.map(insight => `
                            <div class="insight-item ${insight.severity}">
                                <div class="insight-title">${insight.title}</div>
                                <div class="insight-description">${insight.description}</div>
                                ${insight.recommendations && insight.recommendations.length > 0 ? `
                                    <div class="insight-recommendations">
                                        <h4>Recommendations:</h4>
                                        <ul>
                                            ${insight.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(modal);

        // Draw detailed chart
        if (data.historical && data.historical.length > 0) {
            const svg = modal.querySelector('.detailed-sparkline');
            this.drawDetailedChart(svg, data.historical);
        }

        // Close modal
        modal.querySelector('.close-detail-modal').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Draw detailed historical chart with interactivity
     */
    drawDetailedChart(svg, data) {
        const width = svg.clientWidth || 800;
        const height = 200;
        const padding = { top: 30, right: 20, bottom: 40, left: 50 };

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Clean data - convert to numbers and handle null/undefined
        const progressData = data.map(d => {
            const score = d.progress_score;
            return {
                value: score == null ? 0 : Number(score),
                week: d.week_start ? new Date(d.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'
            };
        });
        
        const max = 100;
        const min = 0;

        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Create points for the line
        const points = progressData.map((item, index) => {
            const x = padding.left + (index / (progressData.length - 1)) * chartWidth;
            const y = padding.top + ((max - item.value) / max) * chartHeight;
            if (isNaN(x) || isNaN(y)) return '';
            return `${x},${y}`;
        }).filter(p => p).join(' ');

        // Create gradient fill
        const gradientId = `chart-gradient-${Math.random().toString(36).substr(2, 9)}`;
        const areaPoints = `${padding.left},${height - padding.bottom} ${points} ${padding.left + chartWidth},${height - padding.bottom}`;

        svg.innerHTML = `
            <defs>
                <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#007bff;stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:#007bff;stop-opacity:0.05" />
                </linearGradient>
            </defs>
            
            <!-- Grid lines -->
            ${[0, 25, 50, 75, 100].map(val => {
                const y = padding.top + ((max - val) / max) * chartHeight;
                return `
                    <line x1="${padding.left}" y1="${y}" 
                          x2="${padding.left + chartWidth}" y2="${y}" 
                          stroke="#e5e7eb" stroke-width="1"/>
                    <text x="${padding.left - 10}" y="${y + 4}" 
                          text-anchor="end" font-size="10" fill="#6b7280">${val}</text>
                `;
            }).join('')}
            
            <!-- Axes -->
            <line x1="${padding.left}" y1="${padding.top}" 
                  x2="${padding.left}" y2="${height - padding.bottom}" 
                  stroke="#6b7280" stroke-width="2"/>
            <line x1="${padding.left}" y1="${height - padding.bottom}" 
                  x2="${width - padding.right}" y2="${height - padding.bottom}" 
                  stroke="#6b7280" stroke-width="2"/>
            
            <!-- Area fill -->
            <polyline points="${areaPoints}" fill="url(#${gradientId})" stroke="none"/>
            
            <!-- Progress line -->
            <polyline points="${points}" fill="none" stroke="#007bff" stroke-width="3"/>
            
            <!-- Data points and labels -->
            ${progressData.map((item, index) => {
                const x = padding.left + (index / (progressData.length - 1)) * chartWidth;
                const y = padding.top + ((max - item.value) / max) * chartHeight;
                if (isNaN(x) || isNaN(y)) return '';
                
                return `
                    <!-- Interactive circle -->
                    <circle cx="${x}" cy="${y}" r="6" fill="white" stroke="#007bff" stroke-width="2" 
                            class="chart-point" data-week="${item.week}" data-value="${Math.round(item.value)}"
                            style="cursor: pointer; transition: all 0.2s;"/>
                    
                    <!-- Week label -->
                    <text x="${x}" y="${height - padding.bottom + 20}" 
                          text-anchor="middle" font-size="9" fill="#6b7280">${item.week}</text>
                `;
            }).join('')}
            
            <!-- Axis labels -->
            <text x="${padding.left + chartWidth / 2}" y="${height - 5}" 
                  text-anchor="middle" font-size="12" fill="#374151" font-weight="600">Week</text>
            <text x="${15}" y="${padding.top + chartHeight / 2}" 
                  text-anchor="middle" font-size="12" fill="#374151" font-weight="600"
                  transform="rotate(-90 15 ${padding.top + chartHeight / 2})">Progress Score</text>
        `;

        // Add interactivity
        this.addChartInteractivity(svg, progressData);
    }

    /**
     * Add hover effects and tooltips to chart
     */
    addChartInteractivity(svg, data) {
        const points = svg.querySelectorAll('.chart-point');
        
        points.forEach((point, index) => {
            // Hover effect - enlarge point
            point.addEventListener('mouseenter', (e) => {
                point.setAttribute('r', '8');
                point.style.filter = 'drop-shadow(0 2px 4px rgba(0,123,255,0.4))';
                
                // Show tooltip
                this.showChartTooltip(e, data[index]);
            });
            
            point.addEventListener('mouseleave', (e) => {
                point.setAttribute('r', '6');
                point.style.filter = 'none';
                
                // Hide tooltip
                this.hideChartTooltip();
            });
            
            // Click to select week
            point.addEventListener('click', (e) => {
                this.selectWeek(data[index]);
            });
        });
    }

    /**
     * Show tooltip on hover
     */
    showChartTooltip(event, dataPoint) {
        // Remove existing tooltip
        this.hideChartTooltip();
        
        const tooltip = document.createElement('div');
        tooltip.id = 'chart-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            pointer-events: none;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        
        tooltip.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">${dataPoint.week}</div>
            <div>Progress: <strong>${Math.round(dataPoint.value)}/100</strong></div>
        `;
        
        tooltip.style.left = (event.pageX + 15) + 'px';
        tooltip.style.top = (event.pageY - 15) + 'px';
        
        document.body.appendChild(tooltip);
    }

    /**
     * Hide tooltip
     */
    hideChartTooltip() {
        const existing = document.getElementById('chart-tooltip');
        if (existing) {
            existing.remove();
        }
    }

    /**
     * Handle week selection
     */
    selectWeek(dataPoint) {
        console.log('Selected week:', dataPoint);
        alert(`Week of ${dataPoint.week}\nProgress Score: ${Math.round(dataPoint.value)}/100`);
        // You can expand this to show detailed week view
    }

    /**
     * Setup Socket.IO listeners for real-time updates
     */
    setupSocketListeners() {
        if (!this.options.socket) return;

        this.options.socket.on('progress_update', (data) => {
            if (data.classId === this.currentClassId) {
                console.log('Progress updated, reloading...');
                this.loadProgress();
            }
        });
    }

    /**
     * Manually refresh progress
     */
    async refresh() {
        await this.loadProgress();
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="progress-loading">
                <i class="fas fa-spinner"></i>
                <p>Loading progress data...</p>
            </div>
        `;
    }

    /**
     * Show error state
     */
    showError(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="progress-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * Show empty state
     */
    showEmpty() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="progress-empty">
                <i class="fas fa-inbox"></i>
                <h3>No Teams Yet</h3>
                <p>Create teams to start tracking progress</p>
            </div>
        `;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressTracker;
}

