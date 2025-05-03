// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAFdtlbEK5-SHtSDP_yCHwzIwYHR8Bns4c",
    authDomain: "bkp3-ai.firebaseapp.com",
    projectId: "bkp3-ai",
    storageBucket: "bkp3-ai.appspot.com",
    messagingSenderId: "34824408221",
    appId: "1:34824408221:web:ba6e55cf52afa7b557d874",
    measurementId: "G-RP3GTBZP3Y"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore(); 