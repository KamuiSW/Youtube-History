// Public configuration file
window.config = {
    GOOGLE_CLIENT_ID: '760851876600-bl1vfhp6ci0cfootf10gi88i36s81k44.apps.googleusercontent.com',
    YOUTUBE_API_KEY: 'YOUR_YOUTUBE_API_KEY',
    // Add base URL for GitHub Pages
    BASE_URL: window.location.hostname === 'localhost' ? '' : '/Youtube-History/',
    // Add debug mode
    DEBUG: true
};

// Add error handling for config loading
window.addEventListener('error', function(e) {
    if (e.target.tagName === 'SCRIPT' && e.target.src.includes('config.js')) {
        console.error('Config.js loading error:', e.target.src);
    }
});

// Log config loading
console.log('Config loaded:', window.config); 