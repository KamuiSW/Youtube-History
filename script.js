// Chart.js global defaults
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
Chart.defaults.color = '#e1e8ed';

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dashboard = document.getElementById('dashboard');
const uploadContent = document.querySelector('.upload-content');

// Chart instances
let dailyTimelineChart = null;
let hourlyDistributionChart = null;
let channelDistributionChart = null;

// Google API configuration
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY';
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

// Loading state
function setLoading(isLoading) {
    if (isLoading) {
        uploadContent.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Processing your YouTube history...</p>
            <p class="file-info">This may take a few moments</p>
        `;
    } else {
        uploadContent.innerHTML = `
            <img src="https://www.youtube.com/s/desktop/7c155e84/img/favicon_144x144.png" alt="YouTube Logo" class="youtube-logo">
            <p>Choose how to analyze your history:</p>
            <div class="upload-options">
                <div class="upload-option">
                    <h3>Upload JSON File</h3>
                    <p>Drag and drop your YouTube history file here</p>
                    <p>or</p>
                    <button class="upload-button" onclick="document.getElementById('fileInput').click()">
                        Choose File
                    </button>
                    <p class="file-info">Supported format: YouTube Takeout JSON file</p>
                </div>
                <div class="upload-option">
                    <h3>Sign in with Google</h3>
                    <p>Connect your Google account to analyze your history directly</p>
                    <div class="g-signin2" data-onsuccess="onGoogleSignIn"></div>
                </div>
            </div>
        `;
    }
}

// Google Sign-In callback
function onGoogleSignIn(googleUser) {
    const auth2 = gapi.auth2.getAuthInstance();
    if (auth2.isSignedIn.get()) {
        setLoading(true);
        fetchYouTubeHistory(googleUser.getAuthResponse().access_token);
    }
}

// Fetch YouTube history using the Data API
async function fetchYouTubeHistory(accessToken) {
    try {
        const history = [];
        let nextPageToken = null;
        
        do {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=50&pageToken=${nextPageToken || ''}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            // Convert API response to match our data format
            const items = data.items.map(item => ({
                header: "YouTube",
                title: item.snippet.title,
                titleUrl: `https://www.youtube.com/watch?v=${item.id}`,
                subtitles: [{
                    name: item.snippet.channelTitle,
                    url: `https://www.youtube.com/channel/${item.snippet.channelId}`
                }],
                time: item.snippet.publishedAt,
                products: ["YouTube"],
                activityControls: ["YouTube watch history"]
            }));
            
            history.push(...items);
            nextPageToken = data.nextPageToken;
            
        } while (nextPageToken);
        
        processData(history);
    } catch (error) {
        console.error('Error fetching YouTube history:', error);
        alert('Error fetching your YouTube history. Please try again or use the JSON file upload option.');
        setLoading(false);
    }
}

// Drag and drop handlers
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#4a90e2';
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#34495e';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#34495e';
    const file = e.dataTransfer.files[0];
    handleFile(file);
});

// File input handler
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFile(file);
});

// File validation
function validateYouTubeHistory(data) {
    console.log('Validating data:', data);
    
    // If data is an object, try to find the array of history items
    if (typeof data === 'object' && !Array.isArray(data)) {
        // Try to find the history array in common locations
        if (data.history) {
            data = data.history;
        } else if (data.data) {
            data = data.data;
        } else if (data.items) {
            data = data.items;
        } else {
            // If it's a single item, wrap it in an array
            data = [data];
        }
    }

    if (!Array.isArray(data)) {
        throw new Error('Invalid format: Expected an array of history items');
    }

    if (data.length === 0) {
        throw new Error('No history data found in the file');
    }

    // Check if the first item has the expected YouTube history structure
    const firstItem = data[0];
    console.log('First item:', firstItem);
    console.log('First item keys:', Object.keys(firstItem));

    // YouTube watch history can come in different formats
    // Format 1: Direct watch history
    if (firstItem.title && firstItem.titleUrl && firstItem.time) {
        return true;
    }
    
    // Format 2: Alternative field names
    if (firstItem.videoTitle && firstItem.videoUrl && firstItem.timestamp) {
        return true;
    }

    // Format 3: Nested structure
    if (firstItem.header && firstItem.data) {
        const firstDataItem = firstItem.data[0];
        if (firstDataItem && firstDataItem.title && firstDataItem.titleUrl && firstDataItem.time) {
            return true;
        }
    }

    // Format 4: Check for any YouTube URL and title
    if (firstItem.title && firstItem.titleUrl && firstItem.titleUrl.includes('youtube.com')) {
        return true;
    }

    // Format 5: Check for any video-related fields
    const hasVideoFields = Object.keys(firstItem).some(key => 
        key.toLowerCase().includes('video') || 
        key.toLowerCase().includes('title') || 
        key.toLowerCase().includes('url')
    );

    if (hasVideoFields) {
        console.log('Found video-related fields:', Object.keys(firstItem));
        return true;
    }

    throw new Error('Invalid format: Could not find YouTube watch history data. Please make sure you\'re uploading the watch history file from your YouTube Takeout data. The file should contain video titles, URLs, and timestamps.');
}

