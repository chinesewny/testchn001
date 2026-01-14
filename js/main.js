// Main initialization and utility functions (Updated)
window.addEventListener('DOMContentLoaded', async () => {
    // Set today's date in attendance date input
    if(document.getElementById('att-date-input')) {
        document.getElementById('att-date-input').value = getThaiDateISO();
    }
    
    // Initialize Firebase
    showLoading("กำลังเตรียมระบบ...");
    try {
        await initializeFirebase();
        console.log("Firebase initialized successfully");
    } catch (error) {
        console.warn("Firebase initialization failed, continuing without cache:", error);
    } finally {
        hideLoading();
    }
    
    // Initialize UI components
    renderScoreButtons();
    initEventListeners();
    loadFromLocalStorage();
    setupInactivityTimer();
    
    // Initial UI refresh and data sync
    refreshUI();
    syncData();

    // Check queue every 5 seconds (Auto Retry)
    setInterval(processQueue, 5000);

    // Check existing sessions
    const adminSession = localStorage.getItem('wany_admin_session');
    const studentCode = localStorage.getItem('current_student_code');

    if (adminSession) {
        switchMainTab('admin');
        showAdminPanel(true);
    } else if (studentCode) {
        switchMainTab('student');
        document.getElementById('student-login-wrapper').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
    } else {
        switchMainTab('student'); 
    }

    // Set up periodic checks
    setInterval(checkSmartSchedule, 60000);
    setInterval(syncData, 5 * 60 * 1000); // Sync every 5 minutes
    
    // Check for real-time updates (optional)
    if (firebaseInitialized) {
        setupRealtimeUpdates();
    }
});

// Optional: Setup real-time updates for active users
function setupRealtimeUpdates() {
    // Only setup real-time for admin users
    const adminSession = localStorage.getItem('wany_admin_session');
    if (!adminSession) return;
    
    // Listen for attendance updates
    firebaseManager.setupRealtimeListener('attendance', (attendanceData) => {
        dataState.attendance = attendanceData;
        
        // Only refresh if attendance panel is active
        if (!document.getElementById('admin-panel-attendance').classList.contains('hidden')) {
            renderAttRoster();
        }
    });
    
    // Listen for score updates
    firebaseManager.setupRealtimeListener('scores', (scoresData) => {
        dataState.scores = scoresData;
        
        // Only refresh if relevant panels are active
        if (!document.getElementById('admin-panel-scan').classList.contains('hidden')) {
            renderScoreRoster();
        }
        if (!document.getElementById('admin-panel-report').classList.contains('hidden')) {
            renderGradeReport();
        }
    });
    
    // Listen for submission updates
    firebaseManager.setupRealtimeListener('submissions', (submissionsData) => {
        dataState.submissions = submissionsData;
        
        // Update homework badge
        updateInboxBadge();
        
        // Refresh homework panel if active
        if (!document.getElementById('admin-panel-homework').classList.contains('hidden')) {
            renderIncomingSubmissions();
        }
    });
}

