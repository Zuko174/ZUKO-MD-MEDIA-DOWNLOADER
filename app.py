from flask import Flask, render_template, request, jsonify, send_file
import os
import tempfile
import yt_dlp
from urllib.parse import urlparse
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'zukomd-secret-key-2024')

# Supported platforms
SUPPORTED_PLATFORMS = {
    'youtube': ['youtube.com', 'youtu.be'],
    'tiktok': ['tiktok.com'],
    'instagram': ['instagram.com'],
    'facebook': ['facebook.com', 'fb.watch'],
    'twitter': ['twitter.com', 'x.com'],
    'pinterest': ['pinterest.com'],
    'reddit': ['reddit.com'],
    'dailymotion': ['dailymotion.com'],
    'vimeo': ['vimeo.com']
}

def detect_platform(url):
    """Detect which social media platform the URL belongs to"""
    domain = urlparse(url).netloc.lower()
    for platform, domains in SUPPORTED_PLATFORMS.items():
        for d in domains:
            if d in domain:
                return platform
    return None

def download_video(url):
    """Download video using yt-dlp"""
    try:
        temp_dir = tempfile.mkdtemp()
        output_template = os.path.join(temp_dir, '%(title)s.%(ext)s')
        
        ydl_opts = {
            'outtmpl': output_template,
            'format': 'best',
            'quiet': True,
            'no_warnings': True,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            if not info:
                return None, "Failed to extract video information"
            
            # Find downloaded file
            downloaded_files = [f for f in os.listdir(temp_dir) if f.endswith(('.mp4', '.webm', '.mkv'))]
            if not downloaded_files:
                return None, "No video file found"
            
            video_path = os.path.join(temp_dir, downloaded_files[0])
            
            metadata = {
                'title': info.get('title', 'Video'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', ''),
                'uploader': info.get('uploader', 'Unknown'),
                'filename': downloaded_files[0],
                'filesize': os.path.getsize(video_path)
            }
            
            return video_path, metadata
            
    except Exception as e:
        return None, f"Error: {str(e)}"

def get_video_info(url):
    """Get video information"""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if not info:
                return None, "Failed to get video information"
            
            metadata = {
                'title': info.get('title', 'Video'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', ''),
                'uploader': info.get('uploader', 'Unknown'),
                'formats': []
            }
            
            # Get available formats
            if 'formats' in info:
                for fmt in info['formats'][:10]:  # Limit to 10 formats
                    if fmt.get('ext') in ['mp4', 'webm']:
                        metadata['formats'].append({
                            'format_id': fmt.get('format_id', 'best'),
                            'ext': fmt.get('ext', 'mp4'),
                            'resolution': fmt.get('resolution', 'N/A'),
                            'filesize': fmt.get('filesize', 0)
                        })
            
            return metadata, None
            
    except Exception as e:
        return None, f"Error: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html', platforms=SUPPORTED_PLATFORMS.keys())

@app.route('/api/info', methods=['POST'])
def get_info():
    try:
        data = request.json
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        platform = detect_platform(url)
        if not platform:
            return jsonify({'error': 'Unsupported platform'}), 400
        
        info, error = get_video_info(url)
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify({
            'success': True,
            'platform': platform,
            'info': info
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['POST'])
def download():
    try:
        data = request.json
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        video_path, result = download_video(url)
        
        if isinstance(result, str):  # Error
            return jsonify({'error': result}), 500
        
        metadata = result
        
        return send_file(
            video_path,
            as_attachment=True,
            download_name=metadata['filename'],
            mimetype='video/mp4'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.now().isoformat()})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
