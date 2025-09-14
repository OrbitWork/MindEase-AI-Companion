// Resource Page JavaScript 
// Import Firebase configuration
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Theme management (matching chat.js)
const THEME_KEY = 'mindmaze-theme';

// Query bank for different suggestions each login
const QUERY_BANK = {
    high: [
        'panic attack grounding 5-4-3-2-1 breathing',
        'anxiety grounding techniques 5 minutes',
        'box breathing for stress 4-4-4-4'
    ],
    moderate: [
        'guided deep breathing for anxiety 10 minutes',
        'relaxation response breathing',
        'box breathing tutorial'
    ],
    mild: [
        'mindfulness body scan 10 minutes',
        'calming meditation for focus',
        'progressive muscle relaxation short'
    ],
    low: [
        'positive affirmations short meditation',
        'short gratitude meditation',
        'breathing to start the day'
    ]
};

// Session management for different suggestions each login
const SESSION_SEED = sessionStorage.getItem('mm_res_seed') || crypto.getRandomValues(new Uint32Array(1))[0].toString();
sessionStorage.setItem('mm_res_seed', SESSION_SEED);

// State management
let currentUser = null;
let currentVideo = null;
let isModalOpen = false;
let focusableElements = [];
let lastFocusedElement = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeModal();
    initializeAuth();
});

// Theme handling (matching chat.js pattern)
function initializeTheme() {
    applyTheme();
    watchThemeChanges();
}

function applyTheme() {
    const theme = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

function watchThemeChanges() {
    // Listen for storage events from other tabs/pages
    window.addEventListener('storage', (e) => {
        if (e.key === THEME_KEY) {
            applyTheme();
        }
    });
    
    // Poll for theme changes (in case localStorage is updated on same page)
    setInterval(() => {
        const current = document.documentElement.getAttribute('data-theme');
        const saved = localStorage.getItem(THEME_KEY) || 'light';
        if (current !== saved) {
            applyTheme();
        }
    }, 1000);
}

// Authentication handling
function initializeAuth() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        const resolvedName = await updatePatientName(user);
        await loadSuggestions(user, resolvedName);
    });
}

// Patient name resolution (full name only, no email prefix)
async function updatePatientName(user) {
  const el = document.getElementById('patientName');
  let resolved = 'User';
  if (!user) { if (el) el.textContent = resolved; return resolved; }

  try {
    // Read the ROOT user doc (same place dashboard uses)
    const rootRef = doc(db, 'users', user.uid);
    const rootSnap = await getDoc(rootRef);
    if (rootSnap.exists()) {
      const data = rootSnap.data();
      if (data.name) resolved = data.name;
      else if (data.displayName) resolved = data.displayName;
    }

    // Fallbacks (no email prefix)
    if (resolved === 'User' && user.displayName) resolved = user.displayName;

    if (el) el.textContent = resolved;
    return resolved;
  } catch (err) {
    console.error('Error fetching user name:', err);
    if (el) el.textContent = resolved;
    return resolved;
  }
}


// Load video suggestions based on stress level
async function loadSuggestions(user, resolvedName = 'User') {
    const statusElement = document.getElementById('suggestionsStatus');
    const gridElement = document.getElementById('videoGrid');
    
    if (!user) {
        statusElement.textContent = 'Sign in required to get personalized suggestions.';
        statusElement.className = 'suggestions-status';
        // Set greeting for non-authenticated users
        document.getElementById('greetName').textContent = `Hello ${resolvedName}`;
        document.getElementById('greetStress').textContent = '--';
        return;
    }
    
    try {
        statusElement.textContent = 'Loading personalized suggestions...';
        statusElement.className = 'suggestions-status loading';
        
        const stressLevel = await getStressLevel(user.uid);
        const query = getRandomQueryForStress(stressLevel);
        
        // Update greeting bar
        document.getElementById('greetName').textContent = `Hello ${resolvedName}`;
        document.getElementById('greetStress').textContent = `${Math.round(stressLevel)}%`;
        
        statusElement.textContent = 'Fetching wellness videos...';
        
        const videos = await fetchYouTubeVideos(query, 8);
        
        if (videos && videos.length > 0) {
            // Shuffle results for variety
            const shuffledVideos = shuffleArray([...videos]);
            renderVideoGrid(shuffledVideos);
            statusElement.style.display = 'none';
        } else {
            statusElement.textContent = 'No videos available at the moment. Please try again later.';
            statusElement.className = 'suggestions-status';
        }
    } catch (error) {
        console.error('Error loading suggestions:', error);
        statusElement.textContent = 'Unable to load suggestions. Please check your connection and try again.';
        statusElement.className = 'suggestions-status';
    }
}

