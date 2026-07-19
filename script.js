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

// Tracks the signed-in user's nickname (profiles/{uid}.nickname)
let currentNickname = null;

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
        loadUserProfile(user);
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
    const name = document.getElementById('new-entry-name').value.trim();
    if (!name) {
        alert("Please give your entry a name.");
        return;
    }

    closeNewEntryModal();
    await createEntryWithTitle(name);
}

async function createEntryWithTitle(title) {
    const user = auth.currentUser;
    if (!user) {
        alert("You must be logged in.");
        return;
    }

    try {
        const docRef = await db.collection('users').doc(user.uid)
            .collection('journals').add({
                title: title,
                text: '',
                status: 'draft',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: user.uid
            });

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
    document.getElementById('settings-content').classList.add('hidden');
    document.getElementById('progress-content').classList.add('hidden');
    document.getElementById('resources-content').classList.add('hidden');
    document.getElementById('beta-content').classList.add('hidden');
    const goals = document.getElementById('goals-content');
    goals.classList.add('hidden');
    goals.classList.remove('flex');
    document.getElementById('journal-content').classList.remove('hidden');
}

function showDefaultDashboard() {
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('settings-content').classList.add('hidden');
    document.getElementById('progress-content').classList.add('hidden');
    document.getElementById('resources-content').classList.add('hidden');
    document.getElementById('beta-content').classList.add('hidden');
    const goals = document.getElementById('goals-content');
    goals.classList.add('hidden');
    goals.classList.remove('flex');
    document.getElementById('default-dashboard').classList.remove('hidden');
}

function showGoals() {
    document.getElementById('default-dashboard').classList.add('hidden');
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('settings-content').classList.add('hidden');
    document.getElementById('progress-content').classList.add('hidden');
    document.getElementById('resources-content').classList.add('hidden');
    document.getElementById('beta-content').classList.add('hidden');
    const goals = document.getElementById('goals-content');
    goals.classList.remove('hidden');
    goals.classList.add('flex');
    loadChecklist();
    loadGoals();
    refreshHabitButtons();
}

function showProgress() {
    document.getElementById('default-dashboard').classList.add('hidden');
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('settings-content').classList.add('hidden');
    document.getElementById('resources-content').classList.add('hidden');
    document.getElementById('beta-content').classList.add('hidden');
    const goals = document.getElementById('goals-content');
    goals.classList.add('hidden');
    goals.classList.remove('flex');
    document.getElementById('progress-content').classList.remove('hidden');
    loadProgressData();
}

function showResources() {
    document.getElementById('default-dashboard').classList.add('hidden');
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('settings-content').classList.add('hidden');
    document.getElementById('progress-content').classList.add('hidden');
    document.getElementById('beta-content').classList.add('hidden');
    const goals = document.getElementById('goals-content');
    goals.classList.add('hidden');
    goals.classList.remove('flex');
    document.getElementById('resources-content').classList.remove('hidden');
    loadResources();
}

function showBetaFeatures() {
    document.getElementById('default-dashboard').classList.add('hidden');
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('settings-content').classList.add('hidden');
    document.getElementById('progress-content').classList.add('hidden');
    document.getElementById('resources-content').classList.add('hidden');
    const goals = document.getElementById('goals-content');
    goals.classList.add('hidden');
    goals.classList.remove('flex');
    document.getElementById('beta-content').classList.remove('hidden');
}

// ============================================
// GOALS TAB — CHECKLIST & GOALS LISTS
// ============================================
let addItemType = null; // 'checklist' or 'goal'

function openAddItemModal(type) {
    addItemType = type;
    document.getElementById('add-item-title').textContent = type === 'checklist' ? 'Add to-do' : 'Add goal';
    document.getElementById('add-item-input').value = '';
    document.getElementById('add-item-modal').classList.remove('hidden');
    document.getElementById('add-item-input').focus();
}

function closeAddItemModal() {
    document.getElementById('add-item-modal').classList.add('hidden');
}

async function confirmAddItem() {
    const user = auth.currentUser;
    if (!user) return;

    const text = document.getElementById('add-item-input').value.trim();
    if (!text) { alert("Type something first!"); return; }

    const collectionName = addItemType === 'checklist' ? 'checklistItems' : 'goals';

    try {
        await db.collection('users').doc(user.uid).collection(collectionName).add({
            text: text,
            done: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeAddItemModal();
        if (addItemType === 'checklist') loadChecklist();
        else loadGoals();
    } catch (error) {
        alert("Error adding: " + error.message);
    }
}

async function loadChecklist() {
    const user = auth.currentUser;
    if (!user) return;

    const container = document.getElementById('checklist-items');
    try {
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('checklistItems').orderBy('createdAt', 'desc').get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-sm text-slate-400 italic">No items yet. Click + to add.</div>';
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const row = document.createElement('label');
            row.className = 'flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 cursor-pointer transition';
            row.innerHTML = `
                <input type="checkbox" ${data.done ? 'checked' : ''} 
                    onchange="toggleChecklistItem('${doc.id}', this.checked)"
                    class="w-5 h-5 accent-[#0F4C81]">
                <span class="${data.done ? 'line-through text-slate-400' : 'text-slate-700'}">${data.text}</span>
            `;
            container.appendChild(row);
        });
    } catch (error) {
        container.innerHTML = '<div class="text-sm text-red-600">Error: ' + error.message + '</div>';
    }
}

async function toggleChecklistItem(itemId, done) {
    const user = auth.currentUser;
    if (!user) return;
    await db.collection('users').doc(user.uid)
        .collection('checklistItems').doc(itemId).update({ done: done });
    loadChecklist();
}

async function loadGoals() {
    const user = auth.currentUser;
    if (!user) return;

    const container = document.getElementById('goals-items');
    try {
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('goals').orderBy('createdAt', 'desc').get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-sm text-slate-400 italic">No goals yet. Click + to add.</div>';
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const li = document.createElement('li');
            li.className = 'px-2 py-1';
            li.textContent = data.text;
            container.appendChild(li);
        });
    } catch (error) {
        container.innerHTML = '<div class="text-sm text-red-600">Error: ' + error.message + '</div>';
    }
}

