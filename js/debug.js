// Firebase debug utilities
async function debugFirebase() {
    console.group("Firebase Debug Info");
    
    console.log("Firebase Initialized:", firebaseInitialized);
    console.log("Firebase App:", firebaseApp ? "Yes" : "No");
    console.log("Firestore DB:", firestoreDb ? "Yes" : "No");
    
    if (firebaseInitialized) {
        try {
            // Test connection
            const testDoc = await firestoreDb.collection('test').doc('connection').get();
            console.log("Firebase Connection:", testDoc.exists ? "Connected" : "Connected but no test doc");
            
            // Show cache stats
            const metadataSnapshot = await firestoreDb.collection('metadata').get();
            console.log("Cache Metadata:");
            metadataSnapshot.forEach(doc => {
                console.log(`  ${doc.id}:`, doc.data());
            });
            
            // Show collection counts
            const collections = Object.values(FIREBASE_COLLECTIONS);
            for (const collectionName of collections) {
                try {
                    const snapshot = await firestoreDb.collection(collectionName).get();
                    console.log(`${collectionName}: ${snapshot.size} documents`);
                } catch (err) {
                    console.log(`${collectionName}: Error - ${err.message}`);
                }
            }
        } catch (error) {
            console.error("Firebase Debug Error:", error);
        }
    }
    
    console.groupEnd();
    
    // Show in UI for easy debugging
    showToast("Debug info logged to console", "bg-blue-600");
}

// Performance testing
async function testPerformance() {
    console.group("Performance Test");
    
    // Test Firebase cache speed
    if (firebaseInitialized) {
        const startFirebase = performance.now();
        await firebaseManager.loadFromFirebase('students');
        const endFirebase = performance.now();
        console.log(`Firebase load: ${(endFirebase - startFirebase).toFixed(2)}ms`);
    }
    
    // Test Google Sheet speed
    const startGoogle = performance.now();
    try {
        await fetch(GOOGLE_SCRIPT_URL + "?action=getData&t=" + Date.now());
    } catch (e) {}
    const endGoogle = performance.now();
    console.log(`Google Sheet load: ${(endGoogle - startGoogle).toFixed(2)}ms`);
    
    console.groupEnd();
}

// Add to window for debugging
window.debugFirebase = debugFirebase;
window.testPerformance = testPerformance;
window.forceRefreshCache = forceRefreshCache;