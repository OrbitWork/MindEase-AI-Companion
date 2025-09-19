// ============================================================================
// MindMaze Dashboard JavaScript - ES Module
// Patient Dashboard Logic with Firebase Integration
// ============================================================================

// Firebase imports - MUST be at the very top
import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged, 
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, 
  getDoc, 
  setDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ============================================================================
// GLOBAL VARIABLES AND CONSTANTS
// ============================================================================

// Core application state
let currentUser = null;
let stressChart = null;
let currentQuestionIndex = 0;
let dailyAnswers = [];
let selectedQuestions = [];
let isSubmittingAssessment = false;

// Simple breathing exercise state (for wellness card)
let simpleBreathingTimer = null;
let simpleBreathingTimeRemaining = 60;
let breathingPhase = 'ready';
let breathingCycleInterval = null;

// Mindfulness modal states (separate from simple breathing)
let breathingModalTimer = null;
let breathingModalTimeRemaining = 300; // 5 minutes
let breathingModalActive = false;
let currentBreathingModalPhase = 'inhale';

let focusModalTimer = null;
let focusModalTimeRemaining = 180; // 3 minutes
let focusModalActive = false;
let currentExerciseType = null;

let currentAudioPlayer = null;
let currentAudioType = null;

// Stress questions pool
const stressQuestions = [
  {
    question: "How overwhelmed do you feel today?",
    answers: ["Not at all", "Slightly", "Moderately", "Very", "Extremely"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How well did you sleep last night?",
    answers: ["Very well", "Well", "Okay", "Poorly", "Very poorly"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How anxious do you feel right now?",
    answers: ["Not anxious", "Mildly anxious", "Moderately anxious", "Very anxious", "Extremely anxious"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How much control do you feel over your life today?",
    answers: ["Complete control", "Good control", "Some control", "Little control", "No control"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How would you rate your energy level?",
    answers: ["Very high", "High", "Moderate", "Low", "Very low"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How satisfied are you with your relationships today?",
    answers: ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very dissatisfied"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How physically tense do you feel?",
    answers: ["Not tense", "Slightly tense", "Moderately tense", "Very tense", "Extremely tense"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How difficult is it to concentrate today?",
    answers: ["Very easy", "Easy", "Moderate", "Difficult", "Very difficult"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How optimistic do you feel about the future?",
    answers: ["Very optimistic", "Optimistic", "Neutral", "Pessimistic", "Very pessimistic"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How much do work/school pressures affect you today?",
    answers: ["Not at all", "Slightly", "Moderately", "Significantly", "Extremely"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How well are you managing your daily responsibilities?",
    answers: ["Very well", "Well", "Okay", "Poorly", "Very poorly"],
    weights: [1, 2, 3, 4, 5]
  },
  {
    question: "How emotionally balanced do you feel?",
    answers: ["Very balanced", "Balanced", "Somewhat balanced", "Unbalanced", "Very unbalanced"],
    weights: [1, 2, 3, 4, 5]
  }
];

// Motivational quotes
const dailyQuotes = [
  "Take time to make your soul happy.",
  "Peace comes from within. Do not seek it without.",
  "You are stronger than you think and more resilient than you know.",
  "Every day is a new beginning. Take a deep breath and start again.",
  "Your mental health is a priority. Your happiness is essential.",
  "It's okay to not be okay. What matters is that you're here.",
  "Small steps in the right direction can turn out to be the biggest step of your life.",
  "You have been assigned this mountain to show others it can be moved.",
  "Healing isn't linear. Be patient with yourself.",
  "Your current situation is not your final destination.",
  "Breathe in peace, breathe out stress.",
  "You are enough, just as you are.",
  "Progress, not perfection.",
  "One day at a time, one breath at a time.",
  "Your journey matters, and so do you."
];

// Daily journal prompts
const journalPrompts = [
  "What are three things you're grateful for today?",
  "Describe a moment that made you smile recently.",
  "What is one challenge you overcame this week?",
  "How did you practice self-care today?",
  "What would you tell your past self from a year ago?",
  "Describe your ideal peaceful day.",
  "What small accomplishment are you proud of today?",
  "How did you connect with others today?",
  "What lesson did you learn recently?",
  "What are you looking forward to tomorrow?",
  "Describe something beautiful you noticed today.",
  "How did you step outside your comfort zone recently?",
  "What positive change have you made in your life?",
  "What would you like to let go of today?",
  "How did you show kindness to yourself or others?",
  "What skills or talents are you developing?",
  "Describe a place where you feel most at peace.",
  "What advice would you give to a friend facing your current challenges?",
  "How have you grown as a person this month?",
  "What simple pleasure brought you joy today?",
  "What are you most curious about right now?",
  "How did you make today meaningful?",
  "What positive habit are you building?",
  "Describe a recent conversation that impacted you.",
  "What does success mean to you today?",
  "How did you practice mindfulness today?",
  "What boundaries are you learning to set?",
  "What would you like to remember about this day?",
  "How did you nurture your relationships today?",
  "What inspires you to keep moving forward?"
];

// DOM element references - cached for performance
let domElements = {};

// ============================================================================
// INITIALIZATION - SINGLE ENTRY POINT
// ============================================================================

// Wait for DOM to be ready, then initialize Firebase auth listener
document.addEventListener('DOMContentLoaded', function() {
  console.log('MindMaze Dashboard initializing...');
  
  // Cache DOM elements
  cacheDOMElements();
  
  // Setup Firebase auth listener - SINGLE ENTRY POINT
  initializeFirebaseAuth();
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup new wellness features
  setupWellnessFeatures();
  
  // Setup theme toggle
  setupThemeToggle();
  
  // Enable comprehensive activity tracking
  logAllActivities();
});

function updateActivityDisplay(activities) {
  console.log('🔄 Updating activity display with', activities.length, 'activities');
  
  if (!domElements.activityList) {
    console.warn('⚠️ Activity list element not found');
    return;
  }
  
  if (activities.length === 0) {
    domElements.activityList.innerHTML = `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="fas fa-info-circle text-muted"></i>
        </div>
        <div class="activity-content">
          <div class="activity-title">No activities yet</div>
          <div class="activity-time">Start using features to see your activity log</div>
        </div>
      </div>
    `;
    return;
  }
  
  const activityHTML = activities.map(activity => {
    const timeAgo = getTimeAgo(activity.timestamp);
    return `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="${activity.icon} ${activity.color}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
  
  domElements.activityList.innerHTML = activityHTML;
  console.log('✅ Activity display updated successfully');
}

// Cache DOM elements for better performance
function cacheDOMElements() {
  domElements = {
    patientName: document.getElementById('patientName'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    currentStress: document.getElementById('currentStress'),
    stressStatusLabel: document.getElementById('stressStatusLabel'),
    todayStressProgress: document.getElementById('todayStressProgress'),
    avgStress: document.getElementById('avgStress'),
    minStress: document.getElementById('minStress'),
    maxStress: document.getElementById('maxStress'),
    weeklyProgress: document.getElementById('weeklyProgress'),
    activityList: document.getElementById('activityList'),
    logoutBtn: document.getElementById('logoutBtn'),
    dailyGreeting: document.getElementById('dailyGreeting'),
    dailyQuote: document.getElementById('dailyQuote')
  };
  
  console.log('DOM elements cached successfully');
}

// ============================================================================
// THEME TOGGLE FUNCTIONALITY
// ============================================================================

function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;
  
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('mindmaze-theme') || 'light';
  html.setAttribute('data-theme', savedTheme);
  
  if (themeToggle) {
    // Update toggle icon based on current theme
    updateThemeToggleIcon(savedTheme);
    
    themeToggle.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('mindmaze-theme', newTheme);
      updateThemeToggleIcon(newTheme);
    });
  }
}

function updateThemeToggleIcon(theme) {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    if (icon) {
      icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }
}

// ============================================================================
// FIREBASE AUTHENTICATION - SINGLE ENTRY POINT
// ============================================================================

function initializeFirebaseAuth() {
  console.log('Setting up Firebase authentication listener...');
  
  // This is the SINGLE ENTRY POINT for the entire application
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('User authenticated successfully:', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      });
      
      // Set global user reference
      currentUser = user;
      
      try {
        // Show loading state
        showLoadingState();
        
        // Load all patient data in sequence
        await loadUserProfile();
        await loadTodayData();
        await loadHistoricalData();
        await checkDailyAssessment();
        
        // Initialize Mindmaze Mood Tracker on every login
        setTimeout(() => {
          initializeMoodTracker();
        }, 1000); // Small delay to ensure DOM is ready
        
        console.log('Dashboard initialization completed successfully');
        
      } catch (error) {
        console.error('Error during dashboard initialization:', error);
        showErrorState('Failed to load dashboard data');
      }
      
    } else {
      console.log('No user authenticated, redirecting to login');
      window.location.href = 'Login-Signup.html';
    }
  });
}

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

async function loadUserProfile() {
  console.log('Loading user profile for UID:', currentUser.uid);
  
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    let userData;
    if (userDoc.exists()) {
      userData = userDoc.data();
      console.log('Existing user profile loaded:', userData);
    } else {
      console.log('No user profile found, creating default profile');
      userData = await createDefaultProfile();
    }
    
    updateProfileDisplay(userData);
    
  } catch (error) {
    console.error('Error loading user profile:', error);
    throw error;
  }
}

async function createDefaultProfile() {
  const defaultProfile = {
    name: currentUser.displayName || currentUser.email?.split('@')[0] || 'MindMaze Patient',
    email: currentUser.email,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp()
  };
  
  try {
    await setDoc(doc(db, 'users', currentUser.uid), defaultProfile);
    console.log('Default user profile created:', defaultProfile);
    return defaultProfile;
  } catch (error) {
    console.error('Error creating default profile:', error);
    throw error;
  }
}

function updateProfileDisplay(userData) {
  const displayName = userData.name || userData.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Patient';
  const email = userData.email || currentUser.email || 'No email';
  
  console.log('Updating profile display:', { displayName, email });
  
  // Update profile elements
  if (domElements.patientName) domElements.patientName.textContent = displayName;
  if (domElements.profileName) domElements.profileName.textContent = displayName;
  if (domElements.profileEmail) domElements.profileEmail.textContent = email;
  
  // Update greeting and quote
  if (domElements.dailyGreeting) {
    const greeting = generateDailyGreeting(displayName);
    domElements.dailyGreeting.innerHTML = greeting.replace(displayName, `<span>${displayName}</span>`);
  }
  
  if (domElements.dailyQuote) {
    domElements.dailyQuote.textContent = getDailyQuote();
  }
  
  console.log('Profile display updated successfully');
}

// ============================================================================
// TODAY'S DATA LOADING
// ============================================================================

async function loadTodayData() {
  const today = new Date().toLocaleDateString("en-CA");
  
  console.log("Loading today's data for:", today);

  try {
    // Load all today's data in parallel
    const [stressDoc, moodDoc, journalDoc] = await Promise.all([
      getDoc(doc(db, "users", currentUser.uid, "dailyResponses", today)),
      getDoc(doc(db, "users", currentUser.uid, "moodLogs", today)),
      getDoc(doc(db, "users", currentUser.uid, "journal", today))
    ]);

    // --- Stress Assessment ---
    if (stressDoc.exists()) {
      const stressData = stressDoc.data();
      console.log("Today's stress data found:", stressData.stressScore);
      updateTodayStressDisplay(stressData.stressScore);
    } else {
      console.log("No stress assessment found for today");
    }

    // --- Mood Log ---
    if (moodDoc.exists()) {
      const moodData = moodDoc.data();
      console.log("Today's mood data found:", moodData);
      displaySelectedMood(moodData.emoji, moodData.text);
      disableMoodSelector();
    } else {
      console.log("No mood log found for today");
      enableMoodSelector();
    }

    // --- Journal Prompt ---
    if (journalDoc.exists()) {
      const journalData = journalDoc.data();
      console.log("Today's journal data found");
      displaySavedJournalEntry(journalData.entry);
    } else {
      console.log("No journal entry found for today");
      showJournalInput();
      loadDailyJournalPrompt(); // Load the prompt here
    }
  } catch (error) {
    console.error("Error loading today's data:", error);
    throw error;
  }
}

function enableMoodSelector() {
  const moodSection = document.getElementById("moodSelector");
  if (moodSection) {
    moodSection.style.display = "block";
    const moodOptions = moodSection.querySelectorAll(".mood-option");
    moodOptions.forEach(option => {
      option.disabled = false;
      option.style.pointerEvents = 'auto';
    });
  }
}

function showJournalInput() {
  const journalInput = document.getElementById("journalInput");
  const journalSaved = document.getElementById("journalSaved");
  
  if (journalInput) journalInput.style.display = "block";
  if (journalSaved) journalSaved.style.display = "none";
}

// ============================================================================
// HISTORICAL DATA LOADING
// ============================================================================

async function loadHistoricalData() {
  console.log('Loading historical data...');
  
  try {
    await Promise.all([
      loadStressHistory(),
      loadActivityHistory()
    ]);
    
    console.log('Historical data loaded successfully');
    
  } catch (error) {
    console.error('Error loading historical data:', error);
    throw error;
  }
}

async function loadStressHistory() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const stressQuery = query(
      collection(db, 'users', currentUser.uid, 'stressLogs'),
      where('timestamp', '>=', oneWeekAgo),
      orderBy('timestamp', 'asc')
    );
    
    const stressSnapshot = await getDocs(stressQuery);
    
    let stressData = [];
    if (stressSnapshot.empty) {
      stressData = generateSampleStressData();
      console.log('Using sample stress data for demonstration');
    } else {
      stressData = stressSnapshot.docs.map(doc => ({
        date: doc.data().timestamp.toDate(),
        stress: doc.data().stressLevel
      }));
      console.log('Loaded stress history:', stressData.length, 'entries');
    }
    
    updateStressStats(stressData);
    createStressChart(stressData);
    
  } catch (error) {
    console.error('Error loading stress history:', error);
    // Use sample data on error
    const sampleData = generateSampleStressData();
    updateStressStats(sampleData);
    createStressChart(sampleData);
  }
}

async function loadActivityHistory() {
  try {
    const activityQuery = query(
      collection(db, 'users', currentUser.uid, 'activities'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const activitySnapshot = await getDocs(activityQuery);
    
    let activities = [];
    if (activitySnapshot.empty) {
      activities = generateSampleActivities();
      console.log('Using sample activity data for demonstration');
    } else {
      activities = activitySnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      }));
      console.log('Loaded activity history:', activities.length, 'entries');
    }
    
    updateActivityDisplay(activities);
    
  } catch (error) {
    console.error('Error loading activity history:', error);
    updateActivityDisplay(generateSampleActivities());
  }
}

// ============================================================================
// DAILY MOOD TRACKER
// ============================================================================

function setupMoodTracker() {
  console.log('Setting up mood tracker');
  
  const moodOptions = document.querySelectorAll('.mood-option');
  
  moodOptions.forEach(option => {
    option.addEventListener('click', async function() {
      const moodOptionsContainer = document.querySelector('.mood-options');
      if (moodOptionsContainer && moodOptionsContainer.classList.contains('disabled')) {
        console.log('Mood selector is disabled');
        return;
      }
      
      const mood = this.dataset.mood;
      const emoji = this.dataset.emoji;
      const text = this.dataset.text;
      const value = parseInt(this.dataset.value);
      
      console.log('Mood selected:', { mood, emoji, text, value });
      
      // Visual feedback
      moodOptions.forEach(opt => opt.classList.remove('selected'));
      this.classList.add('selected');
      
      await saveMoodLog(mood, emoji, text, value);
    });
  });
}

async function saveMoodLog(mood, emoji, text, value) {
  console.log('Saving mood log:', { mood, emoji, text, value });
  
  try {
    const today = new Date().toLocaleDateString("en-CA");
    
    await setDoc(doc(db, 'users', currentUser.uid, 'moodLogs', today), {
      mood: mood,
      emoji: emoji,
      text: text,
      value: value,
      timestamp: serverTimestamp(),
      date: today
    });
    
    console.log('Mood log saved successfully');
    
    displaySelectedMood(emoji, text);
    disableMoodSelector();
    
    await logActivity('mood', `Logged mood: ${text}`, 'fas fa-smile', 'text-success');
    
  } catch (error) {
    console.error('Error saving mood log:', error);
    alert('Error saving mood. Please try again.');
  }
}

function displaySelectedMood(emoji, text) {
  console.log('Displaying selected mood:', { emoji, text });
  
  const moodSnapshot = document.getElementById('moodSnapshot');
  const selectedMoodEmoji = document.getElementById('selectedMoodEmoji');
  const selectedMoodText = document.getElementById('selectedMoodText');
  const moodSelector = document.getElementById('moodSelector');
  
  if (selectedMoodEmoji) selectedMoodEmoji.textContent = emoji;
  if (selectedMoodText) selectedMoodText.textContent = text;
  if (moodSnapshot) moodSnapshot.style.display = 'block';
  if (moodSelector) moodSelector.style.display = 'none';
}

function disableMoodSelector() {
  const moodOptionsContainer = document.querySelector('.mood-options');
  if (moodOptionsContainer) {
    moodOptionsContainer.classList.add('disabled');
    console.log('Disabled mood selector');
  }
}

// ============================================================================
// DAILY JOURNAL PROMPT
// ============================================================================

function setupJournalPrompt() {
  console.log('Setting up journal prompt');
  
  const saveBtn = document.getElementById('saveJournalEntry');
  saveBtn?.addEventListener('click', saveJournalEntry);
}

function loadDailyJournalPrompt() {
  const promptTextEl = document.getElementById('dailyPromptText');
  
  if (promptTextEl) {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const promptIndex = dayOfYear % journalPrompts.length;
    const todayPrompt = journalPrompts[promptIndex];
    
    promptTextEl.textContent = todayPrompt;
    console.log('Loaded daily journal prompt:', todayPrompt);
  }
}

async function saveJournalEntry() {
  console.log('Saving journal entry');
  
  try {
    const journalEntryEl = document.getElementById('journalEntry');
    const entryText = journalEntryEl?.value.trim();
    
    if (!entryText) {
      alert('Please write something before saving your journal entry.');
      return;
    }
    
    const today = new Date().toLocaleDateString("en-CA");
    
    await setDoc(doc(db, 'users', currentUser.uid, 'journal', today), {
      entry: entryText,
      timestamp: serverTimestamp(),
      date: today,
      promptIndex: Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24) % journalPrompts.length
    });
    
    console.log('Journal entry saved successfully');
    
    displaySavedJournalEntry(entryText);
    await logActivity('journal', 'Completed daily journal entry', 'fas fa-journal-whills', 'text-info');
    
  } catch (error) {
    console.error('Error saving journal entry:', error);
    alert('Error saving journal entry. Please try again.');
  }
}

function displaySavedJournalEntry(entryText) {
  console.log('Displaying saved journal entry');
  
  const journalInput = document.getElementById('journalInput');
  const journalSaved = document.getElementById('journalSaved');
  const savedEntryText = document.getElementById('savedEntryText');
  
  if (savedEntryText) savedEntryText.textContent = entryText;
  if (journalInput) journalInput.style.display = 'none';
  if (journalSaved) journalSaved.style.display = 'block';
}

// ============================================================================
// SIMPLE BREATHING EXERCISE (WELLNESS CARD)
// ============================================================================

function setupSimpleBreathing() {
  console.log('Setting up simple breathing exercise');
  
  const startBtn = document.getElementById('startSimpleBreathing');
  const stopBtn = document.getElementById('stopSimpleBreathing');
  
  startBtn?.addEventListener('click', startSimpleBreathingExercise);
  stopBtn?.addEventListener('click', stopSimpleBreathingExercise);
}

function startSimpleBreathingExercise() {
  console.log('Starting simple breathing exercise');
  
  const startBtn = document.getElementById('startSimpleBreathing');
  const stopBtn = document.getElementById('stopSimpleBreathing');
  
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'inline-block';
  
  simpleBreathingTimeRemaining = 60;
  updateSimpleBreathingTimer();
  
  simpleBreathingTimer = setInterval(() => {
    simpleBreathingTimeRemaining--;
    updateSimpleBreathingTimer();
    
    if (simpleBreathingTimeRemaining <= 0) {
      completeSimpleBreathingExercise();
    }
  }, 1000);
  
  startBreathingCycle();
}

function stopSimpleBreathingExercise() {
  console.log('Stopping simple breathing exercise');
  
  const startBtn = document.getElementById('startSimpleBreathing');
  const stopBtn = document.getElementById('stopSimpleBreathing');
  const instruction = document.getElementById('breathingInstructionSimple');
  const circle = document.getElementById('breathingCircleSimple');
  
  if (simpleBreathingTimer) {
    clearInterval(simpleBreathingTimer);
    simpleBreathingTimer = null;
  }
  if (breathingCycleInterval) {
    clearInterval(breathingCycleInterval);
    breathingCycleInterval = null;
  }
  
  if (startBtn) startBtn.style.display = 'inline-block';
  if (stopBtn) stopBtn.style.display = 'none';
  if (instruction) instruction.textContent = 'Ready to begin';
  if (circle) circle.className = 'breathing-circle-simple';
  
  simpleBreathingTimeRemaining = 60;
  updateSimpleBreathingTimer();
  breathingPhase = 'ready';
}

async function completeSimpleBreathingExercise() {
  console.log('Completing simple breathing exercise');
  
  stopSimpleBreathingExercise();
  
  const instruction = document.getElementById('breathingInstructionSimple');
  if (instruction) instruction.textContent = 'Exercise complete!';
  
  await logActivity('breathing', '1-minute breathing exercise completed', 'fas fa-wind', 'text-primary');
  
  setTimeout(() => {
    if (instruction) instruction.textContent = 'Ready to begin';
  }, 3000);
}

function startBreathingCycle() {
  const circle = document.getElementById('breathingCircleSimple');
  const instruction = document.getElementById('breathingInstructionSimple');
  let cyclePhase = 0;
  
  function nextPhase() {
    if (!simpleBreathingTimer) return;
    
    switch (cyclePhase) {
      case 0: // Breathe In
        if (circle) circle.className = 'breathing-circle-simple breathe-in';
        if (instruction) instruction.textContent = 'Breathe In...';
        setTimeout(() => { cyclePhase = 1; nextPhase(); }, 4000);
        break;
      case 1: // Hold
        if (circle) circle.className = 'breathing-circle-simple hold';
        if (instruction) instruction.textContent = 'Hold...';
        setTimeout(() => { cyclePhase = 2; nextPhase(); }, 2000);
        break;
      case 2: // Breathe Out
        if (circle) circle.className = 'breathing-circle-simple breathe-out';
        if (instruction) instruction.textContent = 'Breathe Out...';
        setTimeout(() => { cyclePhase = 3; nextPhase(); }, 4000);
        break;
      case 3: // Rest
        if (circle) circle.className = 'breathing-circle-simple rest';
        if (instruction) instruction.textContent = 'Rest...';
        setTimeout(() => { cyclePhase = 0; nextPhase(); }, 2000);
        break;
    }
  }
  
  nextPhase();
}

function updateSimpleBreathingTimer() {
  const timerDisplay = document.getElementById('breathingTimerDisplay');
  if (timerDisplay) {
    const minutes = Math.floor(simpleBreathingTimeRemaining / 60);
    const seconds = simpleBreathingTimeRemaining % 60;
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

// ============================================================================
// MINDFULNESS RECOMMENDATIONS - MODAL FUNCTIONALITY
// ============================================================================

// Modal openers
function openBreathingModal() {
    const modal = new bootstrap.Modal(document.getElementById('breathingModal'));
    modal.show();
    resetBreathingModalSession();
}

function openSoundsModal() {
    const modal = new bootstrap.Modal(document.getElementById('soundsModal'));
    modal.show();
    resetSoundPlayer();
}

function openStoriesModal() {
    const modal = new bootstrap.Modal(document.getElementById('storiesModal'));
    modal.show();
    resetStoryPlayer();
}

function openFocusModal() {
    const modal = new bootstrap.Modal(document.getElementById('focusModal'));
    modal.show();
    resetFocusModalSession();
}

// Deep Breathing Modal (5-minute)
function resetBreathingModalSession() {
    breathingModalTimeRemaining = 300;
    breathingModalActive = false;
    currentBreathingModalPhase = 'inhale';
    
    if (breathingModalTimer) {
        clearInterval(breathingModalTimer);
        breathingModalTimer = null;
    }
    
    updateBreathingModalDisplay();
    resetBreathingModalControls();
    resetBreathingModalVisual();
}

function updateBreathingModalDisplay() {
    const timerEl = document.getElementById('breathingTimer');
    if (timerEl) {
        const minutes = Math.floor(breathingModalTimeRemaining / 60);
        const seconds = breathingModalTimeRemaining % 60;
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function resetBreathingModalControls() {
    const startBtn = document.getElementById('startBreathing');
    const pauseBtn = document.getElementById('pauseBreathing');
    const stopBtn = document.getElementById('stopBreathing');
    const instructionEl = document.getElementById('breathingInstruction');
    
    if (startBtn) startBtn.style.display = 'inline-block';
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';
    if (instructionEl) instructionEl.textContent = 'Get ready to breathe deeply';
}

function resetBreathingModalVisual() {
    const circle = document.getElementById('breathingCircle');
    if (circle) {
        circle.classList.remove('breathe-in', 'breathe-out');
    }
}

function startBreathingModalSession() {
    breathingModalActive = true;
    const startBtn = document.getElementById('startBreathing');
    const pauseBtn = document.getElementById('pauseBreathing');
    const stopBtn = document.getElementById('stopBreathing');
    const instructionEl = document.getElementById('breathingInstruction');
    
    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'inline-block';
    if (instructionEl) instructionEl.textContent = 'Breathe in slowly...';
    
    // Start the timer
    breathingModalTimer = setInterval(() => {
        breathingModalTimeRemaining--;
        updateBreathingModalDisplay();
        
        if (breathingModalTimeRemaining <= 0) {
            completeBreathingModalSession();
        }
    }, 1000);
    
    // Start breathing animation
    startBreathingModalAnimation();
}

function pauseBreathingModalSession() {
    breathingModalActive = false;
    const startBtn = document.getElementById('startBreathing');
    const pauseBtn = document.getElementById('pauseBreathing');
    const instructionEl = document.getElementById('breathingInstruction');
    
    if (breathingModalTimer) {
        clearInterval(breathingModalTimer);
        breathingModalTimer = null;
    }
    
    if (startBtn) startBtn.style.display = 'inline-block';
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (instructionEl) instructionEl.textContent = 'Paused - Click Start to continue';
    
    resetBreathingModalVisual();
}

function stopBreathingModalSession() {
    resetBreathingModalSession();
}

function completeBreathingModalSession() {
    breathingModalActive = false;
    if (breathingModalTimer) {
        clearInterval(breathingModalTimer);
        breathingModalTimer = null;
    }
    
    const instructionEl = document.getElementById('breathingInstruction');
    if (instructionEl) instructionEl.textContent = 'Session complete! Well done.';
    
    resetBreathingModalControls();
    resetBreathingModalVisual();
    
    // Log activity if function exists
    if (typeof logActivity === 'function') {
        logActivity('breathing', '5-minute breathing exercise completed', 'fas fa-spa', 'text-primary');
    }
    
    // Auto-close modal after 3 seconds
    setTimeout(() => {
        const modal = bootstrap.Modal.getInstance(document.getElementById('breathingModal'));
        if (modal) modal.hide();
    }, 3000);
}

function startBreathingModalAnimation() {
    if (!breathingModalActive) return;
    
    const circle = document.getElementById('breathingCircle');
    const instructionEl = document.getElementById('breathingInstruction');
    
    if (currentBreathingModalPhase === 'inhale') {
        if (circle) circle.classList.add('breathe-in');
        if (instructionEl) instructionEl.textContent = 'Breathe in slowly...';
        currentBreathingModalPhase = 'exhale';
        setTimeout(() => startBreathingModalAnimation(), 4000); // 4 seconds inhale
    } else {
        if (circle) {
            circle.classList.remove('breathe-in');
            circle.classList.add('breathe-out');
        }
        if (instructionEl) instructionEl.textContent = 'Breathe out slowly...';
        currentBreathingModalPhase = 'inhale';
        setTimeout(() => {
            if (circle) circle.classList.remove('breathe-out');
            setTimeout(() => startBreathingModalAnimation(), 1000); // 1 second pause
        }, 4000); // 4 seconds exhale
    }
}

// ============================================================================
// CALMING SOUNDS - COMPLETELY FIXED AUDIO FUNCTIONALITY
// ============================================================================

function resetSoundPlayer() {
    console.log('Resetting sound player');
    if (currentAudioPlayer && currentAudioType === 'sound') {
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
        currentAudioPlayer.removeAttribute('src');
        currentAudioPlayer.load();
    }
    
    const controls = document.getElementById('soundControls');
    if (controls) controls.style.display = 'none';
    
    // Clear current audio references
    if (currentAudioType === 'sound') {
        currentAudioPlayer = null;
        currentAudioType = null;
    }
}

function playSound(soundFile, soundName) {
    console.log('=== PLAY SOUND DEBUG ===');
    console.log('playSound called:', soundFile, soundName);
    
    const player = document.getElementById('soundPlayer');
    const controls = document.getElementById('soundControls');
    const nameEl = document.getElementById('currentSoundName');
    const playBtn = document.getElementById('soundPlayBtn');
    const pauseBtn = document.getElementById('soundPauseBtn');
    
    if (!player) {
        console.error('❌ Sound player element not found');
        return;
    }
    
    console.log('✅ Player found:', player);
    
    // Stop any current audio
    if (currentAudioPlayer && currentAudioPlayer !== player) {
        console.log('🛑 Stopping current audio');
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
    }
    
    currentAudioPlayer = player;
    currentAudioType = 'sound';
    
    // Set the audio source with multiple fallbacks
    const audioPaths = [
        `/assets/sounds/${soundFile}.mp3`,
        `./assets/sounds/${soundFile}.mp3`,
        `assets/sounds/${soundFile}.mp3`,
        // Fallback to a test audio file
        `https://www.soundjay.com/misc/sounds-1015.wav`
    ];
    
    let currentPathIndex = 0;
    
    function tryNextPath() {
        if (currentPathIndex >= audioPaths.length) {
            console.error('❌ All audio paths failed');
            if (nameEl) nameEl.textContent = `${soundName} - All sources failed`;
            setTimeout(() => {
                if (controls) controls.style.display = 'none';
            }, 3000);
            return;
        }
        
        const audioPath = audioPaths[currentPathIndex];
        console.log(`🔄 Trying path ${currentPathIndex + 1}/${audioPaths.length}:`, audioPath);
        
        // Clear previous listeners
        player.removeEventListener('loadstart', handleLoadStart);
        player.removeEventListener('canplay', handleCanPlay);
        player.removeEventListener('canplaythrough', handleCanPlayThrough);
        player.removeEventListener('error', handleError);
        player.removeEventListener('ended', handleEnded);
        
        // Add new listeners
        function handleLoadStart() {
            console.log('📥 Audio load started...');
        }
        
        function handleCanPlay() {
            console.log('✅ Audio can play');
        }
        
        function handleCanPlayThrough() {
            console.log('✅ Audio can play through');
        }
        
        function handleError(e) {
            console.error(`❌ Audio error on path ${currentPathIndex + 1}:`, e);
            console.error('Error details:', {
                code: e.target?.error?.code,
                message: e.target?.error?.message,
                src: e.target?.src
            });
            
            currentPathIndex++;
            setTimeout(tryNextPath, 100);
        }
        
        function handleEnded() {
            console.log('🏁 Sound ended');
            if (controls) controls.style.display = 'none';
            if (playBtn) playBtn.style.display = 'inline-block';
            if (pauseBtn) pauseBtn.style.display = 'none';
        }
        
        player.addEventListener('loadstart', handleLoadStart);
        player.addEventListener('canplay', handleCanPlay);
        player.addEventListener('canplaythrough', handleCanPlayThrough);
        player.addEventListener('error', handleError);
        player.addEventListener('ended', handleEnded);
        
        // Set source and try to play
        player.src = audioPath;
        player.load();
        
        if (nameEl) nameEl.textContent = soundName;
        if (controls) controls.style.display = 'flex';
        
        // Add a small delay before playing
        setTimeout(() => {
            const playPromise = player.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('🎵 Sound started playing successfully!');
                    if (playBtn) playBtn.style.display = 'none';
                    if (pauseBtn) pauseBtn.style.display = 'inline-block';
                    
                    // Log activity
                    logActivity('sounds', `Listened to ${soundName}`, 'fas fa-music', 'text-warning');
                    
                }).catch(error => {
                    console.error('❌ Play promise rejected:', error);
                    
                    // Try user interaction prompt for autoplay policy
                    if (error.name === 'NotAllowedError') {
                        console.log('🔒 Autoplay blocked - user interaction required');
                        if (nameEl) nameEl.textContent = `${soundName} - Click play to start`;
                        if (playBtn) playBtn.style.display = 'inline-block';
                        if (pauseBtn) pauseBtn.style.display = 'none';
                    } else {
                        currentPathIndex++;
                        setTimeout(tryNextPath, 100);
                    }
                });
            }
        }, 200);
    }
    
    // Start trying paths
    tryNextPath();
}

// ============================================================================
// SLEEP STORIES - COMPLETELY FIXED AUDIO FUNCTIONALITY
// ============================================================================

function resetStoryPlayer() {
    console.log('Resetting story player');
    if (currentAudioPlayer && currentAudioType === 'story') {
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
        currentAudioPlayer.removeAttribute('src');
        currentAudioPlayer.load();
    }
    
    const controls = document.getElementById('storyControls');
    if (controls) controls.style.display = 'none';
    
    // Clear current audio references
    if (currentAudioType === 'story') {
        currentAudioPlayer = null;
        currentAudioType = null;
    }
}

function playStory(storyFile, storyName) {
    console.log('=== PLAY STORY DEBUG ===');
    console.log('playStory called:', storyFile, storyName);
    
    const player = document.getElementById('storyPlayer');
    const controls = document.getElementById('storyControls');
    const nameEl = document.getElementById('currentStoryName');
    const playBtn = document.getElementById('storyPlayBtn');
    const pauseBtn = document.getElementById('storyPauseBtn');
    
    if (!player) {
        console.error('❌ Story player element not found');
        return;
    }
    
    console.log('✅ Player found:', player);
    
    // Stop any current audio
    if (currentAudioPlayer && currentAudioPlayer !== player) {
        console.log('🛑 Stopping current audio');
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
    }
    
    currentAudioPlayer = player;
    currentAudioType = 'story';
    
    // Set the audio source with multiple fallbacks
    const audioPaths = [
        `/assets/stories/${storyFile}.mp3`,
        `./assets/stories/${storyFile}.mp3`,
        `assets/stories/${storyFile}.mp3`,
        // Fallback to a test audio file
        `https://www.soundjay.com/misc/sounds-1015.wav`
    ];
    
    let currentPathIndex = 0;
    
    function tryNextPath() {
        if (currentPathIndex >= audioPaths.length) {
            console.error('❌ All audio paths failed');
            if (nameEl) nameEl.textContent = `${storyName} - All sources failed`;
            setTimeout(() => {
                if (controls) controls.style.display = 'none';
            }, 3000);
            return;
        }
        
        const audioPath = audioPaths[currentPathIndex];
        console.log(`🔄 Trying path ${currentPathIndex + 1}/${audioPaths.length}:`, audioPath);
        
        // Clear previous listeners
        player.removeEventListener('loadstart', handleLoadStart);
        player.removeEventListener('canplay', handleCanPlay);
        player.removeEventListener('canplaythrough', handleCanPlayThrough);
        player.removeEventListener('error', handleError);
        player.removeEventListener('ended', handleEnded);
        
        // Add new listeners
        function handleLoadStart() {
            console.log('📥 Story load started...');
        }
        
        function handleCanPlay() {
            console.log('✅ Story can play');
        }
        
        function handleCanPlayThrough() {
            console.log('✅ Story can play through');
        }
        
        function handleError(e) {
            console.error(`❌ Story error on path ${currentPathIndex + 1}:`, e);
            console.error('Error details:', {
                code: e.target?.error?.code,
                message: e.target?.error?.message,
                src: e.target?.src
            });
            
            currentPathIndex++;
            setTimeout(tryNextPath, 100);
        }
        
        function handleEnded() {
            console.log('🏁 Story ended');
            if (controls) controls.style.display = 'none';
            if (playBtn) playBtn.style.display = 'inline-block';
            if (pauseBtn) pauseBtn.style.display = 'none';
        }
        
        player.addEventListener('loadstart', handleLoadStart);
        player.addEventListener('canplay', handleCanPlay);
        player.addEventListener('canplaythrough', handleCanPlayThrough);
        player.addEventListener('error', handleError);
        player.addEventListener('ended', handleEnded);
        
        // Set source and try to play
        player.src = audioPath;
        player.load();
        
        if (nameEl) nameEl.textContent = storyName;
        if (controls) controls.style.display = 'flex';
        
        // Add a small delay before playing
        setTimeout(() => {
            const playPromise = player.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('🎵 Story started playing successfully!');
                    if (playBtn) playBtn.style.display = 'none';
                    if (pauseBtn) pauseBtn.style.display = 'inline-block';
                    
                    // Log activity
                    logActivity('story', `Played ${storyName} sleep story`, 'fas fa-moon', 'text-secondary');
                    
                }).catch(error => {
                    console.error('❌ Play promise rejected:', error);
                    
                    // Try user interaction prompt for autoplay policy
                    if (error.name === 'NotAllowedError') {
                        console.log('🔒 Autoplay blocked - user interaction required');
                        if (nameEl) nameEl.textContent = `${storyName} - Click play to start`;
                        if (playBtn) playBtn.style.display = 'inline-block';
                        if (pauseBtn) pauseBtn.style.display = 'none';
                    } else {
                        currentPathIndex++;
                        setTimeout(tryNextPath, 100);
                    }
                });
            }
        }, 200);
    }
    
    // Start trying paths
    tryNextPath();
}

// ============================================================================
// MINDFUL FOCUS EXERCISES
// ============================================================================

function resetFocusModalSession() {
    focusModalTimeRemaining = 180;
    focusModalActive = false;
    currentExerciseType = null;
    
    if (focusModalTimer) {
        clearInterval(focusModalTimer);
        focusModalTimer = null;
    }
    
    updateFocusModalDisplay();
    resetFocusModalControls();
    showFocusExerciseSelection();
    clearFocusExerciseSelection();
}

function updateFocusModalDisplay() {
    const timerEl = document.getElementById('focusTimer');
    if (timerEl) {
        const minutes = Math.floor(focusModalTimeRemaining / 60);
        const seconds = focusModalTimeRemaining % 60;
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function resetFocusModalControls() {
    const startBtn = document.getElementById('startFocus');
    const pauseBtn = document.getElementById('pauseFocus');
    const stopBtn = document.getElementById('stopFocus');
    const instructionEl = document.getElementById('focusInstruction');
    
    if (startBtn) startBtn.style.display = 'inline-block';
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';
    if (instructionEl) instructionEl.textContent = 'Select an exercise above to begin';
}

function showFocusExerciseSelection() {
    const exerciseGrid = document.querySelector('.exercise-grid');
    const focusSession = document.getElementById('focusSession');
    
    if (exerciseGrid) exerciseGrid.style.display = 'grid';
    if (focusSession) focusSession.style.display = 'none';
}

function clearFocusExerciseSelection() {
    const cards = document.querySelectorAll('.exercise-card');
    cards.forEach(card => card.classList.remove('active'));
}

function startFocusExercise(exerciseType) {
    currentExerciseType = exerciseType;
    const exerciseGrid = document.querySelector('.exercise-grid');
    const focusSession = document.getElementById('focusSession');
    const instructionEl = document.getElementById('focusInstruction');
    
    // Show focus session area
    if (exerciseGrid) exerciseGrid.style.display = 'none';
    if (focusSession) focusSession.style.display = 'block';
    
    // Update instruction based on exercise type
    const instructions = {
        counting: 'Count each breath from 1 to 10, then start over. When your mind wanders, gently return to 1.',
        object: 'Focus your attention on the pulsing dot. When your mind wanders, gently return your gaze.',
        body: 'Slowly scan your body from head to toe. Notice any sensations without judgment.',
        word: 'Silently repeat a calming word like "peace" or "calm" with each breath.'
    };
    
    if (instructionEl) instructionEl.textContent = instructions[exerciseType] || 'Focus on your breath and stay present.';
    
    // Highlight selected exercise
    clearFocusExerciseSelection();
    const selectedCard = document.querySelector(`[onclick="startFocusExercise('${exerciseType}')"]`);
    if (selectedCard) selectedCard.classList.add('active');
}

function startFocusModalSession() {
    if (!currentExerciseType) {
        alert('Please select an exercise first.');
        return;
    }
    
    focusModalActive = true;
    const startBtn = document.getElementById('startFocus');
    const pauseBtn = document.getElementById('pauseFocus');
    const stopBtn = document.getElementById('stopFocus');
    const instructionEl = document.getElementById('focusInstruction');
    
    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'inline-block';
    
    // Start the timer
    focusModalTimer = setInterval(() => {
        focusModalTimeRemaining--;
        updateFocusModalDisplay();
        
        if (focusModalTimeRemaining <= 0) {
            completeFocusModalSession();
        }
    }, 1000);
    
    // Update instruction for active session
    if (instructionEl) {
        const currentText = instructionEl.textContent;
        instructionEl.textContent = currentText + ' Session in progress...';
    }
}

function pauseFocusModalSession() {
    focusModalActive = false;
    const startBtn = document.getElementById('startFocus');
    const pauseBtn = document.getElementById('pauseFocus');
    const instructionEl = document.getElementById('focusInstruction');
    
    if (focusModalTimer) {
        clearInterval(focusModalTimer);
        focusModalTimer = null;
    }
    
    if (startBtn) startBtn.style.display = 'inline-block';
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (instructionEl) instructionEl.textContent = 'Paused - Click Start to continue';
}

function stopFocusModalSession() {
    resetFocusModalSession();
}

function completeFocusModalSession() {
    focusModalActive = false;
    if (focusModalTimer) {
        clearInterval(focusModalTimer);
        focusModalTimer = null;
    }
    
    const instructionEl = document.getElementById('focusInstruction');
    if (instructionEl) instructionEl.textContent = 'Focus session complete! Great concentration.';
    
    resetFocusModalControls();
    
    // Log activity if function exists
    if (typeof logActivity === 'function') {
        logActivity('focus', `Completed ${currentExerciseType} focus exercise`, 'fas fa-brain', 'text-info');
    }
    
    // Auto-close modal after 3 seconds
    setTimeout(() => {
        const modal = bootstrap.Modal.getInstance(document.getElementById('focusModal'));
        if (modal) modal.hide();
    }, 3000);
}

// ============================================================================
// STRESS ASSESSMENT FUNCTIONALITY
// ============================================================================

async function checkDailyAssessment() {
  try {
    const today = new Date().toLocaleDateString("en-CA");
    const responseDoc = await getDoc(doc(db, 'users', currentUser.uid, 'dailyResponses', today));
    
    if (!responseDoc.exists()) {
      setTimeout(() => {
        showDailyQuestions();
      }, 2000);
    } else {
      console.log('Daily assessment already completed for today');
    }
  } catch (error) {
    console.error('Error checking daily assessment:', error);
    setTimeout(() => {
      showDailyQuestions();
    }, 3000);
  }
}

async function showDailyQuestions() {
  try {
    const today = new Date().toLocaleDateString("en-CA");
    const responseDoc = await getDoc(doc(db, 'users', currentUser.uid, 'dailyResponses', today));
    
    const modal = new bootstrap.Modal(document.getElementById('stressQuestionsModal'));
    
    if (responseDoc.exists()) {
      showAlreadyCompletedMessage(responseDoc.data().stressScore);
    } else {
      selectedQuestions = selectDailyQuestions();
      initializeQuestionsWizard();
    }
    
    modal.show();
  } catch (error) {
    console.error('Error showing daily questions:', error);
  }
}

function selectDailyQuestions() {
  const today = new Date().toDateString();
  const seed = today.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  
  const shuffled = [...stressQuestions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.sin(seed + i) * 1000) % (i + 1);
    if (j >= 0) {
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }
  
  return shuffled.slice(0, 8);
}

function showAlreadyCompletedMessage(stressScore) {
  const alreadyCompletedEl = document.getElementById('alreadyCompletedMessage');
  const questionsContainerEl = document.getElementById('questionsContainer');
  const navigationEl = document.getElementById('questionNavigation');
  const completedScoreEl = document.getElementById('completedStressScore');
  
  if (alreadyCompletedEl) alreadyCompletedEl.style.display = 'block';
  if (questionsContainerEl) questionsContainerEl.style.display = 'none';
  if (navigationEl) navigationEl.style.display = 'none';
  if (completedScoreEl) completedScoreEl.textContent = stressScore;
}

function initializeQuestionsWizard() {
  const alreadyCompletedEl = document.getElementById('alreadyCompletedMessage');
  const questionsContainerEl = document.getElementById('questionsContainer');
  const navigationEl = document.getElementById('questionNavigation');
  
  if (alreadyCompletedEl) alreadyCompletedEl.style.display = 'none';
  if (questionsContainerEl) questionsContainerEl.style.display = 'block';
  if (navigationEl) navigationEl.style.display = 'flex';
  
  currentQuestionIndex = 0;
  dailyAnswers = new Array(8).fill(undefined);
  
  displayCurrentQuestion();
  updateWizardProgress();
  updateWizardNavigation();
}

function displayCurrentQuestion() {
  if (!selectedQuestions || selectedQuestions.length === 0) return;
  
  const currentQuestion = selectedQuestions[currentQuestionIndex];
  const questionTextEl = document.getElementById('currentQuestionText');
  const questionOptionsEl = document.getElementById('currentQuestionOptions');
  
  if (questionTextEl) {
    questionTextEl.textContent = currentQuestion.question;
  }
  
  if (questionOptionsEl) {
    questionOptionsEl.innerHTML = currentQuestion.answers.map((answer, answerIndex) => `
      <label class="question-option-wizard" data-value="${currentQuestion.weights[answerIndex]}">
        <input type="radio" name="current_question" value="${currentQuestion.weights[answerIndex]}">
        <span>${answer}</span>
      </label>
    `).join('');
    
    questionOptionsEl.querySelectorAll('.question-option-wizard').forEach(option => {
      option.addEventListener('click', function() {
        const value = parseInt(this.dataset.value);
        
        questionOptionsEl.querySelectorAll('.question-option-wizard').forEach(opt => {
          opt.classList.remove('selected');
        });
        
        this.classList.add('selected');
        this.querySelector('input[type="radio"]').checked = true;
        
        dailyAnswers[currentQuestionIndex] = value;
        updateWizardProgress();    
        updateWizardNavigation();
      });
    });
    
    if (dailyAnswers[currentQuestionIndex] !== undefined) {
      const savedValue = dailyAnswers[currentQuestionIndex];
      const savedOption = questionOptionsEl.querySelector(`[data-value="${savedValue}"]`);
      if (savedOption) {
        savedOption.classList.add('selected');
        savedOption.querySelector('input[type="radio"]').checked = true;
      }
    }
  }
}

function updateWizardProgress() {
  const currentNumEl = document.getElementById('currentQuestionNum');
  const progressBarEl = document.getElementById('questionsProgress');
  const progressPercentageEl = document.getElementById('progressPercentage');

  // Count how many answers user has actually given
  const answered = dailyAnswers.filter(v => v !== undefined).length;
  const progressPercentage = Math.floor((answered / 8) * 100);

  // Keep showing the visible screen number (1..8) for orientation
  const questionNumber = currentQuestionIndex + 1;

  if (currentNumEl) currentNumEl.textContent = questionNumber;
  if (progressBarEl) {
    progressBarEl.style.width = `${progressPercentage}%`;
    progressBarEl.setAttribute('aria-valuenow', progressPercentage);
  }
  if (progressPercentageEl) {
    progressPercentageEl.textContent = `${progressPercentage}%`;
  }
}

function updateWizardNavigation() {
  const nextBtn = document.getElementById('nextQuestion');
  const prevBtn = document.getElementById('prevQuestion');
  
  if (prevBtn) {
    prevBtn.disabled = currentQuestionIndex === 0;
  }
  
  if (nextBtn) {
    if (currentQuestionIndex === 7) {
      nextBtn.innerHTML = '<i class="fas fa-check me-2"></i>Submit Assessment';
    } else {
      nextBtn.innerHTML = 'Next<i class="fas fa-chevron-right ms-2"></i>';
    }
    
    const hasAnswer = dailyAnswers[currentQuestionIndex] !== undefined;
    nextBtn.disabled = !hasAnswer;
  }
}

function nextQuestion() {
  if (currentQuestionIndex < 7) {
    currentQuestionIndex++;
    displayCurrentQuestion();
    updateWizardProgress();
    updateWizardNavigation();
  } else {
    submitDailyAssessment();
  }
}

function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayCurrentQuestion();
    updateWizardProgress();
    updateWizardNavigation();
  }
}

async function submitDailyAssessment() {
  if (isSubmittingAssessment) return;
  isSubmittingAssessment = true;

  const btn = document.getElementById('nextQuestion');
  const restoreBtn = (label = '<i class="fas fa-check me-2"></i>Submit Assessment') => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  };

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';
    }

    const validAnswers = dailyAnswers.filter(a => a !== undefined);
    if (validAnswers.length !== 8) {
      alert('Please answer all questions before submitting.');
      restoreBtn();
      isSubmittingAssessment = false;
      return;
    }

    const averageScore = validAnswers.reduce((s, v) => s + v, 0) / validAnswers.length;
    const stressScore = Math.round((averageScore / 5) * 100);
    const today = new Date().toLocaleDateString("en-CA"); 


    await setDoc(doc(db, 'users', currentUser.uid, 'dailyResponses', today), {
      answers: dailyAnswers,
      stressScore,
      timestamp: serverTimestamp(),
      date: today,
      questions: selectedQuestions.map(q => q.question)
    });

    await addDoc(collection(db, 'users', currentUser.uid, 'stressLogs'), {
      stressLevel: Math.round(stressScore / 10),
      timestamp: serverTimestamp(),
      date: today,
      source: 'daily_assessment'
    });

    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('stressQuestionsModal'));
    if (modalInstance) modalInstance.hide();

    updateTodayStressDisplay(stressScore);
    await loadStressHistory();
    await logActivity('assessment', 'Completed daily stress assessment', 'fas fa-clipboard-check', 'text-success');

    console.log('Daily assessment submitted successfully');
  } catch (error) {
    console.error('Error submitting assessment:', error);
    alert('Error submitting assessment. Please try again.');
    restoreBtn();
  } finally {
    isSubmittingAssessment = false;
  }
}

