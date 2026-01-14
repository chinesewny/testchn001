// UI rendering functions
function refreshUI() {
    refreshDropdowns();
    renderSubjectList();
    renderScheduleList();
    checkSmartSchedule(); 
    if(!document.getElementById('admin-panel-scan').classList.contains('hidden')) { 
        updateScanTaskDropdown(); 
        renderScoreRoster(); 
    }
    if(!document.getElementById('admin-panel-report').classList.contains('hidden')) { 
        renderGradeReport(); 
    }
    if(!document.getElementById('admin-panel-homework').classList.contains('hidden')) { 
        renderIncomingSubmissions(); 
    }
    if(!document.getElementById('admin-panel-attendance').classList.contains('hidden')) { 
        renderAttRoster(); 
    }
    if(!document.getElementById('admin-panel-material').classList.contains('hidden')) { 
        renderAdminMaterials(); 
    }
    updateInboxBadge();
    if(!document.getElementById('student-dashboard').classList.contains('hidden')) {
         const code = localStorage.getItem('current_student_code');
         if(code) { 
             renderStudentDashboard(code); 
         }
    }
}

function refreshDropdowns() { 
    const setOpts = (id, list) => { 
        const el = document.getElementById(id); 
        if(!el) return; 
        const cur = el.value; 
        el.innerHTML = '<option value="">-- เลือก --</option>'; 
        list.forEach(i => { 
            const o = document.createElement('option'); 
            o.value = i.id; 
            o.textContent = i.name; 
            el.appendChild(o); 
        }); 
        el.value = cur; 
    }; 
    
    setOpts('class-subject-ref', dataState.subjects); 
    setOpts('student-class', dataState.classes); 
    setOpts('scan-class-select', dataState.classes); 
    setOpts('task-subject-filter', dataState.subjects); 
    setOpts('att-class-select', dataState.classes); 
    setOpts('mat-subject', dataState.subjects); 
    setOpts('sch-class', dataState.classes); 
    setOpts('report-subject', dataState.subjects); 
}

function updateReportClassDropdown() { 
    const subId = document.getElementById('report-subject').value; 
    const classSelect = document.getElementById('report-class'); 
    classSelect.innerHTML = '<option value="">-- เลือกห้อง --</option>'; 
    document.getElementById('report-table-body').innerHTML = ''; 
    if(!subId) return; 
    const filteredClasses = dataState.classes.filter(c => c.subjectId == subId); 
    filteredClasses.forEach(c => { 
        const o = document.createElement('option'); 
        o.value = c.id; 
        o.textContent = c.name; 
        classSelect.appendChild(o); 
    }); 
}

function updateScanTaskDropdown() { 
    const cid = document.getElementById('scan-class-select').value; 
    const el = document.getElementById('scan-task-select'); 
    const currentTaskId = el.value; 
    el.innerHTML = '<option value="">-- เลือกงาน --</option>'; 
    dataState.tasks.filter(t => t.classId == cid).reverse().forEach(t => { 
        const o = document.createElement('option'); 
        o.value = t.id; 
        o.textContent = `${t.name} (Max ${t.maxScore})`; 
        el.appendChild(o); 
    }); 
    if(currentTaskId) el.value = currentTaskId; 
}

function renderTaskClassCheckboxes() { 
    const subId = document.getElementById('task-subject-filter').value; 
    const div = document.getElementById('task-class-checkboxes'); 
    div.innerHTML = ''; 
    dataState.classes.filter(c => c.subjectId == subId).forEach(c => { 
        const lbl = document.createElement('label'); 
        lbl.className = "flex items-center gap-2 p-2 rounded hover:bg-white/10 cursor-pointer"; 
        lbl.innerHTML = `<input type="checkbox" value="${c.id}" class="accent-yellow-500 w-4 h-4 rounded"><span class="text-xs text-white/80">${c.name}</span>`; 
        div.appendChild(lbl); 
    }); 
}

