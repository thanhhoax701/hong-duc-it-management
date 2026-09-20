// ============================================================
// HỒNG ĐỨC IT MANAGEMENT - FIREBASE CONFIG
// ============================================================
// 1. Firebase Console -> Project settings -> Your apps -> Web app
// 2. Copy firebaseConfig vào bên dưới.
// 3. Không đặt private key/service account vào file này.
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAIQDSC6zAVhIV6DiRpT_ElqmEOdM6df3M",
  authDomain: "hong-duc-it-management-fe602.firebaseapp.com",
  databaseURL: "https://hong-duc-it-management-fe602-default-rtdb.firebaseio.com",
  projectId: "hong-duc-it-management-fe602",
  storageBucket: "hong-duc-it-management-fe602.firebasestorage.app",
  messagingSenderId: "422204071723",
  appId: "1:422204071723:web:05e94d619b05d7bc69ef6e",
  measurementId: "G-SHCGD6ZBKE"
};

// true = có thể xem giao diện demo khi chưa cấu hình Firebase.
// Khi triển khai thật, đổi thành false để bắt buộc Firebase.
export const DEMO_MODE = false;
