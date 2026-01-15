// Data synchronization and storage functions (Updated with better error handling)

// Global variables
let dataState = {
    subjects: [],
    classes: [],
    students: [],
    tasks: [],
    scores: [],
    attendance: [],
    materials: [],
    submissions: [],
    returns: [],
    schedules: []
};

let requestQueue = [];
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQNjMSE06u5xO4dtyipa5P-YzoaicppubdwlUgMpaX4L4TUjk3-xY2PRnzhS42AxZe/exec';

async function syncData() {
    // If queue is pending, don't fetch new data
    if (requestQueue.length > 0) {
        processQueue();
        return;
    }

    const statusIcon = document.querySelector('.fa-wifi');
    if(statusIcon) {
        statusIcon.className = "fa-solid fa-spinner fa-spin text-yellow-400"; 
        if(statusIcon.nextSibling) {
            statusIcon.nextSibling.textContent = " Syncing...";
        }
    }

    try {
        // Step 1: Try to load from Firebase cache first (fast)
        if (typeof firebaseFallback !== 'undefined' && firebaseFallback.shouldUseFirebase()) {
            try {
                const cachedData = await firebaseManager.loadAllData();
                
                if (cachedData && Object.keys(cachedData).length > 0) {
                    // Update local state with cached data
                    Object.assign(dataState, cachedData);
                    refreshUI();
                    updateSyncUI('Online (Cache)', 'green');
                    
                    // Continue with background sync from Google Sheet
                    setTimeout(() => {
                        syncFromGoogleSheet().catch(err => {
                            console.warn("Background sync failed:", err);
                        });
                    }, 1000);
                    return;
                }
            } catch (firebaseError) {
                console.warn("Firebase cache load failed:", firebaseError.message);
                // Continue to Google Sheet sync
            }
        }
        
        // Step 2: Load from Google Sheet
        await syncFromGoogleSheet();
        
    } catch (error) {
        console.warn("Sync Failed (Offline/Error):", error);
        loadFromLocalStorage();
        refreshUI();
        updateSyncUI('Offline', 'red');
    }
}

async function syncFromGoogleSheet() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL + "?action=getData&t=" + Date.now());
        const result = await response.json();
        
        if (result.status === 'success' || result.subjects) {
            // Update local state
            dataState = result.data || result;
            
            // Save to Firebase cache (background) - with error handling
            if (typeof firebaseFallback !== 'undefined' && firebaseFallback.shouldUseFirebase()) {
                setTimeout(() => {
                    if (typeof firebaseManager !== 'undefined') {
                        firebaseManager.saveAllData(dataState).catch(err => {
                            console.warn("Failed to save to Firebase cache (non-critical):", err.message);
                        });
                    }
                }, 2000); // Delay to prevent quota
            }
            
            // Save to localStorage
            saveToLocalStorage();
            refreshUI();
            updateSyncUI('Online', 'green');
            
            // Reset quota errors on successful sync
            if (typeof firebaseFallback !== 'undefined') {
                firebaseFallback.handleSuccess();
            }
        }
    } catch (error) {
        console.error("Google Sheet sync failed:", error);
        throw error;
    }
}

function updateSyncUI(text, color) {
    const statusElements = document.querySelectorAll('#sync-status, #sync-status-scan');
    
    // Add fallback indicator
    let statusText = text;
    if (typeof firebaseFallback !== 'undefined' && firebaseFallback.fallbackMode && text.includes('Online')) {
        statusText = text.replace('Online', 'Online (No Cache)');
    }
    
    statusElements.forEach(element => {
        if (element) {
            element.textContent = " " + statusText;
        }
    });
    
    const statusIcon = document.querySelector('.fa-wifi');
    if(statusIcon) {
        if (typeof firebaseFallback !== 'undefined' && firebaseFallback.fallbackMode) {
            statusIcon.className = "fa-solid fa-wifi text-yellow-400";
            if (statusIcon.parentElement) {
                statusIcon.parentElement.className = "text-xs text-yellow-400 font-bold transition-all";
            }
        } else {
            statusIcon.className = color === 'green' ? "fa-solid fa-wifi" : "fa-solid fa-wifi text-red-400 animate-pulse";
            if (statusIcon.parentElement) {
                statusIcon.parentElement.className = `text-xs text-${color}-400 font-bold transition-all`;
            }
        }
    }
}

