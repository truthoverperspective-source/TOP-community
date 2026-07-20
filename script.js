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
    if (!currentBookId) return; // no journal book selected yet

    const entryList = document.getElementById('entry-list');
    entryList.innerHTML = '<div class="text-sm text-amber-800/50 italic">Loading...</div>';

    try {
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('journals')
            .where('bookId', '==', currentBookId)
            .get();

        if (snapshot.empty) {
            entryList.innerHTML = '<div class="text-sm text-amber-800/50 italic">No entries yet. Click + to start.</div>';
            return;
        }

        // Sorted client-side (rather than orderBy in the query) since an
        // equality filter + orderBy on a different field needs a composite index.
        const docs = snapshot.docs.slice().sort((a, b) => {
            const at = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
            const bt = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
            return bt - at;
        });

        entryList.innerHTML = '';
        docs.forEach(doc => {
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
                bookId: currentBookId,
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
    applyJournalTheme(currentJournalTheme, currentJournalGraphic);
    updateCurrentJournalSidebar();
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
    renderBetaPanel();
}

// ============================================
// BETA FEATURES — HEALTH INTELLIGENCE PANEL
// ============================================

// SAMPLE DATA — hand-shaped to look like a real tracker API response
// (Fitbit-style daily records). Not connected to any live device.
// getHealthData() is the only thing UI code should call — swapping in a
// real API later means changing that one function, not the render code.
function generateSampleHealthData() {
    let seed = 88172645;
    function rand() {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        seed |= 0;
        return (seed >>> 0) / 4294967296;
    }
    function randRange(min, max) { return min + rand() * (max - min); }

    const days = [];
    for (let i = 29; i >= 0; i--) {
        const dateKey = dateKeyDaysAgo(i);
        const [y, m, d] = dateKey.split('-').map(Number);
        const isWeekend = [0, 6].includes(new Date(y, m - 1, d).getDay());

        const sleepHours = Number(randRange(5.5, 8.5).toFixed(1));
        const sleepMinutesTotal = Math.round(sleepHours * 60);
        const deep = Math.round(sleepMinutesTotal * randRange(0.14, 0.20));
        const rem = Math.round(sleepMinutesTotal * randRange(0.19, 0.25));
        const light = sleepMinutesTotal - deep - rem;

        const bedtimeDate = new Date(2000, 0, 1, Math.floor(randRange(21, 24.9)) % 24, Math.floor(randRange(0, 60)));
        const bedtime = bedtimeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        days.push({
            date: dateKey,
            sleepHours: sleepHours,
            sleepStages: { deep: deep, rem: rem, light: light },
            bedtime: bedtime,
            steps: Math.round(randRange(isWeekend ? 3000 : 4000, isWeekend ? 11000 : 14000)),
            activeMinutes: Math.round(randRange(12, 95)),
            restingHR: Math.round(randRange(58, 72)),
            hrv: Math.round(randRange(25, 65)),
            waterOz: Math.round(randRange(20, 92)),
            mindfulMinutes: Math.round(randRange(0, 30))
        });
    }
    return days;
}

const SAMPLE_HEALTH_DATA = { device: 'Fitbit Charge 6', days: generateSampleHealthData() };

function getHealthData() {
    return SAMPLE_HEALTH_DATA.days;
}

function shortLabelForDate(dateKey) {
    const [, m, d] = dateKey.split('-').map(Number);
    return m + '/' + d;
}

function shiftDateKey(dateKey, offsetDays) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + offsetDays);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

function avgField(arr, field) {
    if (!arr.length) return 0;
    return arr.reduce((sum, d) => sum + d[field], 0) / arr.length;
}

function deltaBadge(current, baseline, opts) {
    opts = opts || {};
    const diff = current - baseline;
    const up = diff >= 0;
    const color = up ? 'text-cyan-400' : 'text-amber-400';
    const decimals = opts.decimals === undefined ? 1 : opts.decimals;
    return `<span class="${color} font-mono text-xs">${up ? '▲' : '▼'} ${Math.abs(diff).toFixed(decimals)}${opts.suffix || ''}</span>`;
}

function updateBetaDeviceLabel(name) {
    const el = document.getElementById('beta-sync-status');
    if (el) el.textContent = 'SYNCED 2 MIN AGO — ' + name.toUpperCase();
}

// ---- dark chart renderers (parameterized, no hardcoded light colors) ----

function renderDarkChart(containerId, points, opts) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!points.length) {
        container.innerHTML = '<div class="h-24 flex items-center justify-center text-slate-600 text-xs font-mono">NO DATA</div>';
        return;
    }

    const color = opts.color || '#22d3ee';
    const min = opts.min, max = opts.max;
    const width = 600;
    const height = opts.height || 160;
    const padX = 8, padY = 12;
    const gradId = 'grad-' + containerId;

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
        return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="#1e293b" stroke-width="1"/>`;
    }).join('');

    const hoverDots = coords.map(c =>
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="8" fill="transparent" class="chart-hover-dot" data-label="${c.label}" data-value="${c.value}"/>`
    ).join('');

    container.innerHTML = `
        <div class="relative">
            <svg viewBox="0 0 ${width} ${height}" class="w-full" style="height:${Math.round(height * 0.62)}px" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                ${gridLines}
                <path d="${areaPath}" fill="url(#${gradId})" stroke="none"/>
                <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 3px ${color})"/>
                <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4" fill="${color}" stroke="#020617" stroke-width="2"/>
                ${hoverDots}
            </svg>
            <div class="chart-tooltip hidden absolute bg-slate-800 text-cyan-300 text-xs font-mono px-2 py-1 rounded border border-slate-700 pointer-events-none whitespace-nowrap z-10" style="transform: translate(-50%, -130%);"></div>
            ${opts.showLabels === false ? '' : `
            <div class="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-1">
                <span>${points[0].label}</span>
                <span>${points[points.length - 1].label}</span>
            </div>`}
        </div>
    `;

    wireChartTooltips(container, opts.valueSuffix);
}