// Utility Functions
function showToast(message, colorClass = "", icon = "") { 
    const toast = document.getElementById('toast-notification'); 
    document.getElementById('toast-message').textContent = message; 
    
    // Update Icon
    const iconEl = toast.querySelector('i');
    if(iconEl) iconEl.className = icon || "fa-solid fa-circle-check text-2xl";

    const theme = colorClass || "bg-gradient-to-r from-green-600 to-teal-600 border-green-400/50";
    toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 text-white px-8 py-4 rounded-full shadow-2xl z-50 flex items-center gap-3 translate-y-20 opacity-0 font-bold border ${theme} toast-show`; 
    
    setTimeout(() => toast.classList.remove('toast-show'), 3000); 
}

function switchMainTab(tab) { 
    // Hide all sections
    document.getElementById('section-admin').classList.add('hidden'); 
    document.getElementById('section-student').classList.add('hidden'); 
    
    // Show selected section
    document.getElementById(`section-${tab}`).classList.remove('hidden'); 
    
    // Update tab button styles
    const btnAdmin = document.getElementById('tab-btn-admin');
    const btnStudent = document.getElementById('tab-btn-student');
    
    if(tab === 'admin') {
        btnAdmin.className = "px-6 py-2 rounded-full text-sm font-bold bg-white text-blue-900 shadow-lg transition-all";
        btnStudent.className = "px-6 py-2 rounded-full text-sm font-bold text-white/50 hover:text-white transition-all";
    } else {
        btnStudent.className = "px-6 py-2 rounded-full text-sm font-bold bg-white text-blue-900 shadow-lg transition-all";
        btnAdmin.className = "px-6 py-2 rounded-full text-sm font-bold text-white/50 hover:text-white transition-all";
    } 
}

function switchAdminSubTab(tab) { 
    // Hide all admin panels
    document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.add('hidden')); 
    
    // Show selected panel
    document.getElementById(`admin-panel-${tab}`).classList.remove('hidden'); 
    
    // Update menu button styles
    document.querySelectorAll('.menu-btn').forEach(btn => { 
        btn.className = "menu-btn glass-ios hover:bg-white/10 text-white/70 rounded-2xl py-3 font-bold"; 
    }); 
    
    // Highlight active button
    const activeBtn = document.getElementById(`menu-${tab}`);
    if(activeBtn) {
        activeBtn.className = "menu-btn btn-blue rounded-2xl py-3 font-bold shadow-lg text-white";
    }
    
    // Refresh UI for the selected tab
    refreshUI();
}

function setupInactivityTimer() {
    let time;
    
    // Reset timer on user activity
    window.onload = resetTimer; 
    document.onmousemove = resetTimer; 
    document.onkeypress = resetTimer; 
    document.ontouchstart = resetTimer; 
    document.onclick = resetTimer;

    function logout() { 
        alert("หมดเวลาการใช้งาน (30 นาที) ระบบจะออกจากระบบเพื่อความปลอดภัย"); 
        localStorage.removeItem('wany_admin_session'); 
        localStorage.removeItem('current_student_code'); 
        location.reload(); 
    }
    
    function resetTimer() { 
        clearTimeout(time); 
        time = setTimeout(logout, 30 * 60 * 1000); // 30 minutes
    }
}

window.handleLogout = function(force = false) { 
    if(force || confirm("ออกจากระบบ?")) { 
        showLoading("กำลังออกจากระบบ...");
        localStorage.removeItem('wany_admin_session'); 
        localStorage.removeItem('wany_data_backup'); 
        localStorage.removeItem('current_student_code'); 
        setTimeout(() => location.reload(), 500);
    } 
}

function showAdminPanel(auto = false) { 
    document.getElementById('admin-login-wrapper').classList.add('hidden'); 
    document.getElementById('admin-content-wrapper').classList.remove('hidden'); 
    refreshUI(); 
    if(!auto) syncData(); 
    
    const adminEmail = localStorage.getItem('admin_email');
    if(!adminEmail) openEmailModal('admin');
}

function logoutStudent() { 
    document.getElementById('student-dashboard').classList.add('hidden'); 
    document.getElementById('student-login-wrapper').classList.remove('hidden'); 
    document.getElementById('student-login-id').value = ''; 
}

// Firebase utility functions
async function forceRefreshCache() {
    if (!firebaseInitialized) {
        alert("Firebase not initialized");
        return;
    }
    
    showLoading("กำลังรีเฟรชแคช...");
    try {
        // Clear existing cache
        await firebaseManager.clearCache();
        
        // Reload from Google Sheet
        await syncFromGoogleSheet();
        
        showToast("รีเฟรชแคชสำเร็จ", "bg-green-600");
    } catch (error) {
        console.error("Force refresh error:", error);
        showToast("รีเฟรชแคชล้มเหลว", "bg-red-600");
    } finally {
        hideLoading();
    }
}