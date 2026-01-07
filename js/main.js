import { getThaiDateISO, formatThaiDate, calGrade, calculateScores, escapeHtml } from './utils.js';
import { fetchData, sendData } from './api.js';
import { showToast, showLoading, renderDropdown, renderScheduleList } from './ui.js';

let dataState = { subjects: [], classes: [], students: [], tasks: [], scores: [], attendance: [], materials: [], submissions: [], returns: [], schedules: [] };
let scoreMode = 'manual';
let attMode = null;
let pendingScore = null;
let smartClassId = null;

const PERIODS = [
    { p: 1, start: "08:30", end: "09:20" }, { p: 2, start: "09:20", end: "10:10" },
    { p: 3, start: "10:10", end: "11:00" }, { p: 4, start: "11:00", end: "11:50" },
    { p: 5, start: "11:50", end: "12:40" }, { p: 6, start: "12:40", end: "13:30" },
    { p: 7, start: "13:30", end: "14:20" }, { p: 8, start: "14:20", end: "15:10" }
];

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadLocalData();
    const savedSession = localStorage.getItem('wany_admin_session');
    
    if (document.getElementById('att-date-input')) document.getElementById('att-date-input').value = getThaiDateISO();
    
    if (savedSession) {
        showAdminPanel(true);
    } else {
        switchMainTab('student');
        appSync();
    }
    
    renderScoreButtons();
    setInterval(checkSmartSchedule, 60000);
});

async function appSync() {
    try {
        const json = await fetchData();
        if (json) {
            dataState = json;
            if(!dataState.schedules) dataState.schedules = [];
            saveLocalData();
            refreshUI();
        }
    } catch (e) {
        showToast("โหมด Offline (ข้อมูลเก่า)", "warning");
    }
}

function saveLocalData() { localStorage.setItem('wany_data_backup', JSON.stringify({ timestamp: Date.now(), data: dataState })); }
function loadLocalData() {
    const b = localStorage.getItem('wany_data_backup');
    if (b) { const p = JSON.parse(b); dataState = p.data; }
}

function showAdminPanel(auto = false) {
    document.getElementById('admin-login-wrapper').classList.add('hidden');
    document.getElementById('admin-content-wrapper').classList.remove('hidden');
    refreshUI();
    if (!auto) appSync();
}

function refreshUI() {
    renderDropdown('class-subject-ref', dataState.subjects);
    renderDropdown('student-class', dataState.classes);
    renderDropdown('scan-class-select', dataState.classes);
    renderDropdown('task-subject-filter', dataState.subjects);
    renderDropdown('report-class', dataState.classes);
    renderDropdown('att-class-select', dataState.classes);
    renderDropdown('mat-subject', dataState.subjects);
    renderDropdown('sch-class', dataState.classes);
    
    renderScheduleList(dataState.schedules || [], dataState.classes);
    checkSmartSchedule();
    
    if(!document.getElementById('admin-panel-homework').classList.contains('hidden')) renderIncomingSubmissions();
    if(!document.getElementById('admin-panel-material').classList.contains('hidden')) renderAdminMaterials();
    updateInboxBadge();
}

// --- Logic Implementations ---
async function handleSave(payload) {
    // Optimistic Update
    updateLocalState(payload);
    refreshUI();
    try {
        await sendData(payload);
    } catch(e) {
        showToast("บันทึกไม่สำเร็จ (รอ Sync)", "error");
    }
}