function renderDarkBarChart(containerId, points, opts) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!points.length) {
        container.innerHTML = '<div class="h-20 flex items-center justify-center text-slate-600 text-xs font-mono">NO DATA</div>';
        return;
    }

    const color = opts.color || '#22d3ee';
    const highlightColor = opts.highlightColor || '#f59e0b';
    const max = opts.max || Math.max(...points.map(p => p.value)) * 1.15;
    const width = 600, height = opts.height || 130, padX = 8, padY = 10;
    const barGap = 4;
    const slot = (width - padX * 2) / points.length;
    const barWidth = Math.max(2, slot - barGap);

    const bars = points.map((p, i) => {
        const x = padX + i * slot;
        const h = Math.max(2, (p.value / (max || 1)) * (height - padY * 2));
        const y = height - padY - h;
        const fill = p.highlight ? highlightColor : color;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fill}" class="chart-hover-dot" data-label="${p.label}" data-value="${p.value}"/>`;
    }).join('');

    container.innerHTML = `
        <div class="relative">
            <svg viewBox="0 0 ${width} ${height}" class="w-full" style="height:${Math.round(height * 0.68)}px" preserveAspectRatio="none">
                <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="#1e293b" stroke-width="1"/>
                ${bars}
            </svg>
            <div class="chart-tooltip hidden absolute bg-slate-800 text-cyan-300 text-xs font-mono px-2 py-1 rounded border border-slate-700 pointer-events-none whitespace-nowrap z-10" style="transform: translate(-50%, -130%);"></div>
            <div class="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-1">
                <span>${points[0].label}</span>
                <span>${points[points.length - 1].label}</span>
            </div>
        </div>
    `;

    wireChartTooltips(container, opts.valueSuffix);
}

function wireChartTooltips(container, valueSuffix) {
    const tooltip = container.querySelector('.chart-tooltip');
    container.querySelectorAll('.chart-hover-dot').forEach(dot => {
        dot.addEventListener('mouseenter', () => {
            tooltip.textContent = dot.dataset.label + ': ' + dot.dataset.value + (valueSuffix || '');
            tooltip.classList.remove('hidden');
            const rect = dot.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            tooltip.style.left = (rect.left - containerRect.left + rect.width / 2) + 'px';
            tooltip.style.top = (rect.top - containerRect.top) + 'px';
        });
        dot.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
    });
}

function renderSleepStageBar(containerId, stages) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const total = stages.deep + stages.rem + stages.light || 1;
    const segs = [
        { label: 'DEEP', value: stages.deep, cls: 'bg-fuchsia-400' },
        { label: 'REM', value: stages.rem, cls: 'bg-cyan-400' },
        { label: 'LIGHT', value: stages.light, cls: 'bg-teal-400/50' }
    ];
    container.innerHTML = `
        <div class="flex h-3 w-full rounded-full overflow-hidden bg-slate-800">
            ${segs.map(s => `<div class="${s.cls}" style="width:${(s.value / total * 100).toFixed(1)}%"></div>`).join('')}
        </div>
        <div class="flex justify-between mt-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            ${segs.map(s => `<span>${s.label} <span class="text-slate-200">${Math.round(s.value)}m</span></span>`).join('')}
        </div>
    `;
}

// ---- pillar renderers ----

function renderBetaSleep(data) {
    const today = data[data.length - 1];
    const last7 = data.slice(-7);
    const avg7 = avgField(last7, 'sleepHours');

    document.getElementById('beta-sleep-hours').textContent = today.sleepHours.toFixed(1) + 'H';
    document.getElementById('beta-sleep-delta').innerHTML = deltaBadge(today.sleepHours, avg7, { suffix: 'H' });
    renderSleepStageBar('beta-sleep-stage-bar', today.sleepStages);

    const points = data.map(d => ({ label: shortLabelForDate(d.date), value: d.sleepHours }));
    renderDarkChart('beta-sleep-chart', points, { color: '#22d3ee', min: 4, max: 9.5, valueSuffix: 'H' });
}

