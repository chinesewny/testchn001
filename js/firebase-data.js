// Firebase Data Operations
class FirebaseManager {
    constructor() {
        this.lastSyncTime = null;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
        this.isSyncing = false;
    }
    
    // Initialize Firebase
    async init() {
        if (!firebaseInitialized) {
            return await initializeFirebase();
        }
        return true;
    }
    
    // Save data to Firebase (cache)
    async saveToFirebase(dataType, data) {
        if (!firebaseInitialized) return false;
        
        try {
            const collection = firestoreDb.collection(FIREBASE_COLLECTIONS[dataType.toUpperCase()]);
            
            // Convert array to batch write
            const batch = firestoreDb.batch();
            
            data.forEach(item => {
                const docRef = collection.doc(String(item.id));
                batch.set(docRef, item, { merge: true });
            });
            
            await batch.commit();
            
            // Update metadata
            await this.updateSyncMetadata(dataType);
            
            console.log(`Data saved to Firebase: ${dataType} (${data.length} items)`);
            return true;
        } catch (error) {
            console.error(`Error saving to Firebase (${dataType}):`, error);
            return false;
        }
    }
    
    // Load data from Firebase (cache)
    async loadFromFirebase(dataType) {
        if (!firebaseInitialized) return null;
        
        try {
            const collection = firestoreDb.collection(FIREBASE_COLLECTIONS[dataType.toUpperCase()]);
            const snapshot = await collection.get();
            
            const data = [];
            snapshot.forEach(doc => {
                data.push(doc.data());
            });
            
            console.log(`Data loaded from Firebase: ${dataType} (${data.length} items)`);
            return data;
        } catch (error) {
            console.error(`Error loading from Firebase (${dataType}):`, error);
            return null;
        }
    }
    
    // Check if cache is valid
    async isCacheValid(dataType) {
        if (!firebaseInitialized) return false;
        
        try {
            const metadataDoc = await firestoreDb
                .collection(FIREBASE_COLLECTIONS.METADATA)
                .doc(dataType)
                .get();
                
            if (!metadataDoc.exists) return false;
            
            const metadata = metadataDoc.data();
            const lastSync = metadata.lastSync;
            const now = Date.now();
            
            return (now - lastSync) < this.cacheExpiry;
        } catch (error) {
            console.error("Error checking cache validity:", error);
            return false;
        }
    }
    
    // Update sync metadata
    async updateSyncMetadata(dataType) {
        if (!firebaseInitialized) return;
        
        try {
            await firestoreDb
                .collection(FIREBASE_COLLECTIONS.METADATA)
                .doc(dataType)
                .set({
                    lastSync: Date.now(),
                    syncCount: firebase.firestore.FieldValue.increment(1)
                }, { merge: true });
        } catch (error) {
            console.error("Error updating sync metadata:", error);
        }
    }
    
    // Load all data from Firebase (with cache check)
    async loadAllData() {
        if (!firebaseInitialized) {
            console.log("Firebase not initialized, skipping cache");
            return null;
        }
        
        const allData = {};
        const dataTypes = Object.keys(FIREBASE_COLLECTIONS)
            .filter(key => key !== 'METADATA');
        
        for (const type of dataTypes) {
            const dataType = type.toLowerCase();
            
            // Check if cache is valid
            const isValid = await this.isCacheValid(dataType);
            
            if (isValid) {
                const data = await this.loadFromFirebase(dataType);
                if (data) {
                    allData[dataType] = data;
                }
            } else {
                console.log(`Cache for ${dataType} is expired or invalid`);
            }
        }
        
        // Return null if no valid cache found
        if (Object.keys(allData).length === 0) {
            return null;
        }
        
        return allData;
    }
    
    // Save all data to Firebase
    async saveAllData(dataState) {
        if (!firebaseInitialized) return false;
        
        try {
            const savePromises = [];
            
            for (const [key, data] of Object.entries(dataState)) {
                if (Array.isArray(data) && data.length > 0) {
                    savePromises.push(this.saveToFirebase(key, data));
                }
            }
            
            await Promise.all(savePromises);
            this.lastSyncTime = Date.now();
            
            console.log("All data saved to Firebase cache");
            return true;
        } catch (error) {
            console.error("Error saving all data to Firebase:", error);
            return false;
        }
    }
    
    // Listen for real-time updates (optional)
    setupRealtimeListener(dataType, callback) {
        if (!firebaseInitialized) return () => {};
        
        const collection = firestoreDb.collection(FIREBASE_COLLECTIONS[dataType.toUpperCase()]);
        
        const unsubscribe = collection.onSnapshot((snapshot) => {
            const data = [];
            snapshot.forEach(doc => {
                data.push(doc.data());
            });
            
            callback(data);
        }, (error) => {
            console.error(`Realtime listener error (${dataType}):`, error);
        });
        
        return unsubscribe;
    }
    
    // Clear cache (for debugging)
    async clearCache() {
        if (!firebaseInitialized) return false;
        
        try {
            const collections = Object.values(FIREBASE_COLLECTIONS);
            const batch = firestoreDb.batch();
            
            for (const collectionName of collections) {
                const snapshot = await firestoreDb.collection(collectionName).get();
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }
            
            await batch.commit();
            console.log("Firebase cache cleared");
            return true;
        } catch (error) {
            console.error("Error clearing cache:", error);
            return false;
        }
    }
}

// Create singleton instance
const firebaseManager = new FirebaseManager();