function updateLocalState(p) {
    if(p.action === 'addSubject') dataState.subjects.push({id:p.id, name:p.name});
    if(p.action === 'addClass') dataState.classes.push({id:p.id, name:p.name, subjectId:p.subjectId});
    if(p.action === 'addStudent') dataState.students.push({id:p.id, classId:p.classId, no:p.no, code:p.code, name:p.name});
    if(p.action === 'addTask') {
        p.classIds.forEach((cid, idx) => {
             const chapStr = Array.isArray(p.chapter) ? p.chapter.join(',') : p.chapter;
             dataState.tasks.push({ id: p.id + idx, classId: cid, subjectId: p.subjectId, category: p.category, chapter: chapStr, name: p.name, maxScore: p.maxScore, dueDateISO: p.dueDateISO });
        });
    }
    if(p.action === 'addScore') {
        const idx = dataState.scores.findIndex(s => s.studentId == p.studentId && s.taskId == p.taskId);
        if(idx >= 0) dataState.scores[idx].score = p.score; else dataState.scores.push({studentId:p.studentId, taskId:p.taskId, score:p.score});
    }
    if(p.action === 'addAttendance') {
         const idx = dataState.attendance.findIndex(a => a.studentId == p.studentId && a.date == p.date);
         if(idx >= 0) dataState.attendance[idx].status = p.status; else dataState.attendance.push({studentId:p.studentId, classId:p.classId, date:p.date, status:p.status});
    }
    if(p.action === 'submitTask') {
        p.studentIds.forEach(sid => {
            const idx = dataState.submissions.findIndex(s => s.studentId == sid && s.taskId == p.taskId);
            if(idx >= 0) { dataState.submissions[idx].link = p.link; dataState.submissions[idx].timestampISO = new Date().toISOString(); }
            else dataState.submissions.push({taskId:p.taskId, studentId:sid, link:p.link, timestampISO: new Date().toISOString(), comment: p.comment});
        });
    }
    // ... (Add other state updates here as needed)
}

function initEventListeners() {
    // Admin Login
    document.getElementById('admin-login-form').onsubmit = async (e) => {
        e.preventDefault();
        showLoading(true);
        const u = document.getElementById('admin-username').value;
        const p = document.getElementById('admin-password').value;
        const res = await sendData({ action: 'login', username: u, password: p });
        showLoading(false);
        if (res.status === 'success') {
            localStorage.setItem('wany_admin_session', res.token);
            showAdminPanel();
        } else {
            showToast('รหัสผ่านไม่ถูกต้อง', 'error');
        }
    };
    
    // Forms
    document.getElementById('form-subject').onsubmit = (e) => { e.preventDefault(); handleSave({ action:'addSubject', id:Date.now(), name:document.getElementById('subject-name').value }); e.target.reset(); };
    document.getElementById('form-class').onsubmit = (e) => { e.preventDefault(); handleSave({ action:'addClass', id:Date.now(), name:document.getElementById('class-name').value, subjectId:document.getElementById('class-subject-ref').value }); e.target.reset(); };
    document.getElementById('form-student').onsubmit = (e) => { e.preventDefault(); handleSave({ action: 'addStudent', id: Date.now(), classId: document.getElementById('student-class').value, no: document.getElementById('student-no').value, code: document.getElementById('student-id').value, name: document.getElementById('student-name').value }); e.target.reset(); };
    
    document.getElementById('form-task').onsubmit = (e) => { 
        e.preventDefault();
        const classCbs = document.querySelectorAll('#task-class-checkboxes input:checked');
        const chapCbs = document.querySelectorAll('.chapter-checkbox:checked');
        if(classCbs.length===0) return showToast("เลือกห้อง", 'warning');
        const cat = document.getElementById('task-category').value;
        const selectedChaps = Array.from(chapCbs).map(cb => cb.value);
        
        handleSave({ action: 'addTask', id: Date.now(), classIds: Array.from(classCbs).map(c=>c.value), subjectId: document.getElementById('task-subject-filter').value, category: cat, chapter: selectedChaps, name: document.getElementById('task-name').value, maxScore: document.getElementById('task-max').value, dueDateISO: getThaiDateISO() });
        e.target.reset();
        showToast("สร้างงานแล้ว");
    };

    // Scanners
    document.getElementById('scan-score-input').onkeydown = (e) => {
        if(e.key === 'Enter') {
            const val = e.target.value.trim();
            const cid = document.getElementById('scan-class-select').value;
            const tid = document.getElementById('scan-task-select').value;
            if(!cid || !tid) return;
            const s = dataState.students.find(st => (st.code == val || st.no == val) && st.classId == cid);
            if(s) {
                const t = dataState.tasks.find(x=>x.id==tid);
                if(scoreMode !== 'manual') {
                    handleSave({action:'addScore', studentId:s.id, taskId:t.id, score:scoreMode});
                    showToast(`${s.name} : ${scoreMode}`, "success");
                } else {
                    pendingScore = { s, t };
                    document.getElementById('score-modal').classList.remove('hidden');
                    document.getElementById('modal-task-name').textContent = t.name;
                    document.getElementById('modal-student-name').textContent = s.name;
                    document.getElementById('modal-max-score').textContent = t.maxScore;
                    setTimeout(() => document.getElementById('modal-score-input').focus(), 100);
                }
                e.target.value = '';
            } else { showToast("ไม่พบนักเรียน", "error"); e.target.value=''; }
        }
    };
    
    // Select Change
    document.getElementById('scan-class-select').onchange = () => { updateScanTaskDropdown(); renderScoreRoster(); };
    document.getElementById('scan-task-select').onchange = renderScoreRoster;
    document.getElementById('att-class-select').onchange = renderAttRoster;
    document.getElementById('att-date-input').onchange = renderAttRoster;
    document.getElementById('report-class').onchange = renderGradeReport;
    
    // Modal Save
    document.getElementById('btn-modal-save').onclick = () => {
        const val = document.getElementById('modal-score-input').value;
        if(Number(val) > Number(pendingScore.t.maxScore)) return alert("เกินคะแนนเต็ม");
        handleSave({action:'addScore', studentId:pendingScore.s.id, taskId:pendingScore.t.id, score:val});
        document.getElementById('score-modal').classList.add('hidden');
    };
    document.getElementById('modal-score-input').onkeydown = (e) => { if(e.key==='Enter') document.getElementById('btn-modal-save').click(); };
}