// File handling
function handleFile(file) {
    if (!file) return;
    
    // File type validation
    if (!file.name.endsWith('.json')) {
        alert('Please upload a JSON file');
        return;
    }

    // File size validation (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
        alert('File size exceeds 100MB limit. Please upload a smaller file.');
        return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            console.log('File loaded successfully');
            console.log('Data type:', typeof data);
            console.log('Is array:', Array.isArray(data));
            console.log('Data structure:', Object.keys(data));
            
            validateYouTubeHistory(data);
            processData(data);
        } catch (error) {
            console.error('Error details:', error);
            console.error('Error stack:', error.stack);
            alert(error.message || 'Error processing file. Please make sure it\'s a valid YouTube history file.');
            setLoading(false);
        }
    };

    reader.onerror = () => {
        alert('Error reading file. Please try again.');
        setLoading(false);
    };

    reader.readAsText(file);
}

// Data processing
function processData(data) {
    // Show dashboard
    dashboard.style.display = 'block';
    
    // Initialize charts
    initializeCharts();
    
    // Process the data
    const stats = calculateStats(data);
    updateDashboard(stats);
    
    setLoading(false);
}

// Calculate statistics
function calculateStats(data) {
    const stats = {
        totalVideos: data.length,
        totalTime: 0,
        channelCounts: {},
        hourlyDistribution: Array(24).fill(0),
        dailyTimeline: {}
    };

    data.forEach(item => {
        // Extract channel name from subtitles array
        const channel = item.subtitles && item.subtitles[0] ? item.subtitles[0].name : 'Unknown Channel';
        
        // Count channels
        stats.channelCounts[channel] = (stats.channelCounts[channel] || 0) + 1;
        
        // Parse time and update hourly distribution
        const date = new Date(item.time);
        stats.hourlyDistribution[date.getHours()]++;
        
        // Update daily timeline
        const dateKey = date.toISOString().split('T')[0];
        stats.dailyTimeline[dateKey] = (stats.dailyTimeline[dateKey] || 0) + 1;
    });

    // Calculate total time (assuming average video length of 10 minutes)
    stats.totalTime = stats.totalVideos * 10;

    return stats;
}

// Update dashboard with statistics
function updateDashboard(stats) {
    // Update stat cards
    document.getElementById('totalVideos').textContent = stats.totalVideos.toLocaleString();
    document.getElementById('totalTime').textContent = `${Math.round(stats.totalTime / 60)} hours`;
    
    // Find top channel
    const topChannel = Object.entries(stats.channelCounts)
        .sort(([,a], [,b]) => b - a)[0];
    document.getElementById('topChannel').textContent = topChannel ? topChannel[0] : 'N/A';
    
    // Find busiest hour
    const busiestHour = stats.hourlyDistribution.indexOf(Math.max(...stats.hourlyDistribution));
    document.getElementById('busiestHour').textContent = `${busiestHour}:00`;

    // Update charts
    updateCharts(stats);
}

// Update charts with data
function updateCharts(stats) {
    // Daily Timeline Chart
    const dailyData = Object.entries(stats.dailyTimeline)
        .sort(([a], [b]) => a.localeCompare(b));
    
    dailyTimelineChart.data.labels = dailyData.map(([date]) => date);
    dailyTimelineChart.data.datasets[0].data = dailyData.map(([,count]) => count);
    dailyTimelineChart.update();

    // Hourly Distribution Chart
    hourlyDistributionChart.data.datasets[0].data = stats.hourlyDistribution;
    hourlyDistributionChart.update();

    // Channel Distribution Chart
    const topChannels = Object.entries(stats.channelCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    channelDistributionChart.data.labels = topChannels.map(([channel]) => channel);
    channelDistributionChart.data.datasets[0].data = topChannels.map(([,count]) => count);
    channelDistributionChart.update();
}

// Chart initialization
function initializeCharts() {
    // Daily Timeline Chart
    const dailyTimelineCtx = document.getElementById('dailyTimeline').getContext('2d');
    dailyTimelineChart = new Chart(dailyTimelineCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Watch Time (minutes)',
                data: [],
                borderColor: '#4a90e2',
                backgroundColor: 'rgba(74, 144, 226, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Daily Watch Time',
                    color: '#ffffff',
                    font: {
                        size: 16,
                        weight: 600
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#95a5a6'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#95a5a6'
                    }
                }
            }
        }
    });

    // Hourly Distribution Chart
    const hourlyDistributionCtx = document.getElementById('hourlyDistribution').getContext('2d');
    hourlyDistributionChart = new Chart(hourlyDistributionCtx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Watch Time (minutes)',
                data: Array(24).fill(0),
                backgroundColor: '#4a90e2'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Hourly Watch Time Distribution',
                    color: '#ffffff',
                    font: {
                        size: 16,
                        weight: 600
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#95a5a6'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#95a5a6'
                    }
                }
            }
        }
    });

    // Channel Distribution Chart
    const channelDistributionCtx = document.getElementById('channelDistribution').getContext('2d');
    channelDistributionChart = new Chart(channelDistributionCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#4a90e2',
                    '#357abd',
                    '#2c3e50',
                    '#34495e',
                    '#95a5a6'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Top Channels',
                    color: '#ffffff',
                    font: {
                        size: 16,
                        weight: 600
                    }
                },
                legend: {
                    labels: {
                        color: '#95a5a6'
                    }
                }
            }
        }
    });
} 