function updateTodayStressDisplay(stressScore) {
  console.log('Updating today\'s stress display:', stressScore);
  
  if (domElements.currentStress) {
    domElements.currentStress.textContent = stressScore;
  }
  
  if (domElements.todayStressProgress) {
    domElements.todayStressProgress.style.width = `${stressScore}%`;
    domElements.todayStressProgress.setAttribute('aria-valuenow', stressScore);
  }
  
  let status, statusClass;
  if (stressScore <= 30) {
    status = 'Low Stress';
    statusClass = 'low';
  } else if (stressScore <= 60) {
    status = 'Moderate Stress';
    statusClass = 'medium';
  } else {
    status = 'High Stress';
    statusClass = 'high';
  }
  
  if (domElements.stressStatusLabel) {
    domElements.stressStatusLabel.textContent = status;
    domElements.stressStatusLabel.className = `stress-status-label ${statusClass}`;
  }
  
  updateStressIndicatorColor(Math.round(stressScore / 10));
}

// ============================================================================
// CHART AND STATISTICS
// ============================================================================

function updateStressStats(stressData) {
  if (stressData.length === 0) return;
  
  const stressLevels = stressData.map(d => d.stress);
  const avg = Math.round(stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length);
  const min = Math.min(...stressLevels);
  const max = Math.max(...stressLevels);
  
  if (domElements.avgStress) domElements.avgStress.textContent = avg;
  if (domElements.minStress) domElements.minStress.textContent = min;
  if (domElements.maxStress) domElements.maxStress.textContent = max;
  
  if (stressLevels.length >= 2) {
    const firstStress = stressLevels[0];
    const lastStress = stressLevels[stressLevels.length - 1];
    const improvement = Math.max(0, (firstStress - lastStress) / firstStress * 100);
    
    if (domElements.weeklyProgress) {
      domElements.weeklyProgress.style.width = `${Math.min(100, improvement + 20)}%`;
      domElements.weeklyProgress.setAttribute('aria-valuenow', Math.round(improvement));
    }
  }
}

