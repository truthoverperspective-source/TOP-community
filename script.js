// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyBFsfWGj5AcIFJleqJcu8W0puAxZFLk4G0",
  authDomain: "top-database.firebaseapp.com",
  projectId: "top-database",
  storageBucket: "top-database.firebasestorage.app",
  messagingSenderId: "840546805024",
  appId: "1:840546805024:web:1c8c62cea77e14186fe345",
  measurementId: "G-RCRWXKLPMQ"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Tracks which entry is currently open
let currentEntryId = null;
let currentMode = 'edit'; // 'edit' or 'view'

// ============================================
// AUTH
// ============================================
async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');
    } catch (error) {
        alert("Login failed: " + error.message);
    }
}

function logout() {
    auth.signOut().then(() => {
        document.getElementById('dashboard-content').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });
}

// Keep user logged in on page refresh
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');
    } else {
        document.getElementById('dashboard-content').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    }
});

// Press Enter in password field to log in
document.addEventListener('DOMContentLoaded', function() {
    const passwordField = document.getElementById('login-password');
    if (passwordField) {
        passwordField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleLogin();
        });
    }
});

// ============================================
// DASHBOARD VIEW SWITCHING
// ============================================
function showJournal() {
    document.getElementById('default-dashboard').classList.add('hidden');
    document.getElementById('journal-content').classList.remove('hidden');
}

function showDefaultDashboard() {
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('default-dashboard').classList.remove('hidden');
}

function goBackToDashboard() {
    showDefaultDashboard();
}

// ============================================
// NOTEBOOK OPEN / CLOSE
// ============================================
function openJournalNotebook() {
    document.getElementById('notebook-container').classList.add('hidden');
    document.getElementById('open-notebook').classList.remove('hidden');
    loadEntries(); // Pull entries from Firestore for the table of contents
}

function closeJournalNotebook() {
    document.getElementById('open-notebook').classList.add('hidden');
    document.getElementById('notebook-container').classList.remove('hidden');
}

// ============================================
// LOAD ENTRIES (Table of Contents)
// ============================================
async function loadEntries() {
    const user = auth.currentUser;
    if (!user) return;

    const entryList = document.getElementById('entry-list');
    entryList.innerHTML = '<div class="text-sm text-amber-800/50 italic">Loading...</div>';

    try {
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('journals')
            .orderBy('timestamp', 'desc')
            .get();

        if (snapshot.empty) {
            entryList.innerHTML = '<div class="text-sm text-amber-800/50 italic">No entries yet. Click + to start.</div>';
            return;
        }

        entryList.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? data.timestamp.toDate() : new Date();
            const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + '/' + String(date.getFullYear()).slice(-2);
            const title = data.title || 'Untitled';

            const row = document.createElement('div');
            row.className = 'flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-amber-800/10 transition text-sm text-amber-900/90';
            row.innerHTML = `
                <span class="truncate"><span class="font-medium">${dateStr}</span> — ${title}</span>
                <span class="flex gap-2 shrink-0">
                    <button onclick="openEntry('${doc.id}', 'edit')" title="Edit" class="hover:scale-110 transition">✏️</button>
                    <button onclick="openEntry('${doc.id}', 'view')" title="View" class="hover:scale-110 transition">👓</button>
                </span>
            `;
            entryList.appendChild(row);
        });
    } catch (error) {
        entryList.innerHTML = '<div class="text-sm text-red-600">Error loading entries: ' + error.message + '</div>';
    }
}

// ============================================
// OPEN AN ENTRY (edit or view mode)
// ============================================
async function openEntry(entryId, mode) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const doc = await db.collection('users').doc(user.uid)
            .collection('journals').doc(entryId).get();

        if (!doc.exists) {
            alert("Entry not found.");
            return;
        }

        const data = doc.data();
        currentEntryId = entryId;
        currentMode = mode;

        const textarea = document.getElementById('journal-textarea');
        const titleEl = document.getElementById('current-entry-title');

        textarea.value = data.text || '';
        titleEl.textContent = (mode === 'view' ? '👓 ' : '✏️ ') + (data.title || 'Untitled');
        textarea.disabled = (mode === 'view');
        if (mode === 'edit') textarea.focus();

    } catch (error) {
        alert("Error opening entry: " + error.message);
    }
}

// ============================================
// NEW ENTRY MODAL
// ============================================
function openNewEntryModal() {
    document.getElementById('new-entry-modal').classList.remove('hidden');
    document.getElementById('new-entry-name').value = '';
    document.getElementById('new-entry-name').focus();
}

function closeNewEntryModal() {
    document.getElementById('new-entry-modal').classList.add('hidden');
}

async function createNewEntry() {
    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in.");
        return;
    }

    const name = document.getElementById('new-entry-name').value.trim();
    if (!name) {
        alert("Please give your entry a name.");
        return;
    }

    try {
        const docRef = await db.collection('users').doc(user.uid)
            .collection('journals').add({
                title: name,
                text: '',
                status: 'draft',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: user.uid
            });

        closeNewEntryModal();
        await loadEntries();          // Refresh the table of contents
        openEntry(docRef.id, 'edit'); // Open the new entry ready to write

    } catch (error) {
        alert("Error creating entry: " + error.message);
    }
}

// ============================================
// SAVE / SUBMIT
// ============================================
async function saveJournal() {
    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in to save.");
        return;
    }

    if (!currentEntryId) {
        alert("Select or create an entry first!");
        return;
    }

    const journalText = document.getElementById('journal-textarea').value;

    try {
        await db.collection('users').doc(user.uid)
            .collection('journals').doc(currentEntryId).update({
                text: journalText,
                lastEdited: firebase.firestore.FieldValue.serverTimestamp()
            });
        alert("✅ Entry saved!");
    } catch (error) {
        alert("Error saving: " + error.message);
    }
}

async function submitJournal() {
    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in to submit.");
        return;
    }

    if (!currentEntryId) {
        alert("Select or create an entry first!");
        return;
    }

    const journalText = document.getElementById('journal-textarea').value;

    try {
        await db.collection('users').doc(user.uid)
            .collection('journals').doc(currentEntryId).update({
                text: journalText,
                status: 'submitted',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        alert("📤 Entry submitted to your therapist!");
    } catch (error) {
        alert("Error submitting: " + error.message);
    }
}
function showJournal() {
    document.getElementById('default-dashboard').classList.add('hidden');
    document.getElementById('goals-content').classList.add('hidden');
    document.getElementById('journal-content').classList.remove('hidden');
}

function showDefaultDashboard() {
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('goals-content').classList.add('hidden');
    document.getElementById('default-dashboard').classList.remove('hidden');
}

function showGoals() {
    document.getElementById('default-dashboard').classList.add('hidden');
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('goals-content').classList.remove('hidden');
    loadChecklist();
    loadGoals();
    refreshHabitButtons();
}

// ============================================
// PLACEHOLDER FUNCTIONS (to build later)
// ============================================
function customizeJournal() { alert("🎨 Customization coming soon."); }
function showPrompts() { alert("Prompts coming soon."); }
function showBookshelf() { alert("Bookshelf coming soon."); }