// ============================================
// HEALTH HABIT SURVEYS
// ============================================
let currentSurvey = null;

const surveys = {
    sleep: {
        title: "😴 Sleep Check-in",
        questions: [
            { id: 'quality', label: 'How was your sleep last night? (1–10)', type: 'scale' },
            { id: 'hours', label: 'Roughly how many hours did you sleep?', type: 'number' }
        ]
    },
    nutrition: {
        title: "🥗 Nutrition Check-in",
        questions: [
            { id: 'foodGroups', label: 'Which food groups did you cover today?', type: 'multi', options: ['Fruits', 'Vegetables', 'Protein', 'Whole grains', 'Dairy'] },
            { id: 'water', label: 'Did you drink enough water?', type: 'yesno' }
        ]
    },
    exercise: {
        title: "🏃 Exercise Check-in",
        questions: [
            { id: 'type', label: 'What type of exercise did you do?', type: 'multi', options: ['Cardio', 'Strength', 'Stretching/Yoga', 'Walking', 'None'] },
            { id: 'effort', label: 'Effort level (1–10)', type: 'scale' }
        ]
    },
    social: {
        title: "👥 Social Check-in",
        questions: [
            { id: 'connected', label: 'Did you connect with someone today?', type: 'yesno' },
            { id: 'quality', label: 'How meaningful did it feel? (1–10)', type: 'scale' }
        ]
    },
    mindset: {
        title: "🧠 Mindset Check-in",
        questions: [
            { id: 'outlook', label: 'How positive is your outlook today? (1–10)', type: 'scale' },
            { id: 'gratitude', label: 'Did you note something you\'re grateful for?', type: 'yesno' }
        ]
    }
};

function dateKeyDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayKey() {
    return dateKeyDaysAgo(0);
}

function openSurvey(category) {
    currentSurvey = category;
    const survey = surveys[category];
    document.getElementById('survey-title').textContent = survey.title;

    const container = document.getElementById('survey-questions');
    container.innerHTML = '';

    survey.questions.forEach(q => {
        const wrap = document.createElement('div');
        let inputHtml = '';

        if (q.type === 'scale') {
            inputHtml = `<input type="range" min="1" max="10" value="5" id="q-${q.id}" class="w-full accent-[#0F4C81]" oninput="document.getElementById('q-${q.id}-val').textContent = this.value">
                <div class="text-center font-bold text-[#0F4C81]" id="q-${q.id}-val">5</div>`;
        } else if (q.type === 'number') {
            inputHtml = `<input type="number" min="0" max="24" id="q-${q.id}" class="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#0F4C81]">`;
        } else if (q.type === 'yesno') {
            inputHtml = `<select id="q-${q.id}" class="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#0F4C81]">
                <option value="yes">Yes</option><option value="no">No</option></select>`;
        } else if (q.type === 'multi') {
            inputHtml = q.options.map(opt =>
                `<label class="flex items-center gap-2 py-1"><input type="checkbox" name="q-${q.id}" value="${opt}" class="w-4 h-4 accent-[#0F4C81]"> ${opt}</label>`
            ).join('');
        }

        wrap.innerHTML = `<div class="font-medium text-slate-700 mb-2">${q.label}</div>${inputHtml}`;
        container.appendChild(wrap);
    });

    document.getElementById('survey-modal').classList.remove('hidden');
}

function closeSurvey() {
    document.getElementById('survey-modal').classList.add('hidden');
    currentSurvey = null;
}