function createStressChart(stressData) {
  const ctx = document.getElementById('stressChart');
  if (!ctx) return;
  
  if (stressChart) {
    stressChart.destroy();
  }
  
  const labels = stressData.map(d => {
    return d.date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  });
  
  const data = stressData.map(d => d.stress);
  
  stressChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Stress Level',
        data: data,
        borderColor: '#1E3A8A',
        backgroundColor: 'rgba(135, 206, 235, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#87CEEB',
        pointBorderColor: '#1E3A8A',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          ticks: {
            stepSize: 2,
            color: '#6B7280',
            font: { size: 12 }
          },
          grid: {
            color: 'rgba(135, 206, 235, 0.2)'
          }
        },
        x: {
          ticks: {
            color: '#6B7280',
            font: { size: 11 }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// ============================================================================
// ENHANCED ACTIVITY LOGGING - TRACKS ALL USER ACTIONS
// ============================================================================

async function logActivity(type, title, icon, color) {
  console.log('🎯 Logging activity:', { type, title, icon, color });
  
  if (!currentUser) {
    console.warn('⚠️ No current user - activity not logged');
    return;
  }
  
  try {
    const activityData = {
      type: type,
      title: title,
      icon: icon,
      color: color,
      timestamp: serverTimestamp(),
      date: new Date().toLocaleDateString("en-CA"),
      userId: currentUser.uid
    };
    
    console.log('💾 Saving activity to Firestore:', activityData);
    
    const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'activities'), activityData);
    console.log('✅ Activity logged successfully with ID:', docRef.id);
    
    // Immediately refresh activity display
    await loadActivityHistory();
    
  } catch (error) {
    console.error('❌ Error logging activity:', error);
    
    // Still show in console even if Firebase fails
    console.log('📝 Activity (local only):', { type, title, timestamp: new Date() });
  }
}

