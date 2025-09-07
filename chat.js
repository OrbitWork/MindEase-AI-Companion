// chat.js - MindMaze Chat Implementation

// Import Firebase configuration
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot,
    serverTimestamp,
    increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// OpenAI Configuration - Move to backend in production!
const OPENAI_API_KEY = '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'; // Replace with your key
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Theme Configuration
const THEME_KEY = 'mindmaze-theme';

// Chat Configuration
const DAILY_MESSAGE_LIMIT = 20;
const WELLNESS_TIPS = [
    "💡 Today's Tip: Try 5 minutes of deep breathing for a calmer mind.",
    "🌱 Today's Tip: Take a moment to appreciate something beautiful around you.",
    "💪 Today's Tip: Small acts of kindness can boost your mood instantly.",
    "🧘 Today's Tip: Practice gratitude - name three things you're thankful for.",
    "🌈 Today's Tip: Remember, progress is more important than perfection.",
    "🌸 Today's Tip: Take breaks between tasks to recharge your energy.",
    "✨ Today's Tip: Connect with nature, even if it's just looking outside.",
    "💙 Today's Tip: Be gentle with yourself - you're doing your best.",
    "🎯 Today's Tip: Focus on what you can control, let go of what you can't.",
    "🌟 Today's Tip: Celebrate small wins - they add up to big achievements."
];

// System prompt for OpenAI
const SYSTEM_PROMPT = `You are MindMaze's AI wellness companion - a warm, empathetic, and supportive mental health assistant. Your personality traits:

PERSONALITY:
- Extremely friendly and human-like
- Use emojis naturally and frequently 
- Supportive and encouraging tone
- Never judgmental, always understanding
- Speak like a caring friend who genuinely cares

RESPONSE STYLE:
- Keep responses concise but meaningful (2-4 sentences max)
- Always include relevant emojis
- End some responses with motivational phrases like "💪 You got this!", "🌈 Small steps matter.", "🧘 Remember to breathe."
- Use user's name occasionally to make it personal

TOPICS YOU HANDLE:
✅ Mental health support and coping strategies
✅ Stress management and relaxation techniques  
✅ Mindfulness and meditation guidance
✅ Positive thinking and motivation
✅ Sleep and wellness tips
✅ Breathing exercises and grounding techniques
✅ Emotional support and validation
✅ Goal setting and personal growth

BOUNDARIES:
❌ If user asks about unrelated topics (weather, news, technical help, etc.), politely redirect: "⚠️ I'm here to support your wellbeing 💙 Let's talk about mindfulness, stress, or positivity."
❌ Never provide medical diagnosis or replace professional therapy
❌ Always suggest professional help for serious mental health concerns

Remember: You're not just giving advice - you're being a compassionate companion on their wellness journey. Make every interaction feel warm, personal, and supportive.`;

// Global Variables
let currentUser = null;
let isInitialized = false;
let messagesLeft = DAILY_MESSAGE_LIMIT;
let isTyping = false;
let chatHistory = [];
let hasShownGreeting = false;

// DOM Elements
const elements = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    userName: document.getElementById('userName'),
    greetingSection: document.getElementById('greetingSection'),
    greetingText: document.getElementById('greetingText'),
    quickReplies: document.getElementById('quickReplies'),
    dailyTipSection: document.getElementById('dailyTipSection'),
    dailyTipText: document.getElementById('dailyTipText'),
    chatWindow: document.getElementById('chatWindow'),
    chatMessages: document.getElementById('chatMessages'),
    typingIndicator: document.getElementById('typingIndicator'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    usageText: document.getElementById('usageText')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    initializeEventListeners();
    checkAuthentication();
});

// Apply Theme from localStorage
function applyTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    console.log(`Applied theme: ${savedTheme}`);
}

// Watch for theme changes
function watchThemeChanges() {
    window.addEventListener('storage', (e) => {
        if (e.key === THEME_KEY) {
            applyTheme();
        }
    });

    setInterval(() => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
        if (currentTheme !== savedTheme) {
            applyTheme();
        }
    }, 1000);
}

// Event Listeners
function initializeEventListeners() {
    // Message input
    if (elements.messageInput) {
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Input validation
        elements.messageInput.addEventListener('input', validateInput);
    }

    // Send button
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener('click', sendMessage);
    }

    // Quick reply buttons
    if (elements.quickReplies) {
        elements.quickReplies.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-reply-btn')) {
                const message = e.target.dataset.message;
                sendQuickReply(message);
            }
        });
    }
}