async function submitSurvey() {
    const user = auth.currentUser;
    if (!user || !currentSurvey) return;

    const survey = surveys[currentSurvey];
    const responses = {};

    survey.questions.forEach(q => {
        if (q.type === 'multi') {
            responses[q.id] = Array.from(document.querySelectorAll(`input[name="q-${q.id}"]:checked`)).map(cb => cb.value);
        } else {
            responses[q.id] = document.getElementById(`q-${q.id}`).value;
        }
    });

    try {
        await db.collection('users').doc(user.uid)
            .collection('healthSurveys').doc(todayKey())
            .set({
                [currentSurvey]: {
                    responses: responses,
                    completedAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            }, { merge: true });

        closeSurvey();
        refreshHabitButtons();
    } catch (error) {
        alert("Error saving survey: " + error.message);
    }
}

async function refreshHabitButtons() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const doc = await db.collection('users').doc(user.uid)
            .collection('healthSurveys').doc(todayKey()).get();

        const data = doc.exists ? doc.data() : {};

        ['sleep', 'nutrition', 'exercise', 'social', 'mindset'].forEach(cat => {
            const btn = document.getElementById('habit-btn-' + cat);
            if (!btn) return;
            if (data[cat]) {
                btn.classList.remove('border-slate-200');
                btn.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
                if (!btn.textContent.includes('✓')) btn.textContent = btn.textContent + '  ✓';
            } else {
                btn.classList.add('border-slate-200');
                btn.classList.remove('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
            }
        });
    } catch (error) {
        console.error("Error refreshing habit buttons:", error);
    }
}
// ============================================
// MOOD TRACKER
// ============================================
async function logMood(value) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection('users').doc(user.uid)
            .collection('healthSurveys').doc(todayKey())
            .set({
                mood: {
                    value: value,
                    loggedAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            }, { merge: true });

        highlightMood(value);
    } catch (error) {
        alert("Error logging mood: " + error.message);
    }
}

function highlightMood(value) {
    document.querySelectorAll('#mood-row span').forEach(el => {
        if (el.dataset.mood == value) {
            el.classList.add('scale-125', 'drop-shadow-lg');
            el.style.filter = 'none';
        } else {
            el.classList.remove('scale-125', 'drop-shadow-lg');
            el.style.filter = 'grayscale(80%) opacity(0.5)';
        }
    });
}

async function loadTodayMood() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const doc = await db.collection('users').doc(user.uid)
            .collection('healthSurveys').doc(todayKey()).get();
        if (doc.exists && doc.data().mood) {
            highlightMood(doc.data().mood.value);
        }
    } catch (e) { /* no mood yet, fine */ }
}
// ============================================
// PLACEHOLDER FUNCTIONS (to build later)
// ============================================
function customizeJournal() { alert("🎨 Customization coming soon."); }
function showBookshelf() { alert("Bookshelf coming soon."); }

// ============================================
// PROMPTS
// ============================================
const SUGGESTED_PROMPTS = [
    "What drained your energy this week?",
    "What are you proud of right now?",
    "What's one thing you're avoiding, and why?",
    "Describe a moment today when you felt calm.",
    "What would you tell a friend going through what you're going through?",
    "What's one small win you can celebrate today?"
];

const THERAPIST_PROMPTS = [
    { text: "Let's explore where that guilt about saying no is coming from.", from: "Dr. Elena" },
    { text: "Write about a boundary you set this week — how did it feel?", from: "Dr. Elena" },
    { text: "What does \"enough\" mean to you right now?", from: "Dr. Elena" }
];

function showPrompts() {
    showJournal();
    openJournalNotebook();
    document.getElementById('prompts-modal').classList.remove('hidden');
    switchPromptsTab('suggested');
}

function closePromptsModal() {
    document.getElementById('prompts-modal').classList.add('hidden');
}

function switchPromptsTab(tab) {
    const suggestedBtn = document.getElementById('prompts-tab-suggested');
    const therapistBtn = document.getElementById('prompts-tab-therapist');
    const activeClasses = ['bg-white', 'shadow', 'text-[#0F4C81]'];
    const inactiveClasses = ['text-slate-500', 'hover:text-slate-700'];

    suggestedBtn.classList.remove(...activeClasses, ...inactiveClasses);
    therapistBtn.classList.remove(...activeClasses, ...inactiveClasses);

    const activeBtn = tab === 'suggested' ? suggestedBtn : therapistBtn;
    const inactiveBtn = tab === 'suggested' ? therapistBtn : suggestedBtn;
    activeBtn.classList.add(...activeClasses);
    inactiveBtn.classList.add(...inactiveClasses);

    const list = document.getElementById('prompts-list');
    list.innerHTML = '';

    if (tab === 'suggested') {
        SUGGESTED_PROMPTS.forEach(text => list.appendChild(buildPromptRow(text)));
    } else {
        THERAPIST_PROMPTS.forEach(p => list.appendChild(buildPromptRow(p.text, p.from)));
    }
}