async function handleStudentLogin() {
    const inputId = document.getElementById('student-login-id')?.value.trim();
    if (!inputId) {
        alert("กรุณากรอกรหัสนักเรียน");
        return;
    }
    
    // Check if student data is loaded
    if (!dataState.students || dataState.students.length === 0) {
        showLoading("กำลังโหลดฐานข้อมูล...");
        await syncData(); // Try to fetch new data
    }

    showLoading("กำลังตรวจสอบข้อมูล...");
    await new Promise(r => setTimeout(r, 500)); // Delay for smooth UI

    // Check again
    if (!dataState.students || dataState.students.length === 0) {
        hideLoading();
        showToast("กำลังโหลดข้อมูล... กรุณาลองใหม่", "bg-yellow-600", "fa-solid fa-circle-exclamation text-2xl");
        return;
    }

    const student = dataState.students.find(s => 
        String(s.code) === String(inputId) || 
        String(s.id) === String(inputId) ||
        String(s.studentId) === String(inputId)
    );
    
    hideLoading();

    if (student) {
        localStorage.setItem('current_student_code', student.code || student.id);
        const loginWrapper = document.getElementById('student-login-wrapper');
        const dashboard = document.getElementById('student-dashboard');
        
        if (loginWrapper) loginWrapper.classList.add('hidden');
        if (dashboard) dashboard.classList.remove('hidden');
        
        if (student.code && typeof renderStudentDashboard === 'function') {
            renderStudentDashboard(student.code);
        }
        showToast(`ยินดีต้อนรับ ${student.name}`);
    } else {
        // Student not found
        showToast("ไม่พบรายชื่อนี้ในระบบ", "bg-red-600 border-red-400", "fa-solid fa-circle-xmark text-2xl");
    }
}

function saveToLocalStorage() { 
    localStorage.setItem('wany_data_backup', JSON.stringify({ 
        timestamp: new Date().getTime(), 
        data: dataState 
    })); 
}

function loadFromLocalStorage() { 
    const backup = localStorage.getItem('wany_data_backup'); 
    if(backup) { 
        try {
            const parsed = JSON.parse(backup); 
            // Check if data is not older than 30 minutes (1800000 ms)
            if(new Date().getTime() - parsed.timestamp < 1800000) {
                dataState = parsed.data; 
                console.log("Loaded from localStorage backup");
            } else {
                console.log("LocalStorage backup expired");
            }
        } catch (error) {
            console.error("Error parsing localStorage backup:", error);
        }
    } 
}

async function saveAndRefresh(payload) { 
    // 1. If it's a Login request, send immediately (no queue)
    if(payload.action === 'login') {
        showLoading("กำลังตรวจสอบ...");
        
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL + "?action=" + payload.action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload.data)
            });
            const result = await response.json();
            
            if(result.status === 'success') {
                showToast(result.message, "bg-green-600");
                await syncData(); // Refresh data
            } else {
                showToast(result.message || "เกิดข้อผิดพลาด", "bg-red-600");
            }
        } catch(error) {
            console.error("Login error:", error);
            showToast("เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว", "bg-red-600");
        } finally {
            hideLoading();
        }
        return;
    }
    
    // 2. Add other requests to queue
    requestQueue.push(payload);
    updateQueueBadge();
    
    // 3. Try to process immediately if online
    if(navigator.onLine) {
        processQueue();
    }
}

function processQueue() {
    if (requestQueue.length === 0) return;
    
    // Show processing indicator
    updateQueueBadge();
    
    const payload = requestQueue[0];
    
    fetch(GOOGLE_SCRIPT_URL + "?action=" + payload.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data)
    })
    .then(response => response.json())
    .then(result => {
        if(result.status === 'success') {
            // Remove from queue
            requestQueue.shift();
            updateQueueBadge();
            
            // Show success message
            showToast(result.message || "บันทึกสำเร็จ", "bg-green-600");
            
            // Refresh data
            syncData();
        } else {
            // Keep in queue for retry
            showToast(result.message || "บันทึกไม่สำเร็จ", "bg-red-600");
            
            // Move to end of queue for retry
            requestQueue.push(requestQueue.shift());
            updateQueueBadge();
        }
    })
    .catch(error => {
        console.error("Queue processing error:", error);
        showToast("เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว", "bg-red-600");
        
        // Move to end of queue for retry
        requestQueue.push(requestQueue.shift());
        updateQueueBadge();
    });
}

