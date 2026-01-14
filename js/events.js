// Event listeners initialization
function initEventListeners() {
    // Friend search
    document.getElementById('friend-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.friend-item').forEach(item => { 
            item.style.display = item.textContent.toLowerCase().includes(term) ? 'flex' : 'none'; 
        });
    });
    
    // Email modal enter key
    document.getElementById('user-email-input').onkeydown = (e) => { 
        if(e.key === 'Enter') {
            e.preventDefault(); // Prevent implicit form submit
            saveUserEmail();
        }
    };
    
    // Submit work form
    document.getElementById('form-submit-work').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-final');
        const originalText = btn.innerHTML;
        btn.disabled = true; 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง...';
        
        const tid = document.getElementById('submit-task-id').value;
        const sid = document.getElementById('submit-student-id').value;
        const link = document.getElementById('submit-link-input').value;
        const comment = document.getElementById('submit-comment-input').value;
        const checkboxes = document.querySelectorAll('.friend-checkbox:checked');
        
        let allStudentIds = [sid]; 
        checkboxes.forEach(cb => allStudentIds.push(cb.value));
        
        try {
            await saveAndRefresh({ 
                action: 'submitTask', 
                taskId: tid, 
                studentIds: allStudentIds, 
                link: link, 
                comment: comment 
            });
            
            document.getElementById('submit-modal').classList.add('hidden');
            
            // Refresh dashboard using current student code
            const s = dataState.students.find(x => x.id == sid);
            if(s) renderStudentDashboard(s.code);
            
        } catch(err) { 
            alert("เกิดข้อผิดพลาด"); 
        } finally { 
            btn.disabled = false; 
            btn.innerHTML = originalText; 
        }
    };
    
    // Admin login form
    document.getElementById('admin-login-form').onsubmit = async (e) => { 
        e.preventDefault(); 
        const u = document.getElementById('admin-username').value; 
        const p = document.getElementById('admin-password').value; 
        
        const res = await saveAndRefresh({action:'login', username:u, password:p}); 
        if(res.status == 'success'){ 
            localStorage.setItem('wany_admin_session', res.token); 
            showAdminPanel(); 
        } else {
            alert("รหัสผิด (Demo: ลองกด Login เลย หรือใช้ user:admin pass:1234)"); 
        }
    };
    
    // Task creation form
    document.getElementById('form-task').onsubmit = (e) => { 
        e.preventDefault(); 
        const classCbs = document.querySelectorAll('#task-class-checkboxes input:checked'); 
        const chapCbs = document.querySelectorAll('.chapter-checkbox:checked'); 
        
        if(classCbs.length === 0) return alert("เลือกห้อง"); 
        const selectedChaps = Array.from(chapCbs).map(cb => cb.value); 
        const cat = document.getElementById('task-category').value; 
        
        if(cat === 'accum' && selectedChaps.length === 0) return alert("เลือกช่องคะแนน"); 
        
        const d = new Date(); 
        d.setDate(d.getDate() + 7);
        const offset = d.getTimezoneOffset() * 60000;
        const nextWeekISO = new Date(d.getTime() - offset).toISOString().slice(0,10);

        saveAndRefresh({ 
            action: 'addTask', 
            id: Date.now(), 
            classIds: Array.from(classCbs).map(c => c.value), 
            subjectId: document.getElementById('task-subject-filter').value, 
            category: cat, 
            chapter: selectedChaps, 
            name: document.getElementById('task-name').value, 
            maxScore: document.getElementById('task-max').value, 
            dueDateISO: nextWeekISO 
        }); 
        
        e.target.reset(); 
        document.querySelectorAll('.chapter-checkbox').forEach(c => c.checked = false); 
        alert("สร้างงานแล้ว (กำหนดส่งใน 7 วัน)"); 
    };

    // Schedule form
    document.getElementById('form-schedule').onsubmit = (e) => { 
        e.preventDefault(); 
        saveAndRefresh({ 
            action: 'addSchedule', 
            id: Date.now(), 
            day: document.getElementById('sch-day').value, 
            period: document.getElementById('sch-period').value, 
            classId: document.getElementById('sch-class').value 
        }); 
    };
    
    // Task category change
    document.getElementById('task-category').onchange = (e) => { 
        e.target.value === 'accum' ? 
            document.getElementById('chapter-wrapper').classList.remove('hidden') : 
            document.getElementById('chapter-wrapper').classList.add('hidden'); 
    }
    
    // Subject form
    document.getElementById('form-subject').onsubmit = (e) => { 
        e.preventDefault(); 
        saveAndRefresh({ 
            action: 'addSubject', 
            id: Date.now(), 
            name: document.getElementById('subject-name').value 
        }); 
        e.target.reset(); 
    };
    
    // Class form
    document.getElementById('form-class').onsubmit = (e) => { 
        e.preventDefault(); 
        saveAndRefresh({ 
            action: 'addClass', 
            id: Date.now(), 
            name: document.getElementById('class-name').value, 
            subjectId: document.getElementById('class-subject-ref').value 
        }); 
        e.target.reset(); 
    };
    
    // Student form
    document.getElementById('form-student').onsubmit = (e) => { 
        e.preventDefault(); 
        saveAndRefresh({ 
            action: 'addStudent', 
            id: Date.now(), 
            classId: document.getElementById('student-class').value, 
            no: document.getElementById('student-no').value, 
            code: document.getElementById('student-id').value, 
            name: document.getElementById('student-name').value 
        }); 
        e.target.reset(); 
    };
    
    // Report class change
    document.getElementById('report-class').onchange = renderGradeReport;
    
    // Report subject change
    document.getElementById('report-subject').onchange = updateReportClassDropdown;
    
    // Scan class change
    document.getElementById('scan-class-select').onchange = () => { 
        updateScanTaskDropdown(); 
        renderScoreRoster(); 
    };
    
    // Scan task change
    document.getElementById('scan-task-select').onchange = renderScoreRoster;
    
    // Attendance class change
    document.getElementById('att-class-select').onchange = renderAttRoster;
    
    // Attendance date change
    document.getElementById('att-date-input').onchange = renderAttRoster;
    
    // Score modal save button
    document.getElementById('btn-modal-save').onclick = () => { 
        const val = document.getElementById('modal-score-input').value; 
        const { s, t } = pendingScore; 
        
        if(Number(val) > Number(t.maxScore)) return alert("เกินคะแนนเต็ม"); 
        
        saveAndRefresh({
            action: 'addScore', 
            studentId: s.id, 
            taskId: t.id, 
            score: val
        }); 
        
        closeScoreModal(); 
        showToast("บันทึกแล้ว"); 
    };
    
    // Material form
    document.getElementById('form-material').onsubmit = (e) => { 
        e.preventDefault(); 
        saveAndRefresh({ 
            action: 'addMaterial', 
            id: Date.now(), 
            subjectId: document.getElementById('mat-subject').value, 
            title: document.getElementById('mat-title').value, 
            type: 'link', 
            link: document.getElementById('mat-link').value 
        }); 
        e.target.reset(); 
    }
    
    // Score modal enter key
    document.getElementById('modal-score-input').onkeydown = (e) => { 
        if(e.key === 'Enter') document.getElementById('btn-modal-save').click(); 
    };
    
    // Student login enter key
    document.getElementById('student-login-id').onkeydown = (e) => { 
        if(e.key === 'Enter') handleStudentLogin(); 
    };
    
    // Attendance scan input
    document.getElementById('att-scan-input').onkeydown = (e) => { 
        if(e.key === 'Enter') { 
            const val = e.target.value.trim(); 
            const cid = document.getElementById('att-class-select').value; 
            const date = document.getElementById('att-date-input').value; 
            const mode = attMode || 'มา'; 
            
            if(!cid) { 
                alert("กรุณาเลือกห้องก่อน"); 
                e.target.value=''; 
                return; 
            } 
            
            const s = dataState.students.find(st => 
                (String(st.code) == val || String(st.no) == val) && st.classId == cid
            ); 
            
            if(s) { 
                saveAndRefresh({ 
                    action: 'addAttendance', 
                    studentId: s.id, 
                    classId: cid, 
                    date: date, 
                    status: mode 
                }); 
                showToast(`${s.name} : ${mode}`, "bg-green-600"); 
            } else { 
                showToast(`ไม่พบรหัส: ${val}`, "bg-red-600"); 
            } 
            
            e.target.value = ''; 
        } 
    };
    
    // Score scan input
    document.getElementById('scan-score-input').onkeydown = (e) => { 
        if(e.key === 'Enter') { 
            const val = e.target.value.trim(); 
            const cid = document.getElementById('scan-class-select').value; 
            if(!cid) return; 
            
            const s = dataState.students.find(st => 
                (String(st.code) == val || String(st.no) == val) && st.classId == cid
            ); 
            
            if(s) { 
                const tid = document.getElementById('scan-task-select').value; 
                const t = dataState.tasks.find(x => x.id == tid); 
                
                if(t) { 
                    if(scoreMode !== 'manual') { 
                        if(Number(scoreMode) > Number(t.maxScore)) { 
                            alert("คะแนนที่เลือกเกินคะแนนเต็มของงานนี้!"); 
                        } else { 
                            saveAndRefresh({
                                action: 'addScore', 
                                studentId: s.id, 
                                taskId: t.id, 
                                score: scoreMode
                            }); 
                            showToast(`${s.name} : ${scoreMode} คะแนน`, "bg-green-600"); 
                        } 
                    } else { 
                        pendingScore = { s, t }; 
                        document.getElementById('score-modal').classList.remove('hidden'); 
                        document.getElementById('modal-task-name').textContent = t.name; 
                        document.getElementById('modal-student-name').textContent = s.name; 
                        document.getElementById('modal-max-score').textContent = t.maxScore; 
                        
                        const sc = dataState.scores.find(x => x.studentId == s.id && x.taskId == t.id); 
                        document.getElementById('modal-score-input').value = sc ? sc.score : ''; 
                        
                        setTimeout(() => document.getElementById('modal-score-input').focus(), 100); 
                    } 
                    e.target.value = ''; 
                } 
            } else { 
                showToast("ไม่พบนักเรียน", "bg-red-600"); 
                e.target.value = ''; 
            } 
        } 
    };
}