function renderTaskChapterCheckboxes() { 
    const subId = document.getElementById('task-subject-filter').value; 
    const container = document.getElementById('task-chapter-checkboxes'); 
    container.innerHTML = ''; 
    if(!subId) return; 
    const subj = dataState.subjects.find(s => s.id == subId);
    const config = (subj && subj.scoreConfig && subj.scoreConfig.length > 0) ? subj.scoreConfig : Array(5).fill(10);
    config.forEach((maxScore, index) => { 
        const div = document.createElement('div');
        div.className = "flex items-center gap-1 bg-black/20 px-2 py-1 rounded border border-white/10 cursor-pointer hover:bg-white/10";
        div.innerHTML = `<input type="checkbox" id="chap-${index+1}" value="${index+1}" class="chapter-checkbox accent-yellow-400 w-3 h-3"><label for="chap-${index+1}" class="text-[10px] text-white cursor-pointer select-none">Ch.${index+1} <span class="text-white/50">(${maxScore})</span></label>`;
        div.onclick = (e) => { 
            if(e.target.tagName !== 'INPUT') { 
                const cb = div.querySelector('input'); 
                cb.checked = !cb.checked; 
            } 
        };
        container.appendChild(div); 
    }); 
}

function renderSubjectList() {
    const div = document.getElementById('subject-list-container'); 
    div.innerHTML = '';
    dataState.subjects.forEach(s => {
        const el = document.createElement('div');
        el.className = "p-3 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-all flex justify-between items-center";
        const config = s.scoreConfig || []; 
        const slots = config.length > 0 ? `${config.length} ช่อง` : 'ค่าเริ่มต้น (5)';
        el.innerHTML = `<div><div class="font-bold text-sm text-white">${s.name}</div><div class="text-xs text-white/50">โครงสร้างคะแนน: ${slots}</div></div><i class="fa-solid fa-gear text-white/30"></i>`;
        el.onclick = () => openSubjectConfig(s.id); 
        div.appendChild(el);
    });
}

function renderScheduleList() { 
    const div = document.getElementById('schedule-list'); 
    div.innerHTML = ''; 
    if(!dataState.schedules) return; 
    const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์']; 
    const sorted = [...dataState.schedules].sort((a,b) => (a.day - b.day) || (a.period - b.period)); 
    sorted.forEach(s => { 
        const clsName = dataState.classes.find(c => c.id == s.classId)?.name || '?'; 
        const row = document.createElement('div'); 
        row.className = "flex justify-between items-center text-xs text-white/70 bg-white/5 p-2 rounded border border-white/5"; 
        row.innerHTML = `<span>${days[s.day]} คาบ ${s.period}</span> <span class="text-yellow-400 font-bold">${clsName}</span>`; 
        div.appendChild(row); 
    }); 
}

function renderAdminMaterials() { 
    const div = document.getElementById('admin-mat-list'); 
    div.innerHTML = ''; 
    dataState.materials.forEach(m => { 
        const sub = dataState.subjects.find(s => s.id == m.subjectId)?.name || '-'; 
        const el = document.createElement('div'); 
        el.className = "bg-white/5 p-3 rounded-xl border border-white/10 flex justify-between"; 
        el.innerHTML = `<div><div class="text-xs text-yellow-400">${sub}</div><div class="font-bold text-sm text-white"><a href="${m.link}" target="_blank" class="hover:underline">${m.title}</a></div></div>`; 
        div.appendChild(el); 
    }); 
}

function renderScoreButtons() { 
    const c = document.getElementById('score-buttons-container'); 
    if(!c) return; 
    c.innerHTML = ''; 
    [5,6,7,8,9,10].forEach(i => { 
        const b = document.createElement('button'); 
        b.textContent = i; 
        b.className = "btn-score py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10"; 
        b.onclick = () => setScoreMode(i); 
        c.appendChild(b); 
    }); 
}

function setScoreMode(m) { 
    scoreMode = m; 
    document.querySelectorAll('.btn-score').forEach(b => { 
        b.classList.remove('btn-score-active'); 
        if(b.textContent == m) b.classList.add('btn-score-active'); 
    }); 
    if(m == 'manual') document.getElementById('btn-score-manual').classList.add('btn-score-active'); 
    else document.getElementById('btn-score-manual').classList.remove('btn-score-active'); 
    document.getElementById('scan-score-input').focus(); 
}

function setAttMode(mode) {
    attMode = mode;
    ['present','leave','absent','activity'].forEach(t => { 
        document.getElementById(`btn-att-${t}`).classList.remove(`btn-att-active-${t}`); 
    });
    let btnId = '';
    if(mode === 'มา') btnId = 'present'; 
    else if(mode === 'ลา') btnId = 'leave'; 
    else if(mode === 'ขาด') btnId = 'absent'; 
    else if(mode === 'กิจกรรม') btnId = 'activity';
    
    if(btnId) document.getElementById(`btn-att-${btnId}`).classList.add(`btn-att-active-${btnId}`);
    document.getElementById('att-scan-input').focus();
}

