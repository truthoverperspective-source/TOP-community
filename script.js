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