// Enhanced activity logging for all dashboard actions
async function logAllActivities() {
  console.log('🔄 Setting up comprehensive activity tracking...');
  
  // Track breathing exercises
  const originalStartSimpleBreathing = startSimpleBreathingExercise;
  window.startSimpleBreathingExercise = async function() {
    await logActivity('breathing', 'Started 1-minute breathing exercise', 'fas fa-wind', 'text-primary');
    return originalStartSimpleBreathing.apply(this, arguments);
  };
  
  const originalCompleteSimpleBreathing = completeSimpleBreathingExercise;
  window.completeSimpleBreathingExercise = async function() {
    await logActivity('breathing', '1-minute breathing exercise completed', 'fas fa-wind', 'text-success');
    return originalCompleteSimpleBreathing.apply(this, arguments);
  };
  
  // Track modal openings
  const originalOpenBreathingModal = openBreathingModal;
  window.openBreathingModal = async function() {
    await logActivity('modal', 'Opened deep breathing session', 'fas fa-spa', 'text-primary');
    return originalOpenBreathingModal.apply(this, arguments);
  };
  
  const originalOpenSoundsModal = openSoundsModal;
  window.openSoundsModal = async function() {
    await logActivity('modal', 'Opened calming sounds', 'fas fa-music', 'text-info');
    return originalOpenSoundsModal.apply(this, arguments);
  };
  
  const originalOpenStoriesModal = openStoriesModal;
  window.openStoriesModal = async function() {
    await logActivity('modal', 'Opened sleep stories', 'fas fa-moon', 'text-secondary');
    return originalOpenStoriesModal.apply(this, arguments);
  };
  
  const originalOpenFocusModal = openFocusModal;
  window.openFocusModal = async function() {
    await logActivity('modal', 'Opened mindful focus exercises', 'fas fa-brain', 'text-info');
    return originalOpenFocusModal.apply(this, arguments);
  };
  
  // Track theme changes
  const originalSetupThemeToggle = setupThemeToggle;
  window.setupThemeToggle = function() {
    const result = originalSetupThemeToggle.apply(this, arguments);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', async () => {
        const newTheme = document.documentElement.getAttribute('data-theme');
        await logActivity('settings', `Switched to ${newTheme} theme`, 'fas fa-palette', 'text-warning');
      });
    }
    
    return result;
  };
  
  console.log('✅ All activity tracking enabled');
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