// Validate Input
function validateInput() {
    if (!elements.messageInput || !elements.sendBtn) return;
    
    const message = elements.messageInput.value.trim();
    const isValid = message.length > 0 && messagesLeft > 0 && !isTyping;
    
    elements.sendBtn.disabled = !isValid;
    elements.sendBtn.style.opacity = isValid ? '1' : '0.5';
}

// Authentication Check
function checkAuthentication() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            initializeChat();
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'index.html';
        }
    });
}

// Initialize Chat
async function initializeChat() {
    try {
        // Update user profile
        updateUserProfile();
        
        // Start watching theme changes
        watchThemeChanges();
        
        // Check daily usage
        await checkDailyUsage();
        
        // Set up daily tip
        displayDailyTip();
        
        // Load chat history first
        await loadChatHistory();
        
        // Show greeting only if no messages today
        if (chatHistory.length === 0) {
            displayGreeting();
            hasShownGreeting = true;
        } else {
            hideGreetingSection();
        }
        
        // Enable input
        enableInput();
        
        // Hide loading overlay
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
        
        isInitialized = true;
        
        console.log('MindMaze Chat initialized successfully! 🧠💙');
        
    } catch (error) {
        console.error('Chat initialization error:', error);
        showError('Failed to initialize chat. Please refresh the page.');
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
    }
}

// Update User Profile
function updateUserProfile() {
    const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    
    // Update navbar user name
    if (elements.userName) {
        elements.userName.textContent = displayName;
    }
    
    // Update greeting with first name
    const firstName = displayName.split(' ')[0];
    if (elements.greetingText) {
        elements.greetingText.textContent = `👋 Hi ${firstName}! How are you feeling today?`;
    }
}

// Get Today String
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

// Check Daily Usage
async function checkDailyUsage() {
    try {
        const today = getTodayString();
        const usageRef = doc(db, 'users', currentUser.uid, 'chatUsage', today);
        const usageDoc = await getDoc(usageRef);
        
        if (usageDoc.exists()) {
            const data = usageDoc.data();
            messagesLeft = Math.max(0, DAILY_MESSAGE_LIMIT - (data.messagesCount || 0));
        } else {
            messagesLeft = DAILY_MESSAGE_LIMIT;
            // Initialize usage document
            await setDoc(usageRef, {
                messagesCount: 0,
                date: today,
                lastUpdate: serverTimestamp()
            });
        }
        
        updateUsageDisplay();
        
    } catch (error) {
        console.error('Error checking daily usage:', error);
        messagesLeft = DAILY_MESSAGE_LIMIT;
        updateUsageDisplay();
    }
}

// Update Usage Display
function updateUsageDisplay() {
    if (elements.usageText) {
        elements.usageText.textContent = `Chats left today: ${messagesLeft}/${DAILY_MESSAGE_LIMIT}`;
        
        if (messagesLeft <= 0) {
            if (elements.messageInput) {
                elements.messageInput.disabled = true;
                elements.messageInput.placeholder = "Daily limit reached. Come back tomorrow!";
                elements.messageInput.style.opacity = '0.6';
            }
            if (elements.sendBtn) {
                elements.sendBtn.disabled = true;
            }
        } else if (messagesLeft <= 3) {
            elements.usageText.style.color = '#f59e0b';
            elements.usageText.innerHTML = `⚠️ Only ${messagesLeft} chats left today`;
        }
    }
}

// Hash function for consistent daily tip
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
}

// Display Daily Tip
function displayDailyTip() {
    const today = new Date().toDateString();
    const tipIndex = Math.abs(hashCode(today)) % WELLNESS_TIPS.length;
    if (elements.dailyTipText) {
        elements.dailyTipText.textContent = WELLNESS_TIPS[tipIndex];
    }
}

// Display Greeting
function displayGreeting() {
    if (elements.greetingSection) {
        elements.greetingSection.style.display = 'block';
    }
}

// Hide Greeting Section
function hideGreetingSection() {
    if (elements.greetingSection) {
        elements.greetingSection.style.display = 'none';
    }
    if (elements.dailyTipSection) {
        elements.dailyTipSection.style.marginBottom = '1rem';
    }
}

// Enable Input
function enableInput() {
    if (messagesLeft > 0 && elements.messageInput && elements.sendBtn) {
        elements.messageInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.placeholder = "Type your message...";
        elements.messageInput.style.opacity = '1';
    }
}

