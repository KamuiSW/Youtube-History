// Chart.js global defaults
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
Chart.defaults.color = '#e1e8ed';

// DOM Elements
let dropZone = null;
let fileInput = null;
let dashboard = null;
let uploadContent = null;

// Chart instances
let dailyTimelineChart = null;
let hourlyDistributionChart = null;
let channelDistributionChart = null;

// Initialize Google Sign-In
function initGoogleSignIn() {
    if (typeof gapi === 'undefined') {
        console.log('Google API not loaded yet, waiting...');
        setTimeout(initGoogleSignIn, 100);
        return;
    }
    
    // Check if config exists
    if (!window.config || !window.config.GOOGLE_CLIENT_ID) {
        console.log('Config not loaded yet, waiting...');
        setTimeout(initGoogleSignIn, 100);
        return;
    }
    
    try {
        // Check if already initialized
        if (gapi.auth2.getAuthInstance()) {
            console.log('Google Sign-In already initialized');
            return;
        }

        gapi.load('auth2', function() {
            gapi.auth2.init({
                client_id: window.config.GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
                cookiepolicy: 'single_host_origin'
            }).then(function(auth2) {
                console.log('Google Sign-In initialized successfully');
            }).catch(function(error) {
                console.log('Google Sign-In initialization skipped:', error);
                // Don't show error to user, just log it
            });
        });
    } catch (error) {
        console.log('Google Sign-In initialization error:', error);
        // Don't show error to user, just log it
    }
}

// Set Google Client ID from config
if (window.config && window.config.GOOGLE_CLIENT_ID) {
    document.querySelector('meta[name="google-signin-client_id"]').content = window.config.GOOGLE_CLIENT_ID;
}

// Initialize Google Sign-In when the page loads
window.addEventListener('load', initGoogleSignIn);

// Initialize DOM elements and charts
function initializeElements() {
    dropZone = document.getElementById('dropZone');
    fileInput = document.getElementById('fileInput');
    dashboard = document.getElementById('dashboard');
    uploadContent = document.querySelector('.upload-content');

    if (!dropZone || !fileInput || !dashboard || !uploadContent) {
        console.error('Required DOM elements not found');
        return false;
    }

    return true;
}