function setupEventListeners() {
  console.log('Setting up event listeners');

  if (domElements.logoutBtn) {
    domElements.logoutBtn.addEventListener('click', handleLogout);
  }

  const nextBtn = document.getElementById('nextQuestion');
  const prevBtn = document.getElementById('prevQuestion');
  if (nextBtn) nextBtn.setAttribute('type', 'button');
  if (prevBtn) prevBtn.setAttribute('type', 'button');

  // Delegated handler for question navigation
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#nextQuestion, #prevQuestion');
    if (!btn) return;
    e.preventDefault();
    if (btn.id === 'nextQuestion') {
      nextQuestion();
    } else {
      prevQuestion();
    }
  });

  // Prevent form submission in modal
  const modalForm = document.querySelector('#stressQuestionsModal form');
  if (modalForm) {
    modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (currentQuestionIndex === 7) {
        submitDailyAssessment();
      } else {
        nextQuestion();
      }
    });
  }
  
  // Setup mindfulness event listeners
  setupMindfulnessEventListeners();
}

function setupMindfulnessEventListeners() {
    console.log('🔧 Setting up mindfulness event listeners...');
    
    // ============================================================================
    // SOUND ITEM CLICK LISTENERS - NO MORE ONCLICK CONFLICTS
    // ============================================================================
    
    document.querySelectorAll('.sound-item').forEach(item => {
        // Remove any existing listeners to prevent duplicates
        item.removeEventListener('click', handleSoundItemClick);
        
        item.addEventListener('click', handleSoundItemClick);
    });
    
    function handleSoundItemClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const soundFile = this.dataset.sound;
        const soundName = this.dataset.name;
        
        console.log('🎵 Sound item clicked:', soundFile, soundName);
        
        if (soundFile && soundName) {
            playSound(soundFile, soundName);
        } else {
            console.error('❌ Missing sound data attributes');
        }
    }
    
    // ============================================================================
    // STORY ITEM CLICK LISTENERS - NO MORE ONCLICK CONFLICTS
    // ============================================================================
    
    document.querySelectorAll('.story-card').forEach(item => {
        // Remove any existing listeners to prevent duplicates
        item.removeEventListener('click', handleStoryItemClick);
        
        item.addEventListener('click', handleStoryItemClick);
    });
    
    function handleStoryItemClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const storyFile = this.dataset.story;
        const storyName = this.dataset.name;
        
        console.log('📖 Story item clicked:', storyFile, storyName);
        
        if (storyFile && storyName) {
            playStory(storyFile, storyName);
        } else {
            console.error('❌ Missing story data attributes');
        }
    }
    
    // Breathing exercise controls
    const startBreathingBtn = document.getElementById('startBreathing');
    const pauseBreathingBtn = document.getElementById('pauseBreathing');
    const stopBreathingBtn = document.getElementById('stopBreathing');
    
    if (startBreathingBtn) startBreathingBtn.addEventListener('click', startBreathingModalSession);
    if (pauseBreathingBtn) pauseBreathingBtn.addEventListener('click', pauseBreathingModalSession);
    if (stopBreathingBtn) stopBreathingBtn.addEventListener('click', stopBreathingModalSession);
    
    // ============================================================================
    // SOUND PLAYER CONTROLS - COMPLETELY FIXED
    // ============================================================================
    
    const soundPlayBtn = document.getElementById('soundPlayBtn');
    const soundPauseBtn = document.getElementById('soundPauseBtn');
    const soundStopBtn = document.getElementById('soundStopBtn');
    
    if (soundPlayBtn) {
        soundPlayBtn.addEventListener('click', () => {
            console.log('🎵 Sound PLAY button clicked');
            console.log('Current audio player:', currentAudioPlayer);
            console.log('Current audio type:', currentAudioType);
            
            if (currentAudioPlayer && currentAudioType === 'sound') {
                console.log('▶️ Attempting to resume sound playback...');
                
                const playPromise = currentAudioPlayer.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log('✅ Sound resumed successfully');
                        soundPlayBtn.style.display = 'none';
                        soundPauseBtn.style.display = 'inline-block';
                    }).catch(error => {
                        console.error('❌ Error resuming sound:', error);
                        
                        // If resume fails, try to reload and play
                        console.log('🔄 Retrying with reload...');
                        currentAudioPlayer.load();
                        
                        setTimeout(() => {
                            const retryPromise = currentAudioPlayer.play();
                            if (retryPromise !== undefined) {
                                retryPromise.then(() => {
                                    console.log('✅ Sound started after reload');
                                    soundPlayBtn.style.display = 'none';
                                    soundPauseBtn.style.display = 'inline-block';
                                }).catch(retryError => {
                                    console.error('❌ Retry failed:', retryError);
                                    // Reset UI to initial state
                                    document.getElementById('soundControls').style.display = 'none';
                                });
                            }
                        }, 100);
                    });
                }
            } else {
                console.warn('⚠️ No active sound player or wrong audio type');
                // Hide controls if no active player
                document.getElementById('soundControls').style.display = 'none';
            }
        });
    }
    
    if (soundPauseBtn) {
        soundPauseBtn.addEventListener('click', () => {
            console.log('⏸️ Sound PAUSE button clicked');
            
            if (currentAudioPlayer && currentAudioType === 'sound') {
                console.log('⏸️ Pausing sound playback...');
                currentAudioPlayer.pause();
                soundPauseBtn.style.display = 'none';
                soundPlayBtn.style.display = 'inline-block';
                console.log('✅ Sound paused');
            } else {
                console.warn('⚠️ No active sound player to pause');
            }
        });
    }
    
    if (soundStopBtn) {
        soundStopBtn.addEventListener('click', () => {
            console.log('⏹️ Sound STOP button clicked');
            
            if (currentAudioPlayer && currentAudioType === 'sound') {
                console.log('⏹️ Stopping sound playback...');
                currentAudioPlayer.pause();
                currentAudioPlayer.currentTime = 0;
                const controls = document.getElementById('soundControls');
                if (controls) controls.style.display = 'none';
                
                // Clear references
                currentAudioPlayer = null;
                currentAudioType = null;
                console.log('✅ Sound stopped and cleared');
            } else {
                console.warn('⚠️ No active sound player to stop');
            }
        });
    }
    
    // ============================================================================
    // STORY PLAYER CONTROLS - COMPLETELY FIXED
    // ============================================================================
    
    const storyPlayBtn = document.getElementById('storyPlayBtn');
    const storyPauseBtn = document.getElementById('storyPauseBtn');
    const storyStopBtn = document.getElementById('storyStopBtn');
    
    if (storyPlayBtn) {
        storyPlayBtn.addEventListener('click', () => {
            console.log('📖 Story PLAY button clicked');
            console.log('Current audio player:', currentAudioPlayer);
            console.log('Current audio type:', currentAudioType);
            
            if (currentAudioPlayer && currentAudioType === 'story') {
                console.log('▶️ Attempting to resume story playback...');
                
                const playPromise = currentAudioPlayer.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log('✅ Story resumed successfully');
                        storyPlayBtn.style.display = 'none';
                        storyPauseBtn.style.display = 'inline-block';
                    }).catch(error => {
                        console.error('❌ Error resuming story:', error);
                        
                        // If resume fails, try to reload and play
                        console.log('🔄 Retrying with reload...');
                        currentAudioPlayer.load();
                        
                        setTimeout(() => {
                            const retryPromise = currentAudioPlayer.play();
                            if (retryPromise !== undefined) {
                                retryPromise.then(() => {
                                    console.log('✅ Story started after reload');
                                    storyPlayBtn.style.display = 'none';
                                    storyPauseBtn.style.display = 'inline-block';
                                }).catch(retryError => {
                                    console.error('❌ Retry failed:', retryError);
                                    // Reset UI to initial state
                                    document.getElementById('storyControls').style.display = 'none';
                                });
                            }
                        }, 100);
                    });
                }
            } else {
                console.warn('⚠️ No active story player or wrong audio type');
                // Hide controls if no active player
                document.getElementById('storyControls').style.display = 'none';
            }
        });
    }
    
    if (storyPauseBtn) {
        storyPauseBtn.addEventListener('click', () => {
            console.log('⏸️ Story PAUSE button clicked');
            
            if (currentAudioPlayer && currentAudioType === 'story') {
                console.log('⏸️ Pausing story playback...');
                currentAudioPlayer.pause();
                storyPauseBtn.style.display = 'none';
                storyPlayBtn.style.display = 'inline-block';
                console.log('✅ Story paused');
            } else {
                console.warn('⚠️ No active story player to pause');
            }
        });
    }
    
    if (storyStopBtn) {
        storyStopBtn.addEventListener('click', () => {
            console.log('⏹️ Story STOP button clicked');
            
            if (currentAudioPlayer && currentAudioType === 'story') {
                console.log('⏹️ Stopping story playback...');
                currentAudioPlayer.pause();
                currentAudioPlayer.currentTime = 0;
                const controls = document.getElementById('storyControls');
                if (controls) controls.style.display = 'none';
                
                // Clear references
                currentAudioPlayer = null;
                currentAudioType = null;
                console.log('✅ Story stopped and cleared');
            } else {
                console.warn('⚠️ No active story player to stop');
            }
        });
    }
    
    // Focus exercise controls
    const startFocusBtn = document.getElementById('startFocus');
    const pauseFocusBtn = document.getElementById('pauseFocus');
    const stopFocusBtn = document.getElementById('stopFocus');
    
    if (startFocusBtn) startFocusBtn.addEventListener('click', startFocusModalSession);
    if (pauseFocusBtn) pauseFocusBtn.addEventListener('click', pauseFocusModalSession);
    if (stopFocusBtn) stopFocusBtn.addEventListener('click', stopFocusModalSession);
    
    // Modal cleanup on close
    const modals = ['breathingModal', 'soundsModal', 'storiesModal', 'focusModal'];
    
    modals.forEach(modalId => {
        const modalEl = document.getElementById(modalId);
        if (modalEl) {
            modalEl.addEventListener('hidden.bs.modal', () => {
                console.log(`${modalId} closed, cleaning up...`);
                switch(modalId) {
                    case 'breathingModal':
                        resetBreathingModalSession();
                        break;
                    case 'soundsModal':
                        resetSoundPlayer();
                        break;
                    case 'storiesModal':
                        resetStoryPlayer();
                        break;
                    case 'focusModal':
                        resetFocusModalSession();
                        break;
                }
            });
        }
    });
    
    console.log('✅ All mindfulness event listeners set up successfully');
}

