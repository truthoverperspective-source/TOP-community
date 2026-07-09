// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBFsfWGj5AcIFJleqJcu8W0puAxZFLk4G0",
  authDomain: "top-database.firebaseapp.com",
  projectId: "top-database",
  storageBucket: "top-database.firebasestorage.app",
  messagingSenderId: "840546805024",
  appId: "1:840546805024:web:1c8c62cea77e14186fe345",
  measurementId: "G-RCRWXKLPMQ"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Sign Up Function
async function signUp(email, password) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await db.collection('profiles').doc(user.uid).set({
            email: user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            subscriptionTier: 'free'
        });
        
        console.log("Account created successfully!");
        alert("Account created successfully!");
        return user;
        
    } catch (error) {
        console.error("Error:", error.message);
        alert("Error creating account: " + error.message);
    }
}

// Handle Sign Up Button Click
async function handleSignUp() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    await signUp(email, password);

    alert("Account created successfully!");
}

// Handle Login
async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        
        // Hide login form and show dashboard
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');
        
        console.log("Login successful!");
        
    } catch (error) {
        console.error("Login error:", error.message);
        alert("Login failed: " + error.message);
    }
}

// Allow pressing Enter in password field to login
document.addEventListener('DOMContentLoaded', function() {
    const passwordField = document.getElementById('login-password');
    
    if (passwordField) {
        passwordField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }
});

// Switch between dashboard sections
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(s => {
        s.classList.add('hidden');
    });
    
    // Show the selected section
    const target = document.getElementById(section + '-section');
    if (target) {
        target.classList.remove('hidden');
    }
}

function openJournalNotebook() {
    alert("Journal notebook opened! (We'll add the actual editor + toolbar here next)");
    // Future: open full writing modal or switch to rich text editor
}

function saveJournal() { alert("Entry saved!"); }
function submitJournal() { alert("Entry submitted to therapist!"); }
function customizeJournal() { alert("Customization options coming soon"); }
function goBackToDashboard() {
    // Hide journal, show main dashboard content
    document.getElementById('journal-content').classList.add('hidden');
    // Show your default dashboard panels again
}

// === DASHBOARD TAB SWITCHING ===
function showJournal() {
    document.getElementById('default-dashboard').classList.add('hidden');
    document.getElementById('journal-content').classList.remove('hidden');
}

function goBackToDashboard() {
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('default-dashboard').classList.remove('hidden');
}

function showDefaultDashboard() {
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('default-dashboard').classList.remove('hidden');
}

// Journal functions
function openJournalNotebook() {
    alert("📝 Journal opened!\n\nWe'll build the actual writing area + toolbar next.");
}

function saveJournal() { 
    alert("✅ Entry saved."); 
}

function submitJournal() { 
    alert("📤 Entry submitted to therapist."); 
}

function customizeJournal() { 
    alert("🎨 Customization coming soon."); 
}