// --- UI Logic that needs State access ---
function updateScanTaskDropdown() {
    const cid = document.getElementById('scan-class-select').value;
    renderDropdown('scan-task-select', dataState.tasks.filter(t => t.classId == cid).reverse().map(t => ({id: t.id, name: `${t.name} (Max ${t.maxScore})`})), "-- เลือกงาน --");
}

function renderScoreRoster() {
    const cid = document.getElementById('scan-class-select').value, taskId = document.getElementById('scan-task-select').value, div = document.getElementById('score-roster-grid'); 
    div.innerHTML = ''; if(!cid || !taskId) return; 
    dataState.students.filter(s => s.classId == cid).sort((a,b)=>Number(a.no)-Number(b.no)).forEach(s => { 
        const sc = dataState.scores.find(x => x.studentId == s.id && x.taskId == taskId), val = sc ? sc.score : '-'; 
        const el = document.createElement('div'); el.className = `status-box ${sc ? 'status-done' : 'status-none'} p-2 flex flex-col items-center justify-center cursor-pointer`; 
        el.onclick = () => { 
            pendingScore = { s, t: dataState.tasks.find(t=>t.id==taskId) }; 
            document.getElementById('score-modal').classList.remove('hidden'); 
            document.getElementById('modal-task-name').textContent = pendingScore.t.name; 
            document.getElementById('modal-student-name').textContent = s.name; 
            document.getElementById('modal-max-score').textContent = pendingScore.t.maxScore; 
            document.getElementById('modal-score-input').value = val == '-' ? '' : val; 
            setTimeout(() => document.getElementById('modal-score-input').focus(), 100); 
        };
        el.innerHTML = `<div class="text-xs opacity-70">No. ${s.no}</div><div class="font-bold text-center text-xs truncate w-full">${s.name}</div><div class="text-xl font-bold mt-1">${val}</div>`; div.appendChild(el); 
    }); 
}

