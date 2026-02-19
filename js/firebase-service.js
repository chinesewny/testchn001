// js/firebase-service.js
let saveTimeout; // ตัวแปรสำหรับถือเวลาหน่วง

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    onSnapshot, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { FIREBASE_CONFIG, GOOGLE_SCRIPT_URL } from "./config.js";
// 🟢 เพิ่ม updateLocalState เข้ามาเพื่อใช้อัปเดตทันที
import { dataState, updateDataState, saveToLocalStorage, globalState, updateLocalState } from "./state.js";
import { updateSyncUI, showToast, showLoading, hideLoading } from "./utils.js";
import { refreshUI } from "./ui-render.js";

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const docRef = doc(db, "school_data", "wany_data");

// ==========================================
// 🔄 ฟังก์ชัน Sync Data (รับข้อมูลจาก Server)
// ==========================================
export async function syncData() {
    if (globalState.sheetQueue && globalState.sheetQueue.length > 0) {
        processSheetQueue();
        return;
    }

    updateSyncUI('Connecting (Firestore)...', 'yellow');

    // 🟢 includeMetadataChanges: true เพื่อเช็คว่าข้อมูลมาจากเราเองหรือคนอื่น
    onSnapshot(docRef, { includeMetadataChanges: true }, (docSnap) => {
        
        // ⭐ หัวใจสำคัญของการ "ไม่กระพริบ" (Anti-Flash)
        // ถ้าข้อมูลนี้มาจากการเขียนของเราเอง (Local Write) ที่ยังไม่ยืนยันจาก Server
        // ให้ข้ามการรีเฟรชหน้าจอไปเลย เพราะเราอัปเดตหน้าจอไปแล้วตอนกดปุ่ม
        if (docSnap.metadata.hasPendingWrites) {
            console.log("⏳ Local update detected (Skipping UI refresh to prevent glitch)");
            return; 
        }

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("🔥 Loaded from Firestore (Server Confirmed)");

            // ถ้าเป็นข้อมูลจากคนอื่น หรือ Server ยืนยันแล้วว่าเปลี่ยนจริง ค่อยอัปเดต
            updateDataState(data);
            saveToLocalStorage();
            refreshUI();
            
            updateSyncUI('Online (Firestore)', 'green');
        } else {
            updateSyncUI('No Data (Ready)', 'gray');
        }
    }, (error) => {
        console.error("Firestore Error:", error);
        updateSyncUI('Error: ' + error.message, 'red');
    });
}

// ==========================================
// 💾 ฟังก์ชัน Save Data (บันทึกข้อมูล)
// ==========================================
export async function saveAndRefresh(payload = null) {
    
    // ⭐ ส่วนที่เพิ่ม: อัปเดตหน้าจอทันที (Optimistic Update)
    if (payload) {
        try {
            // 1. อัปเดตข้อมูลในตัวแปรทันที
            updateLocalState(payload); 
            // 2. บันทึกลงเครื่องกันเหนียว
            saveToLocalStorage();
            // 3. รีเฟรชหน้าจอทันที (ผู้ใช้จะเห็นสีเปลี่ยนปั๊บ)
            refreshUI();               
        } catch (e) {
            console.error("Local Update Error:", e);
        }
    }

    // 🛑 เคลียร์เวลานับถอยหลังเดิม (Debounce)
    clearTimeout(saveTimeout);

    // ⏳ รอ 1 วินาที ถ้าไม่มีการกดเพิ่ม ค่อยส่งข้อมูลไป Firebase ทีเดียว
    saveTimeout = setTimeout(async () => {
        try {
            updateSyncUI('Saving...', 'yellow');
            
            // เตรียมข้อมูลส่ง Server
            const dataToSave = JSON.parse(JSON.stringify(dataState));
            await setDoc(docRef, dataToSave);

            updateSyncUI('Online (Saved)', 'green');
            console.log("✅ Saved to Firestore successfully.");

        } catch (error) {
            console.error("Save Error:", error);
            updateSyncUI('Save Failed', 'red');
            showToast("บันทึกไม่สำเร็จ: " + error.message, "error");
        }
    }, 1000); 
}

// ==========================================
// 📦 ฟังก์ชัน Backup / Restore (เหมือนเดิม)
// ==========================================
export async function backupToGoogleSheet() {
    if (!confirm("ต้องการสำรองข้อมูลปัจจุบันไปยัง Google Sheet หรือไม่?")) return;
    showLoading("กำลังส่งข้อมูลไป Google Sheet...");
    try {
        const payload = { action: "exportData", data: dataState };
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (json.status === "success") showToast("สำรองข้อมูลเรียบร้อย!", "success");
        else throw new Error(json.message || "Unknown error");
    } catch (error) {
        showToast("Backup Error: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

export async function restoreFromGoogleSheet() {
    if (!confirm("⚠️ คำเตือน: ข้อมูลจะถูกเขียนทับ\nยืนยันหรือไม่?")) return;
    showLoading("กำลังดึงข้อมูล...");
    try {
        const payload = { action: "importData" };
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (json.status !== "success") throw new Error(json.message);
        
        if(json.data.tasks) dataState.tasks = json.data.tasks;
        if(json.data.scores) dataState.scores = json.data.scores;
        if(json.data.students) dataState.students = json.data.students;
        if(json.data.subjects) dataState.subjects = json.data.subjects;
        if(json.data.classes) dataState.classes = json.data.classes;
        if(json.data.attendance) dataState.attendance = json.data.attendance;
        if(json.data.materials) dataState.materials = json.data.materials;

        const dataToSave = JSON.parse(JSON.stringify(dataState));
        await setDoc(docRef, dataToSave);
        saveToLocalStorage();

        alert("กู้คืนข้อมูลสำเร็จ!");
        location.reload(); 
    } catch (error) {
        showToast("Error: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

async function processSheetQueue() {
    if (globalState.isSendingSheet || globalState.sheetQueue.length === 0) return;
    globalState.isSendingSheet = true;
    updateSyncUI('Sync Sheet...', 'yellow');
    const item = globalState.sheetQueue[0]; 
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item)
        });
        globalState.sheetQueue.shift(); 
        saveToLocalStorage();
        if (globalState.sheetQueue.length > 0) {
            globalState.isSendingSheet = false;
            setTimeout(processSheetQueue, 1000);
        } else {
            globalState.isSendingSheet = false;
            updateSyncUI('Online (Firestore)', 'green');
        }
    } catch (error) {
        globalState.isSendingSheet = false;
        updateSyncUI('Sheet Error', 'red');
    }
}