function setupWellnessFeatures() {
  console.log('Setting up wellness features');
  setupMoodTracker();
  setupSimpleBreathing();
  setupJournalPrompt();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateDailyGreeting(name) {
  const hour = new Date().getHours();
  let greeting;
  
  if (hour < 12) {
    greeting = "Good morning";
  } else if (hour < 17) {
    greeting = "Good afternoon";
  } else {
    greeting = "Good evening";
  }
  
  return `${greeting}, ${name}!`;
}

function getDailyQuote() {
  const today = new Date().toDateString();
  const seed = today.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const index = seed % dailyQuotes.length;
  return dailyQuotes[index];
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const time = timestamp instanceof Date ? timestamp : timestamp.toDate();
  const diffInMs = now - time;
  
  const minutes = Math.floor(diffInMs / (1000 * 60));
  const hours = Math.floor(diffInMs / (1000 * 60 * 60));
  const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

function updateStressIndicatorColor(stressLevel) {
  const stressCircle = document.querySelector('.stress-circle');
  if (!stressCircle) return;
  
  stressCircle.classList.remove('stress-low', 'stress-moderate', 'stress-high');
  
  if (stressLevel <= 3) {
    stressCircle.classList.add('stress-low');
  } else if (stressLevel <= 6) {
    stressCircle.classList.add('stress-moderate');
  } else {
    stressCircle.classList.add('stress-high');
  }
}

function generateSampleStressData() {
  const data = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const baseStress = 4 + Math.sin(i * 0.8) * 2;
    const randomVariation = (Math.random() - 0.5) * 2;
    const stress = Math.max(1, Math.min(10, Math.round(baseStress + randomVariation)));
    
    data.push({ date: date, stress: stress });
  }
  
  return data;
}

function generateSampleActivities() {
  return [
    {
      type: 'assessment',
      title: 'Daily stress assessment completed',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      icon: 'fas fa-clipboard-check',
      color: 'text-success'
    },
    {
      type: 'mood',
      title: 'Logged daily mood: Happy',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      icon: 'fas fa-smile',
      color: 'text-success'
    },
    {
      type: 'breathing',
      title: '1-minute breathing exercise completed',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      icon: 'fas fa-wind',
      color: 'text-primary'
    },
    {
      type: 'journal',
      title: 'Completed daily journal entry',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      icon: 'fas fa-journal-whills',
      color: 'text-info'
    },
    {
      type: 'focus',
      title: 'Mindful focus session completed',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      icon: 'fas fa-brain',
      color: 'text-info'
    }
  ];
}

// ============================================================================
// UI STATE MANAGEMENT
// ============================================================================

function showLoadingState() {
  console.log('Showing loading state');
  
  if (domElements.profileName) domElements.profileName.textContent = 'Loading...';
  if (domElements.profileEmail) domElements.profileEmail.textContent = 'Loading...';
  if (domElements.currentStress) domElements.currentStress.textContent = '--';
  if (domElements.stressStatusLabel) {
    domElements.stressStatusLabel.textContent = 'Loading...';
    domElements.stressStatusLabel.className = 'stress-status-label pending';
  }
  if (domElements.dailyGreeting) {
    domElements.dailyGreeting.textContent = 'Loading your dashboard...';
  }
  if (domElements.dailyQuote) {
    domElements.dailyQuote.textContent = 'Preparing your daily inspiration...';
  }
}

function showErrorState(message) {
  console.error('Dashboard error state:', message);
  
  if (domElements.profileName) domElements.profileName.textContent = 'Error loading profile';
  if (domElements.profileEmail) domElements.profileEmail.textContent = 'Please refresh the page';
  if (domElements.dailyGreeting) {
    domElements.dailyGreeting.textContent = 'Dashboard error - please refresh';
  }
  if (domElements.dailyQuote) {
    domElements.dailyQuote.textContent = 'Unable to load content';
  }
}

// ============================================================================
// LOGOUT FUNCTIONALITY
// ============================================================================

async function handleLogout() {
  try {
    await signOut(auth);
    console.log('User signed out successfully');
    window.location.href = 'Login-Signup.html';
  } catch (error) {
    console.error('Error signing out:', error);
    alert('Error signing out. Please try again.');
  }
}

// ============================================================================
// MINDMAZE MOOD TRACKER - FACE API INTEGRATION
// ============================================================================

// Mood tracker state
let moodTrackerActive = false;
let moodTrackerTimer = null;
let faceApiLoaded = false;
let videoStream = null;

// Mood tracking initialization
async function initializeMoodTracker() {
  console.log('🧠 Initializing Mindmaze Mood Tracker...');
  
  const dot = document.getElementById('moodTrackerDot');
  const text = document.getElementById('moodTrackerText');
  const icon = document.querySelector('.tracker-icon');
  
  if (!dot || !text) {
    console.error('❌ Mood tracker elements not found');
    return;
  }
  
  try {
    // Update UI to analyzing state
    updateMoodTrackerUI('analyzing', 'Analysing mood…');
    
    // Load Face API models
    await loadFaceApiModels();
    
    // Start mood detection
    await startMoodDetection();
    
  } catch (error) {
    console.error('❌ Mindmaze Mood Tracker failed:', error);
    updateMoodTrackerUI('unavailable', 'Mood tracking unavailable');
    await logActivity('mood-tracker', 'Mood tracking failed - camera or API unavailable', 'fas fa-exclamation-triangle', 'text-warning');
  }
}

// Load Face API models
async function loadFaceApiModels() {
  console.log('📦 Loading Face API models...');
  
  if (typeof faceapi === 'undefined') {
    // Load Face API from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    document.head.appendChild(script);
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
    });
  }
  
  // Load models from assets folder
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('assets/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('assets/models')
  ]);
  
  faceApiLoaded = true;
  console.log('✅ Face API models loaded successfully');
}

