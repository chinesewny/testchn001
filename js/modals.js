// Modal management functions
function closeScoreModal() {
    document.getElementById('score-modal').classList.add('hidden');
    document.getElementById('scan-score-input').value = '';
    setTimeout(() => document.getElementById('scan-score-input').focus(), 100);
}

function openSubmitModal(taskId, studentId, taskName) {
    document.getElementById('submit-modal').classList.remove('hidden');
    document.getElementById('submit-task-id').value = taskId;
    document.getElementById('submit-student-id').value = studentId;
    document.getElementById('submit-modal-title').textContent = taskName;
    document.getElementById('submit-link-input').value = '';
    document.getElementById('submit-comment-input').value = '';
    document.getElementById('friend-selector-container').innerHTML = '';
    
    const student = dataState.students.find(s => s.id == studentId);
    if(student) {
        const friends = dataState.students.filter(s => s.classId == student.classId && s.id != studentId);
        const container = document.getElementById('friend-selector-container');
        friends.forEach(f => {
            const div = document.createElement('div');
            div.className = "friend-item flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer";
            div.innerHTML = `<input type="checkbox" value="${f.id}" class="friend-checkbox accent-blue-500"><span class="text-xs text-white/80">${f.name}</span>`;
            container.appendChild(div);
        });
    }
}

// Subject configuration functions
function openSubjectConfig(subjectId) {
    document.getElementById('subject-config-modal').classList.remove('hidden');
    document.getElementById('config-subject-id').value = subjectId;
    const sub = dataState.subjects.find(s => s.id == subjectId);
    document.getElementById('config-subject-name').textContent = sub ? sub.name : '-';
    
    // Load current config
    tempConfig = (sub && sub.scoreConfig && sub.scoreConfig.length > 0) ? [...sub.scoreConfig] : [10,10,10,10,10];
    renderConfigSlots();
}

function renderConfigSlots() {
    const container = document.getElementById('config-slots-container');
    container.innerHTML = '';
    let total = 0;

    tempConfig.forEach((score, idx) => {
        total += Number(score);
        const div = document.createElement('div');
        div.className = "flex items-center gap-2 mb-2";
        div.innerHTML = `
            <span class="text-white text-xs w-8">CH.${idx+1}</span>
            <input type="number" value="${score}" onchange="updateTempConfig(${idx}, this.value)" class="flex-1 glass-input rounded px-2 py-1 text-center text-sm">
            <button onclick="removeConfigSlot(${idx})" class="text-red-400 hover:text-red-300"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(div);
    });

    document.getElementById('config-total-score').textContent = total;
}

window.updateTempConfig = function(idx, val) {
    tempConfig[idx] = Number(val);
    renderConfigSlots();
}

window.removeConfigSlot = function(idx) {
    tempConfig.splice(idx, 1);
    renderConfigSlots();
}

function addConfigSlot() {
    tempConfig.push(10);
    renderConfigSlots();
}

function saveSubjectConfig() {
    const subId = document.getElementById('config-subject-id').value;
    saveAndRefresh({ action: 'updateSubjectConfig', id: subId, config: tempConfig });
    document.getElementById('subject-config-modal').classList.add('hidden');
    showToast("บันทึกโครงสร้างคะแนนแล้ว");
}

function openEmailModal(role) {
    document.getElementById('email-modal').classList.remove('hidden');
    document.getElementById('email-modal-role').value = role;
    const closeBtn = document.getElementById('btn-close-email');
    
    let currentEmail = "";
    if (role === 'admin') { 
        currentEmail = localStorage.getItem('admin_email') || ""; 
    } else { 
        // Use mainProfile from studentRecords[0]
        const code = localStorage.getItem('current_student_code'); 
        const studentRecords = dataState.students.filter(s => String(s.code) === String(code));
        if(studentRecords.length > 0) {
            const mainProfile = studentRecords[0];
            currentEmail = mainProfile.email || "";
        }
    }
    
    document.getElementById('user-email-input').value = currentEmail;
    if (!currentEmail) { 
        closeBtn.classList.add('hidden'); 
    } else { 
        closeBtn.classList.remove('hidden'); 
    }
}

async function saveUserEmail() {
    const emailInput = document.getElementById('user-email-input');
    const email = emailInput.value.trim();
    const role = document.getElementById('email-modal-role').value;
    
    if(!email.includes('@')) return alert("รูปแบบอีเมลไม่ถูกต้อง");

    showLoading("กำลังบันทึกอีเมล...");

    try {
        let payload = { action: 'updateEmail', email: email };
        
        if (role === 'admin') {
            localStorage.setItem('admin_email', email);
            await new Promise(r => setTimeout(r, 800)); 
        } else {
            const code = localStorage.getItem('current_student_code');
            const studentRecords = dataState.students.filter(s => String(s.code) === String(code));
            
            if (studentRecords.length > 0) {
                // Update email for all records of this student
                studentRecords.forEach(studentRecord => {
                    payload.studentId = studentRecord.id;
                    payload.code = studentRecord.code;
                    studentRecord.email = email; // Optimistic local update
                    
                    // Send data to Google Sheet
                    fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    }).catch(err => console.error("Error updating email:", err));
                });
                
                saveToLocalStorage();
            } else {
                throw new Error("Student not found");
            }
        }

        document.getElementById('email-modal').classList.add('hidden');
        showToast("บันทึกข้อมูลเรียบร้อย");
        
    } catch (error) {
        alert("บันทึกไม่สำเร็จ: " + error.message);
    } finally {
        hideLoading();
    }
}

function showLoading(text = "กำลังประมวลผล...") {
    const overlay = document.getElementById('loading-overlay');
    document.getElementById('loading-text').textContent = text;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}