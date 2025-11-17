document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form_sb');
    const txtUrl = document.getElementById('txt-url');
    const btnPaste = document.getElementById('btn-paste');
    const btnClear = document.getElementById('btn-clear');
    const loader = document.getElementById('de-loader');
    const resultDiv = document.getElementById('result');

    // Paste functionality
    btnPaste.addEventListener('click', async function() {
        try {
            const text = await navigator.clipboard.readText();
            txtUrl.value = text;
            toggleClearButton();
            showNotification('✅ Pasted from clipboard!', 'success');
        } catch (err) {
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
            
            <!-- Download Progress Bar (Hidden by default) -->
            <div id="download-progress" style="display: none; margin: 20px 0;">
                <div style="background: #f0f0f0; border-radius: 10px; padding: 20px;">
                    <h5 style="margin-bottom: 15px;">📥 Downloading...</h5>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progress-bar">
                            <span id="progress-text">0%</span>
                        </div>
                    </div>
                    <div style="margin-top: 10px; font-size: 14px; color: #666;">
                        <span id="download-status">Preparing download...</span>
                    </div>
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
                <strong>💡 Tip:</strong> Download progress will be shown on this page. Please wait until it completes.
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
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);
    }

    // Global download function with progress tracking
    window.downloadVideo = async function(url, formatId, title, type) {
        const progressDiv = document.getElementById('download-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const downloadStatus = document.getElementById('download-status');
        
        // Show progress bar
        progressDiv.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        downloadStatus.textContent = 'Connecting to server...';
        
        // Scroll to progress bar
        progressDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        try {
            const downloadUrl = `/api/download?url=${url}&formatId=${formatId}`;
            
            // Fetch with progress tracking
            const response = await fetch(downloadUrl);
            
            if (!response.ok) {
                throw new Error('Download failed');
            }
            
            // Get total file size
            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength, 10);
            
            // Read the response stream
            const reader = response.body.getReader();
            let receivedLength = 0;
            let chunks = [];
            
            downloadStatus.textContent = 'Downloading...';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                receivedLength += value.length;
                
                // Calculate progress
                if (total) {
                    const percent = Math.round((receivedLength / total) * 100);
                    progressBar.style.width = percent + '%';
                    progressText.textContent = percent + '%';
                    downloadStatus.textContent = `Downloaded ${formatBytes(receivedLength)} of ${formatBytes(total)}`;
                } else {
                    downloadStatus.textContent = `Downloaded ${formatBytes(receivedLength)}`;
                }
            }
            
            // Combine chunks
            const blob = new Blob(chunks);
            
            // Create download link
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${sanitizeFilename(title)}.${type.toLowerCase()}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
            
            // Show success
            progressBar.style.width = '100%';
            progressText.textContent = '100%';
            downloadStatus.textContent = '✅ Download complete!';
            progressBar.style.background = '#28a745';
            
            showNotification('✅ Download complete! Check your downloads folder.', 'success');
            
            // Hide progress bar after 3 seconds
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 3000);
            
        } catch (error) {
            console.error('Download error:', error);
            downloadStatus.textContent = '❌ Download failed!';
            progressBar.style.background = '#dc3545';
            showNotification('❌ Download failed. Please try again.', 'error');
        }
    };
    
    // Helper function to format bytes
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    // Helper function to sanitize filename
    function sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9]/gi, '-').substring(0, 50);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            if (document.activeElement !== txtUrl) {
                txtUrl.focus();
            }
        }
        
        if (e.key === 'Escape') {
            txtUrl.value = '';
            toggleClearButton();
            resultDiv.innerHTML = '';
        }
    });

    // Auto-focus input on page load
    txtUrl.focus();
});