// Form handling functions
function searchIndividual(keyword) {
    const container = document.getElementById('individual-search-results');
    container.innerHTML = '';
    
    if(!keyword) { 
        container.classList.add('hidden'); 
        return; 
    }
    
    const results = dataState.students.filter(s => 
        s.name.includes(keyword) || 
        String(s.code).includes(keyword) || 
        String(s.no) == keyword
    );
    
    if(results.length > 0) {
        container.classList.remove('hidden');
        results.forEach(s => {
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-white/10 cursor-pointer text-white border-b border-white/5 last:border-0";
            div.innerHTML = `<div class="font-bold text-sm">${s.name}</div><div class="text-xs text-white/50">${s.code}</div>`;
            div.onclick = () => { 
                showIndividualResult(s); 
                container.classList.add('hidden'); 
                document.getElementById('individual-search').value = ''; 
            };
            container.appendChild(div);
        });
    } else { 
        container.classList.add('hidden'); 
    }
}

function showIndividualResult(s) {
    document.getElementById('individual-result-container').classList.remove('hidden');
    
    // 1. Basic Info
    document.getElementById('ind-name').textContent = s.name;
    document.getElementById('ind-id').textContent = s.code;
    document.getElementById('ind-class').textContent = dataState.classes.find(c => c.id == s.classId)?.name || '-';

    // 2. Scores & GPA
    const tasks = dataState.tasks.filter(t => t.classId == s.classId);
    const { total, midterm, final, chapScores } = calculateScores(s.id, s.classId, tasks);
    document.getElementById('ind-gpa').textContent = calGrade(total);
    document.getElementById('ind-score-mid').textContent = midterm.toFixed(1);
    document.getElementById('ind-score-final').textContent = final.toFixed(1);
    
    // 3. Attendance Stats
    const atts = dataState.attendance.filter(a => a.studentId == s.id);
    let p = 0, l = 0, a = 0, act = 0, aDates = [];
    atts.forEach(att => {
        if(att.status === 'มา') p++;
        else if(att.status === 'ลา') l++;
        else if(att.status === 'ขาด') { 
            a++; 
            aDates.push(formatThaiDate(att.date)); 
        }
        else if(att.status === 'กิจกรรม') act++;
    });

    document.getElementById('ind-att-present').textContent = p;
    document.getElementById('ind-att-leave').textContent = l;
    document.getElementById('ind-att-absent').textContent = a;
    document.getElementById('ind-att-activity').textContent = act;
    
    const absentDiv = document.getElementById('ind-absent-dates');
    absentDiv.innerHTML = aDates.length > 0 ? 
        aDates.map(d => `<span class="inline-block bg-red-500/20 text-red-200 px-1.5 py-0.5 rounded text-[10px] mr-1 mb-1">${d}</span>`).join('') : 
        '<span class="text-green-400/60 text-xs">ไม่มีประวัติการขาดเรียน</span>';

    // 4. Tasks & Progress
    const allTasks = tasks;
    const submittedIds = [];
    
    // Check scores
    dataState.scores.forEach(sc => { 
        if(sc.studentId == s.id) submittedIds.push(sc.taskId); 
    });
    
    // Check submissions (pending)
    dataState.submissions.forEach(sub => { 
        if(sub.studentId == s.id) submittedIds.push(sub.taskId); 
    });
    
    const uniqueSubmitted = [...new Set(submittedIds)];
    const totalCount = allTasks.length;
    const doneCount = uniqueSubmitted.filter(id => allTasks.find(t => t.id == id)).length;
    const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

    document.getElementById('ind-work-progress-text').textContent = `${percent}%`;
    document.getElementById('ind-work-bar').style.width = `${percent}%`;

    // Missing List
    const missingListDiv = document.getElementById('ind-missing-list');
    missingListDiv.innerHTML = '';
    const missingTasks = allTasks.filter(t => !uniqueSubmitted.includes(t.id));
    
    if (missingTasks.length > 0) {
        missingTasks.forEach(t => {
            const el = document.createElement('div');
            el.className = "bg-white/5 p-2 rounded border-l-2 border-red-400 flex items-center justify-between";
            el.innerHTML = `<span class="text-xs text-white/80 truncate">${t.name}</span><span class="text-[10px] text-red-400">ยังไม่ส่ง</span>`;
            missingListDiv.appendChild(el);
        });
    } else {
        missingListDiv.innerHTML = `<div class="text-center py-2 text-green-400 text-xs"><i class="fa-solid fa-check-circle mr-1"></i>ส่งงานครบแล้ว</div>`;
    }
}