// Start mood detection process
// Start mood detection process (patched)
async function startMoodDetection() {
  console.log('📹 Starting mood detection.');

  // Request camera access
  videoStream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' }
  });

  // Create hidden video element
  const video = document.createElement('video');
  video.width = 640;
  video.height = 480;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true; // <-- important for iOS / mobile
  video.style.display = 'none';
  document.body.appendChild(video);

  video.srcObject = videoStream;

  // Wait for metadata, then actively start playback and wait for "playing"
  await new Promise((resolve) => (video.onloadedmetadata = resolve));
  try {
    await video.play();
  } catch (e) {
    console.warn('⚠️ video.play() was blocked, retrying after user gesture', e);
  }
  if (video.readyState < 2) {
    await new Promise((resolve) => (video.onplaying = resolve));
  }

  console.log('📹 Camera initialized, starting detection.');
  const detectionStartTime = Date.now();
  const detectionDuration = 10000; // 10s ten seconds 
  const emotions = [];

  const detectLoop = async () => {
    if (Date.now() - detectionStartTime >= detectionDuration) {
      await completeMoodDetection(emotions, video);
      return;
    }
    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceExpressions();

      if (detections.length > 0) {
        const expressions = detections[0].expressions;
        emotions.push({ timestamp: Date.now(), expressions });
        console.log('😊 Emotion detected:', expressions);
      } else {
        console.log('🔎 No face in frame this tick');
      }
    } catch (error) {
      console.warn('⚠️ Detection frame failed:', error);
    }
    setTimeout(detectLoop, 500);
  };

  detectLoop();
}