// Get stress level from Firestore (match dashboard's exact path)
async function getStressLevel(uid) {
  try {
    // 1) Same source as Dashboard "Today's Stress Level"
    const today = new Date().toLocaleDateString('en-CA'); // local date, same as dashboard
    const dailyRef = doc(db, 'users', uid, 'dailyResponses', today);
    const dailySnap = await getDoc(dailyRef);
    if (dailySnap.exists()) {
      const d = dailySnap.data();
      if (typeof d.stressScore === 'number') return d.stressScore; // <-- 60 comes from here
    }

    // 2) Your existing fallbacks
    const dashRef = doc(db, 'users', uid, 'wellbeing', 'current');
    const dashSnap = await getDoc(dashRef);
    if (dashSnap.exists() && typeof dashSnap.data().stress === 'number') {
      return dashSnap.data().stress;
    }

    const todayRef = doc(db, 'users', uid, 'wellbeing', today);
    const todaySnap = await getDoc(todayRef);
    if (todaySnap.exists()) {
      const data = todaySnap.data();
      if (typeof data.stress === 'number') return data.stress;
      if (data.mood) return inferStressFromMood(data.mood);
    }

    return 40; // only if all reads fail
  } catch (e) {
    console.error('Error fetching stress level:', e);
    return 40;
  }
}

// Get random query for stress level (different each session)
function getRandomQueryForStress(stressLevel) {
    let queryArray;
    
    if (stressLevel >= 70) {
        queryArray = QUERY_BANK.high;
    } else if (stressLevel >= 50) {
        queryArray = QUERY_BANK.moderate;
    } else if (stressLevel >= 30) {
        queryArray = QUERY_BANK.mild;
    } else {
        queryArray = QUERY_BANK.low;
    }
    
    // Use session seed to get consistent but different results per session
    const seedIndex = parseInt(SESSION_SEED) % queryArray.length;
    return queryArray[seedIndex];
}

// Map stress level to search query (exact mapping from requirements)
function mapStressToQuery(stressLevel) {
    if (stressLevel >= 70) {
        return 'panic attack grounding 5-4-3-2-1 breathing';
    } else if (stressLevel >= 50) {
        return 'guided deep breathing for anxiety box breathing';
    } else if (stressLevel >= 30) {
        return 'mindfulness body scan meditation';
    } else {
        return 'positive affirmations short meditation';
    }
}