function renderBetaMovement(data) {
    const today = data[data.length - 1];
    const last7 = data.slice(-7);
    const avgSteps7 = avgField(last7, 'steps');
    const avgActive7 = avgField(last7, 'activeMinutes');

    document.getElementById('beta-steps-today').textContent = today.steps.toLocaleString();
    document.getElementById('beta-steps-avg').textContent = Math.round(avgSteps7).toLocaleString() + ' AVG/7D';
    document.getElementById('beta-active-minutes').textContent = today.activeMinutes + ' MIN';
    document.getElementById('beta-active-delta').innerHTML = deltaBadge(today.activeMinutes, avgActive7, { suffix: 'm', decimals: 0 });

    const last14 = data.slice(-14);
    const points = last14.map((d, i) => ({ label: shortLabelForDate(d.date), value: d.steps, highlight: i === last14.length - 1 }));
    renderDarkBarChart('beta-steps-chart', points, { color: '#22d3ee', highlightColor: '#f59e0b', valueSuffix: ' steps' });
}

function renderBetaRecovery(data) {
    const today = data[data.length - 1];
    const last7 = data.slice(-7);
    const avgHR7 = avgField(last7, 'restingHR');
    const avgHRV7 = avgField(last7, 'hrv');

    document.getElementById('beta-rhr-value').textContent = today.restingHR;
    document.getElementById('beta-rhr-trend').innerHTML = deltaBadge(today.restingHR, avgHR7, { decimals: 0, suffix: '' });
    renderDarkChart('beta-rhr-chart', data.map(d => ({ label: shortLabelForDate(d.date), value: d.restingHR })),
        { color: '#2dd4bf', min: 50, max: 80, height: 90, showLabels: false, valueSuffix: 'bpm' });

    document.getElementById('beta-hrv-value').textContent = today.hrv;
    document.getElementById('beta-hrv-trend').innerHTML = deltaBadge(today.hrv, avgHRV7, { decimals: 0, suffix: '' });
    renderDarkChart('beta-hrv-chart', data.map(d => ({ label: shortLabelForDate(d.date), value: d.hrv })),
        { color: '#e879f9', min: 15, max: 75, height: 90, showLabels: false, valueSuffix: 'ms' });
}

function renderBetaNourishment(data) {
    const today = data[data.length - 1];
    const goal = 80;
    const pct = Math.min(100, Math.round(today.waterOz / goal * 100));

    document.getElementById('beta-water-value').textContent = today.waterOz + 'OZ / ' + goal + 'OZ';
    document.getElementById('beta-water-bar').style.width = pct + '%';

    const last7 = data.slice(-7);
    const points = last7.map((d, i) => ({ label: shortLabelForDate(d.date), value: d.waterOz, highlight: i === last7.length - 1 }));
    renderDarkBarChart('beta-water-chart', points, { color: '#22d3ee', highlightColor: '#f59e0b', height: 100, valueSuffix: 'oz' });
}

function renderBetaMindfulness(data) {
    const totalMindful = data.slice(-7).reduce((sum, d) => sum + d.mindfulMinutes, 0);
    document.getElementById('beta-mindful-total').textContent = totalMindful + ' MIN';
}

async function loadBetaSocialCheckins() {
    const el = document.getElementById('beta-social-checkins');
    if (!el) return;
    const user = auth.currentUser;
    if (!user) { el.textContent = '—/7 SOCIAL CHECK-INS'; return; }
    try {
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('healthSurveys')
            .where(firebase.firestore.FieldPath.documentId(), '>=', dateKeyDaysAgo(6))
            .where(firebase.firestore.FieldPath.documentId(), '<=', dateKeyDaysAgo(0))
            .get();
        let count = 0;
        snapshot.forEach(doc => { if (doc.data().social) count++; });
        el.textContent = count + '/7 SOCIAL CHECK-INS';
    } catch (error) {
        console.error('Error loading beta social check-ins:', error);
        el.textContent = '—/7 SOCIAL CHECK-INS';
    }
}

// ---- Insight Engine: real mood logs x sample sleep data ----

