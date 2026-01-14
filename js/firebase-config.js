// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAZPONKvSWeURM3kvJKVlnZfmHQnOJHz9I",
  authDomain: "chineseclass-by-krukong.firebaseapp.com",
  projectId: "chineseclass-by-krukong",
  storageBucket: "chineseclass-by-krukong.firebasestorage.app",
  messagingSenderId: "806456159848",
  appId: "1:806456159848:web:402ab1ea71aebd73ecd5dd",
  measurementId: "G-9NT2B088RH"
};

// Firebase App Initialization
let firebaseApp;
let firestoreDb;
let firebaseInitialized = false;

async function initializeFirebase() {
    try {
        // Check if Firebase is already initialized
        if (typeof firebase === 'undefined') {
            console.warn("Firebase SDK not loaded. Loading from CDN...");
            await loadFirebaseSDK();
        }
        
        // Initialize Firebase
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firestoreDb = firebase.firestore();
        firebaseInitialized = true;
        
        // Enable offline persistence
        firestoreDb.enablePersistence()
            .then(() => {
                console.log("Firebase persistence enabled");
            })
            .catch((err) => {
                console.warn("Firebase persistence error:", err);
            });
            
        console.log("Firebase initialized successfully");
        return true;
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        firebaseInitialized = false;
        return false;
    }
}

function loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
        // Load Firebase SDK dynamically
        const firebaseScript = document.createElement('script');
        firebaseScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
        firebaseScript.onload = () => {
            const firestoreScript = document.createElement('script');
            firestoreScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js';
            firestoreScript.onload = resolve;
            firestoreScript.onerror = reject;
            document.head.appendChild(firestoreScript);
        };
        firebaseScript.onerror = reject;
        document.head.appendChild(firebaseScript);
    });
}

// Collection names
const FIREBASE_COLLECTIONS = {
    SUBJECTS: 'subjects',
    CLASSES: 'classes',
    STUDENTS: 'students',
    TASKS: 'tasks',
    SCORES: 'scores',
    ATTENDANCE: 'attendance',
    MATERIALS: 'materials',
    SUBMISSIONS: 'submissions',
    RETURNS: 'returns',
    SCHEDULES: 'schedules',
    METADATA: 'metadata'
};