function renderScoreRoster() { 
    const cid = document.getElementById('scan-class-select').value; 
    const taskId = document.getElementById('scan-task-select').value; 
    const div = document.getElementById('score-roster-grid'); 
    div.innerHTML = ''; 
    if(!cid || !taskId) return; 
    
    dataState.students.filter(s => s.classId == cid).sort((a,b) => Number(a.no) - Number(b.no)).forEach(s => { 
        const sc = dataState.scores.find(x => x.studentId == s.id && x.taskId == taskId); 
        const val = sc ? sc.score : '-'; 
        const el = document.createElement('div'); 
        el.className = `status-box ${sc ? 'status-done' : 'status-none'} p-2 flex flex-col items-center justify-center cursor-pointer`; 
        el.onclick = () => { 
            pendingScore = { s, t: dataState.tasks.find(t => t.id == taskId) }; 
            document.getElementById('score-modal').classList.remove('hidden'); 
            document.getElementById('modal-task-name').textContent = pendingScore.t.name; 
            document.getElementById('modal-student-name').textContent = s.name; 
            document.getElementById('modal-max-score').textContent = pendingScore.t.maxScore; 
            document.getElementById('modal-score-input').value = val == '-' ? '' : val; 
            setTimeout(() => document.getElementById('modal-score-input').focus(), 100); 
        };
        el.innerHTML = `<div class="text-xs opacity-70">No. ${s.no}</div><div class="font-bold text-center text-xs truncate w-full">${s.name}</div><div class="text-xl font-bold mt-1">${val}</div>`; 
        div.appendChild(el); 
    }); 
}

function renderAttRoster() { 
    const cid = document.getElementById('att-class-select').value; 
    const div = document.getElementById('att-roster-grid'); 
    const date = document.getElementById('att-date-input').value; 
    div.innerHTML = ''; 
    if(!cid) return; 
    
    let p = 0, l = 0, a = 0, act = 0; 
    dataState.students.filter(s => s.classId == cid).sort((a,b) => Number(a.no) - Number(b.no)).forEach(s => { 
        const log = dataState.attendance.find(a => a.studentId == s.id && (a.date == date || (a.date && a.date.substring(0,10) == date))); 
        const st = log ? log.status : 'none'; 
        if(st == 'มา') p++; 
        if(st == 'ลา') l++; 
        if(st == 'ขาด') a++; 
        if(st == 'กิจกรรม') act++;
        
        let c = 'status-none';
        if(st == 'มา') c = 'status-done';
        else if(st == 'ลา') c = 'bg-yellow-500/20 border-yellow-500 text-yellow-500';
        else if(st == 'ขาด') c = 'bg-red-500/20 border-red-500 text-red-500';
        else if(st == 'กิจกรรม') c = 'bg-orange-500/20 border-orange-500 text-orange-400';

        const el = document.createElement('div'); 
        el.className = `status-box ${c} p-3 flex flex-col items-center justify-center cursor-pointer border`; 
        el.onclick = () => { 
            if(attMode) saveAndRefresh({
                action: 'addAttendance', 
                studentId: s.id, 
                classId: cid, 
                date: date, 
                status: attMode
            }); 
        }; 
        el.innerHTML = `<div class="text-xs opacity-70">No. ${s.no}</div><div class="font-bold text-center text-sm">${s.name}</div><div class="text-[10px] mt-1">${st}</div>`; 
        div.appendChild(el); 
    }); 
    
    document.getElementById('stat-present').textContent = p; 
    document.getElementById('stat-leave').textContent = l; 
    document.getElementById('stat-absent').textContent = a; 
    document.getElementById('stat-activity').textContent = act;
}