function renderInsightCard(highAvg, lowAvg, isSample, meta) {
    const container = document.getElementById('beta-insight-body');
    if (!container) return;
    const tag = isSample
        ? `<span class="text-[10px] font-mono uppercase tracking-widest text-slate-500 border border-slate-700 rounded px-2 py-0.5">SAMPLE — LOG MOODS TO ACTIVATE</span>`
        : `<span class="text-[10px] font-mono uppercase tracking-widest text-cyan-400 border border-cyan-700/50 rounded px-2 py-0.5">LIVE — YOUR MOOD DATA</span>`;
    container.innerHTML = `
        <div class="mb-3">${tag}</div>
        <p class="text-base md:text-lg text-slate-300 leading-relaxed">
            MOOD AVG <span class="font-mono text-2xl text-cyan-400">${highAvg.toFixed(1)}</span> AFTER 7H+ SLEEP
            — VS <span class="font-mono text-2xl text-amber-400">${lowAvg.toFixed(1)}</span> BELOW 7H
        </p>
        <p class="mt-2 text-[10px] font-mono text-slate-600 uppercase tracking-widest">based on ${meta.high} / ${meta.low} logged days</p>
    `;
}

function renderInsightSample() {
    const days = getHealthData();
    const moodPts = demoMoodPoints();
    const high = [], low = [];
    for (let j = 1; j < moodPts.length; j++) {
        const prevSleep = days[j - 1].sleepHours;
        (prevSleep >= 7 ? high : low).push(moodPts[j].value);
    }
    const avg = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
    renderInsightCard(avg(high), avg(low), true, { high: high.length, low: low.length });
}

async function computeInsightEngine() {
    const container = document.getElementById('beta-insight-body');
    if (container) container.innerHTML = '<span class="text-slate-500">Analyzing...</span>';

    const user = auth.currentUser;
    if (!user) { renderInsightSample(); return; }

    try {
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('healthSurveys')
            .where(firebase.firestore.FieldPath.documentId(), '>=', dateKeyDaysAgo(29))
            .where(firebase.firestore.FieldPath.documentId(), '<=', dateKeyDaysAgo(0))
            .get();

        const moodByDate = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.mood && data.mood.value !== undefined && data.mood.value !== null) {
                moodByDate[doc.id] = Number(data.mood.value);
            }
        });

        const moodDates = Object.keys(moodByDate);
        if (moodDates.length < 5) { renderInsightSample(); return; }

        const sleepByDate = {};
        getHealthData().forEach(d => { sleepByDate[d.date] = d.sleepHours; });

        const high = [], low = [];
        moodDates.forEach(dateKey => {
            const sleepHours = sleepByDate[shiftDateKey(dateKey, -1)];
            if (sleepHours === undefined) return;
            (sleepHours >= 7 ? high : low).push(moodByDate[dateKey]);
        });

        if (!high.length || !low.length) { renderInsightSample(); return; }

        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        renderInsightCard(avg(high), avg(low), false, { high: high.length, low: low.length });
    } catch (error) {
        console.error('Error computing insight engine:', error);
        renderInsightSample();
    }
}