function buildPromptRow(text, from) {
    const row = document.createElement('div');
    row.className = 'bg-slate-50 rounded-2xl p-4 flex items-center justify-between gap-4';

    const textWrap = document.createElement('div');
    textWrap.className = 'min-w-0';

    const p = document.createElement('p');
    p.className = 'text-slate-700 text-sm leading-relaxed';
    p.textContent = text;
    textWrap.appendChild(p);

    if (from) {
        const fromEl = document.createElement('p');
        fromEl.className = 'text-xs text-amber-700 mt-1 font-medium';
        fromEl.textContent = '— ' + from;
        textWrap.appendChild(fromEl);
    }

    const btn = document.createElement('button');
    btn.className = 'shrink-0 bg-[#0F4C81] hover:bg-[#0A3D68] text-white text-xs font-medium px-4 py-2 rounded-xl transition whitespace-nowrap';
    btn.textContent = 'Write with this';
    btn.onclick = () => writeWithPrompt(text);

    row.appendChild(textWrap);
    row.appendChild(btn);
    return row;
}

async function writeWithPrompt(promptText) {
    closePromptsModal();
    await createEntryWithTitle(promptText);
}
// ============================================
// DYNAMIC USER NAME
// ============================================
function updateDisplayName(nickname) {
    const nameEl = document.getElementById('user-display-name');
    if (!nameEl || !nickname) return;
    nameEl.textContent = nickname.charAt(0).toUpperCase() + nickname.slice(1);
}

// ============================================
// USER AVATAR (initials circle)
// ============================================
function updateAvatar(nickname) {
    const avatarEl = document.getElementById('user-avatar');
    if (!avatarEl || !nickname) return;
    avatarEl.textContent = nickname.charAt(0).toUpperCase();
}

// ============================================
// NICKNAME — profiles/{uid}.nickname
// ============================================
async function loadUserProfile(user) {
    try {
        const doc = await db.collection('profiles').doc(user.uid).get();
        const nickname = doc.exists ? doc.data().nickname : null;

        if (nickname) {
            currentNickname = nickname;
            updateDisplayName(nickname);
            updateAvatar(nickname);
        } else {
            openNicknameModal(); // first time — no nickname set yet
        }
    } catch (error) {
        // Firestore read failed — fall back to the email prefix rather than block the user
        const fallback = user.email.split('@')[0];
        currentNickname = fallback;
        updateDisplayName(fallback);
        updateAvatar(fallback);
    }
}

function openNicknameModal(prefill) {
    const input = document.getElementById('nickname-input');
    const cancelBtn = document.getElementById('nickname-cancel-btn');
    input.value = prefill || '';
    // Only show Cancel when editing an existing nickname (from Settings) —
    // the first-time setup flow is forced, so it has no way out.
    cancelBtn.classList.toggle('hidden', !prefill);
    document.getElementById('nickname-modal').classList.remove('hidden');
    input.focus();
}

function closeNicknameModal() {
    document.getElementById('nickname-modal').classList.add('hidden');
}

async function confirmNickname() {
    const user = auth.currentUser;
    if (!user) return;

    const nickname = document.getElementById('nickname-input').value.trim();
    if (!nickname) { alert("Please enter a name."); return; }

    try {
        await db.collection('profiles').doc(user.uid).set({ nickname: nickname }, { merge: true });
        currentNickname = nickname;
        updateDisplayName(nickname);
        updateAvatar(nickname);
        closeNicknameModal();
    } catch (error) {
        alert("Error saving your name: " + error.message);
    }
}

// ============================================
// SETTINGS (demo mockup)
// ============================================
function showSettings() {
    document.getElementById('default-dashboard').classList.add('hidden');
    document.getElementById('journal-content').classList.add('hidden');
    document.getElementById('progress-content').classList.add('hidden');
    document.getElementById('resources-content').classList.add('hidden');
    document.getElementById('beta-content').classList.add('hidden');
    const goals = document.getElementById('goals-content');
    if (goals) { goals.classList.add('hidden'); goals.classList.remove('flex'); }
    document.getElementById('settings-content').classList.remove('hidden');
}

// ============================================
// PROGRESS TAB — DEMO MODE TOGGLE
// ============================================
let demoMode = false;

function toggleDemoMode() {
    demoMode = !demoMode;
    const toggle = document.getElementById('demo-toggle');
    const knob = toggle.firstElementChild;
    if (demoMode) {
        toggle.classList.remove('bg-slate-200');
        toggle.classList.add('bg-emerald-500');
        knob.classList.remove('left-1');
        knob.classList.add('right-1');
    } else {
        toggle.classList.remove('bg-emerald-500');
        toggle.classList.add('bg-slate-200');
        knob.classList.remove('right-1');
        knob.classList.add('left-1');
    }
    loadProgressData();
}

function loadProgressData() {
    if (demoMode) {
        renderDemoGoals();
        renderDemoHabitStreaks();
        renderDemoMoodChart();
        renderDemoSleepChart();
        renderDemoJournalSubmissions();
    } else {
        loadRealGoalProgress();
        loadRealHabitStreaks();
        loadRealMoodChart();
        loadRealSleepChart();
        loadRealJournalSubmissions();
    }
}

