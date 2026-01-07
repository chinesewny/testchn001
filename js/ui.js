import { escapeHtml } from './utils.js';

export function showToast(message, type = 'success') {
    const Toast = Swal.mixin({
        toast: true, position: 'bottom', showConfirmButton: false, timer: 3000,
        background: type === 'error' ? '#7f1d1d' : (type === 'warning' ? '#78350f' : '#064e3b'), color: '#fff'
    });
    Toast.fire({ icon: type, title: message });
}

export function showLoading(show = true) {
    const loader = document.getElementById('global-loader');
    if(loader) loader.style.display = show ? 'flex' : 'none';
}

export function renderDropdown(id, list, placeholder = "-- เลือก --") {
    const el = document.getElementById(id);
    if (!el) return;
    const currentVal = el.value;
    el.innerHTML = `<option value="">${placeholder}</option>`;
    list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = escapeHtml(item.id);
        opt.textContent = escapeHtml(item.name);
        el.appendChild(opt);
    });
    el.value = currentVal;
}
export function renderAdminMaterials(materials, subjects) {
    const div = document.getElementById('admin-mat-list');
    if(!div) return;
    div.innerHTML = '';
    materials.forEach(m => {
        const sub = subjects.find(s => s.id == m.subjectId)?.name || '-';
        div.innerHTML += `<div class="bg-white/5 p-3 rounded-xl border border-white/10 flex justify-between"><div><div class="text-xs text-yellow-400">${sub}</div><div class="font-bold text-sm text-white"><a href="${m.link}" target="_blank" class="hover:underline">${m.title}</a></div></div></div>`;
    });
}
export function renderScheduleList(schedules, classes) {
    const div = document.getElementById('schedule-list');
    if(!div) return;
    div.innerHTML = '';
    const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
    schedules.sort((a,b) => (a.day - b.day) || (a.period - b.period)).forEach(s => {
        const clsName = classes.find(c=>c.id==s.classId)?.name || '?';
        div.innerHTML += `<div class="flex justify-between items-center text-xs text-white/70 bg-white/5 p-2 rounded border border-white/5"><span>${days[s.day]} คาบ ${s.period}</span> <span class="text-yellow-400 font-bold">${clsName}</span></div>`;
    });
}