function renderBetaPanel() {
    const data = getHealthData();
    renderBetaSleep(data);
    renderBetaMovement(data);
    renderBetaRecovery(data);
    renderBetaNourishment(data);
    renderBetaMindfulness(data);
    loadBetaSocialCheckins();
    computeInsightEngine();
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
// JOURNAL CUSTOMIZATION — style + graphic
// ============================================
let currentJournalTheme = 'parchment';
let currentJournalGraphic = '';
let pendingJournalTheme = 'parchment';
let pendingJournalGraphic = '';

const JOURNAL_THEMES = {
    parchment: { bg: '#F5F0E6', border: 'rgba(120,53,15,0.35)', text: '#78350f', hint: 'rgba(146,64,14,0.7)', filter: 'none' },
    ocean:     { bg: '#EAF2F8', border: 'rgba(30,58,138,0.3)',  text: '#1e3a8a', hint: 'rgba(30,58,138,0.65)', filter: 'hue-rotate(180deg) saturate(0.7) brightness(1.05)' },
    sage:      { bg: '#EEF4EC', border: 'rgba(6,78,59,0.3)',    text: '#064e3b', hint: 'rgba(6,78,59,0.65)',   filter: 'hue-rotate(70deg) saturate(0.5) brightness(1.05)' },
    blush:     { bg: '#FBEEF1', border: 'rgba(136,19,55,0.3)',  text: '#881337', hint: 'rgba(136,19,55,0.65)', filter: 'hue-rotate(300deg) saturate(0.5) brightness(1.05)' }
};

function applyJournalTheme(themeKey, graphicKey) {
    const theme = JOURNAL_THEMES[themeKey] || JOURNAL_THEMES.parchment;

    const notebookContainer = document.getElementById('notebook-container');
    const openNotebook = document.getElementById('open-notebook');
    const coverImg = document.getElementById('journal-cover-img');
    const openImg = document.getElementById('journal-open-img');
    const tocHeading = document.getElementById('toc-heading');
    const entryTitle = document.getElementById('current-entry-title');
    const hint = document.getElementById('notebook-hint');

    if (notebookContainer) {
        notebookContainer.style.backgroundColor = theme.bg;
        notebookContainer.style.borderColor = theme.border;
    }
    if (openNotebook) {
        openNotebook.style.backgroundColor = theme.bg;
        openNotebook.style.borderColor = theme.border;
    }
    if (coverImg) coverImg.style.filter = theme.filter;
    if (openImg) openImg.style.filter = theme.filter;
    if (tocHeading) tocHeading.style.color = theme.text;
    if (entryTitle) entryTitle.style.color = theme.text;
    if (hint) hint.style.color = theme.hint;

    const badge = document.getElementById('journal-graphic-badge');
    if (badge) {
        if (graphicKey) {
            badge.textContent = graphicKey;
            badge.classList.remove('hidden');
            badge.classList.add('flex');
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('flex');
        }
    }
}

function customizeJournal() {
    pendingJournalTheme = currentJournalTheme;
    pendingJournalGraphic = currentJournalGraphic;
    highlightThemeSelection(pendingJournalTheme);
    highlightGraphicSelection(pendingJournalGraphic);
    document.getElementById('customize-modal').classList.remove('hidden');
}

function closeCustomizeModal() {
    document.getElementById('customize-modal').classList.add('hidden');
}

function selectJournalTheme(themeKey) {
    pendingJournalTheme = themeKey;
    highlightThemeSelection(themeKey);
}

function selectJournalGraphic(graphicKey) {
    pendingJournalGraphic = graphicKey;
    highlightGraphicSelection(graphicKey);
}

function highlightThemeSelection(themeKey) {
    document.querySelectorAll('.theme-swatch').forEach(btn => {
        const selected = btn.dataset.theme === themeKey;
        btn.classList.toggle('ring-4', selected);
        btn.classList.toggle('ring-[#0F4C81]', selected);
        btn.classList.toggle('ring-offset-2', selected);
    });
}

function highlightGraphicSelection(graphicKey) {
    document.querySelectorAll('.graphic-option').forEach(btn => {
        const selected = btn.dataset.graphic === graphicKey;
        btn.classList.toggle('border-[#0F4C81]', selected);
        btn.classList.toggle('bg-blue-50', selected);
        btn.classList.toggle('border-slate-200', !selected);
    });
}

async function saveCustomization() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection('profiles').doc(user.uid).set({
            journalTheme: pendingJournalTheme,
            journalGraphic: pendingJournalGraphic
        }, { merge: true });

        currentJournalTheme = pendingJournalTheme;
        currentJournalGraphic = pendingJournalGraphic;
        applyJournalTheme(currentJournalTheme, currentJournalGraphic);
        closeCustomizeModal();
    } catch (error) {
        alert("Error saving customization: " + error.message);
    }
}

// ============================================
// BOOKSHELF — multiple journal books
// ============================================
let currentBookId = null;
let currentBookData = null;

const BOOK_COLOR_SCHEMES = {
    classic: { bg: '#F5F0E6', spine: 'rgba(120,53,15,0.45)', text: '#78350f' },
    ocean:   { bg: '#EAF2F8', spine: 'rgba(30,58,138,0.4)',  text: '#1e3a8a' },
    sage:    { bg: '#EEF4EC', spine: 'rgba(6,78,59,0.4)',    text: '#064e3b' },
    blush:   { bg: '#FBEEF1', spine: 'rgba(136,19,55,0.4)',  text: '#881337' },
    slate:   { bg: '#EEF1F5', spine: 'rgba(51,65,85,0.4)',   text: '#334155' }
};

const STICKER_CORNERS = ['top-1.5 right-1.5', 'bottom-1.5 right-1.5', 'top-1.5 left-3', 'bottom-1.5 left-3'];

function renderStickerOverlays(stickers, small, removable) {
    const sizeClass = small ? 'text-sm' : 'text-lg';
    return (stickers || []).slice(0, 4).map((emoji, i) => {
        const clickAttr = removable ? `onclick="wizardRemoveSticker(${i})" title="Remove"` : '';
        const cursorStyle = removable ? 'cursor:pointer;' : '';
        return `<span class="absolute ${STICKER_CORNERS[i]} ${sizeClass}" ${clickAttr} style="${cursorStyle}filter: drop-shadow(0 1px 1px rgba(0,0,0,0.25))">${emoji}</span>`;
    }).join('');
}

