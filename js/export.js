// Export functions (CSV, Print)
function exportGradeCSV() {
    const classId = document.getElementById('report-class').value;
    if (!classId) return alert("กรุณาเลือกห้องเรียนก่อนดาวน์โหลด CSV");
    
    const currentClass = dataState.classes.find(c => c.id == classId);
    const students = dataState.students.filter(s => s.classId == classId).sort((a, b) => Number(a.no) - Number(b.no));
    const tasks = dataState.tasks.filter(t => t.classId == classId);
    const classInfo = dataState.classes.find(c => c.id == classId);
    const subject = classInfo ? dataState.subjects.find(s => s.id == classInfo.subjectId) : null;
    const config = (subject && subject.scoreConfig && subject.scoreConfig.length > 0) ? subject.scoreConfig : Array(5).fill(10);
    
    let csvContent = "\uFEFF"; // BOM for UTF-8
    let headerRow = ["เลขที่", "รหัสนักเรียน", "ชื่อ-นามสกุล"];
    
    // Add headers for each chapter score slot
    config.forEach((max, i) => {
        headerRow.push(`"คะแนนเก็บ CH${i+1} (${max})"`);
    });
    
    headerRow.push("กลางภาค", "ปลายภาค", "คะแนนรวม", "เกรด");
    
    csvContent += headerRow.join(",") + "\n";
    
    students.forEach(s => {
        let row = [s.no, `"${s.code}"`, `"${s.name}"`];
        
        // Calculate scores
        const { chapScores, midterm, final, total } = calculateScores(s.id, classId, tasks);
        
        // Add each chapter score
        chapScores.forEach(score => {
            row.push(score);
        });
        
        // Add midterm, final, total, grade
        row.push(midterm, final, total.toFixed(1), calGrade(total));
        
        csvContent += row.join(",") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Grade_${currentClass.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function printOfficialReport() {
    const cid = document.getElementById('report-class').value;
    if (!cid) return alert("กรุณาเลือกห้องเรียนที่จะพิมพ์");

    const cls = dataState.classes.find(c => c.id == cid);
    const subId = document.getElementById('report-subject').value;
    const subj = dataState.subjects.find(s => s.id == subId);
    const tasks = dataState.tasks.filter(t => t.classId == cid);

    // 1. Set paper header
    document.getElementById('print-subtitle').textContent = `วิชา ${subj.name} | ห้อง ${cls.name} | วันที่พิมพ์: ${formatThaiDate(new Date().toISOString())}`;

    // 2. Create Table Header
    const thead = document.getElementById('print-column-header');
    const tbody = document.getElementById('print-table-body');
    tbody.innerHTML = ''; 
    thead.innerHTML = '';

    const config = (subj && subj.scoreConfig && subj.scoreConfig.length > 0) ? subj.scoreConfig : Array(5).fill(10);
    
    // Create Header Columns
    let hHTML = `<th style="width:5%;">#</th><th style="width:25%; text-align:left;">ชื่อ-นามสกุล</th>`;
    
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
        
        hHTML += `<th style="text-align:center;">CH${i+1}<br><span style="font-size:10px;">(${m})<br>${chapterTasks.length} งาน</span></th>`;
    });
    
    hHTML += `<th style="text-align:center;">กลาง</th><th style="text-align:center;">ปลาย</th><th style="text-align:center;">รวม</th><th style="text-align:center;">เกรด</th>`;
    thead.innerHTML = hHTML;

    // 3. Create Data Rows
    dataState.students.filter(s => s.classId == cid).sort((a,b) => Number(a.no) - Number(b.no)).forEach((s, idx) => { 
        const { chapScores, midterm, final, total } = calculateScores(s.id, cid, tasks);
        const grade = calGrade(total);
        
        const tr = document.createElement('tr');
        let html = `<td style="text-align:center;">${s.no||idx+1}</td><td style="padding-left:5px;">${s.name}</td>`;
        
        // Show each chapter score
        chapScores.forEach((score, idx) => {
            // Check if score exceeds maximum
            const maxScore = config[idx] || 10;
            const isOverMax = score > maxScore;
            
            html += `<td style="text-align:center;${isOverMax ? 'color:red;' : ''}">${score.toFixed(1)}</td>`;
        });
        
        html += `<td style="text-align:center;">${midterm.toFixed(1)}</td><td style="text-align:center;">${final.toFixed(1)}</td><td style="text-align:center; font-weight:bold;">${total.toFixed(1)}</td><td style="text-align:center; font-weight:bold;">${grade}</td>`;
        
        tr.innerHTML = html; 
        tbody.appendChild(tr); 
    });

    window.print();
}

function exportAttendanceCSV() {
    const cid = document.getElementById('att-class-select').value;
    if (!cid) return alert("กรุณาเลือกห้องเรียนก่อน");

    const currentClass = dataState.classes.find(c => c.id == cid);
    const students = dataState.students.filter(s => s.classId == cid).sort((a, b) => Number(a.no) - Number(b.no));
    
    // Find all dates with attendance records
    const uniqueDates = [...new Set(dataState.attendance.filter(a => a.classId == cid).map(a => a.date))].sort();

    let csvContent = "\uFEFF"; // BOM for UTF-8
    let headerRow = ["เลขที่", "รหัสนักเรียน", "ชื่อ-นามสกุล"];
    
    uniqueDates.forEach(d => headerRow.push(`"${formatThaiDate(d)}"`));
    headerRow.push("มา", "ลา", "ขาด", "กิจกรรม", "เปอร์เซ็นต์การมา");
    
    csvContent += headerRow.join(",") + "\n";

    students.forEach(s => {
        let row = [s.no, `"${s.code}"`, `"${s.name}"`];
        let p = 0, l = 0, a = 0, act = 0;

        uniqueDates.forEach(d => {
            const log = dataState.attendance.find(att => att.studentId == s.id && att.date == d);
            const status = log ? log.status : "-";
            row.push(status);
            
            if(status == 'มา') p++;
            else if(status == 'ลา') l++;
            else if(status == 'ขาด') a++;
            else if(status == 'กิจกรรม') act++;
        });

        const totalDays = uniqueDates.length || 1;
        const percent = Math.round(((p + act) / totalDays) * 100);

        row.push(p, l, a, act, `${percent}%`);
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_${currentClass.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}