function renderAttRoster() {
    const cid = document.getElementById('att-class-select').value, div = document.getElementById('att-roster-grid'), date = document.getElementById('att-date-input').value; 
    div.innerHTML = ''; if(!cid) return;
    let p=0, l=0, a=0;
    dataState.students.filter(s => s.classId == cid).sort((a,b)=>Number(a.no)-Number(b.no)).forEach(s => {
        const log = dataState.attendance.find(x => x.studentId==s.id && x.date.startsWith(date));
        const st = log ? log.status : 'none';
        if(st=='มา') p++; if(st=='ลา') l++; if(st=='ขาด') a++;
        const c = st=='มา'?'status-done':(st=='ลา'?'bg-yellow-500/20 border-yellow-500 text-yellow-500':(st=='ขาด'?'bg-red-500/20 border-red-500 text-red-500':'status-none'));
        const el = document.createElement('div'); el.className = `status-box ${c} p-3 flex flex-col items-center justify-center cursor-pointer border`;
        el.onclick = () => { if(attMode) handleSave({action:'addAttendance', studentId:s.id, classId:cid, date:date, status:attMode}); };
        el.innerHTML = `<div class="text-xs opacity-70">No. ${s.no}</div><div class="font-bold text-center text-sm">${s.name}</div><div class="text-[10px] mt-1">${st}</div>`; div.appendChild(el);
    });
    document.getElementById('stat-present').textContent = p; document.getElementById('stat-leave').textContent = l; document.getElementById('stat-absent').textContent = a;
}

function renderGradeReport() {
    const cid = document.getElementById('report-class').value, tbody = document.getElementById('report-table-body'); tbody.innerHTML = ''; if(!cid) return;
    const tasks = dataState.tasks.filter(t => t.classId == cid);
    dataState.students.filter(s => s.classId == cid).sort((a,b)=>Number(a.no)-Number(b.no)).forEach((s, idx) => {
        const { chapScores, midterm, final, total } = calculateScores(s.id, tasks, dataState.scores);
        const grade = calGrade(total);
        tbody.innerHTML += `<tr class="hover:bg-white/5"><td class="text-center text-white/50">${s.no||idx+1}</td><td class="px-2 py-3 text-white text-xs">${s.name}</td>${chapScores.map(c=>`<td class="text-center text-yellow-400 font-mono">${c}</td>`).join('')}<td class="text-center text-blue-400 font-bold">${midterm}</td><td class="text-center text-red-400 font-bold">${final}</td><td class="text-center font-bold text-white bg-white/10">${total}</td><td class="text-center text-green-400 font-bold text-lg">${grade}</td></tr>`;
    });
}

function renderIncomingSubmissions() {
    const container = document.getElementById('incoming-list'); container.innerHTML = '';
    let pending = dataState.submissions.filter(sub => !dataState.scores.some(sc => sc.taskId == sub.taskId && sc.studentId == sub.studentId));
    if(pending.length === 0) { container.innerHTML = '<div class="text-center text-white/50 py-10">ไม่มีงานที่รอตรวจ</div>'; return; }
    pending.sort((a,b) => new Date(b.timestampISO) - new Date(a.timestampISO)).forEach(sub => {
        const task = dataState.tasks.find(t => t.id == sub.taskId);
        const student = dataState.students.find(s => s.id == sub.studentId);
        if(!task || !student) return;
        container.innerHTML += `<div class="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col gap-3"><div class="flex justify-between items-start"><div><span class="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded font-bold">${dataState.classes.find(c=>c.id==student.classId)?.name || '-'}</span><h4 class="font-bold text-white text-sm mt-1">${task.name}</h4><p class="text-xs text-yellow-400">${student.name} (No.${student.no})</p></div><a href="${sub.link}" target="_blank" class="text-blue-400 text-xs hover:underline">เปิดงาน</a></div><div class="flex gap-2 items-center"><input id="grade-${sub.id}" type="number" class="glass-input rounded px-2 py-1 text-xs w-20 text-center" placeholder="Max ${task.maxScore}"><button onclick="submitGrade('${sub.id}', '${sub.studentId}', '${sub.taskId}', ${task.maxScore})" class="btn-blue px-3 py-1 rounded text-xs font-bold">ให้คะแนน</button></div></div>`;
    });
}

// Global Exports
window.switchMainTab = (t) => {
    document.getElementById('section-admin').classList.add('hidden');
    document.getElementById('section-student').classList.add('hidden');
    document.getElementById(`section-${t}`).classList.remove('hidden');
    const btnA = document.getElementById('tab-btn-admin'), btnS = document.getElementById('tab-btn-student');
    if(t=='admin'){ btnA.className="px-6 py-2 rounded-full text-sm font-bold bg-white text-blue-900 shadow-lg"; btnS.className="px-6 py-2 rounded-full text-sm font-bold text-white/50 hover:text-white"; }
    else { btnS.className="px-6 py-2 rounded-full text-sm font-bold bg-white text-blue-900 shadow-lg"; btnA.className="px-6 py-2 rounded-full text-sm font-bold text-white/50 hover:text-white"; }
};