// ============================================
// PROGRESS TAB — GOAL PROGRESS CARDS
// ============================================
function goalStatusStyles(status) {
    if (status === 'Complete') return { badge: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-500' };
    if (status === 'In Progress') return { badge: 'bg-blue-100 text-blue-600', bar: 'bg-blue-500' };
    return { badge: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300' };
}

function renderGoalCards(goals) {
    const container = document.getElementById('goal-progress-cards');
    if (!goals.length) {
        container.innerHTML = '<div class="text-sm text-slate-400 italic">No goals yet.</div>';
        return;
    }
    container.innerHTML = goals.map(g => {
        const s = goalStatusStyles(g.status);
        return `
            <div class="bg-white rounded-3xl p-6">
                <div class="flex items-center justify-between mb-3">
                    <span class="font-medium text-slate-800">${g.name}</span>
                    <span class="text-xs font-semibold px-3 py-1 rounded-full ${s.badge}">${g.status}</span>
                </div>
                <div class="h-2.5 bg-slate-100 rounded-full">
                    <div class="h-2.5 ${s.bar} rounded-full" style="width: ${g.percent}%"></div>
                </div>
            </div>`;
    }).join('');
}

function renderDemoGoals() {
    renderGoalCards([
        { name: 'Lose 5 lbs', status: 'In Progress', percent: 60 },
        { name: 'Build support system', status: 'In Progress', percent: 40 },
        { name: 'Get out of parents house', status: 'Not Started', percent: 0 }
    ]);
}

async function loadRealGoalProgress() {
    const user = auth.currentUser;
    if (!user) return;
    const container = document.getElementById('goal-progress-cards');
    container.innerHTML = '<div class="text-sm text-slate-400 italic">Loading...</div>';
    try {
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('goals').orderBy('createdAt', 'desc').get();

        // The goals schema only tracks a boolean `done` flag today, so real
        // mode can only distinguish Complete vs Not Started — there's no
        // partial-progress field yet to populate an "In Progress" state.
        const goals = snapshot.docs.map(doc => {
            const data = doc.data();
            return data.done
                ? { name: data.text, status: 'Complete', percent: 100 }
                : { name: data.text, status: 'Not Started', percent: 0 };
        });
        renderGoalCards(goals);
    } catch (error) {
        container.innerHTML = '<div class="text-sm text-red-600">Error loading goals: ' + error.message + '</div>';
    }
}

// ============================================
// PROGRESS TAB — HABIT STREAKS (rolling 7 days)
// ============================================
function renderHabitStreaks(counts) {
    ['sleep', 'nutrition', 'exercise', 'social', 'mindset'].forEach(cat => {
        const el = document.getElementById('streak-' + cat);
        if (el) el.textContent = (counts[cat] || 0) + '/7';
    });
}

function renderDemoHabitStreaks() {
    renderHabitStreaks({ sleep: 6, nutrition: 5, exercise: 4, social: 7, mindset: 6 });
}

async function loadRealHabitStreaks() {
    const user = auth.currentUser;
    if (!user) return;
    const counts = { sleep: 0, nutrition: 0, exercise: 0, social: 0, mindset: 0 };
    try {
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('healthSurveys')
            .where(firebase.firestore.FieldPath.documentId(), '>=', dateKeyDaysAgo(6))
            .where(firebase.firestore.FieldPath.documentId(), '<=', dateKeyDaysAgo(0))
            .get();

        snapshot.forEach(doc => {
            const data = doc.data();
            ['sleep', 'nutrition', 'exercise', 'social', 'mindset'].forEach(cat => {
                if (data[cat]) counts[cat]++;
            });
        });
        renderHabitStreaks(counts);
    } catch (error) {
        console.error("Error loading habit streaks:", error);
    }
}

// ============================================
// PROGRESS TAB — LINE CHART RENDERER (mood & sleep)
// ============================================
function shortDateLabel(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return (d.getMonth() + 1) + '/' + d.getDate();
}

function renderLineChart(containerId, points, opts) {
    const container = document.getElementById(containerId);
    if (!points.length) {
        container.innerHTML = '<div class="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>';
        return;
    }

    const color = opts.color;
    const min = opts.min;
    const max = opts.max;
    const width = 600;
    const height = 200;
    const padX = 12;
    const padY = 16;

    const xStep = (width - padX * 2) / (points.length - 1 || 1);
    const yScale = v => height - padY - ((v - min) / (max - min || 1)) * (height - padY * 2);

    const coords = points.map((p, i) => ({ x: padX + i * xStep, y: yScale(p.value), label: p.label, value: p.value }));

    const linePath = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c.x.toFixed(1) + ' ' + c.y.toFixed(1)).join(' ');
    const areaPath = linePath +
        ` L ${coords[coords.length - 1].x.toFixed(1)} ${height - padY} L ${coords[0].x.toFixed(1)} ${height - padY} Z`;

    const last = coords[coords.length - 1];
    const gridValues = [min, (min + max) / 2, max];
    const gridLines = gridValues.map(v => {
        const y = yScale(v).toFixed(1);
        return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
    }).join('');

    const hoverDots = coords.map(c =>
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="8" fill="transparent" class="chart-hover-dot" data-label="${c.label}" data-value="${c.value}"/>`
    ).join('');

    container.innerHTML = `
        <div class="relative">
            <svg viewBox="0 0 ${width} ${height}" class="w-full h-40" preserveAspectRatio="none">
                ${gridLines}
                <path d="${areaPath}" fill="${color}" fill-opacity="0.1" stroke="none"/>
                <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="5" fill="${color}" stroke="white" stroke-width="2"/>
                ${hoverDots}
            </svg>
            <div class="chart-tooltip hidden absolute bg-slate-800 text-white text-xs px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap z-10" style="transform: translate(-50%, -130%);"></div>
            <div class="flex justify-between text-xs text-slate-400 mt-2 px-1">
                <span>${points[0].label}</span>
                <span class="font-semibold text-slate-600">Latest: ${last.value}${opts.valueSuffix || ''}</span>
                <span>${points[points.length - 1].label}</span>
            </div>
        </div>
    `;

    const tooltip = container.querySelector('.chart-tooltip');
    container.querySelectorAll('.chart-hover-dot').forEach(dot => {
        dot.addEventListener('mouseenter', () => {
            tooltip.textContent = dot.dataset.label + ': ' + dot.dataset.value + (opts.valueSuffix || '');
            tooltip.classList.remove('hidden');
            const rect = dot.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            tooltip.style.left = (rect.left - containerRect.left + rect.width / 2) + 'px';
            tooltip.style.top = (rect.top - containerRect.top) + 'px';
        });
        dot.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
        });
    });
}

async function fetchHealthSurveySeries(uid, numDays, extractValue) {
    const snapshot = await db.collection('users').doc(uid)
        .collection('healthSurveys')
        .where(firebase.firestore.FieldPath.documentId(), '>=', dateKeyDaysAgo(numDays - 1))
        .where(firebase.firestore.FieldPath.documentId(), '<=', dateKeyDaysAgo(0))
        .get();

    const byDate = {};
    snapshot.forEach(doc => { byDate[doc.id] = doc.data(); });

    const points = [];
    for (let daysAgo = numDays - 1; daysAgo >= 0; daysAgo--) {
        const data = byDate[dateKeyDaysAgo(daysAgo)];
        if (!data) continue;
        const value = extractValue(data);
        if (value === null || value === undefined || isNaN(value)) continue;
        points.push({ label: shortDateLabel(daysAgo), value: value });
    }
    return points;
}

// ============================================
// PROGRESS TAB — MOOD CHART
// ============================================
function demoMoodPoints() {
    const values = [3, 4, 3, 2, 3, 4, 5, 4, 3, 3, 2, 3, 4, 4, 5, 4, 3, 2, 3, 4, 5, 5, 4, 3, 3, 4, 4, 5, 4, 3];
    return values.map((v, i) => ({ label: shortDateLabel(29 - i), value: v }));
}

function renderDemoMoodChart() {
    renderLineChart('mood-chart', demoMoodPoints(), { color: '#0F4C81', min: 1, max: 5 });
}

async function loadRealMoodChart() {
    const user = auth.currentUser;
    if (!user) return;
    const container = document.getElementById('mood-chart');
    container.innerHTML = '<div class="h-40 flex items-center justify-center text-slate-400 text-sm">Loading...</div>';
    try {
        const points = await fetchHealthSurveySeries(user.uid, 30, data => data.mood ? data.mood.value : null);
        renderLineChart('mood-chart', points, { color: '#0F4C81', min: 1, max: 5 });
    } catch (error) {
        container.innerHTML = '<div class="text-sm text-red-600">Error loading mood data: ' + error.message + '</div>';
    }
}

// ============================================
// PROGRESS TAB — SLEEP QUALITY CHART
// ============================================
function demoSleepPoints() {
    const values = [6, 7, 5, 4, 6, 7, 8, 7, 6, 5, 4, 5, 6, 7, 8, 7, 6, 5, 6, 7, 8, 9, 8, 7, 6, 6, 7, 8, 7, 6];
    return values.map((v, i) => ({ label: shortDateLabel(29 - i), value: v }));
}

function renderDemoSleepChart() {
    renderLineChart('sleep-chart', demoSleepPoints(), { color: '#059669', min: 1, max: 10 });
}

async function loadRealSleepChart() {
    const user = auth.currentUser;
    if (!user) return;
    const container = document.getElementById('sleep-chart');
    container.innerHTML = '<div class="h-40 flex items-center justify-center text-slate-400 text-sm">Loading...</div>';
    try {
        const points = await fetchHealthSurveySeries(user.uid, 30, data =>
            data.sleep && data.sleep.responses ? Number(data.sleep.responses.quality) : null
        );
        renderLineChart('sleep-chart', points, { color: '#059669', min: 1, max: 10 });
    } catch (error) {
        container.innerHTML = '<div class="text-sm text-red-600">Error loading sleep data: ' + error.message + '</div>';
    }
}

// ============================================
// PROGRESS TAB — JOURNAL SUBMISSIONS
// ============================================
function renderDemoJournalSubmissions() {
    const entries = [
        { title: 'Homework: Boundaries', date: '7/8/26', goal: 'Build support system' },
        { title: 'Daily reflection', date: '7/6/26', goal: '—' },
        { title: 'Weekly check-in', date: '7/2/26', goal: 'Lose 5 lbs' }
    ];
    document.getElementById('journal-submissions-list').innerHTML = entries.map(e => `
        <div class="flex items-center justify-between border-b border-slate-100 last:border-0 pb-3 last:pb-0">
            <div>
                <div class="font-medium text-slate-800">${e.title}</div>
                <div class="text-xs text-slate-400">${e.date}</div>
            </div>
            <span class="text-xs text-slate-500">${e.goal}</span>
        </div>`).join('');
}

async function loadRealJournalSubmissions() {
    const user = auth.currentUser;
    if (!user) return;
    const container = document.getElementById('journal-submissions-list');
    container.innerHTML = '<div class="text-sm text-slate-400 italic">Loading...</div>';
    try {
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('journals')
            .where('status', '==', 'submitted')
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-sm text-slate-400 italic">No submitted entries yet.</div>';
            return;
        }

        // Sorted client-side (rather than orderBy in the query) to avoid
        // requiring a composite Firestore index for status + submittedAt.
        const docs = snapshot.docs.slice().sort((a, b) => {
            const at = a.data().submittedAt ? a.data().submittedAt.toMillis() : 0;
            const bt = b.data().submittedAt ? b.data().submittedAt.toMillis() : 0;
            return bt - at;
        });

        container.innerHTML = docs.map(doc => {
            const data = doc.data();
            const date = data.submittedAt ? data.submittedAt.toDate() : new Date();
            const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + '/' + String(date.getFullYear()).slice(-2);
            // No goal-relation field exists in the journals schema yet, so
            // real entries can't show which goal they relate to.
            return `
                <div class="flex items-center justify-between border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                    <div>
                        <div class="font-medium text-slate-800">${data.title || 'Untitled'}</div>
                        <div class="text-xs text-slate-400">${dateStr}</div>
                    </div>
                    <span class="text-xs text-slate-400">—</span>
                </div>`;
        }).join('');
    } catch (error) {
        container.innerHTML = '<div class="text-sm text-red-600">Error loading entries: ' + error.message + '</div>';
    }
}

// ============================================
// RESOURCES TAB — BOOKS & LINKS
// ============================================
let addResourceType = null; // 'book' or 'link'

function openAddResourceModal(type) {
    addResourceType = type;
    const secondaryInput = document.getElementById('resource-secondary-input');
    const noteInput = document.getElementById('resource-note-input');

    if (type === 'book') {
        document.getElementById('add-resource-title').textContent = 'Add Book';
        secondaryInput.placeholder = 'Author';
        noteInput.placeholder = 'Note (optional)';
    } else {
        document.getElementById('add-resource-title').textContent = 'Add Link';
        secondaryInput.placeholder = 'URL (https://...)';
        noteInput.placeholder = 'Description (optional)';
    }

    document.getElementById('resource-title-input').value = '';
    secondaryInput.value = '';
    noteInput.value = '';
    document.getElementById('add-resource-modal').classList.remove('hidden');
    document.getElementById('resource-title-input').focus();
}

function closeAddResourceModal() {
    document.getElementById('add-resource-modal').classList.add('hidden');
}

async function confirmAddResource() {
    const user = auth.currentUser;
    if (!user) return;

    const title = document.getElementById('resource-title-input').value.trim();
    const secondary = document.getElementById('resource-secondary-input').value.trim();
    const note = document.getElementById('resource-note-input').value.trim();

    if (!title) { alert("Please enter a title."); return; }
    if (addResourceType === 'link' && !secondary) { alert("Please enter a URL."); return; }

    const newResource = {
        type: addResourceType,
        title: title,
        recommended: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (addResourceType === 'book') {
        newResource.author = secondary;
        newResource.note = note;
    } else {
        // Force a safe scheme so a value like "javascript:..." can never end up as a clickable href.
        newResource.url = /^https?:\/\//i.test(secondary) ? secondary : 'https://' + secondary;
        newResource.description = note;
    }

    try {
        await db.collection('users').doc(user.uid).collection('resources').add(newResource);
        closeAddResourceModal();
        loadResources();
    } catch (error) {
        alert("Error adding resource: " + error.message);
    }
}

async function loadResources() {
    const user = auth.currentUser;
    if (!user) return;

    const booksContainer = document.getElementById('books-list');
    const linksContainer = document.getElementById('links-list');

    try {
        const collectionRef = db.collection('users').doc(user.uid).collection('resources');
        let snapshot = await collectionRef.get();

        if (snapshot.empty) {
            await seedDefaultResources(user.uid);
            snapshot = await collectionRef.get();
        }

        const books = [];
        const links = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === 'book') books.push(data);
            else if (data.type === 'link') links.push(data);
        });

        // Recommended items float to the top of each section.
        const byRecommended = (a, b) => (b.recommended === true ? 1 : 0) - (a.recommended === true ? 1 : 0);
        books.sort(byRecommended);
        links.sort(byRecommended);

        renderBooks(books);
        renderLinks(links);
    } catch (error) {
        booksContainer.innerHTML = '<div class="text-sm text-red-600">Error loading books: ' + error.message + '</div>';
        linksContainer.innerHTML = '<div class="text-sm text-red-600">Error loading links: ' + error.message + '</div>';
    }
}

function renderBooks(books) {
    const container = document.getElementById('books-list');
    if (!books.length) {
        container.innerHTML = '<div class="text-sm text-slate-400 italic">No books yet. Click + to add.</div>';
        return;
    }
    container.innerHTML = books.map(b => `
        <div class="bg-white rounded-3xl p-6">
            <div class="font-semibold text-slate-800">${b.title}</div>
            ${b.author ? `<div class="text-sm text-slate-500">${b.author}</div>` : ''}
            ${b.recommended ? `<span class="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700 mt-2">⭐ Recommended by ${b.recommendedBy || 'Dr. Rivera'}</span>` : ''}
            ${b.note ? `<p class="text-sm text-slate-600 mt-2">${b.note}</p>` : ''}
        </div>`).join('');
}

function renderLinks(links) {
    const container = document.getElementById('links-list');
    if (!links.length) {
        container.innerHTML = '<div class="text-sm text-slate-400 italic">No links yet. Click + to add.</div>';
        return;
    }
    container.innerHTML = links.map(l => `
        <div class="bg-white rounded-3xl p-6">
            <a href="${l.url}" target="_blank" rel="noopener" class="font-semibold text-[#0F4C81] hover:underline">${l.title}</a>
            <div class="text-xs text-slate-400 truncate">${l.url}</div>
            ${l.recommended ? `<span class="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700 mt-2">⭐ Recommended by ${l.recommendedBy || 'Dr. Rivera'}</span>` : ''}
            ${l.description ? `<p class="text-sm text-slate-600 mt-2">${l.description}</p>` : ''}
        </div>`).join('');
}

async function seedDefaultResources(uid) {
    const batch = db.batch();
    const collectionRef = db.collection('users').doc(uid).collection('resources');

    const seedDocs = [
        { type: 'book', title: 'The Body Keeps the Score', author: 'Bessel van der Kolk', recommended: true, recommendedBy: 'Dr. Rivera' },
        { type: 'book', title: 'Feeling Good', author: 'David D. Burns', recommended: true, recommendedBy: 'Dr. Rivera' },
        { type: 'link', title: 'Understanding Anxiety — APA Guide', url: 'https://www.apa.org/topics/anxiety', recommended: true, recommendedBy: 'Dr. Rivera' }
    ];

    seedDocs.forEach(docData => {
        batch.set(collectionRef.doc(), Object.assign({}, docData, {
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }));
    });

    await batch.commit();
}
// ============================================
// SIMPLE SIGN-UP ON MAIN PAGE
// ============================================
async function handleSignUp() {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();

    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters");
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        alert("✅ Account created successfully! You can now sign in.");
        
        // Optional: Clear the fields
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
            alert("This email is already registered. Please sign in instead.");
        } else {
            alert("Error creating account: " + error.message);
        }
    }
}

// ============================================
// SIGN UP MODAL
// ============================================
function showSignUpModal() {
    document.getElementById('signup-modal').classList.remove('hidden');
    // Clear fields
    document.getElementById('modal-signup-email').value = '';
    document.getElementById('modal-signup-password').value = '';
}

function hideSignUpModal() {
    document.getElementById('signup-modal').classList.add('hidden');
}

async function handleSignUpModal() {
    const email = document.getElementById('modal-signup-email').value.trim();
    const password = document.getElementById('modal-signup-password').value.trim();

    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters long");
        return;
    }

    try {
        await auth.createUserWithEmailAndPassword(email, password);
        alert("✅ Account created successfully!\n\nYou can now go to the Sign In page.");
        hideSignUpModal();
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
            alert("This email is already registered. Please use Sign In instead.");
        } else {
            alert("Error: " + error.message);
        }
    }
}