function updateQueueBadge() {
    const badge = document.getElementById('badge-homework');
    if (badge) {
        if (requestQueue.length > 0) {
            badge.textContent = requestQueue.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Student dashboard rendering
function renderStudentDashboard(studentCode) {
    const student = dataState.students.find(s => s.code === studentCode || s.id === studentCode);
    if (!student) return;
    
    // Update student info
    const nameEl = document.getElementById('std-dash-name');
    const classEl = document.getElementById('std-dash-class');
    
    if (nameEl) nameEl.textContent = student.name || '-';
    if (classEl) classEl.textContent = student.class || '-';
    
    // Render subjects
    const container = document.getElementById('std-subjects-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Get student's class
    const studentClass = dataState.classes.find(c => 
        c.id === student.classId || c.name === student.class
    );
    
    if (!studentClass) return;
    
    // Get subjects for this class
    const classSubjects = dataState.subjects.filter(s => 
        s.id === studentClass.subjectId
    );
    
    classSubjects.forEach(subject => {
        const subjectCard = createStudentSubjectCard(student, subject);
        container.appendChild(subjectCard);
    });
}

function createStudentSubjectCard(student, subject) {
    const card = document.createElement('div');
    card.className = 'glass-ios p-5 rounded-2xl border border-white/10';
    
    // Calculate scores for this student in this subject
    const studentScores = dataState.scores.filter(s => 
        s.studentId === student.id && s.subjectId === subject.id
    );
    
    const totalScore = studentScores.reduce((sum, score) => sum + (parseFloat(score.score) || 0), 0);
    const maxScore = studentScores.reduce((sum, score) => sum + (parseFloat(score.max) || 0), 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <h3 class="text-lg font-bold text-white">${subject.name || 'วิชา'}</h3>
                <p class="text-blue-300 text-sm">${student.class || 'ห้อง'}</p>
            </div>
            <div class="text-right">
                <div class="text-2xl font-bold text-yellow-400">${percentage}%</div>
                <div class="text-xs text-white/50">คะแนนรวม</div>
            </div>
        </div>
        
        <div class="mb-4">
            <div class="flex justify-between text-xs text-white/70 mb-1">
                <span>ความคืบหน้า</span>
                <span>${totalScore}/${maxScore}</span>
            </div>
            <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000" 
                     style="width: ${percentage}%"></div>
            </div>
        </div>
        
        <div class="grid grid-cols-3 gap-2 mb-4">
            <div class="text-center p-2 bg-white/5 rounded-lg">
                <div class="text-green-400 text-lg font-bold">${studentScores.filter(s => s.score > 0).length}</div>
                <div class="text-[10px] text-white/50">ส่งแล้ว</div>
            </div>
            <div class="text-center p-2 bg-white/5 rounded-lg">
                <div class="text-yellow-400 text-lg font-bold">${studentScores.length}</div>
                <div class="text-[10px] text-white/50">งานทั้งหมด</div>
            </div>
            <div class="text-center p-2 bg-white/5 rounded-lg">
                <div class="text-red-400 text-lg font-bold">${dataState.tasks.filter(t => t.subjectId === subject.id).length - studentScores.length}</div>
                <div class="text-[10px] text-white/50">ค้างส่ง</div>
            </div>
        </div>
        
        <button onclick="viewSubjectDetails('${subject.id}', '${student.id}')" 
                class="w-full py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold hover:from-blue-500 hover:to-blue-700 transition-all">
            ดูรายละเอียด
        </button>
    `;
    
    return card;
}

function viewSubjectDetails(subjectId, studentId) {
    // This function should open a modal with detailed subject information
    console.log("View subject details:", subjectId, studentId);
    // Implement modal opening logic here
}

// Default function to ensure it exists
if (typeof refreshUI === 'undefined') {
    function refreshUI() {
        console.log("refreshUI called from data.js");
        // Update various UI components based on dataState
    }
}

if (typeof showLoading === 'undefined') {
    function showLoading(text) {
        console.log("Loading:", text);
    }
}

if (typeof hideLoading === 'undefined') {
    function hideLoading() {
        console.log("Hide loading");
    }
}

if (typeof showToast === 'undefined') {
    function showToast(message, colorClass, icon) {
        console.log("Toast:", message);
    }
}
