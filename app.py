from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import os
import re
import requests
import tempfile
import yt_dlp
from urllib.parse import urlparse, urlunparse
import concurrent.futures
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
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
    'likee': ['likee.video'],
    'snapchat': ['snapchat.com'],
    'linkedin': ['linkedin.com'],
    'threads': ['threads.net'],
    'dailymotion': ['dailymotion.com'],
    'vimeo': ['vimeo.com']
}

def clean_url(url):
    """Clean and normalize URL"""
    parsed = urlparse(url)
    # Remove tracking parameters
    query_params = {}
    if parsed.query:
        for param in parsed.query.split('&'):
            if '=' in param:
                key, value = param.split('=', 1)
                if key in ['v', 'id', 'url', 'src']:
                    query_params[key] = value
    # Reconstruct URL without unnecessary parameters
    cleaned = parsed._replace(query='&'.join([f"{k}={v}" for k, v in query_params.items()]) if query_params else '')
    return urlunparse(cleaned)

def detect_platform(url):
    """Detect which social media platform the URL belongs to"""
    domain = urlparse(url).netloc.lower()
    for platform, domains in SUPPORTED_PLATFORMS.items():
        for d in domains:
            if d in domain:
                return platform
    return None

def download_video(url, platform):
    """Download video using appropriate method for each platform"""
    try:
        temp_dir = tempfile.mkdtemp()
        output_template = os.path.join(temp_dir, '%(title)s.%(ext)s')
        
        ydl_opts = {
            'outtmpl': output_template,
            'format': 'best',
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'force_generic_extractor': True,
            'no_check_certificate': True,
            'ignoreerrors': True,
            'verbose': False,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        }
        
        # Platform-specific configurations
        if platform == 'instagram':
            ydl_opts.update({
                'cookiefile': 'cookies.txt' if os.path.exists('cookies.txt') else None,
            })
        elif platform == 'tiktok':
            ydl_opts['http_headers'].update({
                'Referer': 'https://www.tiktok.com/',
            })
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if not info:
                return None, "Failed to extract video information"
            
            # Find the downloaded file
            downloaded_files = [f for f in os.listdir(temp_dir) if f.endswith(('.mp4', '.webm', '.mkv', '.avi'))]
            if not downloaded_files:
                return None, "No video file found after download"
            
            video_path = os.path.join(temp_dir, downloaded_files[0])
            
            # Get video metadata
            metadata = {
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', ''),
                'uploader': info.get('uploader', 'Unknown'),
                'platform': platform,
                'filename': downloaded_files[0],
                'filesize': os.path.getsize(video_path) if os.path.exists(video_path) else 0
            }
            
            return video_path, metadata
            
    except Exception as e:
        return None, f"Error downloading video: {str(e)}"

def get_video_info(url):
    """Get video information without downloading"""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'force_generic_extractor': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if not info:
                return None, "Failed to get video information"
            
            metadata = {
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', ''),
                'uploader': info.get('uploader', 'Unknown'),
                'formats': [],
                'platform': detect_platform(url)
            }
            
            # Get available formats
            if 'formats' in info:
                for fmt in info['formats']:
                    if fmt.get('ext') in ['mp4', 'webm', 'm4a']:
                        format_info = {
                            'format_id': fmt.get('format_id'),
                            'ext': fmt.get('ext'),
                            'resolution': fmt.get('resolution', 'N/A'),
                            'filesize': fmt.get('filesize', 0),
                            'note': fmt.get('format_note', ''),
                        }
                        metadata['formats'].append(format_info)
            
            return metadata, None
            
    except Exception as e:
        return None, f"Error getting video info: {str(e)}"

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
        
        # Clean URL
        url = clean_url(url)
        
        # Detect platform
        platform = detect_platform(url)
        if not platform:
            return jsonify({'error': 'Unsupported platform. Supported: ' + ', '.join(SUPPORTED_PLATFORMS.keys())}), 400
        
        # Get video info
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
        format_id = data.get('format_id', 'best')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Clean URL
        url = clean_url(url)
        
        # Detect platform
        platform = detect_platform(url)
        if not platform:
            return jsonify({'error': 'Unsupported platform'}), 400
        
        # Download video
        video_path, result = download_video(url, platform)
        
        if isinstance(result, str):  # Error message
            return jsonify({'error': result}), 500
        
        metadata = result
        
        # Send file
        return send_file(
            video_path,
            as_attachment=True,
            download_name=metadata['filename'],
            mimetype='video/mp4'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch-download', methods=['POST'])
def batch_download():
    try:
        data = request.json
        urls = data.get('urls', [])
        
        if not urls or len(urls) == 0:
            return jsonify({'error': 'URLs are required'}), 400
        
        if len(urls) > 10:
            return jsonify({'error': 'Maximum 10 URLs allowed'}), 400
        
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_to_url = {executor.submit(download_video, clean_url(url), detect_platform(url)): url for url in urls[:5]}
            
            for future in concurrent.futures.as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    video_path, result = future.result()
                    if video_path:
                        results.append({
                            'url': url,
                            'success': True,
                            'filename': os.path.basename(video_path) if video_path else 'Unknown'
                        })
                    else:
                        results.append({
                            'url': url,
                            'success': False,
                            'error': result
                        })
                except Exception as e:
                    results.append({
                        'url': url,
                        'success': False,
                        'error': str(e)
                    })
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)