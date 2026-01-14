// Score calculation functions
function calculateScores(studentId, classId, tasks) {
    let total = 0, midterm = 0, final = 0;
    
    // Separate scores by chapter (chapter)
    let chapterScores = {}; // {chapter: {sum: 0, count: 0, max: 0}}
    
    const classTasks = tasks.filter(t => t.classId == classId);
    
    classTasks.forEach(task => {
        const scoreRecord = dataState.scores.find(s => s.studentId == studentId && s.taskId == task.id);
        const score = scoreRecord ? Number(scoreRecord.score) : 0;
        
        if (task.category === 'midterm') { 
            midterm += score; 
            total += score; 
        }
        else if (task.category === 'final') { 
            final += score; 
            total += score; 
        }
        else if (task.category === 'accum') {
            // Find which score slots this task belongs to
            if (task.chapter) {
                let chaps = [];
                if (Array.isArray(task.chapter)) {
                    chaps = task.chapter;
                } else if (typeof task.chapter === 'string') {
                    chaps = task.chapter.split(',').map(c => c.trim());
                } else {
                    chaps = [String(task.chapter)];
                }
                
                chaps.forEach(ch => {
                    const chapterKey = `ch${ch}`;
                    if (!chapterScores[chapterKey]) {
                        chapterScores[chapterKey] = { sum: 0, count: 0, max: 0 };
                    }
                    // Find maximum score for this slot from subject config
                    const classInfo = dataState.classes.find(c => c.id == classId);
                    if (classInfo) {
                        const subject = dataState.subjects.find(s => s.id == classInfo.subjectId);
                        if (subject && subject.scoreConfig && subject.scoreConfig.length > 0) {
                            const chapIndex = parseInt(ch) - 1;
                            if (chapIndex >= 0 && chapIndex < subject.scoreConfig.length) {
                                chapterScores[chapterKey].max = subject.scoreConfig[chapIndex];
                            }
                        }
                    }
                    chapterScores[chapterKey].sum += score;
                    chapterScores[chapterKey].count++;
                });
            }
        } else { 
            // For other special tasks, add to total score normally
            total += score; 
        }
    });
    
    // Calculate each chapter score (average and not exceeding maximum)
    let chapScoresArray = [0, 0, 0, 0, 0];
    let totalAccumScore = 0;
    
    Object.keys(chapterScores).forEach(chapterKey => {
        const chapterNum = parseInt(chapterKey.replace('ch', ''));
        if (!isNaN(chapterNum) && chapterNum >= 1 && chapterNum <= 5) {
            const idx = chapterNum - 1;
            const chapData = chapterScores[chapterKey];
            
            if (chapData.count > 0) {
                // Calculate average
                let averageScore = chapData.sum / chapData.count;
                
                // Limit to not exceed maximum score
                if (chapData.max > 0) {
                    averageScore = Math.min(averageScore, chapData.max);
                }
                
                // Round to 1 decimal place
                chapScoresArray[idx] = Math.round(averageScore * 10) / 10;
                totalAccumScore += chapScoresArray[idx];
            }
        }
    });
    
    // Add accumulated scores to total
    total += totalAccumScore;
    
    return { total, midterm, final, chapScores: chapScoresArray, totalAccumScore };
}

function calGrade(score) {
    const s = parseFloat(score);
    if(s >= 80) return 4;
    if(s >= 75) return 3.5;
    if(s >= 70) return 3;
    if(s >= 65) return 2.5;
    if(s >= 60) return 2;
    if(s >= 55) return 1.5;
    if(s >= 50) return 1;
    return 0;
}

function getThaiDateISO() { 
    const d = new Date(); 
    const u = d.getTime() + (d.getTimezoneOffset() * 60000); 
    const b = new Date(u + (7 * 3600000)); 
    return b.toISOString().slice(0, 10); 
}

function formatThaiDate(dateString) { 
    if (!dateString) return "-"; 
    const date = new Date(dateString); 
    if (isNaN(date.getTime())) return "-"; 
    return new Intl.DateTimeFormat('th-TH', { 
        day: 'numeric', 
        month: 'short', 
        year: '2-digit' 
    }).format(date); 
}