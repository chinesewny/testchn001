// Configuration and Constants
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwQNjMSE06u5xO4dtyipa5P-YzoaicppubdwlUgMpaX4L4TUjk3-xY2PRnzhS42AxZe/exec";

const PERIODS = [
    { p: 1, start: "08:30", end: "09:20" },
    { p: 2, start: "09:20", end: "10:10" },
    { p: 3, start: "10:10", end: "11:00" },
    { p: 4, start: "11:00", end: "11:50" },
    { p: 5, start: "11:50", end: "12:40" },
    { p: 6, start: "12:40", end: "13:30" },
    { p: 7, start: "13:30", end: "14:20" },
    { p: 8, start: "14:20", end: "15:10" }
];

// Global State
let dataState = { 
    subjects: [], 
    classes: [], 
    students: [], 
    tasks: [], 
    scores: [], 
    attendance: [], 
    materials: [], 
    submissions: [], 
    returns: [], 
    schedules: [] 
};

let scoreMode = 'manual';
let attMode = null;
let pendingScore = null;
let smartClassId = null;
let currentConfig = [];
let tempConfig = [];

// Queue System
let requestQueue = [];
let isProcessingQueue = false;