// Style textures (cover "material") — combined with a BOOK_COLOR_SCHEMES
// entry to produce the final look. Shared by the bookshelf grid, the
// sidebar's mini cover, and the New Journal wizard's live preview.
const BOOK_STYLE_TEXTURES = {
    leather: {
        backgroundImage: 'linear-gradient(135deg, rgba(0,0,0,0.32), rgba(0,0,0,0) 65%), repeating-linear-gradient(135deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 6px)',
        shadow: '0 10px 20px -6px rgba(0,0,0,0.45)',
        border: 'none',
        swatch: 'linear-gradient(135deg, #2a1c10, #4a3320)'
    },
    linen: {
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 2px, transparent 2px, transparent 5px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 2px, transparent 2px, transparent 5px)',
        shadow: '0 6px 14px -4px rgba(0,0,0,0.15)',
        border: 'none',
        swatch: 'linear-gradient(135deg, #f5f1e8, #e5dcc8)'
    },
    kraft: {
        backgroundImage: 'linear-gradient(160deg, rgba(120,72,0,0.2), rgba(120,72,0,0) 70%), repeating-linear-gradient(100deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 4px)',
        shadow: '0 6px 14px -4px rgba(120,72,0,0.3)',
        border: 'none',
        swatch: 'linear-gradient(135deg, #b48a5a, #8a6539)'
    },
    modern: {
        backgroundImage: 'none',
        shadow: '0 2px 6px rgba(0,0,0,0.12)',
        border: '1px solid rgba(0,0,0,0.08)',
        swatch: '#f8fafc'
    }
};

function getCoverVisualStyle(book, extraShadow) {
    const colors = BOOK_COLOR_SCHEMES[book.colorScheme] || BOOK_COLOR_SCHEMES.classic;
    const texture = BOOK_STYLE_TEXTURES[book.style] || BOOK_STYLE_TEXTURES.leather;
    const shadows = [texture.shadow, extraShadow].filter(Boolean).join(', ');
    return `background-color:${colors.bg};background-image:${texture.backgroundImage};box-shadow:${shadows};border:${texture.border};`;
}

function getCoverInnerHTML(book, removable) {
    const colors = BOOK_COLOR_SCHEMES[book.colorScheme] || BOOK_COLOR_SCHEMES.classic;
    return `
        <span class="absolute left-0 top-0 bottom-0 w-2 rounded-l-md" style="background:${colors.spine}"></span>
        <div class="absolute inset-0 flex items-center justify-center px-3 text-center">
            <span class="font-semibold" style="font-family: 'Playfair Display', serif; color:${colors.text}">${book.name || ''}</span>
        </div>
        ${renderStickerOverlays(book.stickers, false, removable)}
    `;
}

// Creates the one-time default book + backfills bookId on pre-existing
// entries. Guarded by profiles/{uid}.bookshelfMigrated so it only ever
// fires once, even if journalBooks somehow comes back empty again later.
async function ensureDefaultBook(uid) {
    const booksRef = db.collection('users').doc(uid).collection('journalBooks');
    const snapshot = await booksRef.orderBy('createdAt').get();

    if (!snapshot.empty) {
        const first = snapshot.docs[0];
        return { id: first.id, ...first.data() };
    }

    const profileRef = db.collection('profiles').doc(uid);
    const profileDoc = await profileRef.get();
    if (profileDoc.exists && profileDoc.data().bookshelfMigrated) {
        return null; // already migrated once — don't silently recreate a book
    }

    const defaultBook = {
        name: 'My Journal',
        colorScheme: 'classic',
        style: 'leather',
        stickers: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const defaultBookRef = booksRef.doc();
    await defaultBookRef.set(defaultBook);

    const journalsSnapshot = await db.collection('users').doc(uid).collection('journals').get();
    const batch = db.batch();
    journalsSnapshot.forEach(doc => {
        if (!doc.data().bookId) {
            batch.update(doc.ref, { bookId: defaultBookRef.id });
        }
    });
    await batch.commit();

    await profileRef.set({ bookshelfMigrated: true }, { merge: true });

    return { id: defaultBookRef.id, ...defaultBook };
}

function updateCurrentJournalSidebar() {
    if (!currentBookData) return;
    const nameEl = document.getElementById('current-book-name');
    const coverEl = document.getElementById('current-book-cover');
    if (nameEl) nameEl.textContent = currentBookData.name;
    if (coverEl) {
        const colors = BOOK_COLOR_SCHEMES[currentBookData.colorScheme] || BOOK_COLOR_SCHEMES.classic;
        coverEl.style.background = colors.bg;
        coverEl.innerHTML = `<span class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-md" style="background:${colors.spine}"></span>` +
            renderStickerOverlays(currentBookData.stickers, true);
    }
}

async function loadBooks() {
    const user = auth.currentUser;
    if (!user) return;
    const container = document.getElementById('bookshelf-grid');
    if (!container) return;
    container.innerHTML = '<div class="text-sm text-slate-400 italic col-span-full">Loading...</div>';

    try {
        await ensureDefaultBook(user.uid); // no-op if books already exist
        const snapshot = await db.collection('users').doc(user.uid)
            .collection('journalBooks').orderBy('createdAt').get();
        const books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderBookshelfGrid(books);
    } catch (error) {
        container.innerHTML = '<div class="text-sm text-red-600 col-span-full">Error loading bookshelf: ' + error.message + '</div>';
    }
}

function renderBookshelfGrid(books) {
    const container = document.getElementById('bookshelf-grid');

    const covers = books.map(book => {
        const ringShadow = book.id === currentBookId ? '0 0 0 3px white, 0 0 0 6px #0F4C81' : '';
        return `
            <div class="flex flex-col items-center">
                <div onclick="selectBook('${book.id}')"
                    class="relative w-full aspect-[3/4] rounded-r-2xl rounded-l-md cursor-pointer transition hover:-translate-y-1"
                    style="${getCoverVisualStyle(book, ringShadow)}">
                    ${getCoverInnerHTML(book)}
                </div>
            </div>`;
    }).join('');

    const newBookCard = `
        <div class="flex flex-col items-center">
            <div onclick="openJournalWizard()"
                class="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#0F4C81] cursor-pointer transition flex items-center justify-center text-slate-400 hover:text-[#0F4C81]">
                <span class="text-3xl">＋</span>
            </div>
            <div class="text-center text-sm text-slate-500 mt-2">New Journal</div>
        </div>`;

    container.innerHTML = covers + newBookCard;
}

async function selectBook(bookId) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const doc = await db.collection('users').doc(user.uid)
            .collection('journalBooks').doc(bookId).get();
        if (!doc.exists) return;

        currentBookId = bookId;
        currentBookData = { id: bookId, ...doc.data() };
        currentEntryId = null;

        const textarea = document.getElementById('journal-textarea');
        const titleEl = document.getElementById('current-entry-title');
        if (textarea) { textarea.value = ''; textarea.disabled = true; }
        if (titleEl) titleEl.textContent = 'Select or create an entry';

        updateCurrentJournalSidebar();
        closeBookshelfPanel();
    } catch (error) {
        alert("Error selecting journal: " + error.message);
    }
}

