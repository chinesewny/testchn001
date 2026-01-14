// Data synchronization and storage functions (Updated for Firebase)
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
        if (firebaseInitialized) {
            const cachedData = await firebaseManager.loadAllData();
            
            if (cachedData && Object.keys(cachedData).length > 0) {
                // Update local state with cached data
                Object.assign(dataState, cachedData);
                refreshUI();
                updateSyncUI('Online (Cache)', 'green');
                
                // Continue with background sync from Google Sheet
                syncFromGoogleSheet();
                return;
            }
        }
        
        // Step 2: If no cache, load from Google Sheet
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
            
            // Save to Firebase cache (background)
            if (firebaseInitialized) {
                firebaseManager.saveAllData(dataState).catch(err => {
                    console.warn("Failed to save to Firebase cache:", err);
                });
            }
            
            // Save to localStorage
            saveToLocalStorage();
            refreshUI();
            updateSyncUI('Online', 'green');
        }
    } catch (error) {
        console.error("Google Sheet sync failed:", error);
        throw error;
    }
}

function updateSyncUI(text, color) {
    const statusElements = document.querySelectorAll('#sync-status, #sync-status-scan');
    statusElements.forEach(element => {
        if (element) {
            element.textContent = " " + text;
        }
    });
    
    const statusIcon = document.querySelector('.fa-wifi');
    if(statusIcon) {
        statusIcon.className = color === 'green' ? "fa-solid fa-wifi" : "fa-solid fa-wifi text-red-400 animate-pulse";
        statusIcon.parentElement.className = `text-xs text-${color}-400 font-bold transition-all`;
    }
}

async function handleStudentLogin() {
    const inputId = document.getElementById('student-login-id').value.trim();
    if (!inputId) return alert("กรุณากรอกรหัสนักเรียน");
    
    // Check if student data is loaded
    if (dataState.students.length === 0) {
        showLoading("กำลังโหลดฐานข้อมูล...");
        await syncData(); // Try to fetch new data
    }

    showLoading("กำลังตรวจสอบข้อมูล...");
    await new Promise(r => setTimeout(r, 500)); // Delay for smooth UI

    // Check again
    if (dataState.students.length === 0) {
        hideLoading();
        showToast("กำลังโหลดข้อมูล... กรุณาลองใหม่", "bg-yellow-600", "fa-solid fa-circle-exclamation text-2xl");
        return;
    }

    const student = dataState.students.find(s => String(s.code) === String(inputId) || String(s.id) === String(inputId));
    
    hideLoading();

    if (student) {
        localStorage.setItem('current_student_code', student.code);
        document.getElementById('student-login-wrapper').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
        if(student.code) renderStudentDashboard(student.code);
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
        const parsed = JSON.parse(backup); 
        if(new Date().getTime() - parsed.timestamp < 1800000) {
            dataState = parsed.data; 
        }
    } 
}

async function saveAndRefresh(payload) { 
    // 1. If it's a Login request, send immediately (no queue)
    if(payload.action === 'login') {
        showLoading("กำลังตรวจสอบข้อมูล...");
        try {
            const res = await fetch(GOOGLE_SCRIPT_URL, { method:'POST', body:JSON.stringify(payload) }); 
            hideLoading();
            return await res.json(); 
        } catch(e) { 
            hideLoading();
            return {status:'error'}; 
        }
    }

    // 2. For general data saving: Optimistic Update immediately
    updateLocalState(payload); 
    refreshUI(); 
    
    // Save to localStorage immediately
    saveToLocalStorage();
    
    // Save to Firebase cache immediately
    if (firebaseInitialized) {
        // Update specific collection in Firebase
        const dataType = getDataTypeFromAction(payload.action);
        if (dataType) {
            const dataArray = dataState[dataType];
            if (dataArray) {
                firebaseManager.saveToFirebase(dataType, dataArray).catch(err => {
                    console.warn("Failed to update Firebase cache:", err);
                });
            }
        }
    }

    // Show immediate feedback
    showToast("บันทึกแล้ว (กำลังซิงค์...)", "bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-400/50");

    // 3. Add request to queue for Google Sheet sync
    requestQueue.push(payload);
    processQueue();

    return {status:'success'};
}

function getDataTypeFromAction(action) {
    const actionMap = {
        'addSubject': 'subjects',
        'updateSubjectConfig': 'subjects',
        'addClass': 'classes',
        'addStudent': 'students',
        'updateEmail': 'students',
        'addTask': 'tasks',
        'addScore': 'scores',
        'addAttendance': 'attendance',
        'addMaterial': 'materials',
        'addSchedule': 'schedules',
        'returnForRevision': 'returns',
        'submitTask': 'submissions'
    };
    
    return actionMap[action];
}

