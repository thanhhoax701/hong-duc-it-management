// ============================================================
// HỒNG ĐỨC IT MANAGEMENT - FIREBASE CONFIG
// ============================================================
// 1. Firebase Console -> Project settings -> Your apps -> Web app
// 2. Copy firebaseConfig vào bên dưới.
// 3. Không đặt private key/service account vào file này.
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAidVqaMbr4byYZFpDc_tBCFga4MPYm7Tc",
  authDomain: "hong-duc-it-management.firebaseapp.com",
  projectId: "hong-duc-it-management",
  storageBucket: "hong-duc-it-management.firebasestorage.app",
  messagingSenderId: "275364368590",
  appId: "1:275364368590:web:13d06d715fb77f0f41c09f",
  measurementId: "G-5K4TYGJ1V8"
};

// true = có thể xem giao diện demo khi chưa cấu hình Firebase.
// Khi triển khai thật, đổi thành false để bắt buộc Firebase.
export const DEMO_MODE = false;
