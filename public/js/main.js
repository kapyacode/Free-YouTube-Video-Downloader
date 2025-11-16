document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form_sb');
    const txtUrl = document.getElementById('txt-url');
    const btnPaste = document.getElementById('btn-paste');
    const btnClear = document.getElementById('btn-clear');
    const loader = document.getElementById('de-loader');
    const resultDiv = document.getElementById('result');

    // Paste functionality with feedback
    btnPaste.addEventListener('click', async function() {
        try {
            const text = await navigator.clipboard.readText();
            txtUrl.value = text;
            toggleClearButton();
            
            // Show paste success feedback
            showNotification('✅ Pasted from clipboard!', 'success');
        } catch (err) {
            // Fallback for browsers that don't support clipboard API
            txtUrl.focus();
            try {
                document.execCommand('paste');
                toggleClearButton();
            } catch (e) {
                showNotification('⚠️ Please paste manually (Ctrl+V)', 'warning');
            }
        }
    });

    // Clear functionality
    btnClear.addEventListener('click', function() {
        txtUrl.value = '';
        toggleClearButton();
        resultDiv.innerHTML = '';
        showNotification('🗑️ Input cleared', 'info');
    });

    txtUrl.addEventListener('input', toggleClearButton);

    function toggleClearButton() {
        if (txtUrl.value.length > 0) {
            btnClear.style.display = 'block';
            btnPaste.style.display = 'none';
        } else {
            btnClear.style.display = 'none';
            btnPaste.style.display = 'block';
        }
    }

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const url = txtUrl.value.trim();
        
        if (!url) {
            showError('Please enter a YouTube URL');
            return;
        }

        if (!isValidYouTubeUrl(url)) {
            showError('Please enter a valid YouTube URL. Example: https://www.youtube.com/watch?v=...');
            return;
        }

        await fetchVideoInfo(url);
    });

    function isValidYouTubeUrl(url) {
        const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
        return pattern.test(url);
    }

    async function fetchVideoInfo(url) {
        loader.style.display = 'block';
        resultDiv.innerHTML = '';

        try {
            const response = await fetch('/api/video-info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch video info');
            }

            displayResults(data, url);
            showNotification('✅ Video loaded successfully!', 'success');
        } catch (error) {
            showError(error.message);
        } finally {
            loader.style.display = 'none';
        }
    }

    function displayResults(data, originalUrl) {
        const html = `
            <div class="video-info" style="animation: slideIn 0.3s ease-out;">
                <img src="${data.thumbnail}" alt="${escapeHtml(data.title)}" class="video-thumbnail" 
                     onerror="this.src='https://via.placeholder.com/320x180?text=No+Image'">
                <div class="video-details">
                    <div class="video-title">${escapeHtml(data.title)}</div>
                    <div class="video-meta">⏱️ Duration: ${data.duration}</div>
                </div>
            </div>
            
            <h4 class="mb-3 mt-4">📥 Download Options:</h4>
            <div class="download-options">
                ${data.formats.map((format, index) => `
                    <div class="download-item" style="animation: fadeIn 0.3s ease-out ${index * 0.1}s backwards;">
                        <div class="format-info">
                            <div class="format-quality">
                                ${format.format === 'video' ? '🎥' : '🎵'} ${format.quality}
                            </div>
                            <div class="format-type">${format.type} • ${format.size}</div>
                        </div>
                        <button class="download-btn" onclick="downloadVideo('${encodeURIComponent(originalUrl)}', '${format.formatId}', '${escapeHtml(data.title)}', '${format.type}')">
                            <span class="btn-text">Download</span>
                            <span class="btn-icon">⬇️</span>
                        </button>
                    </div>
                `).join('')}
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; font-size: 14px;">
                <strong>💡 Tip:</strong> For best quality, choose 1080p or 720p. For audio only, select the MP3 option.
            </div>
        `;

        resultDiv.innerHTML = html;
    }

    function showError(message) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger" style="background: #fee; border: 2px solid #fcc; padding: 20px; border-radius: 12px; color: #c33; animation: shake 0.5s;">
                <strong>❌ Error:</strong> ${escapeHtml(message)}
            </div>
        `;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show notification toast
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        
        const colors = {
            success: { bg: '#28a745', border: '#1e7e34' },
            error: { bg: '#dc3545', border: '#bd2130' },
            warning: { bg: '#ffc107', border: '#e0a800' },
            info: { bg: '#17a2b8', border: '#117a8b' }
        };
        
        const color = colors[type] || colors.info;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${color.bg};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            border-left: 4px solid ${color.border};
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        notification.innerHTML = message;
        document.body.appendChild(notification);
        
        // Remove after 4 seconds with fade out
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);
    }

    // Global download function with enhanced feedback
    window.downloadVideo = function(url, formatId, title, type) {
        // Show download starting notification
        showNotification(`⬇️ Downloading ${type}...<br><small>Check your browser downloads</small>`, 'success');
        
        // Create download URL
        const downloadUrl = `/api/download?url=${url}&formatId=${formatId}`;
        
        // Open download in new tab
        const downloadWindow = window.open(downloadUrl, '_blank');
        
        // Check if popup was blocked
        if (!downloadWindow || downloadWindow.closed || typeof downloadWindow.closed == 'undefined') {
            showNotification('⚠️ Popup blocked! Please allow popups for downloads.', 'warning');
        }
        
        // Track download (optional - for analytics)
        console.log('Download initiated:', { title, formatId, type });
    };

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+V or Cmd+V to focus input
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            if (document.activeElement !== txtUrl) {
                txtUrl.focus();
            }
        }
        
        // Escape to clear
        if (e.key === 'Escape') {
            txtUrl.value = '';
            toggleClearButton();
            resultDiv.innerHTML = '';
        }
    });

    // Auto-focus input on page load
    txtUrl.focus();
});