window.switchAdminSubTab = (t) => {
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.add('hidden')); 
    document.getElementById(`admin-panel-${t}`).classList.remove('hidden'); 
    document.querySelectorAll('.menu-btn').forEach(b => b.className="menu-btn glass-ios hover:bg-white/10 text-white/70 rounded-2xl py-3 font-bold");
    document.getElementById(`menu-${t}`).className="menu-btn btn-blue rounded-2xl py-3 font-bold shadow-lg text-white";
    refreshUI();
};

window.handleAdminLogout = () => {
    Swal.fire({ title: 'ออกจากระบบ?', icon: 'question', showCancelButton: true, confirmButtonText: 'ใช่', cancelButtonText: 'ไม่' }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('wany_admin_session');
            localStorage.removeItem('wany_data_backup');
            location.reload();
        }
    });
};

window.renderScoreButtons = () => { 
    const c = document.getElementById('score-buttons-container'); if(!c) return; c.innerHTML=''; 
    [5,6,7,8,9,10].forEach(i => { const b = document.createElement('button'); b.textContent=i; b.className="btn-score py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10"; b.onclick=()=>setScoreMode(i); c.appendChild(b); }); 
};

window.setScoreMode = (m) => {
    scoreMode = m; 
    document.querySelectorAll('.btn-score').forEach(b => {
        b.classList.remove('btn-score-active');
        if(b.textContent == m) b.classList.add('btn-score-active');
    });
    if(m=='manual') document.getElementById('btn-score-manual').classList.add('btn-score-active');
    else document.getElementById('btn-score-manual').classList.remove('btn-score-active');
    const inp = document.getElementById('scan-score-input'); if(inp) inp.focus();
};

window.setAttMode = (m) => {
    attMode = m;
    ['present','leave','absent'].forEach(s => document.getElementById(`btn-att-${s}`).classList.remove(`btn-att-active-${s}`));
    if(m=='มา') document.getElementById('btn-att-present').classList.add('btn-att-active-present');
    if(m=='ลา') document.getElementById('btn-att-leave').classList.add('btn-att-active-leave');
    if(m=='ขาด') document.getElementById('btn-att-absent').classList.add('btn-att-active-absent');
    const inp = document.getElementById('att-scan-input'); if(inp) inp.focus();
};

window.renderTaskClassCheckboxes = () => {
    const subId = document.getElementById('task-subject-filter').value; const div = document.getElementById('task-class-checkboxes'); div.innerHTML='';
    dataState.classes.filter(c=>c.subjectId==subId).forEach(c => { div.innerHTML+=`<label class="flex items-center gap-2 p-2 rounded hover:bg-white/10 cursor-pointer"><input type="checkbox" value="${c.id}" class="accent-yellow-500 w-4 h-4 rounded"><span class="text-xs text-white/80">${c.name}</span></label>`; });
};

window.submitGrade = (subId, sid, tid, max) => {
    const val = document.getElementById(`grade-${subId}`).value;
    if(val === '' || Number(val) > Number(max)) return showToast("คะแนนไม่ถูกต้อง", "error");
    handleSave({ action:'addScore', studentId: sid, taskId: tid, score: val });
};

window.updateInboxBadge = () => {
    let count = 0; dataState.submissions.forEach(sub => { if(!dataState.scores.some(sc => sc.taskId == sub.taskId && sc.studentId == sub.studentId)) count++; });
    const badge = document.getElementById('badge-homework'); count > 0 ? (badge.classList.remove('hidden'), badge.textContent = count > 99 ? '99+' : count) : badge.classList.add('hidden');
};