// ============================================
// NEW JOURNAL WIZARD
// ============================================
let wizardStep = 1;
let wizardState = { style: 'leather', colorScheme: 'classic', stickers: [], name: '' };

const WIZARD_STEP_TITLES = {
    1: 'Choose your notebook',
    2: 'Color scheme',
    3: 'Stickers',
    4: 'Name it'
};

const WIZARD_STICKER_PALETTE = ['🌱', '🌊', '⭐', '🌙', '🦋', '🌸', '✨', '🔥', '☕', '🎵', '🌈', '🍃'];

function openJournalWizard() {
    resetWizardState();
    document.getElementById('journal-wizard-modal').classList.remove('hidden');
    renderWizardPreview();
    renderWizardStep();
}

function closeJournalWizard() {
    document.getElementById('journal-wizard-modal').classList.add('hidden');
    resetWizardState();
}

function resetWizardState() {
    wizardStep = 1;
    wizardState = { style: 'leather', colorScheme: 'classic', stickers: [], name: '' };
}

function renderWizardStep() {
    document.getElementById('wizard-step-title').textContent = WIZARD_STEP_TITLES[wizardStep];

    const content = document.getElementById('wizard-step-content');
    if (wizardStep === 1) content.innerHTML = renderWizardStyleStep();
    else if (wizardStep === 2) content.innerHTML = renderWizardColorStep();
    else if (wizardStep === 3) content.innerHTML = renderWizardStickerStep();
    else {
        content.innerHTML = renderWizardNameStep();
        // Set via property, not baked into the markup string, so a name
        // containing a " can't break out of the value="" attribute.
        document.getElementById('wizard-name-input').value = wizardState.name;
    }

    updateWizardDots();
    updateWizardNavButtons();
}

function updateWizardDots() {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById('wizard-dot-' + i);
        if (dot) dot.style.backgroundColor = i <= wizardStep ? '#0F4C81' : '#e2e8f0';
    }
}

function updateWizardNavButtons() {
    document.getElementById('wizard-back-btn').classList.toggle('hidden', wizardStep === 1);
    document.getElementById('wizard-next-btn').textContent = wizardStep === 4 ? 'Add to Bookshelf' : 'Next';
}

function wizardBack() {
    if (wizardStep > 1) {
        wizardStep--;
        renderWizardStep();
    }
}

function wizardNext() {
    if (wizardStep < 4) {
        wizardStep++;
        renderWizardStep();
    } else {
        saveNewJournalBook();
    }
}

function renderWizardPreview() {
    const previewEl = document.getElementById('wizard-preview-cover');
    if (!previewEl) return;
    const book = {
        name: wizardState.name || 'My Journal',
        colorScheme: wizardState.colorScheme,
        style: wizardState.style,
        stickers: wizardState.stickers
    };
    previewEl.style.cssText = getCoverVisualStyle(book);
    previewEl.innerHTML = getCoverInnerHTML(book, true); // removable — click a placed sticker to remove it
}

