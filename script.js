// ZUKO-MD Downloader JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const urlInput = document.getElementById('urlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadBestBtn = document.getElementById('downloadBestBtn');
    const batchDownloadBtn = document.getElementById('batchDownloadBtn');
    const addExampleBtn = document.getElementById('addExampleBtn');
    const alertDiv = document.getElementById('alert');
    const loadingDiv = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    const videoPreview = document.getElementById('videoPreview');
    const downloadSection = document.getElementById('downloadSection');
    const formatsGrid = document.getElementById('formatsGrid');
    
    // State
    let currentVideoInfo = null;
    let selectedFormat = 'best';
    
    // Initialize
    setupEventListeners();
    updatePlatformIcons();
    
    function setupEventListeners() {
        // Analyze button
        analyzeBtn.addEventListener('click', analyzeUrl);
        urlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') analyzeUrl();
        });
        
        // Platform cards
        document.querySelectorAll('.platform-card').forEach(card => {
            card.addEventListener('click', function() {
                selectPlatform(this);
            });
        });
        
        // Download buttons
        downloadBtn.addEventListener('click', downloadVideo);
        downloadBestBtn.addEventListener('click', downloadBest);
        batchDownloadBtn.addEventListener('click', batchDownload);
        addExampleBtn.addEventListener('click', addExampleUrl);
        
        // Format selection
        if (formatsGrid) {
            formatsGrid.addEventListener('click', function(e) {
                const formatCard = e.target.closest('.format-card');
                if (formatCard) selectFormat(formatCard);
            });
        }
    }
    
    function selectPlatform(card) {
        // Remove active from all
        document.querySelectorAll('.platform-card').forEach(c => {
            c.classList.remove('active');
        });
        
        // Add active to clicked
        card.classList.add('active');
        
        // Add example URL
        const platform = card.dataset.platform;
        const examples = {
            'youtube': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'tiktok': 'https://www.tiktok.com/@example/video/123456789',
            'instagram': 'https://www.instagram.com/p/ABC1234567/',
            'facebook': 'https://www.facebook.com/watch/?v=123456789',
            'twitter': 'https://twitter.com/user/status/123456789'
        };
        
        urlInput.value = examples[platform] || '';
        urlInput.focus();
    }
    
    function addExampleUrl() {
        const examples = [
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://www.tiktok.com/@example/video/123456789',
            'https://www.instagram.com/p/ABC1234567/',
            'https://twitter.com/user/status/123456789'
        ];
        urlInput.value = examples[Math.floor(Math.random() * examples.length)];
    }
    
    async function analyzeUrl() {
        const url = urlInput.value.trim();
        
        if (!url) {
            showAlert('Please enter a URL', 'danger');
            urlInput.focus();
            return;
        }
        
        if (!isValidUrl(url)) {
            showAlert('Please enter a valid URL', 'danger');
            return;
        }
        
        showLoading(true, 'Analyzing video...');
        analyzeBtn.disabled = true;
        
        try {
            const response = await fetch('/api/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url })
            });
            
            const data = await response.json();
            
            if (data.error) {
                showAlert(data.error, 'danger');
                return;
            }
            
            currentVideoInfo = data.info;
            displayVideoInfo(data);
            showVideoPreview();
            showAlert('Video analyzed successfully!', 'success');
            
        } catch (error) {
            showAlert('Network error. Please try again.', 'danger');
            console.error('Error:', error);
        } finally {
            showLoading(false);
            analyzeBtn.disabled = false;
        }
    }
    
    function displayVideoInfo(data) {
        const thumbnail = document.getElementById('thumbnail');
        const videoTitle = document.getElementById('videoTitle');
        const uploader = document.getElementById('uploader');
        const duration = document.getElementById('duration');
        const platform = document.getElementById('platform');
        
        // Set info
        thumbnail.src = data.info.thumbnail || '';
        videoTitle.textContent = data.info.title || 'Unknown Title';
        uploader.textContent = `By: ${data.info.uploader || 'Unknown'}`;
        duration.textContent = `Duration: ${formatDuration(data.info.duration)}`;
        platform.textContent = `Platform: ${data.platform.charAt(0).toUpperCase() + data.platform.slice(1)}`;
        
        // Display formats
        displayFormats(data.info.formats);
    }
    
    function displayFormats(formats) {
        if (!formatsGrid) return;
        
        formatsGrid.innerHTML = '';
        
        if (!formats || formats.length === 0) {
            formatsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--gray);">No formats available. Will download best quality.</p>';
            return;
        }
        
        // Add Best Quality option
        const bestCard = createFormatCard({
            format_id: 'best',
            ext: 'mp4',
            resolution: 'Best',
            filesize: formats.reduce((total, fmt) => total + (fmt.filesize || 0), 0),
            note: 'Auto-select best quality'
        }, true);
        formatsGrid.appendChild(bestCard);
        
        // Add other formats
        formats.forEach(format => {
            if (format.ext === 'mp4' || format.ext === 'webm') {
                const card = createFormatCard(format);
                formatsGrid.appendChild(card);
            }
        });
    }
    
    function createFormatCard(format, isSelected = false) {
        const card = document.createElement('div');
        card.className = `format-card ${isSelected ? 'selected' : ''}`;
        card.dataset.formatId = format.format_id;
        
        const size = format.filesize ? formatFileSize(format.filesize) : 'Unknown';
        const resolution = format.resolution || format.note || 'N/A';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <strong>${format.ext.toUpperCase()}</strong>
                <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${resolution}</span>
            </div>
            <div style="color: var(--gray); font-size: 0.9rem;">Size: ${size}</div>
            ${format.note ? `<div style="color: var(--dark); font-size: 0.85rem; margin-top: 5px;">${format.note}</div>` : ''}
        `;
        
        return card;
    }
    
    function selectFormat(formatCard) {
        document.querySelectorAll('.format-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        formatCard.classList.add('selected');
        selectedFormat = formatCard.dataset.formatId;
    }
    
    async function downloadVideo() {
        if (!currentVideoInfo) {
            showAlert('Please analyze a video first', 'danger');
            return;
        }
        
        const url = urlInput.value.trim();
        await downloadWithFormat(url, selectedFormat);
    }
    
    async function downloadBest() {
        const url = urlInput.value.trim();
        if (!url) {
            showAlert('Please enter a URL', 'danger');
            return;
        }
        
        await downloadWithFormat(url, 'best');
    }
    
    async function downloadWithFormat(url, formatId) {
        showLoading(true, 'Downloading video...');
        
        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url, format_id: formatId })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Download failed');
            }
            
            // Get filename
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'video.mp4';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match) filename = match[1];
            }
            
            // Create download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            
            showAlert('Download started! Check your downloads folder.', 'success');
            
        } catch (error) {
            showAlert(error.message, 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    async function batchDownload() {
        const urlsText = document.getElementById('batchUrls').value.trim();
        if (!urlsText) {
            showAlert('Please enter URLs', 'danger');
            return;
        }
        
        const urls = urlsText.split('\n')
            .map(url => url.trim())
            .filter(url => url && isValidUrl(url));
        
        if (urls.length === 0) {
            showAlert('No valid URLs found', 'danger');
            return;
        }
        
        if (urls.length > 10) {
            showAlert('Maximum 10 URLs allowed', 'danger');
            return;
        }
        
        showLoading(true, 'Processing batch download...');
        
        try {
            const response = await fetch('/api/batch-download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ urls: urls })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            const successCount = data.results.filter(r => r.success).length;
            const errorCount = data.results.filter(r => !r.success).length;
            
            showAlert(`Batch complete: ${successCount} successful, ${errorCount} failed`, 
                     errorCount === 0 ? 'success' : 'warning');
            
        } catch (error) {
            showAlert(error.message, 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    function showVideoPreview() {
        if (videoPreview) videoPreview.style.display = 'block';
        if (downloadSection) downloadSection.style.display = 'block';
    }
    
    function showLoading(show, message = 'Processing...') {
        if (loadingDiv) {
            loadingDiv.style.display = show ? 'block' : 'none';
            if (loadingText && message) loadingText.textContent = message;
        }
    }
    
    function showAlert(message, type = 'info') {
        if (!alertDiv) return;
        
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.display = 'block';
        
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    }
    
    function updatePlatformIcons() {
        const icons = {
            'youtube': '▶️',
            'tiktok': '🎵',
            'instagram': '📷',
            'facebook': '👥',
            'twitter': '🐦',
            'pinterest': '📌',
            'reddit': '📱',
            'likee': '⭐',
            'snapchat': '👻',
            'linkedin': '💼',
            'threads': '🧵',
            'dailymotion': '🎬',
            'vimeo': '🎥'
        };
        
        document.querySelectorAll('.platform-card').forEach(card => {
            const platform = card.dataset.platform;
            const iconDiv = card.querySelector('.platform-icon');
            if (iconDiv && icons[platform]) {
                iconDiv.textContent = icons[platform];
            }
        });
    }
    
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    function formatDuration(seconds) {
        if (!seconds) return 'N/A';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});