// Complete mood detection and process results
async function completeMoodDetection(emotions, video) {
  console.log('🎯 Completing mood detection...');
  
  // Clean up video
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (video.parentNode) {
    video.parentNode.removeChild(video);
  }
  
  if (emotions.length === 0) {
    console.warn('⚠️ No emotions detected during session');
    updateMoodTrackerUI('unavailable', 'Mood tracking unavailable');
    return;
  }
  
  // Analyze emotions
  const dominantEmotion = analyzeDominantEmotion(emotions);
  const confidence = Math.round(dominantEmotion.confidence * 100);
  
  console.log('🎭 Dominant emotion:', dominantEmotion);
  
  // Save to Firestore
  await saveMoodDetectionResults(dominantEmotion, confidence, emotions.length);
  
  // Keep analyzing state for 2 minutes total (already ran for 1 minute)
  setTimeout(() => {
    const emoji = getEmotionEmoji(dominantEmotion.emotion);
    const moodText = `Mood Detected: ${emoji} ${capitalizeFirst(dominantEmotion.emotion)}`;
    updateMoodTrackerUI('detected', moodText);
  }, 600); // Show result after additional 1 minute (2 minutes total)
}

// Analyze dominant emotion from collected data
/* function analyzeDominantEmotion(emotions) {
  const emotionSums = {};
  let totalSamples = 0;
  
  emotions.forEach(sample => {
    totalSamples++;
    Object.entries(sample.expressions).forEach(([emotion, confidence]) => {
      if (!emotionSums[emotion]) emotionSums[emotion] = 0;
      emotionSums[emotion] += confidence;
    });
  });
  
  // Find emotion with highest average confidence
  let dominantEmotion = 'neutral';
  let highestAverage = 0;
  
  Object.entries(emotionSums).forEach(([emotion, sum]) => {
    const average = sum / totalSamples;
    if (average > highestAverage) {
      highestAverage = average;
      dominantEmotion = emotion;
    }
  });
  
  return {
    emotion: dominantEmotion,
    confidence: highestAverage
  };
} */
 function analyzeDominantEmotion(emotions) {
   // Parameters you can tune
   const NEUTRAL_MARGIN = 0.12;      // if neutral is only slightly higher, let non-neutral win
   const MIN_CONFIDENCE = 0.20;      // require at least 20% frame votes to call a non-neutral mood

   // Count frame-wise winners
   const counts = {};
   for (const sample of emotions) {
     const entries = Object.entries(sample.expressions).sort((a, b) => b[1] - a[1]);
     const [topLabel, topVal] = entries[0];
     const [secondLabel, secondVal] = entries[1] || ['neutral', 0];

     // If top is neutral but second is close, count the second (non-neutral) to avoid neutral bias
     let label = topLabel;
     if (topLabel === 'neutral' && secondVal >= topVal - NEUTRAL_MARGIN && secondLabel !== 'neutral') {
       label = secondLabel;
     }
     counts[label] = (counts[label] || 0) + 1;
   }

   // Choose the most frequent label
   const total = emotions.length || 1;
   const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
   let [dominant, count] = sorted[0] || ['neutral', 0];
   let confidence = count / total; // frame-vote share

   // If non-neutral is too weak, fall back to neutral
   if (dominant !== 'neutral' && confidence < MIN_CONFIDENCE) {
     dominant = 'neutral';
     confidence = (counts['neutral'] || 0) / total;
   }
   return { emotion: dominant, confidence };
 }

// Get emoji for emotion
function getEmotionEmoji(emotion) {
  const emojiMap = {
    happy: '🙂',
    sad: '😢',
    angry: '😠',
    fearful: '😨',
    disgusted: '🤢',
    surprised: '😮',
    neutral: '😐'
  };
  
  return emojiMap[emotion] || '😐';
}

// Save mood detection results to Firestore
async function saveMoodDetectionResults(dominantEmotion, confidence, sampleCount) {
  if (!currentUser) {
    console.warn('⚠️ No current user - mood results not saved');
    return;
  }
  
  const timestamp = new Date();
  const today = timestamp.toLocaleDateString("en-CA");
  
  try {
    // Save raw detection data
    const faceLogData = {
      emotion: dominantEmotion.emotion,
      confidence: dominantEmotion.confidence,
      confidencePercentage: confidence,
      sampleCount: sampleCount,
      timestamp: serverTimestamp(),
      date: today,
      userId: currentUser.uid
    };
    
    await setDoc(doc(db, 'users', currentUser.uid, 'faceLogs', timestamp.getTime().toString()), faceLogData);
    console.log('💾 Face log saved to Firestore');
    
    // Log activity
    const emoji = getEmotionEmoji(dominantEmotion.emotion);
    const activityTitle = `🧠 Mood detected: ${emoji} ${capitalizeFirst(dominantEmotion.emotion)} (${confidence}%)`;
    
    await logActivity('mood-tracker', activityTitle, 'fas fa-brain', 'text-info');
    console.log('✅ Mood detection activity logged');
    
  } catch (error) {
    console.error('❌ Error saving mood detection results:', error);
  }
}

// Update mood tracker UI
function updateMoodTrackerUI(state, text) {
  const dot = document.getElementById('moodTrackerDot');
  const textEl = document.getElementById('moodTrackerText');
  const icon = document.querySelector('.tracker-icon');
  
  if (!dot || !textEl) return;
  
  // Remove all state classes
  dot.classList.remove('analyzing', 'detected', 'unavailable');
  if (icon) icon.classList.remove('analyzing');
  
  // Add new state
  dot.classList.add(state);
  if (state === 'analyzing' && icon) {
    icon.classList.add('analyzing');
  }
  
  textEl.textContent = text;
  
  console.log(`🎯 Mood tracker UI updated: ${state} - ${text}`);
}

// Utility function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// EXPORT API FOR EXTERNAL USE
// ============================================================================

window.MindMazeDashboard = {
  // Core functions
  loadUserProfile,
  loadTodayData,
  loadHistoricalData,
  handleLogout,
  
  // Wellness features
  saveMoodLog,
  saveJournalEntry,
  startSimpleBreathingExercise,
  stopSimpleBreathingExercise,
  
  // Mindfulness functions
  openBreathingModal,
  openSoundsModal,
  openStoriesModal,
  openFocusModal,
  playSound,
  playStory,
  startFocusExercise,
  
  // Stress assessment
  submitDailyAssessment,
  updateTodayStressDisplay,
  
  // Mood tracker functions
  initializeMoodTracker,
  updateMoodTrackerUI,
  
  // Utilities
  generateDailyGreeting,
  getDailyQuote,
  getTimeAgo,
  logActivity
};

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

// ============================================================================
// AUDIO TESTING AND DIAGNOSTICS
// ============================================================================

// Test function to verify audio files exist and can play
function testAudioFiles() {
    console.log('🧪 Testing audio files...');
    
    const testFiles = [
        { path: '/assets/sounds/rain.mp3', type: 'sound', name: 'Rain' },
        { path: '/assets/sounds/ocean.mp3', type: 'sound', name: 'Ocean' },
        { path: '/assets/sounds/forest.mp3', type: 'sound', name: 'Forest' },
        { path: '/assets/sounds/birds.mp3', type: 'sound', name: 'Birds' },
        { path: '/assets/stories/peaceful-meadow.mp3', type: 'story', name: 'Peaceful Meadow' },
        { path: '/assets/stories/starry-night.mp3', type: 'story', name: 'Starry Night' },
        { path: '/assets/stories/mountain-stream.mp3', type: 'story', name: 'Mountain Stream' }
    ];
    
    testFiles.forEach((file, index) => {
        setTimeout(() => {
            const audio = new Audio();
            
            audio.addEventListener('loadstart', () => {
                console.log(`📥 ${file.name}: Loading started`);
            });
            
            audio.addEventListener('canplay', () => {
                console.log(`✅ ${file.name}: Ready to play`);
            });
            
            audio.addEventListener('error', (e) => {
                console.error(`❌ ${file.name}: Failed to load`, {
                    path: file.path,
                    error: e.target.error
                });
            });
            
            console.log(`🔍 Testing: ${file.name} at ${file.path}`);
            audio.src = file.path;
            audio.load();
            
        }, index * 500); // Stagger tests
    });
}

// Manual play function for testing
function manualTestPlay(filename, type = 'sound') {
    console.log(`🎮 Manual test: ${type} - ${filename}`);
    
    if (type === 'sound') {
        playSound(filename, `Test ${filename}`);
    } else {
        playStory(filename, `Test ${filename}`);
    }
}

// Add these to window for console access
window.testAudioFiles = testAudioFiles;
window.manualTestPlay = manualTestPlay;

console.log('MindMaze Dashboard ES Module loaded successfully');
console.log('Available API:', Object.keys(window.MindMazeDashboard));

// Auto-test audio files when dashboard loads (optional)
setTimeout(() => {
    if (window.testAudioFiles) {
        console.log('🚀 Running automatic audio file test...');
        testAudioFiles();
    }
}, 2000);