// Queue processing (updated to also update Firebase)
async function processQueue() {
    if (isProcessingQueue || requestQueue.length === 0) return;
    isProcessingQueue = true;

    // Small delay for smooth operation
    await new Promise(r => setTimeout(r, 1000)); 

    updateSyncUI(`Sending (${requestQueue.length})...`, 'yellow');

    while (requestQueue.length > 0) {
        const payload = requestQueue[0];
        
        try {
            const res = await fetch(GOOGLE_SCRIPT_URL, { 
                method: 'POST', 
                body: JSON.stringify(payload) 
            });
            
            // If successful, remove from queue
            requestQueue.shift(); 
            
            // Update Firebase cache after successful sync
            if (firebaseInitialized) {
                const dataType = getDataTypeFromAction(payload.action);
                if (dataType && dataState[dataType]) {
                    firebaseManager.saveToFirebase(dataType, dataState[dataType])
                        .catch(err => console.warn("Firebase cache update failed:", err));
                }
            }
            
        } catch (e) {
            console.warn("Sync failed, retrying later...", e);
            updateSyncUI('Pending Sync (Offline)', 'red');
            break; 
        }
    }
    
    if (requestQueue.length === 0) {
        updateSyncUI('All Synced', 'green');
        showToast("ข้อมูลถูกบันทึกลงฐานข้อมูลเรียบร้อย", "bg-green-600");
    }
    
    isProcessingQueue = false;
}

function updateLocalState(p) {
    if(p.action === 'addSubject') dataState.subjects.push({id:p.id, name:p.name});
    if(p.action === 'updateSubjectConfig') { 
        const s = dataState.subjects.find(x=>x.id==p.id); 
        if(s) s.scoreConfig = p.config; 
    }
    if(p.action === 'addClass') dataState.classes.push({id:p.id, name:p.name, subjectId:p.subjectId});
    if(p.action === 'addStudent') dataState.students.push({id:p.id, classId:p.classId, no:p.no, code:p.code, name:p.name});
    if(p.action === 'updateEmail') { 
        // Update email for all records of this student
        dataState.students.forEach(student => {
            if(student.code === p.code || student.id == p.studentId) {
                student.email = p.email;
            }
        });
    }
    if(p.action === 'addTask') { 
        p.classIds.forEach((cid, idx) => { 
            const chapStr = Array.isArray(p.chapter) ? p.chapter.join(',') : p.chapter; 
            dataState.tasks.push({ 
                id: Number(p.id) + idx, 
                classId: cid, 
                subjectId: p.subjectId, 
                category: p.category, 
                chapter: chapStr, 
                name: p.name, 
                maxScore: p.maxScore, 
                dueDateISO: p.dueDateISO 
            }); 
        }); 
    }
    if(p.action === 'addScore') { 
        const idx = dataState.scores.findIndex(s => s.studentId == p.studentId && s.taskId == p.taskId); 
        if(idx >= 0) dataState.scores[idx].score = p.score; 
        else dataState.scores.push({studentId:p.studentId, taskId:p.taskId, score:p.score}); 
        if(dataState.returns) dataState.returns = dataState.returns.filter(r => !(r.studentId == p.studentId && r.taskId == p.taskId)); 
    }
    if(p.action === 'addAttendance') { 
        const idx = dataState.attendance.findIndex(a => a.studentId == p.studentId && a.date == p.date); 
        if(idx >= 0) dataState.attendance[idx].status = p.status; 
        else dataState.attendance.push({studentId:p.studentId, classId:p.classId, date:p.date, status:p.status}); 
    }
    if(p.action === 'addMaterial') dataState.materials.push({id:p.id, subjectId:p.subjectId, title:p.title, link:p.link, type:p.type});
    if(p.action === 'addSchedule') dataState.schedules.push({ id:p.id, day:p.day, period:p.period, classId:p.classId });
    if(p.action === 'returnForRevision') { 
        dataState.submissions = dataState.submissions.filter(s => !(s.studentId == p.studentId && s.taskId == p.taskId)); 
        if(!dataState.returns) dataState.returns = []; 
        dataState.returns.push({taskId:p.taskId, studentId:p.studentId, comment:p.comment, timestampISO: new Date().toISOString()}); 
    }
    if(p.action === 'submitTask') { 
        p.studentIds.forEach(sid => { 
            dataState.submissions = dataState.submissions.filter(s => !(s.studentId == sid && s.taskId == p.taskId)); 
            if(dataState.returns) dataState.returns = dataState.returns.filter(r => !(r.studentId == sid && r.taskId == p.taskId)); 
            dataState.submissions.push({
                taskId:p.taskId, 
                studentId:sid, 
                link:p.link, 
                timestampISO: new Date().toISOString(), 
                comment: p.comment
            }); 
        }); 
    }
}