function renderGradeReport() { 
    const cid = document.getElementById('report-class').value;
    const thead = document.getElementById('report-table-header');
    const tbody = document.getElementById('report-table-body'); 
    tbody.innerHTML = ''; 
    thead.innerHTML = '';
    if(!cid) return; 
    
    const cls = dataState.classes.find(c => c.id == cid);
    const subj = dataState.subjects.find(s => s.id == cls.subjectId);
    const config = (subj && subj.scoreConfig && subj.scoreConfig.length > 0) ? subj.scoreConfig : Array(5).fill(10);
    const tasks = dataState.tasks.filter(t => t.classId == cid);
    
    // Create header
    let hHTML = `<th class="px-2 py-4 text-center">#</th><th class="px-2 py-4 text-left min-w-[150px]">ชื่อ-นามสกุล</th>`;
    
    // Add headers for each chapter score slot
    config.forEach((m, i) => {
        // Find how many tasks are in this slot
        const chapterTasks = tasks.filter(t => {
            if (t.category === 'accum' && t.chapter) {
                let chaps = [];
                if (Array.isArray(t.chapter)) {
                    chaps = t.chapter;
                } else if (typeof t.chapter === 'string') {
                    chaps = t.chapter.split(',').map(c => c.trim());
                } else {
                    chaps = [String(t.chapter)];
                }
                return chaps.includes(String(i + 1));
            }
            return false;
        });
        
        hHTML += `<th class="px-1 py-4 text-center text-yellow-400">CH${i+1}<br><span class="text-[9px] opacity-50">(${m})<br>${chapterTasks.length} งาน</span></th>`;
    });
    
    hHTML += `<th class="px-1 py-4 text-center text-blue-400">กลาง</th><th class="px-1 py-4 text-center text-red-400">ปลาย</th><th class="px-2 py-4 text-center text-white font-bold bg-white/10">รวม</th><th class="px-2 py-4 text-center">เกรด</th>`;
    thead.innerHTML = hHTML;
    
    // Create student rows
    dataState.students.filter(s => s.classId == cid).sort((a,b) => Number(a.no) - Number(b.no)).forEach((s, idx) => { 
        const { chapScores, midterm, final, total, totalAccumScore } = calculateScores(s.id, cid, tasks);
        const grade = calGrade(total);
        const tr = document.createElement('tr'); 
        tr.className = "hover:bg-white/5 transition-colors"; 
        
        let html = `<td class="text-center text-white/50">${s.no||idx+1}</td><td class="px-2 py-3 text-white text-xs">${s.name}</td>`;
        
        // Show each chapter score
        chapScores.forEach((score, idx) => {
            // Find how many tasks are in this slot
            const chapterTasks = tasks.filter(t => {
                if (t.category === 'accum' && t.chapter) {
                    let chaps = [];
                    if (Array.isArray(t.chapter)) {
                        chaps = t.chapter;
                    } else if (typeof t.chapter === 'string') {
                        chaps = t.chapter.split(',').map(c => c.trim());
                    } else {
                        chaps = [String(t.chapter)];
                    }
                    return chaps.includes(String(idx + 1));
                }
                return false;
            });
            
            // If there are tasks in this slot, show score
            if (chapterTasks.length > 0) {
                // Check if score exceeds maximum
                const maxScore = config[idx] || 10;
                const isOverMax = score > maxScore;
                
                html += `<td class="text-center text-yellow-400 font-mono ${isOverMax ? 'text-red-400' : ''}" title="${chapterTasks.length} งาน${isOverMax ? ' (เกินค่าสูงสุด)' : ''}">${score.toFixed(1)}</td>`;
            } else {
                html += `<td class="text-center text-white/30">-</td>`;
            }
        });
        
        html += `<td class="text-center text-blue-400 font-bold">${midterm.toFixed(1)}</td><td class="text-center text-red-400 font-bold">${final.toFixed(1)}</td><td class="text-center font-bold text-white bg-white/10">${total.toFixed(1)}</td><td class="text-center text-green-400 font-bold text-lg">${grade}</td>`;
        tr.innerHTML = html; 
        tbody.appendChild(tr); 
    }); 
}