// Fetch videos from YouTube API (using existing server endpoint)
async function fetchYouTubeVideos(query, maxResults = 8) {
    try {
        // Add cache-bust parameter for different results each session
        const url = `/api/youtube?query=${encodeURIComponent(query)}&max=${maxResults}&t=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error('Error fetching YouTube videos:', error);
        throw error;
    }
}

// Render video grid
function renderVideoGrid(videos) {
    const gridElement = document.getElementById('videoGrid');
    gridElement.innerHTML = '';
    
    videos.forEach((video, index) => {
        const videoCard = createVideoCard(video, index);
        gridElement.appendChild(videoCard);
    });
}

// Create individual video card
function createVideoCard(video, index) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.tabIndex = 0;
    card.role = 'button';
    card.setAttribute('aria-label', `Play video: ${escapeHtml(video.title)}`);
    
    card.innerHTML = `
        <img 
            src="${escapeHtml(video.thumbnail)}" 
            alt="Thumbnail for ${escapeHtml(video.title)}"
            class="video-thumbnail"
            loading="lazy"
        >
        <div class="video-info">
            <h3 class="video-title">${escapeHtml(video.title)}</h3>
            <p class="video-channel">${escapeHtml(video.channelTitle)}</p>
        </div>
    `;
    
    // Add click and keyboard event listeners
    const openModal = () => openVideoModal(video);
    card.addEventListener('click', openModal);
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal();
        }
    });
    
    return card;
}

// Modal functionality
function initializeModal() {
    const modal = document.getElementById('videoModal');
    const closeBtn = document.getElementById('modalClose');
    
    // Close modal handlers
    closeBtn.addEventListener('click', closeVideoModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeVideoModal();
        }
    });
    
    // Escape key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isModalOpen) {
            closeVideoModal();
        }
    });
    
}

// Open video modal (Netflix-style)
function openVideoModal(video) {
    currentVideo = video;
    const modal = document.getElementById('videoModal');
    const modalTitle = document.getElementById('modalTitle');
    const videoFrame = document.getElementById('videoFrame');
    
    // Set video details
    modalTitle.textContent = video.title;
    videoFrame.src = `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&mute=1&enablejsapi=1`;
    
    // Show modal
    modal.style.display = 'flex';
    isModalOpen = true;
    document.body.classList.add('modal-open');
    
    // Store last focused element and set up focus trap
    lastFocusedElement = document.activeElement;
    setupFocusTrap();
    
    // Focus the close button initially
    document.getElementById('modalClose').focus();
}

// Close video modal
function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const videoFrame = document.getElementById('videoFrame');
    
    // Clear video
    videoFrame.src = '';
    currentVideo = null;
    
    // Hide modal
    modal.style.display = 'none';
    isModalOpen = false;
    document.body.classList.remove('modal-open');
    
    // Restore focus
    if (lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }
}

// Set up focus trap for modal accessibility
function setupFocusTrap() {
    const modal = document.getElementById('videoModal');
    focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    // Remove existing listener if any
    modal.removeEventListener('keydown', handleFocusTrap);
    modal.addEventListener('keydown', handleFocusTrap);
    
    function handleFocusTrap(e) {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
    }
}

function updateFullscreenButton() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = fullscreenBtn?.querySelector('i');
    
    if (fullscreenIcon) {
        if (document.fullscreenElement) {
            fullscreenIcon.className = 'fas fa-compress';
            fullscreenBtn.setAttribute('aria-label', 'Exit fullscreen');
        } else {
            fullscreenIcon.className = 'fas fa-expand';
            fullscreenBtn.setAttribute('aria-label', 'Enter fullscreen');
        }
    }
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getLocalToday() {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
}

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function inferStressFromMood(mood) {
    if (!mood || typeof mood !== 'string') return 40;
    
    const moodLower = mood.toLowerCase();
    
    // High stress moods
    if (moodLower.includes('angry') || 
        moodLower.includes('furious') || 
        moodLower.includes('rage') ||
        moodLower.includes('panicked') ||
        moodLower.includes('overwhelmed') ||
        moodLower.includes('anxious') ||
        moodLower.includes('stressed') ||
        moodLower.includes('worried')) {
        return 75;
    }
    
    // Medium-high stress moods
    if (moodLower.includes('frustrated') ||
        moodLower.includes('irritated') ||
        moodLower.includes('nervous') ||
        moodLower.includes('tense') ||
        moodLower.includes('restless') ||
        moodLower.includes('sad') ||
        moodLower.includes('depressed') ||
        moodLower.includes('down')) {
        return 60;
    }
    
    // Medium stress moods
    if (moodLower.includes('tired') ||
        moodLower.includes('bored') ||
        moodLower.includes('neutral') ||
        moodLower.includes('okay') ||
        moodLower.includes('fine') ||
        moodLower.includes('confused') ||
        moodLower.includes('uncertain')) {
        return 45;
    }
    
    // Low stress moods
    if (moodLower.includes('calm') ||
        moodLower.includes('peaceful') ||
        moodLower.includes('relaxed') ||
        moodLower.includes('content') ||
        moodLower.includes('satisfied') ||
        moodLower.includes('good') ||
        moodLower.includes('happy') ||
        moodLower.includes('joyful') ||
        moodLower.includes('excited') ||
        moodLower.includes('energetic') ||
        moodLower.includes('optimistic')) {
        return 25;
    }
    
    // Default if no match
    return 40;
}

// Focus and visibility management for theme sync
window.addEventListener('focus', () => {
    if (currentUser) {
        applyTheme();
    }
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUser) {
        applyTheme();
    }
});

console.log('MindMaze Resources (updated) loaded ✅');