function renderWizardStyleStep() {
    const cards = [
        { key: 'leather', label: 'Leather' },
        { key: 'linen', label: 'Linen' },
        { key: 'kraft', label: 'Kraft' },
        { key: 'modern', label: 'Modern' }
    ];
    return `<div class="grid grid-cols-2 gap-3">` + cards.map(c => {
        const selected = wizardState.style === c.key;
        const borderStyle = selected ? 'border-color:#0F4C81;background-color:#EFF6FF;' : 'border-color:#e2e8f0;';
        return `
            <button onclick="wizardSelectStyle('${c.key}')" class="rounded-2xl p-4 text-center transition" style="border-width:2px;border-style:solid;${borderStyle}">
                <div class="w-full h-12 rounded-lg mb-2" style="background:${BOOK_STYLE_TEXTURES[c.key].swatch};border:1px solid rgba(0,0,0,0.08)"></div>
                <span class="text-sm font-medium text-slate-700">${c.label}</span>
            </button>`;
    }).join('') + `</div>`;
}

function renderWizardColorStep() {
    const swatches = Object.keys(BOOK_COLOR_SCHEMES).map(key => {
        const colors = BOOK_COLOR_SCHEMES[key];
        const selected = wizardState.colorScheme === key;
        const ringStyle = selected ? 'box-shadow:0 0 0 3px white, 0 0 0 6px #0F4C81;' : '';
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        return `<button onclick="wizardSelectColor('${key}')" class="w-14 h-14 rounded-full transition" style="background:${colors.bg};${ringStyle}" title="${label}"></button>`;
    }).join('');
    return `<div class="flex justify-center gap-4 flex-wrap py-2">${swatches}</div>`;
}

function renderWizardStickerStep() {
    const count = wizardState.stickers.length;
    const palette = WIZARD_STICKER_PALETTE.map(emoji => {
        const disabled = count >= 4;
        const opacity = disabled ? 'opacity:0.3;' : '';
        return `<button onclick="wizardAddSticker('${emoji}')" ${disabled ? 'disabled' : ''} class="w-11 h-11 rounded-xl border-2 border-slate-200 hover:border-[#0F4C81] flex items-center justify-center text-xl transition" style="${opacity}">${emoji}</button>`;
    }).join('');
    return `
        <div class="text-center text-sm text-slate-500 mb-3">${count}/4 stickers &middot; click a placed sticker on the cover to remove it</div>
        <div class="flex flex-wrap justify-center gap-2">${palette}</div>
    `;
}

function renderWizardNameStep() {
    return `
        <input type="text" id="wizard-name-input" placeholder="Name your journal..." maxlength="30"
            oninput="wizardUpdateName(this.value)"
            class="w-full px-6 py-4 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#0F4C81] text-lg text-center">
    `;
}

function wizardSelectStyle(styleKey) {
    wizardState.style = styleKey;
    renderWizardPreview();
    renderWizardStep();
}

function wizardSelectColor(colorKey) {
    wizardState.colorScheme = colorKey;
    renderWizardPreview();
    renderWizardStep();
}

function wizardAddSticker(emoji) {
    if (wizardState.stickers.length >= 4) return;
    wizardState.stickers.push(emoji);
    renderWizardPreview();
    renderWizardStep();
}

function wizardRemoveSticker(index) {
    wizardState.stickers.splice(index, 1);
    renderWizardPreview();
    if (wizardStep === 3) renderWizardStep();
}

function wizardUpdateName(value) {
    wizardState.name = value;
    renderWizardPreview();
}

async function saveNewJournalBook() {
    const user = auth.currentUser;
    if (!user) return;

    const name = wizardState.name.trim().slice(0, 30);
    if (!name) {
        alert("Please name your journal.");
        return;
    }

    const newBook = {
        name: name,
        colorScheme: wizardState.colorScheme,
        style: wizardState.style,
        stickers: wizardState.stickers,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const docRef = await db.collection('users').doc(user.uid).collection('journalBooks').add(newBook);

        currentBookId = docRef.id;
        currentBookData = { id: docRef.id, ...newBook };
        updateCurrentJournalSidebar();

        closeJournalWizard();
        loadBooks(); // re-render the grid — the new cover shows selected since currentBookId now matches
    } catch (error) {
        alert("Error creating journal: " + error.message);
    }
}

function showBookshelf() {
    showJournal();
    document.getElementById('notebook-container').classList.add('hidden');
    document.getElementById('open-notebook').classList.add('hidden');
    document.getElementById('bookshelf-panel-view').classList.remove('hidden');
    loadBooks();
}

function closeBookshelfPanel() {
    document.getElementById('bookshelf-panel-view').classList.add('hidden');
    document.getElementById('notebook-container').classList.remove('hidden');
}

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
        const data = doc.exists ? doc.data() : {};

        currentJournalTheme = data.journalTheme || 'parchment';
        currentJournalGraphic = data.journalGraphic || '';
        applyJournalTheme(currentJournalTheme, currentJournalGraphic);

        const defaultBook = await ensureDefaultBook(user.uid);
        if (defaultBook) {
            currentBookId = defaultBook.id;
            currentBookData = defaultBook;
            updateCurrentJournalSidebar();
        }

        const nickname = data.nickname || null;
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