function renderIncomingSubmissions() { 
    const container = document.getElementById('incoming-list'); 
    container.innerHTML = ''; 
    let pending = dataState.submissions.filter(sub => !dataState.scores.some(sc => sc.taskId == sub.taskId && sc.studentId == sub.studentId));
    pending.sort((a,b) => new Date(b.timestampISO) - new Date(a.timestampISO)); 
    
    if(pending.length === 0) { 
        container.innerHTML = '<div class="text-center text-white/50 py-10">ไม่มีงานที่รอตรวจ</div>'; 
        return; 
    } 
    
    const groups = {};
    pending.forEach(sub => { 
        const key = `${sub.taskId}|${sub.link}`; 
        if (!groups[key]) { 
            groups[key] = { 
                taskId: sub.taskId, 
                link: sub.link, 
                comment: sub.comment, 
                timestampISO: sub.timestampISO, 
                students: [] 
            }; 
        } 
        const s = dataState.students.find(st => st.id == sub.studentId); 
        if(s) groups[key].students.push(s); 
    });
    
    Object.values(groups).forEach(group => {
        const task = dataState.tasks.find(t => t.id == group.taskId); 
        if(!task || group.students.length === 0) return;
        
        group.students.sort((a,b) => Number(a.no) - Number(b.no));
        const names = group.students.map(s => `<span class="text-yellow-400 font-bold">${s.name} (No.${s.no})</span>`).join(', ');
        const studentIdsStr = group.students.map(s => s.id).join(',');
        
        const div = document.createElement('div'); 
        div.className = "bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col gap-3"; 
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <span class="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded font-bold">${dataState.classes.find(c => c.id == group.students[0].classId)?.name || '-'}</span>
                    <h4 class="font-bold text-white text-sm mt-1">${task.name}</h4>
                    <div class="text-xs text-white/70 mt-1 leading-relaxed"><i class="fa-solid fa-users text-blue-400 mr-1"></i> ${names}</div>
                </div>
                <a href="${group.link}" target="_blank" class="text-blue-400 text-xs hover:underline flex-shrink-0"><i class="fa-solid fa-link"></i> เปิดงาน</a>
            </div>
            ${group.comment ? `<div class="bg-black/20 p-2 rounded text-xs text-white/70 border-l-2 border-blue-500">"${group.comment}"</div>` : ''}
            <div class="flex gap-2 items-center pt-2 border-t border-white/5">
                <input id="grade-group-${group.taskId}-${group.link.replace(/[^a-zA-Z0-9]/g, '')}" type="number" class="glass-input rounded px-2 py-1 text-xs w-20 text-center" placeholder="Max ${task.maxScore}">
                <button onclick="submitGroupGrade('${studentIdsStr}', '${group.taskId}', '${task.maxScore}', 'grade-group-${group.taskId}-${group.link.replace(/[^a-zA-Z0-9]/g, '')}')" class="btn-blue px-3 py-1 rounded text-xs font-bold shadow-lg">ให้คะแนนกลุ่ม</button>
                <button onclick="returnGroupWork('${studentIdsStr}', '${group.taskId}')" class="btn-yellow px-3 py-1 rounded text-xs">ส่งคืน</button>
            </div>
        `; 
        container.appendChild(div); 
    });
}

window.submitGroupGrade = async function(studentIdsStr, taskId, max, inputId) { 
    const val = document.getElementById(inputId).value; 
    if(val === '') return alert("กรุณาใส่คะแนน"); 
    if(Number(val) > Number(max)) return alert("คะแนนเกินค่าเต็ม"); 
    
    const sids = studentIdsStr.split(','); 
    for (const sid of sids) updateLocalState({ 
        action: 'addScore', 
        studentId: sid, 
        taskId: taskId, 
        score: val 
    }); 
    
    refreshUI();
    const promises = sids.map(sid => saveAndRefresh({ 
        action: 'addScore', 
        studentId: sid, 
        taskId: taskId, 
        score: val 
    })); 
    
    showToast(`บันทึกคะแนนกลุ่มเรียบร้อย`, "bg-green-600");
};

window.returnGroupWork = async function(studentIdsStr, taskId) { 
    const reason = prompt("ระบุเหตุผลที่ส่งคืน (สมาชิกทุกคนจะเห็นข้อความนี้):"); 
    if(reason) { 
        const sids = studentIdsStr.split(','); 
        for (const sid of sids) updateLocalState({ 
            action: 'returnForRevision', 
            studentId: sid, 
            taskId: taskId, 
            comment: reason 
        }); 
        
        refreshUI();
        const promises = sids.map(sid => saveAndRefresh({ 
            action: 'returnForRevision', 
            studentId: sid, 
            taskId: taskId, 
            comment: reason 
        })); 
        
        showToast("ส่งคืนงานเรียบร้อย", "bg-yellow-600");
    } 
};

function updateInboxBadge() { 
    let count = 0; 
    dataState.submissions.forEach(sub => { 
        if(!dataState.scores.some(sc => sc.taskId == sub.taskId && sc.studentId == sub.studentId)) count++; 
    }); 
    
    const badge = document.getElementById('badge-homework'); 
    if (count > 0) { 
        badge.classList.remove('hidden'); 
        badge.textContent = count > 99 ? '99+' : count; 
    } else { 
        badge.classList.add('hidden'); 
    } 
}

function checkSmartSchedule() { 
    if(!dataState.schedules) return; 
    const now = new Date(); 
    const day = now.getDay(); 
    const timeStr = now.toTimeString().slice(0,5); 
    let currentPeriod = PERIODS.find(p => timeStr >= p.start && timeStr <= p.end); 
    const banner = document.getElementById('smart-att-banner'); 
    
    if(currentPeriod && dataState.schedules) { 
        const match = dataState.schedules.find(s => s.day == day && s.period == currentPeriod.p); 
        if(match) { 
            const cls = dataState.classes.find(c => c.id == match.classId); 
            if(cls) { 
                banner.classList.remove('hidden'); 
                document.getElementById('smart-period').textContent = currentPeriod.p; 
                document.getElementById('smart-class-name').textContent = cls.name; 
                smartClassId = cls.id; 
                return; 
            } 
        } 
    } 
    
    banner.classList.add('hidden'); 
    smartClassId = null; 
}

window.useSmartClass = function() { 
    if(smartClassId) { 
        document.getElementById('att-class-select').value = smartClassId; 
        renderAttRoster(); 
    } 
}

function renderStudentDashboard(studentCode) {
    // 1. Find all student records by student code (in case of multiple classes/subjects)
    const studentRecords = dataState.students.filter(s => String(s.code) === String(studentCode));
    if (studentRecords.length === 0) return;

    // Use profile data from first record (name/email should be same)
    const mainProfile = studentRecords[0];

    document.getElementById('std-dash-name').textContent = mainProfile.name;
    
    // Combine all class names the student is in
    const classNames = [...new Set(studentRecords.map(s => {
        const cls = dataState.classes.find(c => c.id == s.classId);
        return cls ? cls.name : null;
    }))].filter(Boolean).join(', ');
    
    document.getElementById('std-dash-class').textContent = classNames;

    const container = document.getElementById('std-subjects-container'); 
    container.innerHTML = '';
    
    const today = getThaiDateISO();

    // 2. Loop to create cards for "every subject" the student is registered in
    studentRecords.forEach(studentRecord => {
        const currentClass = dataState.classes.find(c => c.id == studentRecord.classId);
        if (!currentClass) return;
        
        const subj = dataState.subjects.find(sub => sub.id == currentClass.subjectId);
        if (!subj) return;

        // Get tasks for this class
        const subjectTasks = dataState.tasks.filter(t => t.classId == studentRecord.classId && t.subjectId == subj.id);
        
        // Calculate scores
        const { midterm, final, total, chapScores } = calculateScores(studentRecord.id, studentRecord.classId, subjectTasks); 
        const grade = calGrade(total);
        
        // Calculate attendance
        const atts = dataState.attendance.filter(a => a.studentId == studentRecord.id);
        
        let p = 0, l = 0, a = 0, act = 0;
        atts.forEach(att => { 
            if(att.status == 'มา') p++; 
            else if(att.status == 'ลา') l++; 
            else if(att.status == 'ขาด') a++; 
            else if(att.status == 'กิจกรรม') act++; 
        });

        // Midterm score display
        let midDisplay = `<span class="text-white/20 font-bold">-</span>`; 
        const midTask = subjectTasks.find(t => t.category === 'midterm');
        if (midTask) {
            const hasScore = dataState.scores.some(sc => sc.studentId == studentRecord.id && sc.taskId == midTask.id);
            if (hasScore) { 
                midDisplay = `<span class="text-blue-300 font-bold">${midterm.toFixed(1)}</span>`; 
                if (midterm < (midTask.maxScore / 2)) { 
                    midDisplay = `<span class="text-orange-400 font-bold text-xs"><i class="fa-solid fa-triangle-exclamation"></i> ต้องแก้ไข (ไม่ผ่านเกณฑ์)</span>`; 
                } 
            }
        }

        // Final score display
        let finalDisplay = `<span class="text-white/20 font-bold">-</span>`; 
        const finalTask = subjectTasks.find(t => t.category === 'final');
        if (finalTask) {
            const hasScore = dataState.scores.some(sc => sc.studentId == studentRecord.id && sc.taskId == finalTask.id);
            if (hasScore) { 
                if (Number(final) > 0) { 
                    finalDisplay = `<i class="fa-solid fa-check text-green-400 text-xl"></i>`; 
                } else { 
                    finalDisplay = `<span class="text-red-400 text-xs"><i class="fa-solid fa-xmark"></i> ขาดสอบ</span>`; 
                } 
            }
        }

        // Calculate progress
        let completedCount = 0;
        subjectTasks.forEach(t => { 
            const hasScore = dataState.scores.some(sc => sc.studentId == studentRecord.id && sc.taskId == t.id); 
            const hasSub = dataState.submissions.some(sb => sb.studentId == studentRecord.id && sb.taskId == t.id); 
            if(hasScore || hasSub) completedCount++; 
        });
        
        let progress = subjectTasks.length > 0 ? Math.round((completedCount/subjectTasks.length)*100) : 0;

        // 3. Get materials for this subject
        const subjectMaterials = dataState.materials.filter(m => m.subjectId == subj.id);
        let materialHTML = '';
        
        if (subjectMaterials.length > 0) {
            materialHTML = `<div class="mt-6 border-t border-white/10 pt-4">
                <h4 class="text-xs font-bold text-white/60 mb-3 uppercase flex items-center"><i class="fa-solid fa-book-open mr-2 text-yellow-400"></i> เนื้อหาบทเรียน</h4>
                <div class="grid grid-cols-1 gap-2">`;
                
            subjectMaterials.forEach(m => {
                materialHTML += `
                    <a href="${m.link}" target="_blank" class="block bg-white/5 hover:bg-white/10 p-3 rounded-xl flex items-center justify-between group transition-all border border-white/5 hover:border-blue-500/30">
                        <span class="text-sm text-white group-hover:text-blue-300 font-medium truncate"><i class="fa-solid fa-link text-xs mr-2 text-blue-400/70"></i>${m.title}</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-xs text-white/30 group-hover:text-blue-400"></i>
                    </a>`;
            });
            
            materialHTML += `</div></div>`;
        } else {
            materialHTML = `<div class="mt-6 border-t border-white/10 pt-4 text-center text-xs text-white/30 py-2">ยังไม่มีเนื้อหาในวิชานี้</div>`;
        }

        // Create Subject Card
        const card = document.createElement('div');
        card.className = "flex flex-col gap-6 p-5 bg-gradient-to-r from-blue-900/40 to-blue-600/20 rounded-2xl border border-blue-500/30 mb-6 shadow-xl";
        
        let html = `
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg text-white ring-2 ring-white/20">📚</div>
                <div>
                    <h2 class="text-xl font-bold text-white tracking-wide drop-shadow-md">${subj.name}</h2>
                    <p class="text-blue-200 text-sm font-mono mt-1">ห้องเรียน: <span class="text-white font-bold">${currentClass.name}</span> | เกรด: <span class="text-yellow-400 font-bold text-lg">${grade}</span></p>
                </div>
            </div>
            <div class="flex gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
                <div class="text-center px-4 border-r border-white/10">
                    <div class="text-[10px] text-white/50 uppercase font-bold tracking-wider">กลางภาค</div>
                    <div class="mt-1 text-lg">${midDisplay}</div>
                </div>
                <div class="text-center px-4">
                    <div class="text-[10px] text-white/50 uppercase font-bold tracking-wider">ปลายภาค</div>
                    <div class="mt-1 text-lg">${finalDisplay}</div>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="glass-ios p-5 rounded-2xl border border-white/10 relative overflow-hidden group hover:border-green-500/30 transition-all">
                <div class="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                <h3 class="text-sm font-bold text-white mb-4 flex items-center"><i class="fa-solid fa-user-clock mr-2 text-green-400"></i>ประวัติการเข้าเรียน</h3>
                <div class="grid grid-cols-4 gap-2 text-center mb-0">
                    <div class="bg-green-500/10 border border-green-500/30 rounded-xl p-2"><div class="text-xl font-bold text-green-400">${p}</div><div class="text-[9px] text-white/50 uppercase">มา</div></div>
                    <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2"><div class="text-xl font-bold text-yellow-400">${l}</div><div class="text-[9px] text-white/50 uppercase">ลา</div></div>
                    <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-2"><div class="text-xl font-bold text-red-400">${a}</div><div class="text-[9px] text-white/50 uppercase">ขาด</div></div>
                    <div class="bg-orange-500/10 border border-orange-500/30 rounded-xl p-2"><div class="text-xl font-bold text-orange-400">${act}</div><div class="text-[9px] text-white/50 uppercase">กิจกรรม</div></div>
                </div>
            </div>

            <div class="glass-ios p-5 rounded-2xl border border-white/10 relative overflow-hidden group hover:border-yellow-500/30 transition-all">
                <div class="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
                <h3 class="text-sm font-bold text-white mb-4 flex items-center"><i class="fa-solid fa-list-check mr-2 text-yellow-400"></i>สถานะการส่งงาน</h3>
                <div class="mb-4">
                    <div class="flex justify-between text-xs text-white/70 mb-1"><span>ความคืบหน้า</span><span class="text-white font-bold">${progress}%</span></div>
                    <div class="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <div class="bg-gradient-to-r from-yellow-500 to-orange-500 h-2.5 rounded-full transition-all duration-1000" style="width: ${progress}%"></div>
                    </div>
                </div>
                <div class="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">`;

        // Sort tasks
        const getPriority = (t) => {
            const sc = dataState.scores.find(x => x.studentId == studentRecord.id && x.taskId == t.id);
            const sub = dataState.submissions.find(x => x.studentId == studentRecord.id && x.taskId == t.id);
            const ret = dataState.returns ? dataState.returns.find(x => x.studentId == studentRecord.id && x.taskId == t.id) : null;
            const isLate = t.dueDateISO < today;
            
            if (ret) return 1;          
            if (!sc && !sub && isLate) return 2; 
            if (!sc && !sub) return 3;  
            if (sub && !sc) return 4;   
            return 5;                   
        };
        
        const sortedTasks = [...subjectTasks].sort((a,b) => getPriority(a) - getPriority(b));

        if (sortedTasks.length === 0) {
            html += `<div class="text-center text-xs text-white/30 py-4">ไม่มีงานที่มอบหมาย</div>`;
        }

        sortedTasks.forEach(t => {
            const sc = dataState.scores.find(x => x.studentId == studentRecord.id && x.taskId == t.id);
            const submission = dataState.submissions.find(x => x.studentId == studentRecord.id && x.taskId == t.id);
            const returned = dataState.returns ? dataState.returns.find(x => x.studentId == studentRecord.id && x.taskId == t.id) : null;
            
            let bgClass = "bg-white/5 border-white/10 hover:bg-white/10";
            let statusBadge = `<span class="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/50">รอส่ง</span>`;
            let actionBtn = `<button onclick="openSubmitModal('${t.id}', '${studentRecord.id}', '${t.name}')" class="text-[10px] bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg border border-white/20 transition-all font-bold">ส่งงาน</button>`;

            if (returned) { 
                bgClass = "bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20"; 
                statusBadge = `<span class="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded font-bold">ต้องแก้ไข</span>`; 
                actionBtn = `<button onclick="openSubmitModal('${t.id}', '${studentRecord.id}', '${t.name}')" class="text-[10px] bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg shadow-lg font-bold animate-pulse">แก้ใหม่</button>`; 
            } 
            else if (sc) { 
                bgClass = "bg-green-500/10 border-green-500/30"; 
                statusBadge = `<span class="text-[10px] text-green-400 font-bold"><i class="fa-solid fa-check mr-1"></i>ตรวจแล้ว (${sc.score})</span>`; 
                actionBtn = ``; 
            } 
            else if (submission) { 
                bgClass = "bg-blue-500/10 border-blue-500/30"; 
                statusBadge = `<span class="text-[10px] text-blue-300"><i class="fa-solid fa-hourglass-half mr-1"></i>รอตรวจ</span>`; 
                actionBtn = `<button onclick="openSubmitModal('${t.id}', '${studentRecord.id}', '${t.name}')" class="text-[10px] bg-blue-600/30 hover:bg-blue-600/50 text-white px-3 py-1.5 rounded-lg border border-blue-500/30">แก้ไข</button>`; 
            } 
            else if (t.dueDateISO < today) { 
                bgClass = "bg-red-500/10 border-red-500/30 hover:bg-red-500/20"; 
                statusBadge = `<span class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold">ค้างส่ง</span>`; 
                actionBtn = `<button onclick="openSubmitModal('${t.id}', '${studentRecord.id}', '${t.name}')" class="text-[10px] bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg shadow-lg font-bold">ส่ง(ช้า)</button>`; 
            }

            html += `<div class="flex items-center justify-between p-2.5 rounded-lg border ${bgClass} transition-all mb-1">
                        <div class="flex-1 min-w-0 mr-3">
                            <div class="text-xs font-bold text-white truncate">${t.name}</div>
                            <div class="mt-1">${statusBadge}</div>
                        </div>
                        ${actionBtn}
                    </div>`;
        });
        
        html += `</div></div></div> ${materialHTML}`;
        
        card.innerHTML = html; 
        container.appendChild(card);
    });
}