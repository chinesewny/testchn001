// Firebase Fallback Strategy
class FirebaseFallback {
    constructor() {
        this.useFirebase = true;
        this.fallbackMode = false;
        this.quotaErrors = 0;
        this.maxQuotaErrors = 3;
    }
    
    // Check if we should use Firebase
    shouldUseFirebase() {
        if (!firebaseInitialized) return false;
        if (this.fallbackMode) return false;
        if (this.quotaErrors >= this.maxQuotaErrors) {
            console.log("Too many quota errors, disabling Firebase");
            this.fallbackMode = true;
            return false;
        }
        return true;
    }
    
    // Handle quota errors
    handleQuotaError() {
        this.quotaErrors++;
        console.warn(`Quota error #${this.quotaErrors}`);
        
        if (this.quotaErrors >= this.maxQuotaErrors) {
            this.fallbackMode = true;
            updateSyncUI('Online (No Cache)', 'yellow');
            showToast("Using fallback mode due to quota limits", "bg-yellow-600");
        }
    }
    
    // Reset quota errors (e.g., after successful sync)
    resetQuotaErrors() {
        if (this.quotaErrors > 0) {
            console.log(`Resetting quota errors (was ${this.quotaErrors})`);
            this.quotaErrors = 0;
            this.fallbackMode = false;
        }
    }
    
    // Get status
    getStatus() {
        return {
            useFirebase: this.shouldUseFirebase(),
            fallbackMode: this.fallbackMode,
            quotaErrors: this.quotaErrors,
            firebaseInitialized: firebaseInitialized
        };
    }
}

const firebaseFallback = new FirebaseFallback();

// Update the updateSyncUI function in data.js
function updateSyncUI(text, color) {
    const statusElements = document.querySelectorAll('#sync-status, #sync-status-scan');
    
    // Add fallback indicator
    let statusText = text;
    if (firebaseFallback.fallbackMode) {
        statusText = text + " (No Cache)";
    }
    
    statusElements.forEach(element => {
        if (element) {
            element.textContent = " " + statusText;
        }
    });
    
    const statusIcon = document.querySelector('.fa-wifi');
    if(statusIcon) {
        if (firebaseFallback.fallbackMode) {
            statusIcon.className = "fa-solid fa-wifi text-yellow-400";
            statusIcon.parentElement.className = `text-xs text-yellow-400 font-bold transition-all`;
        } else {
            statusIcon.className = color === 'green' ? "fa-solid fa-wifi" : "fa-solid fa-wifi text-red-400 animate-pulse";
            statusIcon.parentElement.className = `text-xs text-${color}-400 font-bold transition-all`;
        }
    }
}