window.checkSmartSchedule = () => {
    if(!dataState.schedules) return;
    const now = new Date(); const day = now.getDay(); const timeStr = now.toTimeString().slice(0,5); 
    const currentPeriod = PERIODS.find(p => timeStr >= p.start && timeStr <= p.end);
    const banner = document.getElementById('smart-att-banner');
    if(currentPeriod) {
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
    banner.classList.add('hidden'); smartClassId = null;
};
window.useSmartClass = () => { if(smartClassId) { document.getElementById('att-class-select').value = smartClassId; renderAttRoster(); } };

window.handleStudentLogin = () => {
    if (!dataState.students.length) return showToast("กำลังโหลดข้อมูล...", "info");
    const code = document.getElementById('student-login-id').value.trim();
    const s = dataState.students.find(x => x.code == code || Number(x.code) == Number(code));
    if(!s) return showToast("ไม่พบรหัส", "error");
    
    document.getElementById('student-login-wrapper').classList.add('hidden');
    document.getElementById('student-dashboard').classList.remove('hidden');
    document.getElementById('std-dash-name').textContent = s.name;
    document.getElementById('std-dash-class').textContent = "ห้อง " + (dataState.classes.find(c=>c.id==s.classId)?.name || '-');
    renderStudentDashboard(s);
};

window.renderStudentDashboard = (s) => {
    const container = document.getElementById('std-subjects-container'); container.innerHTML = '';
    const myTasks = dataState.tasks.filter(t => t.classId == s.classId);
    [...new Set(myTasks.map(t => t.subjectId))].forEach(subId => {
        const subjectTasks = myTasks.filter(t => t.subjectId == subId);
        const { chapScores, midterm, final, total } = calculateScores(s.id, subjectTasks, dataState.scores);
        const grade = calGrade(total);
        // (Simplified Rendering logic due to length - using template literal)
        container.innerHTML += `<div class="glass-ios p-5 rounded-3xl border border-white/10"><h3 class="font-bold text-lg text-white mb-3 border-l-4 border-yellow-500 pl-3 flex justify-between">${dataState.subjects.find(x=>x.id==subId)?.name} <span class="text-sm bg-white/10 px-2 rounded">Grade ${grade}</span></h3><div class="overflow-x-auto mb-4 bg-black/20 rounded-xl"><table class="w-full text-sm text-center text-white/80"><thead class="bg-white/5 text-xs"><tr><th>C1</th><th>C2</th><th>C3</th><th>C4</th><th>C5</th><th>C6</th><th class="text-blue-400">Mid</th><th class="text-red-400">Fin</th><th>Tot</th></tr></thead><tbody><tr>${chapScores.map(c=>`<td>${c}</td>`).join('')}<td>${midterm}</td><td>${final}</td><td>${total}</td></tr></tbody></table></div><div class="grid grid-cols-4 gap-2">${renderStudentTasks(s, subjectTasks)}</div></div>`;
    });
    // Attendance
    document.getElementById('std-att-body').innerHTML = dataState.attendance.filter(a=>a.studentId==s.id).map(a=>`<tr><td class="px-3 py-2 text-white/50">${formatThaiDate(a.date)}</td><td class="px-3 py-2 text-center ${a.status=='มา'?'text-green-400':'text-red-400'}">${a.status}</td></tr>`).join('');
};

function renderStudentTasks(s, tasks) {
    return tasks.map(t => {
        const sc = dataState.scores.find(x => x.studentId == s.id && x.taskId == t.id);
        const sub = dataState.submissions.find(x => x.studentId == s.id && x.taskId == t.id);
        let status = sc ? `<span class="text-green-400 font-bold">${sc.score}</span>` : (sub ? '<span class="text-blue-400">รอตรวจ</span>' : '<button class="bg-white/10 px-2 rounded text-[10px]" onclick="openSubmitModal(\''+t.id+'\',\''+s.id+'\')">ส่ง</button>');
        return `<div class="bg-white/5 p-2 rounded text-center"><div class="text-[10px] truncate">${t.name}</div>${status}</div>`;
    }).join('');
}

window.openSubmitModal = (tid, sid) => {
    document.getElementById('submit-task-id').value = tid;
    document.getElementById('submit-student-id').value = sid;
    document.getElementById('submit-modal').classList.remove('hidden');
};

window.logoutStudent = () => { location.reload(); };