// Load Chat History
async function loadChatHistory() {
    try {
        const today = getTodayString();
        const messagesRef = collection(db, 'users', currentUser.uid, 'chatLogs', today, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        
        onSnapshot(q, (snapshot) => {
            // Clear existing messages
            if (elements.chatMessages) {
                elements.chatMessages.innerHTML = '';
            }
            chatHistory = [];
            
            snapshot.forEach((doc) => {
                const messageData = doc.data();
                chatHistory.push(messageData);
                displayMessage(messageData.message, messageData.sender, messageData.timestamp);
            });
            
            scrollToBottom();
        });
        
    } catch (error) {
        console.error('Error loading chat history:', error);
        chatHistory = [];
    }
}

// Display Message
function displayMessage(message, sender, timestamp = null) {
    if (!elements.chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('message-bubble');
    bubbleDiv.textContent = message;
    
    if (sender === 'bot') {
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('bot-avatar');
        avatarDiv.textContent = '🤖';
        messageDiv.appendChild(avatarDiv);
    }
    
    messageDiv.appendChild(bubbleDiv);
    
    // Add timestamp
    const timeDiv = document.createElement('div');
    timeDiv.classList.add('message-time');
    if (timestamp) {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        timeDiv.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        // For new messages without timestamp, use current time
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    messageDiv.appendChild(timeDiv);
    
    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Save Message to Firestore
async function saveMessage(message, sender) {
    try {
        const today = getTodayString();
        const messagesRef = collection(db, 'users', currentUser.uid, 'chatLogs', today, 'messages');
        
        await addDoc(messagesRef, {
            message: message,
            sender: sender,
            timestamp: serverTimestamp()
        });
        
    } catch (error) {
        console.error('Error saving message:', error);
    }
}

// Update Usage Count
async function updateUsageCount() {
    try {
        const today = getTodayString();
        const usageRef = doc(db, 'users', currentUser.uid, 'chatUsage', today);
        
        // Increment message count
        await setDoc(usageRef, {
            messagesCount: increment(1),
            lastUpdate: serverTimestamp(),
            date: today
        }, { merge: true });
        
        // Update local count
        messagesLeft = Math.max(0, messagesLeft - 1);
        updateUsageDisplay();
        
    } catch (error) {
        console.error('Error updating usage count:', error);
    }
}

// Show Typing Indicator
function showTypingIndicator() {
    isTyping = true;
    if (elements.typingIndicator) {
        elements.typingIndicator.style.display = 'flex';
    }
    validateInput();
    scrollToBottom();
}

// Hide Typing Indicator
function hideTypingIndicator() {
    isTyping = false;
    if (elements.typingIndicator) {
        elements.typingIndicator.style.display = 'none';
    }
    validateInput();
}

// Check if message is wellness-related
function isWellnessRelated(message) {
    const wellnessKeywords = [
        'stress', 'anxiety', 'worry', 'feel', 'feeling', 'emotion', 'sad', 'happy',
        'depression', 'mental', 'health', 'wellness', 'mindfulness', 'meditation',
        'breathe', 'breathing', 'relax', 'calm', 'peace', 'positive', 'negative',
        'motivation', 'tired', 'energy', 'sleep', 'rest', 'overwhelmed', 'pressure',
        'support', 'help', 'better', 'improve', 'cope', 'manage', 'handle',
        'grateful', 'gratitude', 'thankful', 'appreciate', 'love', 'care', 'hope',
        'good', 'bad', 'upset', 'angry', 'frustrated', 'lonely', 'confused',
        'nervous', 'scared', 'afraid', 'comfort', 'reassurance', 'advice'
    ];
    
    const messageLower = message.toLowerCase();
    return wellnessKeywords.some(keyword => messageLower.includes(keyword)) || 
           message.length < 50; // Allow short messages through
}

// Get Default Response for errors
function getDefaultResponse(userMessage) {
    const responses = [
        "I'm here to listen and support you 💙 Can you tell me more about how you're feeling?",
        "Thank you for sharing with me 🌟 What's been on your mind lately?",
        "I appreciate you reaching out 💪 How can I help support your wellbeing today?",
        "That sounds important to you 🧘 Let's explore what's been affecting your mood recently.",
        "I'm glad you're here 🌈 What would help you feel more at peace right now?",
        "I understand, and I'm here for you 💙 Tell me more about what you're experiencing.",
        "Your feelings are valid 🌸 How has your day been treating you?",
        "I hear you 💫 What kind of support would be most helpful right now?"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// Get AI Response from OpenAI
async function getAIResponse(userMessage) {
    try {
        // Check for daily limit first
        if (messagesLeft <= 0) {
            return "⚠️ You've reached your daily chat limit. Come back tomorrow for more support! 💙 Take care of yourself in the meantime. 🌟";
        }
        
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 150,
                temperature: 0.7,
                presence_penalty: 0.6,
                frequency_penalty: 0.3
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        let aiMessage = data.choices[0].message.content.trim();
        
        // Ensure the response stays on topic
        if (!isWellnessRelated(userMessage)) {
            aiMessage = "⚠️ I'm here to support your wellbeing 💙 Let's talk about mindfulness, stress, or positivity. How are you feeling right now?";
        }
        
        return aiMessage;
        
    } catch (error) {
        console.error('OpenAI API error:', error);
        return getDefaultResponse(userMessage);
    }
}

// Send Message
async function sendMessage() {
    if (!elements.messageInput) return;
    
    const message = elements.messageInput.value.trim();
    if (!message || messagesLeft <= 0 || isTyping) return;
    
    try {
        // Clear input
        elements.messageInput.value = '';
        validateInput();
        
        // Hide greeting and quick replies after first message
        hideGreetingSection();
        
        // Display user message
        displayMessage(message, 'user');
        
        // Save user message to Firestore
        await saveMessage(message, 'user');
        
        // Update usage count
        await updateUsageCount();
        
        // Show typing indicator
        showTypingIndicator();
        
        // Get AI response
        const aiResponse = await getAIResponse(message);
        
        // Hide typing indicator
        hideTypingIndicator();
        
        // Display AI response
        displayMessage(aiResponse, 'bot');
        
        // Save AI response to Firestore
        await saveMessage(aiResponse, 'bot');
        
    } catch (error) {
        console.error('Error sending message:', error);
        hideTypingIndicator();
        displayMessage('⚠️ Sorry, I encountered an error. Please try again in a moment. 💙', 'bot');
    }
}

// Send Quick Reply
async function sendQuickReply(message) {
    if (messagesLeft <= 0 || isTyping) return;
    
    // Hide greeting section immediately
    hideGreetingSection();
    
    // Display the quick reply as user message
    displayMessage(message, 'user');
    
    // Save user message
    await saveMessage(message, 'user');
    
    // Update usage count
    await updateUsageCount();
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Get AI response
        const aiResponse = await getAIResponse(message);
        
        // Hide typing indicator
        hideTypingIndicator();
        
        // Display AI response
        displayMessage(aiResponse, 'bot');
        
        // Save AI response
        await saveMessage(aiResponse, 'bot');
        
    } catch (error) {
        console.error('Error with quick reply:', error);
        hideTypingIndicator();
        displayMessage('⚠️ Sorry, I encountered an error. Please try again in a moment. 💙', 'bot');
    }
}

// Scroll to Bottom
function scrollToBottom() {
    setTimeout(() => {
        if (elements.chatWindow) {
            elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
        }
    }, 100);
}

// Show Error Message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 90%;
        text-align: center;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Reset chat for new day
function resetForNewDay() {
    messagesLeft = DAILY_MESSAGE_LIMIT;
    chatHistory = [];
    if (elements.chatMessages) {
        elements.chatMessages.innerHTML = '';
    }
    if (elements.greetingSection) {
        elements.greetingSection.style.display = 'block';
    }
    updateUsageDisplay();
    enableInput();
    displayDailyTip();
}

// Check if it's a new day
function checkNewDay() {
    const lastDate = localStorage.getItem('lastChatDate');
    const today = getTodayString();
    
    if (lastDate !== today) {
        localStorage.setItem('lastChatDate', today);
        if (lastDate) { // Only reset if there was a previous date
            resetForNewDay();
        }
    }
}

// Handle window focus for daily reset check
window.addEventListener('focus', () => {
    if (isInitialized) {
        checkDailyUsage();
        applyTheme(); // Re-apply theme on focus
    }
});

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isInitialized) {
        checkDailyUsage();
        applyTheme(); // Re-apply theme on visibility change
    }
});

// Logout function (if needed)
window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        showError('Failed to logout. Please try again.');
    }
};

// Initialize new day check
setInterval(checkNewDay, 60000); // Check every minute

console.log('MindMaze Chat loaded successfully! 🧠💙');