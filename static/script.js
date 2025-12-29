class ZukoMDDownloader {
    constructor() {
        this.currentVideoInfo = null;
        this.selectedFormat = 'best';
        this.initializeEventListeners();
        this.updatePlatformIcons();
    }

    initializeEventListeners() {
        // URL input
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeUrl());
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.analyzeUrl();
        });

        // Platform selection
        document.querySelectorAll('.platform-card').forEach(card => {
            card.addEventListener('click', () => this.selectPlatform(card));
        });

        // Download buttons
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadVideo());
        document.getElementById('downloadBestBtn').addEventListener('click', () => this.downloadBest());
        document.getElementById('batchDownloadBtn').addEventListener('click', () => this.batchDownload());

        // Format selection
        document.getElementById('formatsGrid')?.addEventListener('click', (e) => {
            const formatCard = e.target.closest('.format-card');
            if (formatCard) {
                this.selectFormat(formatCard);
            }
        });

        // URL examples
        document.getElementById('addExampleBtn').addEventListener('click', () => this.addExampleUrl());
    }

    async analyzeUrl() {
        const url = document.getElementById('urlInput').value.trim();
        const urlInput = document.getElementById('urlInput');
        const analyzeBtn = document.getElementById('analyzeBtn');
        
        if (!url) {
            this.showAlert('Please enter a URL', 'danger');
            urlInput.focus();
            return;
        }

        // Basic URL validation
        if (!this.isValidUrl(url)) {
            this.showAlert('Please enter a valid URL', 'danger');
            return;
        }

        // Show loading
        this.showLoading(true);
        analyzeBtn.disabled = true;

        try {
            const response = await fetch('/api/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (data.error) {
                this.showAlert(data.error, 'danger');
                return;
            }

            this.currentVideoInfo = data.info;
            this.displayVideoInfo(data);
            this.showVideoPreview();
            
        } catch (error) {
            this.showAlert('Network error. Please try again.', 'danger');
            console.error('Error:', error);
        } finally {
            this.showLoading(false);
            analyzeBtn.disabled = false;
        }
    }

    displayVideoInfo(data) {
        const preview = document.getElementById('videoPreview');
        const thumbnail = document.getElementById('thumbnail');
        const title = document.getElementById('videoTitle');
        const uploader = document.getElementById('uploader');
        const duration = document.getElementById('duration');
        const platform = document.getElementById('platform');
        
        // Set basic info
        thumbnail.src = data.info.thumbnail || '/static/images/default-thumbnail.jpg';
        title.textContent = data.info.title;
        uploader.textContent = `By: ${data.info.uploader}`;
        duration.textContent = this.formatDuration(data.info.duration);
        platform.textContent = data.platform.charAt(0).toUpperCase() + data.platform.slice(1);
        
        // Display formats
        this.displayFormats(data.info.formats);
    }

    displayFormats(formats) {
        const formatsGrid = document.getElementById('formatsGrid');
        formatsGrid.innerHTML = '';
        
        if (!formats || formats.length === 0) {
            formatsGrid.innerHTML = '<p>No formats available. Will download best quality.</p>';
            return;
        }
        
        // Add "Best Quality" option
        const bestCard = this.createFormatCard({
            format_id: 'best',
            ext: 'mp4',
            resolution: 'Best',
            filesize: this.getTotalSize(formats),
            note: 'Auto-select best quality'
        }, true);
        formatsGrid.appendChild(bestCard);
        
        // Add other formats
        formats.forEach(format => {
            if (format.ext === 'mp4' || format.ext === 'webm') {
                const card = this.createFormatCard(format);
                formatsGrid.appendChild(card);
            }
        });
    }

    createFormatCard(format, isSelected = false) {
        const card = document.createElement('div');
        card.className = `format-card ${isSelected ? 'selected' : ''}`;
        card.dataset.formatId = format.format_id;
        
        const size = format.filesize ? this.formatFileSize(format.filesize) : 'Unknown';
        const resolution = format.resolution || format.note || 'N/A';
        
        card.innerHTML = `
            <div class="format-header">
                <strong>${format.ext.toUpperCase()}</strong>
                <span class="format-resolution">${resolution}</span>
            </div>
            <div class="format-size">${size}</div>
            <div class="format-note">${format.note || ''}</div>
        `;
        
        return card;
    }

    selectFormat(formatCard) {
        // Remove selection from all format cards
        document.querySelectorAll('.format-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Add selection to clicked card
        formatCard.classList.add('selected');
        this.selectedFormat = formatCard.dataset.formatId;
    }

    async downloadVideo() {
        if (!this.currentVideoInfo) {
            this.showAlert('Please analyze a video first', 'danger');
            return;
        }

        const url = document.getElementById('urlInput').value.trim();
        this.downloadWithFormat(url, this.selectedFormat);
    }

    async downloadBest() {
        const url = document.getElementById('urlInput').value.trim();
        if (!url) {
            this.showAlert('Please enter a URL', 'danger');
            return;
        }
        
        this.downloadWithFormat(url, 'best');
    }

    async downloadWithFormat(url, formatId) {
        this.showLoading(true, 'Downloading...');
        
        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, format_id: formatId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Download failed');
            }

            // Get filename from response headers
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'video.mp4';
            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            // Create download link
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            
            this.showAlert('Download started!', 'success');
            
        } catch (error) {
            this.showAlert(error.message, 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    async batchDownload() {
        const urlsText = document.getElementById('batchUrls').value.trim();
        if (!urlsText) {
            this.showAlert('Please enter URLs', 'danger');
            return;
        }

        const urls = urlsText.split('\n')
            .map(url => url.trim())
            .filter(url => url && this.isValidUrl(url));

        if (urls.length === 0) {
            this.showAlert('No valid URLs found', 'danger');
            return;
        }

        if (urls.length > 10) {
            this.showAlert('Maximum 10 URLs allowed', 'danger');
            return;
        }

        this.showLoading(true, 'Processing batch download...');

        try {
            const response = await fetch('/api/batch-download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ urls })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Show results
            let successCount = 0;
            let errorCount = 0;
            
            data.results.forEach(result => {
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            });

            this.showAlert(`Batch download complete: ${successCount} successful, ${errorCount} failed`, 
                          errorCount === 0 ? 'success' : 'warning');
            
        } catch (error) {
            this.showAlert(error.message, 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    selectPlatform(card) {
        // Remove active class from all cards
        document.querySelectorAll('.platform-card').forEach(c => {
            c.classList.remove('active');
        });
        
        // Add active class to clicked card
        card.classList.add('active');
        
        // Add platform URL example
        const platform = card.dataset.platform;
        this.addPlatformExample(platform);
    }

    addPlatformExample(platform) {
        const examples = {
            'youtube': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'tiktok': 'https://www.tiktok.com/@example/video/123456789',
            'instagram': 'https://www.instagram.com/p/ABC1234567/',
            'facebook': 'https://www.facebook.com/watch/?v=123456789',
            'twitter': 'https://twitter.com/user/status/123456789',
            'pinterest': 'https://www.pinterest.com/pin/123456789/',
            'reddit': 'https://www.reddit.com/r/videos/comments/abc123/title/'
        };

        const urlInput = document.getElementById('urlInput');
        urlInput.value = examples[platform] || '';
        urlInput.focus();
    }

    addExampleUrl() {
        const examples = [
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://www.tiktok.com/@example/video/123456789',
            'https://www.instagram.com/p/ABC1234567/',
            'https://twitter.com/user/status/123456789'
        ];
        
        const randomExample = examples[Math.floor(Math.random() * examples.length)];
        document.getElementById('urlInput').value = randomExample;
    }

    showVideoPreview() {
        document.getElementById('videoPreview').style.display = 'block';
        document.getElementById('downloadSection').style.display = 'block';
    }

    showLoading(show, message = 'Processing...') {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loadingText');
        
        if (show) {
            loading.style.display = 'block';
            loadingText.textContent = message;
        } else {
            loading.style.display = 'none';
        }
    }

    showAlert(message, type = 'info') {
        const alertDiv = document.getElementById('alert');
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    }

    updatePlatformIcons() {
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

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    formatDuration(seconds) {
        if (!seconds) return 'N/A';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        if (!bytes) return 'Unknown';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
    }

    getTotalSize(formats) {
        return formats.reduce((total, format) => total + (format.filesize || 0), 0);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.downloader = new ZukoMDDownloader();
});