// Initialize event listeners
function initializeEventListeners() {
    if (!dropZone || !fileInput) {
        console.error('Cannot initialize event listeners: DOM elements not found');
        return;
    }

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#4a90e2';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#34495e';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#34495e';
        
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) {
            console.error('No files dropped');
            return;
        }
        
        const file = e.dataTransfer.files[0];
        console.log('File dropped:', file.name, file.type, file.size);
        handleFile(file);
    });

    fileInput.addEventListener('change', (e) => {
        if (!e.target || !e.target.files || !e.target.files.length) {
            console.error('No file selected');
            return;
        }
        
        const file = e.target.files[0];
        console.log('File selected:', file.name, file.type, file.size);
        handleFile(file);
    });
}

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
                    <button class="google-sign-in-button" onclick="triggerGoogleSignIn()">
                        <img src="https://www.google.com/favicon.ico" alt="Google Logo" class="google-icon">
                        Sign in with Google
                    </button>
                </div>
            </div>
        `;
    }
}

// Trigger Google Sign-In
function triggerGoogleSignIn() {
    if (typeof gapi === 'undefined') {
        alert('Google API not loaded. Please refresh the page and try again.');
        return;
    }

    try {
        const auth2 = gapi.auth2.getAuthInstance();
        if (auth2) {
            const options = {
                scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
                prompt: 'consent'
            };

            auth2.signIn(options)
                .then(function(googleUser) {
                    onGoogleSignIn(googleUser);
                })
                .catch(function(error) {
                    console.error('Error signing in:', error);
                    // Handle specific error cases
                    if (error && error.error) {
                        switch (error.error) {
                            case 'popup_closed_by_user':
                                // User closed the popup, don't show error
                                return;
                            case 'access_denied':
                                alert('Access denied. Please allow access to your YouTube history.');
                                return;
                            case 'immediate_failed':
                                alert('Sign-in failed. Please try again.');
                                return;
                            default:
                                alert('Error signing in with Google. Please try again or use the JSON file upload option.');
                        }
                    } else {
                        // For unknown error types
                        alert('Error signing in with Google. Please try again or use the JSON file upload option.');
                    }
                });
        } else {
            console.error('Google Sign-In not initialized');
            alert('Google Sign-In is not initialized. Please refresh the page and try again.');
        }
    } catch (error) {
        console.error('Error triggering Google Sign-In:', error);
        alert('Error signing in with Google. Please try again or use the JSON file upload option.');
    }
}

// Google Sign-In callback
function onGoogleSignIn(googleUser) {
    try {
        const auth2 = gapi.auth2.getAuthInstance();
        if (auth2.isSignedIn.get()) {
            setLoading(true);
            const accessToken = googleUser.getAuthResponse().access_token;
            console.log('Got access token, fetching YouTube history...');
            fetchYouTubeHistory(accessToken);
        } else {
            console.error('User not signed in after successful sign-in');
            alert('Error: Could not complete sign-in. Please try again.');
        }
    } catch (error) {
        console.error('Error in onGoogleSignIn:', error);
        alert('Error completing sign-in. Please try again.');
    }
}

// Fetch YouTube history using the Data API
async function fetchYouTubeHistory(accessToken) {
    try {
        const history = [];
        let nextPageToken = null;
        
        do {
            console.log('Fetching YouTube history page...');
            // Use the correct endpoint for watch history
            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=50&pageToken=${nextPageToken || ''}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('YouTube API Error Response:', errorData);
                if (response.status === 403) {
                    throw new Error('Access denied. Please make sure you have granted access to your YouTube history.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received YouTube API response:', data);
            
            if (data.error) {
                console.error('YouTube API Error:', data.error);
                if (data.error.code === 403) {
                    throw new Error('Access denied. Please make sure you have granted access to your YouTube history.');
                }
                throw new Error(data.error.message || 'Error fetching YouTube history');
            }
            
            if (!data.items || !Array.isArray(data.items)) {
                console.error('Invalid API response format:', data);
                throw new Error('Invalid response format from YouTube API');
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
                time: new Date(item.snippet.publishedAt).toISOString(),
                products: ["YouTube"],
                activityControls: ["YouTube watch history"]
            }));
            
            history.push(...items);
            nextPageToken = data.nextPageToken;
            
            console.log(`Processed ${items.length} items. Total: ${history.length}`);
            
        } while (nextPageToken);
        
        if (history.length === 0) {
            throw new Error('No YouTube history found. Please make sure you have watched videos and granted access to your history.');
        }

        console.log('Successfully fetched YouTube history:', history.length, 'items');
        processData(history);
    } catch (error) {
        console.error('Error fetching YouTube history:', error);
        alert(error.message || 'Error fetching your YouTube history. Please try again or use the JSON file upload option.');
        setLoading(false);
    }
}

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
    if (!file) {
        console.error('No file provided');
        return;
    }
    
    // File type validation
    if (!file.name.endsWith('.json')) {
        console.error('Invalid file type:', file.name);
        alert('Please upload a JSON file');
        return;
    }

    // File size validation (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
        console.error('File too large:', file.size);
        alert('File size exceeds 100MB limit. Please upload a smaller file.');
        return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            console.log('File read successfully');
            const data = JSON.parse(e.target.result);
            console.log('JSON parsed successfully');
            console.log('Data type:', typeof data);
            console.log('Is array:', Array.isArray(data));
            
            // Handle different data structures
            let historyData = data;
            if (typeof data === 'object' && !Array.isArray(data)) {
                // Try to find the history array in common locations
                if (data.history) {
                    historyData = data.history;
                } else if (data.data) {
                    historyData = data.data;
                } else if (data.items) {
                    historyData = data.items;
                } else {
                    // If it's a single item, wrap it in an array
                    historyData = [data];
                }
            }
            
            if (!Array.isArray(historyData)) {
                throw new Error('Invalid format: Could not find YouTube history data array');
            }
            
            if (historyData.length === 0) {
                throw new Error('No history data found in the file');
            }
            
            // Check if it has the expected YouTube history structure
            const firstItem = historyData[0];
            console.log('First item:', firstItem);
            
            // More lenient validation - just check if it has a title
            if (!firstItem.title) {
                throw new Error('Invalid YouTube history format - missing title');
            }
            
            processData(historyData);
        } catch (error) {
            console.error('Error processing file:', error);
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
            alert(`Error processing file: ${error.message}`);
            setLoading(false);
        }
    };

    reader.onerror = (error) => {
        console.error('Error reading file:', error);
        alert('Error reading file. Please try again.');
        setLoading(false);
    };

    reader.readAsText(file);
}

// Process the data and update the dashboard
function processData(data) {
    // Ensure DOM elements are initialized
    if (!initializeElements()) {
        console.error('Cannot process data: DOM elements not initialized');
        return;
    }

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
        totalVideos: 0,
        totalTime: 0,
        channelCounts: {},
        hourlyDistribution: Array(24).fill(0),
        dailyTimeline: {}
    };

    // Debug: Track unknown channel videos with more details
    const unknownChannelVideos = [];
    const channelDataLog = [];

    data.forEach((item, index) => {
        // Debug: Log all items before filtering
        console.log(`Processing item ${index}:`, {
            title: item.title,
            url: item.titleUrl,
            hasSubtitles: !!item.subtitles,
            subtitlesLength: item.subtitles ? item.subtitles.length : 0
        });

        // Only skip ads, keep other content
        if (item.title && (
            item.title.includes('Viewed Ads On YouTube') ||
            item.title.includes('Watched Ad') ||
            item.title.includes('Ad')
        )) {
            console.log(`Skipping ad: ${item.title}`);
            return;
        }

        stats.totalVideos++;

        // Debug: Log all channel-related data
        channelDataLog.push({
            index,
            title: item.title,
            url: item.titleUrl,
            hasSubtitles: !!item.subtitles,
            subtitlesLength: item.subtitles ? item.subtitles.length : 0,
            subtitlesData: item.subtitles,
            rawData: item
        });

        // Extract channel name with detailed logging
        let channel = 'Unknown Channel';
        if (item.subtitles && item.subtitles[0]) {
            channel = item.subtitles[0].name;
            console.log(`Found channel from subtitles: ${channel} for video: ${item.title}`);
        } else if (item.titleUrl) {
            // Try to extract channel from URL
            const channelMatch = item.titleUrl.match(/\/channel\/([^\/]+)/);
            if (channelMatch) {
                channel = channelMatch[1];
                console.log(`Found channel from URL: ${channel} for video: ${item.title}`);
            } else {
                // Try to extract from video title if it contains channel name
                const titleMatch = item.title.match(/Watched (.+?) -/);
                if (titleMatch) {
                    channel = titleMatch[1];
                    console.log(`Found channel from title: ${channel} for video: ${item.title}`);
                }
            }
        }
        
        // Debug: Log unknown channel videos with more context
        if (channel === 'Unknown Channel') {
            unknownChannelVideos.push({
                index,
                title: item.title || 'No title',
                url: item.titleUrl || 'No URL',
                time: item.time || 'No timestamp',
                hasSubtitles: !!item.subtitles,
                subtitlesLength: item.subtitles ? item.subtitles.length : 0,
                subtitlesData: item.subtitles,
                rawData: item
            });
        }
        
        // Count channels
        stats.channelCounts[channel] = (stats.channelCounts[channel] || 0) + 1;

        // Parse time and update hourly distribution
        const date = new Date(item.time);
        stats.hourlyDistribution[date.getHours()]++;

        // Update daily timeline
        const dateKey = date.toISOString().split('T')[0];
        stats.dailyTimeline[dateKey] = (stats.dailyTimeline[dateKey] || 0) + 1;
    });

    // Debug: Log comprehensive analysis
    console.group('Channel Data Analysis');
    console.log('Total videos processed:', stats.totalVideos);
    console.log('Total unknown channel videos:', unknownChannelVideos.length);
    console.log('Percentage of unknown channels:', ((unknownChannelVideos.length / stats.totalVideos) * 100).toFixed(2) + '%');
    
    console.log('\nChannel Counts:');
    Object.entries(stats.channelCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([channel, count]) => {
            console.log(`${channel}: ${count} videos`);
        });

    console.log('\nSample of Unknown Channel Videos:');
    unknownChannelVideos.slice(0, 5).forEach(video => {
        console.log('\n---');
        console.log('Title:', video.title);
        console.log('URL:', video.url);
        console.log('Has Subtitles:', video.hasSubtitles);
        console.log('Subtitles Length:', video.subtitlesLength);
        console.log('Subtitles Data:', video.subtitlesData);
        console.log('Raw Data:', video.rawData);
    });

    console.log('\nChannel Data Log Sample:');
    channelDataLog.slice(0, 5).forEach(log => {
        console.log('\n---');
        console.log('Index:', log.index);
        console.log('Title:', log.title);
        console.log('Has Subtitles:', log.hasSubtitles);
        console.log('Subtitles Length:', log.subtitlesLength);
        console.log('Subtitles Data:', log.subtitlesData);
    });
    console.groupEnd();

    // Calculate total time (assuming average video length of 10 minutes)
    stats.totalTime = stats.totalVideos * 10;

    return stats;
}

// Update dashboard with statistics
function updateDashboard(stats) {
    // Ensure DOM elements are initialized
    if (!initializeElements()) {
        console.error('Cannot update dashboard: DOM elements not initialized');
        return;
    }

    // Add reset button if not already present
    if (!document.getElementById('resetButton')) {
        const resetButton = document.createElement('button');
        resetButton.id = 'resetButton';
        resetButton.className = 'reset-button';
        resetButton.innerHTML = 'Analyze Another History';
        resetButton.onclick = resetDashboard;
        dashboard.insertBefore(resetButton, dashboard.firstChild);
    }
    
    // Update stat cards
    document.getElementById('totalVideos').textContent = stats.totalVideos.toLocaleString();
    document.getElementById('totalTime').textContent = `${Math.round(stats.totalTime / 60)} hours`;
    
    // Find top channel
    const topChannels = Object.entries(stats.channelCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    const topChannel = topChannels[0];
    document.getElementById('topChannel').textContent = topChannel ? topChannel.name : 'N/A';
    
    // Find busiest hour
    const busiestHour = stats.hourlyDistribution.indexOf(Math.max(...stats.hourlyDistribution));
    document.getElementById('busiestHour').textContent = `${busiestHour}:00`;

    // Update charts
    updateCharts(stats, topChannels);
}

// Update charts with data
function updateCharts(stats, topChannels) {
    try {
        // Check if chart elements exist
        const dailyTimelineElement = document.getElementById('dailyTimeline');
        const hourlyDistributionElement = document.getElementById('hourlyDistribution');
        const channelDistributionElement = document.getElementById('channelDistribution');

        if (!dailyTimelineElement || !hourlyDistributionElement || !channelDistributionElement) {
            console.error('Chart elements not found in DOM');
            return;
        }

        // Check if chart instances exist and are valid
        if (!dailyTimelineChart || !dailyTimelineChart.data || !dailyTimelineChart.data.datasets) {
            console.log('Reinitializing daily timeline chart');
            initializeCharts();
        }
        if (!hourlyDistributionChart || !hourlyDistributionChart.data || !hourlyDistributionChart.data.datasets) {
            console.log('Reinitializing hourly distribution chart');
            initializeCharts();
        }
        if (!channelDistributionChart || !channelDistributionChart.data || !channelDistributionChart.data.datasets) {
            console.log('Reinitializing channel distribution chart');
            initializeCharts();
        }

        // Daily Timeline Chart
        const dailyData = Object.entries(stats.dailyTimeline || {})
            .sort(([a], [b]) => a.localeCompare(b));
        
        if (dailyTimelineChart && dailyTimelineChart.data && dailyTimelineChart.data.datasets) {
            dailyTimelineChart.data.labels = dailyData.map(([date]) => date);
            dailyTimelineChart.data.datasets[0].data = dailyData.map(([,count]) => count);
            dailyTimelineChart.update('none'); // Use 'none' mode for better performance
        }

        // Hourly Distribution Chart
        if (hourlyDistributionChart && hourlyDistributionChart.data && hourlyDistributionChart.data.datasets) {
            hourlyDistributionChart.data.datasets[0].data = stats.hourlyDistribution || Array(24).fill(0);
            hourlyDistributionChart.update('none');
        }

        // Channel Distribution Chart
        if (channelDistributionChart && channelDistributionChart.data && channelDistributionChart.data.datasets) {
            const chartChannels = (topChannels || []).slice(0, 5);
            channelDistributionChart.data.labels = chartChannels.map(channel => channel.name);
            channelDistributionChart.data.datasets[0].data = chartChannels.map(channel => channel.count);
            channelDistributionChart.update('none');
        }
    } catch (error) {
        console.error('Error updating charts:', error);
        console.error('Stats:', stats);
        console.error('Top channels:', topChannels);
        // Try to reinitialize charts on error
        try {
            initializeCharts();
        } catch (initError) {
            console.error('Error reinitializing charts:', initError);
        }
    }
}

// Chart initialization
function initializeCharts() {
    try {
        // Check if chart elements exist
        const dailyTimelineElement = document.getElementById('dailyTimeline');
        const hourlyDistributionElement = document.getElementById('hourlyDistribution');
        const channelDistributionElement = document.getElementById('channelDistribution');

        if (!dailyTimelineElement || !hourlyDistributionElement || !channelDistributionElement) {
            console.error('Chart elements not found in DOM');
            return;
        }

        // Destroy existing charts if they exist
        if (dailyTimelineChart) dailyTimelineChart.destroy();
        if (hourlyDistributionChart) hourlyDistributionChart.destroy();
        if (channelDistributionChart) channelDistributionChart.destroy();

        // Daily Timeline Chart
        const dailyTimelineCtx = dailyTimelineElement.getContext('2d');
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
        const hourlyDistributionCtx = hourlyDistributionElement.getContext('2d');
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
                maintainAspectRatio: false,
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
        const channelDistributionCtx = channelDistributionElement.getContext('2d');
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

        console.log('Charts initialized successfully');
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

// Reset function
function resetDashboard() {
    // Hide dashboard
    dashboard.style.display = 'none';
    
    // Reset charts
    if (dailyTimelineChart) dailyTimelineChart.destroy();
    if (hourlyDistributionChart) hourlyDistributionChart.destroy();
    if (channelDistributionChart) channelDistributionChart.destroy();
    
    // Reset stats
    document.getElementById('totalVideos').textContent = '0';
    document.getElementById('totalTime').textContent = '0 hours';
    document.getElementById('topChannel').textContent = 'N/A';
    document.getElementById('busiestHour').textContent = '0:00';
    
    // Reset file input
    fileInput.value = '';
    
    // Reset upload content
    setLoading(false);
    
    // Sign out from Google if signed in
    if (typeof gapi !== 'undefined' && gapi.auth2) {
        const auth2 = gapi.auth2.getAuthInstance();
        if (auth2 && auth2.isSignedIn.get()) {
            auth2.signOut().then(() => {
                console.log('Signed out from Google');
            });
        }
    }
}

// Add error handling for Chart.js
window.addEventListener('error', function(e) {
    console.error('Global error:', e.message);
    console.error('Error stack:', e.stack);
});

// Add console logging for debugging
console.log('Script loaded and initialized');
console.log('Drop zone element:', dropZone);
console.log('File input element:', fileInput);

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM elements
    if (!initializeElements()) {
        console.error('Failed to initialize DOM elements');
        return;
    }

    // Initialize event listeners
    initializeEventListeners();

    // Initialize Google Sign-In
    initGoogleSignIn();

    console.log('DOM loaded and initialized');
}); 