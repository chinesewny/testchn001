// Firebase Data Operations - Optimized for quota
class FirebaseManager {
    constructor() {
        this.lastSyncTime = null;
        this.cacheExpiry = 10 * 60 * 1000; // 10 minutes cache (เพิ่มขึ้น)
        this.isSyncing = false;
        this.requestDelay = 2000; // Delay between requests to reduce quota
        this.lastRequestTime = 0;
    }
    
    // Add delay to prevent quota exceeded
    async withRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.requestDelay) {
            await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
        }
        
        this.lastRequestTime = Date.now();
    }
    
    // Initialize Firebase
    async init() {
        if (!firebaseInitialized) {
            return await initializeFirebase();
        }
        return true;
    }
    
    // Save data to Firebase (cache) - เซฟเฉพาะข้อมูลสำคัญ
    async saveToFirebase(dataType, data) {
        if (!firebaseInitialized) return false;
        
        try {
            await this.withRateLimit();
            
            const collection = firestoreDb.collection(FIREBASE_COLLECTIONS[dataType.toUpperCase()]);
            
            // Save only first 50 items if array is too large
            const itemsToSave = data.length > 50 ? data.slice(0, 50) : data;
            
            const batch = firestoreDb.batch();
            
            itemsToSave.forEach(item => {
                const docRef = collection.doc(String(item.id));
                batch.set(docRef, item, { merge: true });
            });
            
            await batch.commit();
            
            // Update metadata with simplified data
            await this.updateCacheStatus(dataType, itemsToSave.length);
            
            console.log(`Data saved to Firebase: ${dataType} (${itemsToSave.length} items)`);
            return true;
        } catch (error) {
            console.warn(`Error saving to Firebase (${dataType}):`, error.message);
            return false;
        }
    }
    
    // Load data from Firebase (cache)
    async loadFromFirebase(dataType) {
        if (!firebaseInitialized) return null;
        
        try {
            await this.withRateLimit();
            
            const collection = firestoreDb.collection(FIREBASE_COLLECTIONS[dataType.toUpperCase()]);
            
            // Use limit to reduce quota
            const snapshot = await collection.limit(100).get();
            
            const data = [];
            snapshot.forEach(doc => {
                data.push(doc.data());
            });
            
            console.log(`Data loaded from Firebase: ${dataType} (${data.length} items)`);
            return data;
        } catch (error) {
            console.warn(`Error loading from Firebase (${dataType}):`, error.message);
            return null;
        }
    }
    
    // Check if cache is valid - ใช้วิธีง่ายๆ
    async isCacheValid(dataType) {
        if (!firebaseInitialized) return false;
        
        try {
            await this.withRateLimit();
            
            const statusDoc = await firestoreDb
                .collection(FIREBASE_COLLECTIONS.CACHE_STATUS)
                .doc(dataType)
                .get();
                
            if (!statusDoc.exists) return false;
            
            const status = statusDoc.data();
            const lastSync = status.lastSync || 0;
            const now = Date.now();
            
            // Check if cache is less than expiry time
            return (now - lastSync) < this.cacheExpiry;
        } catch (error) {
            console.warn("Error checking cache validity:", error.message);
            return false;
        }
    }
    
    // Update cache status - ข้อมูลน้อยลง
    async updateCacheStatus(dataType, itemCount = 0) {
        if (!firebaseInitialized) return;
        
        try {
            await this.withRateLimit();
            
            await firestoreDb
                .collection(FIREBASE_COLLECTIONS.CACHE_STATUS)
                .doc(dataType)
                .set({
                    lastSync: Date.now(),
                    itemCount: itemCount,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
        } catch (error) {
            console.warn("Error updating cache status:", error.message);
        }
    }
    
    // Load all data from Firebase - โหลดเฉพาะที่จำเป็น
    async loadAllData() {
        if (!firebaseInitialized) {
            console.log("Firebase not initialized, skipping cache");
            return null;
        }
        
        const allData = {};
        const essentialTypes = ['subjects', 'classes', 'students', 'tasks', 'scores'];
        let hasValidCache = false;
        
        for (const dataType of essentialTypes) {
            try {
                const isValid = await this.isCacheValid(dataType);
                
                if (isValid) {
                    const data = await this.loadFromFirebase(dataType);
                    if (data && data.length > 0) {
                        allData[dataType] = data;
                        hasValidCache = true;
                    }
                } else {
                    console.log(`Cache for ${dataType} is expired`);
                }
            } catch (error) {
                console.warn(`Error loading ${dataType}:`, error.message);
            }
        }
        
        // Return null if no valid cache found
        if (!hasValidCache) {
            return null;
        }
        
        return allData;
    }
    
    // Save all data to Firebase - เซฟเฉพาะข้อมูลหลัก
    async saveAllData(dataState) {
        if (!firebaseInitialized) return false;
        
        try {
            const essentialTypes = ['subjects', 'classes', 'students', 'tasks', 'scores'];
            const savePromises = [];
            
            for (const key of essentialTypes) {
                if (dataState[key] && Array.isArray(dataState[key]) && dataState[key].length > 0) {
                    savePromises.push(this.saveToFirebase(key, dataState[key]));
                }
            }
            
            // Execute with delay between each
            for (const promise of savePromises) {
                await promise;
                await new Promise(resolve => setTimeout(resolve, 500)); // Add delay
            }
            
            this.lastSyncTime = Date.now();
            
            console.log("Essential data saved to Firebase cache");
            return true;
        } catch (error) {
            console.warn("Error saving data to Firebase:", error.message);
            return false;
        }
    }
    
    // Clear cache (เฉพาะเมื่อจำเป็น)
    async clearCache() {
        if (!firebaseInitialized) return false;
        
        try {
            // Clear only essential collections
            const essentialCollections = [
                FIREBASE_COLLECTIONS.SUBJECTS,
                FIREBASE_COLLECTIONS.CLASSES,
                FIREBASE_COLLECTIONS.STUDENTS,
                FIREBASE_COLLECTIONS.TASKS,
                FIREBASE_COLLECTIONS.SCORES,
                FIREBASE_COLLECTIONS.CACHE_STATUS
            ];
            
            for (const collectionName of essentialCollections) {
                try {
                    await this.withRateLimit();
                    const snapshot = await firestoreDb.collection(collectionName).get();
                    const batch = firestoreDb.batch();
                    
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    
                    if (snapshot.size > 0) {
                        await batch.commit();
                        console.log(`Cleared ${collectionName}: ${snapshot.size} docs`);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to prevent quota
                } catch (error) {
                    console.warn(`Error clearing ${collectionName}:`, error.message);
                }
            }
            
            console.log("Cache cleared (essential collections only)");
            return true;
        } catch (error) {
            console.warn("Error clearing cache:", error.message);
            return false;
        }
    }
}

// Create singleton instance
const firebaseManager = new FirebaseManager();
