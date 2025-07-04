from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import cloudscraper
from sources import onionflixer

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configure requests session with retry strategy and connection pooling
session = requests.Session()
retry_strategy = Retry(
    total=3,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["HEAD", "GET", "OPTIONS", "POST"],
    backoff_factor=1
)
adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=20)
session.mount("http://", adapter)
session.mount("https://", adapter)

@app.route('/api/proxy', methods=['POST'])
def proxy():
    try:
        data = request.get_json()
        url = data.get('url')
        method = data.get('method', '').upper()
        headers = data.get('headers', {})
        use_cloudscraper = data.get('cf', False)
        
        if not url: return jsonify({'error': 'URL is required'})
        if method not in ['GET', 'POST']: return jsonify({'error': 'Only GET and POST methods are allowed'})

        # Set default timeout
        timeout = data.get('timeout', 30)
        
        # Choose session based on cf parameter
        if use_cloudscraper:
            scraper = cloudscraper.CloudScraper()
            if method == 'GET': 
                response = scraper.get(url, headers=headers, timeout=timeout, stream=True)
                response.raise_for_status()
                return response.content
            else: 
                form_data = data.get('form_data', {})
                response = scraper.post(url, data=form_data, headers=headers, timeout=timeout, stream=True)
                response.raise_for_status()
                return response.content
        else:
            # Use regular session for connection pooling
            if method == 'GET': 
                response = session.get(url, headers=headers, timeout=timeout, stream=True)
                response.raise_for_status()
                return response.content
            else: 
                form_data = data.get('form_data', {})
                response = session.post(url, data=form_data, headers=headers, timeout=timeout, stream=True)
                response.raise_for_status()
                return response.content
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred.'}), 500

@app.route('/api/onionflixer', methods=['POST'])
def onionflixer_api():
    try:
        data = request.get_json()
        content_type = data.get('type')
        imdb_id = data.get('imdbId')
        tmdb_id = data.get('tmdbId')
        season = data.get('season')
        episode = data.get('episode')
        
        if not content_type: return jsonify({'error': 'type is required'})
        if content_type not in ['movie', 'tv']: return jsonify({'error': 'type must be "movie" or "tv"'})
        if content_type == 'movie' and not imdb_id: return jsonify({'error': 'imdbId is required for movies'})
        if content_type == 'tv' and not all([tmdb_id, season, episode]): return jsonify({'error': 'tmdbId, season, and episode are required for TV shows'})
        
        m3u8_url = onionflixer.main(
            content_type=content_type,
            imdb_id=imdb_id,
            tmdb_id=tmdb_id,
            season=season,
            episode=episode
        )
        
        return jsonify({'m3u8_url': m3u8_url})

    except Exception as e:
        print(f"Error in onionflixer: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Configure Flask app for better connection handling
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
    app.run(debug=False, port=5001, host='0.0.0.0', threaded=True)