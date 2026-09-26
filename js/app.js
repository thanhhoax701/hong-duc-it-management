import { firebaseConfig, DEMO_MODE } from "./firebase-config.js";
import { IT_CATALOG } from "./it-catalog.js";

const FBASE = "https://www.gstatic.com/firebasejs/10.12.5";
let firebaseReady = false, auth = null, db = null;
let firebaseApp = null;
let user = null;
let state = { page: "hardware", tickets: [], assets: [], departments: [], employees: [], maintenance: [], storeVisits: [], ticketHistory: [], comments: [], notifications: [], approvals: [], backups: [], uptime: [], audit: [], search: "", ticketType: "", ticketPriority: "", employeePage: 1, listPages: {}, systemFocus: "", systemLevel: "all", systemQuery: "", systemRequestStatus: "" };
const EMPLOYEE_PAGE_SIZE = 50;
const LIST_PAGE_SIZE = 20;
let currentRole = "requester";
let currentDepartment = "";
let unsubscribers = [];

function paginateList(listKey, items, pageSize = LIST_PAGE_SIZE, itemLabel = "dòng") {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(1, Math.min(state.listPages[listKey] || 1, totalPages));
  state.listPages[listKey] = page;
  const startIndex = (page - 1) * pageSize;
  const firstVisiblePage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstVisiblePage + index);
  const pagination = items.length ? `<div class="employee-pagination"><div class="employee-pagination-summary"><strong>${startIndex + 1}–${Math.min(startIndex + pageSize, items.length)}</strong><span>trên ${items.length} ${itemLabel}</span></div><nav class="employee-pagination-controls" aria-label="Phân trang"><button type="button" class="employee-page-button" data-list-page="${listKey}" data-page-action="first" data-total-pages="${totalPages}" title="Trang đầu" aria-label="Trang đầu" ${page === 1 ? "disabled" : ""}>≪</button><button type="button" class="employee-page-button" data-list-page="${listKey}" data-page-action="prev" data-total-pages="${totalPages}" title="Trang trước" aria-label="Trang trước" ${page === 1 ? "disabled" : ""}>‹</button>${visiblePages.map(number => `<button type="button" class="employee-page-button${number === page ? " active" : ""}" data-list-page="${listKey}" data-page-action="${number}" data-total-pages="${totalPages}" aria-label="Trang ${number}" ${number === page ? 'aria-current="page"' : ""}>${number}</button>`).join("")}<button type="button" class="employee-page-button" data-list-page="${listKey}" data-page-action="next" data-total-pages="${totalPages}" title="Trang sau" aria-label="Trang sau" ${page === totalPages ? "disabled" : ""}>›</button><button type="button" class="employee-page-button" data-list-page="${listKey}" data-page-action="last" data-total-pages="${totalPages}" title="Trang cuối" aria-label="Trang cuối" ${page === totalPages ? "disabled" : ""}>≫</button></nav></div>` : "";
  return { items: items.slice(startIndex, startIndex + pageSize), page, totalPages, pagination };
}

const hardwareSteps = [
  ["Yêu cầu", "Tiếp nhận yêu cầu phần cứng"],
  ["Kiểm tra / giao việc", "Kiểm tra hiện trạng, phân công"],
  ["Đề xuất / xử lý", "Đề xuất phương án, xử lý"],
  ["Mua sắm CCDC", "Mua linh kiện / thiết bị"],
  ["Bàn giao", "Bàn giao, ghi nhận tình trạng"]
];
const systemSteps = [
  ["Giám sát / vận hành", "Máy chủ, mạng, firewall, camera, BRAVO, ZNS, ứng dụng"],
  ["Kiểm soát / phân quyền", "Log, tài khoản, phân quyền"],
  ["Phát triển / tích hợp", "Tiếp nhận nghiệp vụ, điều chỉnh, kiểm thử"],
  ["Tối ưu / bảo trì", "Tinh chỉnh dữ liệu, bảo trì máy chủ, ảo hóa"],
  ["Sao lưu / dự phòng", "Backup dữ liệu, hệ thống HA dự phòng"]
];
const serverSteps = [
  ["Server", "Trạng thái, service, restart, thay linh kiện"],
  ["Mạng", "IP, VLAN, routing, Wi-Fi, port, redundancy"],
  ["Firewall", "Policy, NAT, VPN, IDS/IPS, kiểm soát truy cập"],
  ["Storage / Backup", "RAID, NAS/SAN, snapshot, phục hồi dữ liệu"],
  ["Bảo trì / HA", "Giám sát, backup định kỳ, failover"]
];
const systemCatalog = [
  { id: "camera", icon: "📹", label: "Camera", group: "HỆ THỐNG", basic: "Lắp/thay camera; cấu hình IP; kiểm tra PoE; kiểm tra camera mất kết nối; thay disk NVR", advanced: "Thiết kế CCTV; tính storage; VMS/NVR; camera network; phân quyền; retention; mở rộng hệ thống" },
  { id: "phone-system", icon: "☎", label: "Tổng đài", group: "HỆ THỐNG", basic: "Cấu hình IP Phone; tạo extension; thay máy; kiểm tra cuộc gọi; xử lý lỗi đơn giản", advanced: "Thiết kế IP-PBX; SIP Trunk; IVR; Queue; Recording; VoIP VLAN; integration" },
  { id: "storage-backup", icon: "💾", label: "Storage / Backup", group: "HỆ THỐNG", basic: "Kiểm tra dung lượng; thay disk; kiểm tra backup job; thực hiện restore", advanced: "Thiết kế storage; RAID; NAS/SAN; snapshot; replication; backup strategy; DR; restore toàn hệ thống" }
];

const hardwareCatalog = [
  { id: "device", label: "Thiết bị", group: "Danh mục chung", basic: "Theo dõi thiết bị, trạng thái, vị trí, kiểm tra hoạt động cơ bản", advanced: "Quản lý tài sản, nâng cấp, bảo trì, phân bổ theo đơn vị" },
  { id: "rack", label: "Rack", group: "Vật tư hạ tầng", basic: "Patch dây, thay thiết bị, kiểm tra đèn / trạng thái, vệ sinh, tag label", advanced: "Thiết kế rack, power, cooling, capacity, redundancy, quy hoạch server room" },
  { id: "basic-network", label: "Mạng cơ bản", group: "Cơ sở hạ tầng", basic: "Bấm dây, thay dây, tag label, bootcolor, kiểm tra kết nối", advanced: "Thiết kế hệ thống cáp, fiber, patch panel, rack, SFP, cable infrastructure" },
  { id: "projector", label: "TV / Máy chiếu", group: "Trình chiếu", basic: "Kết nối HDMI, setup TV, trình chiếu, xử lý cơ bản", advanced: "Quản lý tập trung, ứng dụng trong họp / trình chiếu" },
  { id: "printer", label: "Máy in", group: "In ấn", basic: "Cài driver, add printer, xử lý queue, thay toner, xử lý paper jam", advanced: "Triển khai hệ thống in Wi‑Fi, quản lý in tập trung" },
  { id: "phone", label: "Điện thoại", group: "Thiết bị di động", basic: "Setup điện thoại, IP Phone, Analog, thay thiết bị, kiểm tra kết nối", advanced: "VoIP, SIP, IMS, quản lý thiết bị tập trung, tích hợp hệ thống" },
  { id: "pc", label: "PC / Laptop", group: "Thiết bị đầu cuối", basic: "Cài OS, phần mềm, setup máy mới, thay RAM/SSD, xử lý phần cứng/thường gặp", advanced: "Xử lý lỗi phần cứng, chuẩn hóa cấu hình, triển khai image, quản lý thiết bị tập trung" },
  { id: "attendance", label: "Máy chấm công", group: "Kiểm soát ra vào", basic: "Tạo user, đăng ký vân tay/khuôn mặt, đồng bộ, xử lý kết nối", advanced: "Quản lý máy, tích hợp API, database, đồng bộ hệ thống" },
  { id: "ups", label: "UPS / Power", group: "Nguồn điện", basic: "Kiểm tra trạng thái, kiểm tra pin, thay battery, xử lý lỗi cơ bản", advanced: "Tính toán thiết kế UPS, kế hoạch nguồn dự phòng" },
  { id: "camera", label: "Camera", group: "Hệ thống", basic: "Lắp/thay camera, cài đặt IP, kiểm tra PoE, kiểm tra camera mất kết nối, thay disk NVR", advanced: "Thiết kế CCTV, storage, VMS/NVR, camera network, retention, phân quyền" },
  { id: "voip", label: "Tổng đài", group: "Hệ thống", basic: "Cấu hình IP Phone, extension, thay máy, kiểm tra cuộc gọi, sửa lỗi đơn giản", advanced: "Thiết kế IP-PBX, SIP Trunk, IVR, Queue, Recording, VoIP VLAN, integration" },
  { id: "storage", label: "Storage / Backup", group: "Hệ thống", basic: "Kiểm tra dung lượng, thay disk, kiểm tra backup job, thực hiện restore", advanced: "Thiết kế storage, RAID, NAS/SAN, snapshot, replication, backup strategy, DR" },
  { id: "firewall", label: "Firewall", group: "Máy chủ", basic: "Kiểm tra trạng thái, kiểm tra rule cơ bản, mở port theo yêu cầu, kiểm tra kết nối", advanced: "Thiết kế policy, NAT, VPN, IDS/IPS, phân tích traffic, xử lý sự cố bảo mật" },
  { id: "network", label: "Mạng", group: "Máy chủ", basic: "Bấm/thay dây mạng, kiểm tra port, thay thiết bị, kiểm tra IP / Wi‑Fi", advanced: "Thiết kế LAN/WAN, VLAN, routing, VPN, Wi‑Fi system, redundancy, phân tích lỗi" },
  { id: "server", label: "Server", group: "Máy chủ", basic: "Kiểm tra trạng thái, restart service, thay linh kiện, cài OS theo tài liệu, kiểm tra log cơ bản", advanced: "Thiết kế/ci/hành server, AD/DNS/DHCP, virtualization, cluster, migration, HA, xử lý sự cố" }
];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
const nowText = () => new Date().toLocaleString("vi-VN");
const uid = () => Math.random().toString(36).slice(2, 10);

function actorName() { return user?.email || user?.displayName || "demo" }
function isItEmail(email = user?.email || "") { return /^it(?:[+@])/i.test(String(email).trim()) }
function canManage() { return ["admin", "it"].includes(String(currentRole).toLowerCase()) || isItEmail() }
async function notify(recipient, title, message, ticketId = "", type = "workflow") {
  if (!recipient) return;
  try { await addDoc("notifications", { recipient, title, message, ticketId, targetId: ticketId, type, read: false, createdAt: Date.now(), createdAtText: nowText() }) } catch (error) { console.warn("Không tạo được thông báo", error) }
}
function maintenanceStatus(row) {
  if (row.status !== "Hoàn tất" && row.status !== "Hủy" && row.dueDate && row.dueDate < new Date().toISOString().slice(0, 10)) return "Quá hạn";
  return row.status || "Đã lên lịch";
}
function checkDueNotifications() {
  if (!canManage()) return;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  state.maintenance.filter(row => row.status !== "Hoàn tất" && row.status !== "Hủy" && row.dueDate && row.dueDate <= tomorrow).forEach(row => {
    const exists = state.notifications.some(item => item.type === "maintenance-due" && item.targetId === row.id && item.read === false);
    if (!exists) notify(actorName(), "Bảo trì sắp đến hạn", `${row.title} • hạn ${row.dueDate}`, row.id).then(() => {});
  });
}

async function loadUserRole(fs) {
  currentRole = "requester";
  currentDepartment = "";
  if (!user) return;
  try {
    const token = await user.getIdTokenResult();
    currentRole = token.claims.role || "";
    if (!currentRole) {
      const profile = await fs.getDoc(fs.doc(db, "users", user.uid));
      if (profile.exists()) { currentRole = profile.data().role || "requester"; currentDepartment = profile.data().department || ""; }
    } else {
      const profile = await fs.getDoc(fs.doc(db, "users", user.uid));
      if (profile.exists()) currentDepartment = profile.data().department || "";
    }
    if (!currentRole || currentRole === "requester") currentRole = isItEmail() ? "it" : "requester";
  } catch (error) { console.warn("Không đọc được vai trò người dùng", error); if (isItEmail()) currentRole = "it" }
}

async function loadFirebase() {
  if (DEMO_MODE) {
    firebaseReady = false;
    seedDemo();
    showApp();
    return;
  }
  const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("DAN_") && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("DAN_");
  if (!configured) {
    $("#loginScreen").classList.remove("hidden"); return;
  }
  try {
    const appMod = await import(`${FBASE}/firebase-app.js`);
    const authMod = await import(`${FBASE}/firebase-auth.js`);
    const fsMod = await import(`${FBASE}/firebase-firestore.js`);
    const app = appMod.initializeApp(firebaseConfig);
    firebaseApp = app;
    auth = authMod.getAuth(app); db = fsMod.getFirestore(app);
    firebaseReady = true;
    authMod.onAuthStateChanged(auth, u => {
      user = u;
      if (u) { loadUserRole(fsMod).then(() => { showApp(); subscribeData(fsMod) }); }
      else { $("#appShell").classList.add("hidden"); $("#loginScreen").classList.remove("hidden"); }
    });
  } catch (e) {
    console.error(e);
    toast("Không khởi tạo được Firebase: " + e.message, "error");
    $("#appShell").classList.add("hidden");
    $("#loginScreen").classList.remove("hidden");
    if (DEMO_MODE) { seedDemo(); showApp() }
  }
}

function seedDemo() {
  if (state.tickets.length) return;
  state.tickets = [
    { id: "HDIT-0001", type: "system", priority: "Cao", title: "NVR HĐ 4 KHO XE mất ghi hình", department: "Kho xe", requester: "Bộ phận vận hành", assignee: "IT Admin", systemName: "NVR / Camera", description: "Kiểm tra tình trạng lưu trữ và camera.", step: 2, status: "Đang xử lý", createdAt: Date.now() - 86400000 * 2, createdAtText: new Date(Date.now() - 86400000 * 2).toLocaleString("vi-VN") },
    { id: "HDIT-0002", type: "hardware", priority: "Trung bình", title: "Thay SSD máy tính phòng Kế toán", department: "Kế toán", requester: "Nguyễn Văn A", assignee: "IT Admin", systemName: "PC", description: "SSD hiện tại báo sức khỏe thấp.", step: 3, status: "Đang xử lý", createdAt: Date.now() - 86400000, createdAtText: new Date(Date.now() - 86400000).toLocaleString("vi-VN") },
    { id: "HDIT-0003", type: "hardware", priority: "Thấp", title: "Bổ sung màn hình cho phòng Dịch vụ", department: "Dịch vụ", requester: "Phòng Dịch vụ", assignee: "IT Admin", systemName: "Monitor", description: "Yêu cầu bổ sung thiết bị.", step: 5, status: "Hoàn tất", createdAt: Date.now() - 86400000 * 5, createdAtText: new Date(Date.now() - 86400000 * 5).toLocaleString("vi-VN") }
  ];
  state.assets = [{ id: "a1", code: "TS-IT-0001", name: "Router Vigor 2927F", category: "Thiết bị mạng", serial: "", location: "Phòng IT", department: "IT", owner: "IT", status: "Đang sử dụng", purchaseDate: "" }];
  state.departments = [{ id: "d1", name: "IT", code: "IT", manager: "IT Admin" }, { id: "d2", name: "Dịch vụ", code: "DV", manager: "" }, { id: "d3", name: "Kế toán", code: "KT", manager: "" }, { id: "d4", name: "Kinh doanh", code: "KD", manager: "" }];
  state.employees = [
    { id: "e1", employeeCode: "NV-001", name: "IT Admin", workplace: "A01", department: "IT", title: "Quản trị viên", phone: "0900000001", email: "itadmin@hongduc.vn" },
    { id: "e2", employeeCode: "NV-002", name: "Nguyễn Văn A", workplace: "A01", department: "Kinh doanh", title: "Nhân viên", phone: "0900000002", email: "nguyenvana@hongduc.vn" },
    { id: "e3", employeeCode: "NV-003", name: "Trần Thanh Hòa", workplace: "H01", department: "Dịch vụ", title: "Quản lý", phone: "0900000003", email: "tranthanhhoa@hongduc.vn" },
    { id: "e4", employeeCode: "NV-004", name: "Lê Văn Bình", workplace: "H02", department: "Dịch vụ", title: "Nhân viên", phone: "0900000004", email: "levanbinh@hongduc.vn" }
  ];
}

function showApp() {
  $("#loginScreen").classList.add("hidden"); $("#appShell").classList.remove("hidden");
  $("#userName").textContent = user?.displayName || "IT Admin";
  $("#userEmail").textContent = user?.email || (firebaseReady ? "Firebase" : "Chế độ demo");
  $("#userAvatar").textContent = (user?.displayName || "IT").split(" ").slice(-1)[0].slice(0, 2).toUpperCase();
  updateDepartmentsDatalist(); updateEmployeesDatalist(); render();
}

function subscribeData(fs) {
  unsubscribers.forEach(fn => fn()); unsubscribers = [];
  const collections = ["tickets", "assets", "departments", "employees", "maintenance", "storeVisits", "ticketHistory", "comments", "notifications", "approvals", "backups", "uptime", "audit"];
  collections.forEach(name => {
    if (["maintenance", "storeVisits", "audit", "backups", "uptime"].includes(name) && !canManage()) return;
    let q = fs.collection(db, name);
    if (name === "tickets" && currentRole === "requester") q = fs.query(q, fs.where("createdByUid", "==", user.uid));
    else if (name === "tickets" && currentRole === "department_manager") q = fs.query(q, fs.where("department", "==", currentDepartment));
    else if (name === "ticketHistory" && currentRole === "requester") q = fs.query(q, fs.where("createdByUid", "==", user.uid));
    else if (name === "ticketHistory" && currentRole === "department_manager") q = fs.query(q, fs.where("department", "==", currentDepartment));
    else if (name === "notifications" && !canManage()) q = fs.query(q, fs.where("recipient", "==", actorName()));
    else if (!["employees", "departments", "storeVisits"].includes(name)) q = fs.query(q, fs.orderBy("createdAt", "desc"));
    const un = fs.onSnapshot(q, snap => {
      state[name] = snap.docs.map(d => ({ id: d.id, ...d.data() })); updateDepartmentsDatalist(); updateEmployeesDatalist(); render();
    }, err => console.warn(name, err));
    unsubscribers.push(un);
  });
}

function render() {
  checkDueNotifications();
  const pages = {
    hardware: ["Phần cứng", "Yêu cầu → Kiểm tra → Xử lý → Mua sắm → Bàn giao"],
    systems: ["Hệ thống", "Giám sát → Phân quyền → Tích hợp → Bảo trì → Sao lưu"],
    server: ["Máy chủ", "Server → Mạng → Firewall → Backup → HA / Bảo trì"],
    management: ["Quản lý", "Tài sản, bảo trì, lịch đi cửa hàng, đơn vị và nhân viên"],
    tickets: ["Vấn đề / Ticket", "Tiếp nhận, phân công, xử lý và bàn giao"],
    assets: ["Tài sản / CCDC", "Theo dõi thiết bị, vị trí, người sử dụng và tình trạng"],
    maintenance: ["Bảo trì", "Lập lịch và theo dõi bảo trì hệ thống / thiết bị"],
    storeVisits: ["Lịch đi cửa hàng", "Theo dõi lịch xử lý tại các cửa hàng / đơn vị"],
    departments: ["Đơn vị / Phòng ban", "Quản lý đơn vị, người phụ trách và nhu cầu CNTT"],
    employees: ["Danh sách nhân viên", "Tra cứu và cập nhật thông tin nhân viên"],
    reports: ["Báo cáo", "KPI và tình hình xử lý vấn đề"],
    settings: ["Cấu hình", "Firebase, dữ liệu và hướng dẫn triển khai"]
  };
  const [t, sub] = pages[state.page] || pages.hardware;
  const isFocusedModulePage = ["hardware", "systems", "server", "management", "assets", "maintenance", "storeVisits", "departments", "employees"].includes(state.page);
  const appShell = $("#appShell");
  if (appShell) appShell.classList.toggle("focused-module-page", isFocusedModulePage);
  const pageTitle = $("#pageTitle");
  const pageSubtitle = $("#pageSubtitle");
  if (pageTitle) pageTitle.textContent = t;
  if (pageSubtitle) pageSubtitle.textContent = sub;
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === state.page));
  const navOpenCount = $("#navOpenCount");
  if (navOpenCount) navOpenCount.textContent = state.tickets.filter(t => t.step < 5).length;
  const map = { hardware: hardwarePage, systems: systemsPage, server: serverPage, management: managementPage, tickets: ticketsPage, assets: assetsPage, maintenance: maintenancePage, storeVisits: storeVisitsPage, departments: departmentsPage, employees: employeesPage, reports: reportsPage, settings: settingsPage };
  const pageEl = $("#page");
  if (pageEl) pageEl.innerHTML = (map[state.page] || hardwarePage)();
  enhanceDropdowns();
  bindPage();
}

function dashboardPage() {
  const open = state.tickets.filter(t => t.step < 5).length, high = state.tickets.filter(t => t.step < 5 && t.priority === "Cao").length, done = state.tickets.filter(t => t.step === 5).length;
  const hardware = state.tickets.filter(t => t.type === "hardware").length, systems = state.tickets.filter(t => t.type === "system").length, server = state.tickets.filter(t => t.type === "server").length;
  const myNotifications = state.notifications.filter(item => item.recipient === actorName() && !item.read).slice(0, 5);
  return `<div class="hero"><div class="eyebrow">IT OPERATIONS • HỒNG ĐỨC</div><h2>Quản lý vấn đề CNTT<br>từ yêu cầu đến hoàn tất.</h2><p>Một trung tâm để tiếp nhận sự cố, theo dõi phần cứng, quản trị hệ thống, máy chủ, tài sản, bảo trì và sao lưu.</p><div class="hero-actions"><button class="btn btn-primary" data-action="new-ticket">＋ Tạo yêu cầu</button><button class="btn btn-light" data-page-jump="hardware">Xem quy trình phần cứng</button></div></div>
  <div class="stats">
    ${stat("Vấn đề đang mở", open, "Cần theo dõi", "✓")}
    ${stat("Ưu tiên cao", high, "Cần xử lý sớm", "!")}
    ${stat("Tổng tài sản", state.assets.length, "Thiết bị / CCDC", "▤")}
    ${stat("Đã hoàn tất", done, "Phiếu hoàn thành", "✓")}
  </div>
  <div class="grid-2">
    <section class="card"><div class="card-head"><div><h3>Vấn đề gần đây</h3><p>Phiếu mới nhất trên hệ thống</p></div><button class="link-btn" data-page-jump="tickets">Xem tất cả →</button></div>${ticketTable(state.tickets.slice(0, 7))}</section>
    <section class="card"><div class="card-head"><div><h3>Quy trình CNTT</h3><p>Ba quy trình chính</p></div></div><div class="workflow-mini">
      <div class="workflow-item"><div class="workflow-icon">🧰</div><div><b>Phần cứng</b><small>5 bước từ yêu cầu đến bàn giao</small></div><span class="count">${hardware}</span></div>
      <div class="workflow-item"><div class="workflow-icon">⚙️</div><div><b>Quản trị hệ thống</b><small>Vận hành, phân quyền, tích hợp, backup</small></div><span class="count">${systems}</span></div>
      <div class="workflow-item"><div class="workflow-icon">🖥️</div><div><b>Máy chủ</b><small>Server, mạng, firewall, storage, HA</small></div><span class="count">${server}</span></div>
      <div class="workflow-item"><div class="workflow-icon">📦</div><div><b>Tài sản / CCDC</b><small>Quản lý thiết bị CNTT</small></div><span class="count">${state.assets.length}</span></div>
    </div></section>
    <section class="card"><div class="card-head"><div><h3>Thông báo chưa đọc</h3><p>${myNotifications.length} thông báo cần chú ý</p></div></div>${myNotifications.length ? myNotifications.map(item => `<div class="ticket-card"><div>!</div><div class="ticket-main"><b>${esc(item.title)}</b><small>${esc(item.message)} • ${esc(item.createdAtText || "")}</small></div></div>`).join("") : `<div class="empty"><strong>Không có thông báo mới</strong>Mọi việc đang được theo dõi.</div>`}</section>
  </div>`;
}
function stat(label, value, hint, icon) { return `<div class="stat-card"><span class="icon">${icon}</span><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>` }

function quickToolCard({ icon, title, description, action, dataset = {} }) {
  const attrs = Object.entries(dataset).map(([key, value]) => `data-${key}="${esc(value)}"`).join(" ");
  return `<button class="quick-tool" data-action="${esc(action)}" ${attrs}>
    <span class="quick-tool-icon">${icon}</span>
    <span>
      <strong>${esc(title)}</strong>
      <small>${esc(description)}</small>
    </span>
  </button>`;
}

function quickToolGrid(items) {
  return `<div class="tool-grid">${items.map(quickToolCard).join("")}</div>`;
}

function ticketTable(rows) {
  if (!rows.length) return `<div class="empty"><strong>Chưa có phiếu</strong>Hãy tạo yêu cầu đầu tiên.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Vấn đề</th><th>Loại</th><th>Ưu tiên</th><th>Trạng thái</th><th>Bước</th><th></th></tr></thead><tbody>${rows.map(ticketRow).join("")}</tbody></table></div>`;
}
function ticketRow(t) {
  return `<tr data-ticket="${esc(t.id)}"><td><b>${esc(t.id)}</b><small>${esc(t.createdAtText || "")}</small></td><td><b>${esc(t.title)}</b><small>${esc(t.department || "")}</small></td><td>${typeBadge(t.type)}</td><td>${priorityBadge(t.priority)}</td><td>${statusBadge(t.status)}</td><td>${t.step || 1}/5</td><td class="row-actions">${ticketActionButtons(t)}</td></tr>`;
}
function ticketActionButtons(ticket) {
  return `<button class="small-btn icon-action" title="Nhân bản" aria-label="Nhân bản yêu cầu" data-duplicate-ticket="${esc(ticket.id)}">⧉</button><button class="small-btn icon-action" title="Sửa" aria-label="Sửa yêu cầu" data-edit-ticket="${esc(ticket.id)}">✎</button><button class="small-btn icon-action danger" title="Xóa" aria-label="Xóa yêu cầu" data-delete-ticket="${esc(ticket.id)}">×</button>`;
}
function typeBadge(t) {
  const map = {
    hardware: { label: "Phần cứng", class: "badge-orange" },
    system: { label: "Hệ thống", class: "badge-blue" },
    server: { label: "Máy chủ", class: "badge-purple" }
  };
  const item = map[t] || { label: "Khác", class: "badge-gray" };
  return `<span class="badge ${item.class}">${item.label}</span>`;
}
function priorityBadge(p) { return `<span class="badge ${p === "Cao" ? "badge-red" : p === "Trung bình" ? "badge-orange" : "badge-gray"}">${esc(p)}</span>` }
function statusBadge(s) { return `<span class="badge ${s === "Hoàn tất" ? "badge-green" : s === "Đang xử lý" ? "badge-blue" : "badge-gray"}">${esc(s || "Chờ xử lý")}</span>` }

function ticketsPage() {
  const q = state.search.toLowerCase(), rows = state.tickets.filter(t => `${t.id} ${t.title} ${t.department} ${t.systemName}`.toLowerCase().includes(q) && (!state.ticketType || t.type === state.ticketType) && (!state.ticketPriority || t.priority === state.ticketPriority));
  const page = paginateList("tickets", rows, LIST_PAGE_SIZE, "phiếu");
  return `<div class="page-title-row"><div><h2>Danh sách vấn đề</h2><p>${rows.length} phiếu phù hợp</p></div><div class="filters"><select id="ticketType"><option value="">Tất cả loại</option><option value="hardware" ${state.ticketType === "hardware" ? "selected" : ""}>Phần cứng</option><option value="system" ${state.ticketType === "system" ? "selected" : ""}>Hệ thống</option><option value="server" ${state.ticketType === "server" ? "selected" : ""}>Máy chủ</option></select><select id="ticketPriority"><option value="">Tất cả ưu tiên</option><option ${state.ticketPriority === "Cao" ? "selected" : ""}>Cao</option><option ${state.ticketPriority === "Trung bình" ? "selected" : ""}>Trung bình</option><option ${state.ticketPriority === "Thấp" ? "selected" : ""}>Thấp</option></select><button class="btn btn-primary" data-action="new-ticket">＋ Tạo phiếu</button></div></div>
 <div class="card">${ticketTable(page.items)}${page.pagination}</div>`;
}

function workflowPage(type, title, steps) {
  const rows = state.tickets.filter(t => t.type === type);
  const page = paginateList(`workflow-${type}`, rows, LIST_PAGE_SIZE, "phiếu");
  const typeIcon = { hardware: "🧰", system: "⚙️", server: "🖥️" }[type] || "▣";
  const typeLabel = { hardware: "phần cứng", system: "hệ thống", server: "máy chủ" }[type] || "quy trình";
  return `<div class="flow-steps">${steps.map((s, i) => {
    const count = rows.filter(t => (t.step || 1) === i + 1).length;
    return `<div class="flow-step ${count ? "active" : ""} ${i === 0 ? "done" : ""}"><div class="n">${i + 1}</div><b>${esc(s[0])}</b><small>${esc(s[1])}</small><div class="step-count">${count} phiếu</div></div>`
  }).join("")}</div>
 <div class="card"><div class="card-head"><div><h3>${title}</h3><p>Có thể chuyển từng phiếu sang bước tiếp theo.</p></div><button class="btn btn-primary" data-action="new-ticket" data-type="${type}">＋ Tạo yêu cầu</button></div>
 ${page.items.length ? page.items.map(t => `<div class="ticket-card"><div>${typeIcon}</div><div class="ticket-main"><b>${esc(t.title)}</b><small>${esc(t.id)} • ${esc(t.department || "Chưa có đơn vị")} • ${esc(t.assignee || "Chưa phân công")}</small><div class="progress-line" style="margin-top:9px"><span style="width:${((t.step || 1) / 5) * 100}%"></span></div></div><div>${statusBadge(t.status)}<small style="display:block;text-align:center;margin-top:4px;color:#8a98a3;font-size:8px">Bước ${t.step || 1}/5</small></div><div class="ticket-actions">${t.step < 5 ? `<button class="small-btn icon-action" title="Chuyển bước" aria-label="Chuyển bước yêu cầu" data-advance="${esc(t.id)}">→</button>` : ""}<button class="small-btn icon-action" title="Xem" aria-label="Xem yêu cầu" data-view-ticket="${esc(t.id)}">⌕</button>${ticketActionButtons(t)}</div></div>`).join("") : `<div class="empty"><strong>Chưa có phiếu ${typeLabel}</strong>Tạo yêu cầu để bắt đầu quy trình.</div>`}${page.pagination}</div>`;
}
function buildProcessDiagram({ title, variant = "red", steps, infoText }) {
  const labels = [
    { side: "left", title: steps[0][0], text: steps[0][1], className: "node-1" },
    { side: "right", title: steps[1][0], text: steps[1][1], className: "node-2" },
    { side: "left", title: steps[2][0], text: steps[2][1], className: "node-3" },
    { side: "right", title: steps[3][0], text: steps[3][1], className: "node-4" },
    { side: "left", title: steps[4][0], text: steps[4][1], className: "node-5" }
  ];

  return `
    <div class="workflow-visual-page ${variant}">
      <div class="workflow-visual-header">
        <h2>${esc(title)}</h2>
      </div>
      <div class="process-diagram">
        <div class="process-ring-wrap">
          <div class="process-ring">
            ${steps.map((step, index) => `
              <div class="process-node node-${index + 1}">
                <div class="process-step-badge">${index + 1}</div>
                <div class="process-node-inner">
                  <span>${esc(step[0])}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="process-side left">
          ${labels.filter(item => item.side === "left").map(item => `
            <div class="process-copy ${item.className}">
              <div class="process-copy-title">${esc(item.title)}</div>
              <div class="process-copy-text">${esc(item.text)}</div>
            </div>
          `).join("")}
        </div>
        <div class="process-side right">
          ${labels.filter(item => item.side === "right").map(item => `
            <div class="process-copy ${item.className}">
              <div class="process-copy-title">${esc(item.title)}</div>
              <div class="process-copy-text">${esc(item.text)}</div>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="process-info">${esc(infoText)}</div>
    </div>
  `;
}

function hardwarePage() {
  const cards = hardwareCatalog.map(item => `
    <div class="card" style="padding:16px; min-height:180px; display:flex; flex-direction:column; gap:10px;">
      <div class="card-head" style="align-items:flex-start">
        <div>
          <h3 style="margin:0 0 4px">${esc(item.label)}</h3>
          <p>${esc(item.group)}</p>
        </div>
        <span class="badge badge-red">${esc(item.group)}</span>
      </div>
      <div class="system-skill">
        <b>Cơ bản</b>
        <p>${esc(item.basic)}</p>
      </div>
      <div class="system-skill advanced">
        <b>Nâng cao</b>
        <p>${esc(item.advanced)}</p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-primary module-create-btn" data-action="new-ticket" data-ticket-type="hardware" data-ticket-system="${esc(item.label)}">Tạo yêu cầu</button>
      </div>
    </div>
  `).join("");

  return `
    <div class="page-title-row">
      <div><h2>PHẦN CỨNG</h2><p>Quản lý theo từng đầu mục: thiết bị, rack, mạng cơ bản, camera, UPS, máy in ...</p></div>
      <button class="btn btn-primary" type="button" data-open-hardware-details>Xem chi tiết phần cứng</button>
    </div>
    ${systemRequestsHtml("hardware", "Danh sách yêu cầu phần cứng")}
    <div class="modal-backdrop hidden" id="hardwareDetailsModal">
      <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="hardwareDetailsTitle">
        <div class="modal-header"><div><h2 id="hardwareDetailsTitle">Chi tiết phần cứng</h2><p>${hardwareCatalog.length} đầu mục vận hành</p></div><button class="close-btn" type="button" data-close="hardwareDetailsModal" title="Đóng" aria-label="Đóng chi tiết phần cứng">×</button></div>
        <div class="grid-2" style="padding:16px;gap:12px">${cards}</div>
      </div>
    </div>
  `;
}
function serverPage() { return `<div class="page-title-row"><div><h2>MÁY CHỦ</h2><p>Server, mạng và firewall</p></div><button class="btn btn-primary" data-action="new-ticket" data-ticket-type="server">＋ Tạo yêu cầu máy chủ</button></div>${systemRequestsHtml("server", "Danh sách yêu cầu máy chủ")}${serverMatrixHtml()}` }
const serverCatalog = [
  { id: "firewall", icon: "🛡", label: "Firewall", group: "MÁY CHỦ", basic: "Kiểm tra trạng thái; kiểm tra rule có sẵn; mở port theo yêu cầu/quy trình; kiểm tra kết nối", advanced: "Thiết kế policy; NAT; VPN; HA; IDS/IPS; phân tích traffic; xử lý sự cố bảo mật" },
  { id: "network", icon: "🌐", label: "Mạng", group: "MÁY CHỦ", basic: "Bấm/thay dây mạng; cấu hình IP; kết nối Wi-Fi; kiểm tra ping; kiểm tra port; thay thiết bị theo cấu hình có sẵn", advanced: "Thiết kế LAN/WAN; VLAN; routing; VPN; Wi-Fi system; redundancy; phân tích lỗi mạng diện rộng" },
  { id: "server", icon: "🖥", label: "Server", group: "MÁY CHỦ", basic: "Kiểm tra trạng thái; restart service; thay linh kiện; cài OS theo tài liệu; kiểm tra log cơ bản", advanced: "Thiết kế/cấu hình server; AD/DNS/DHCP; virtualization; cluster; migration; HA; xử lý sự cố hệ thống" }
];

function serverMatrixHtml() {
  const openTickets = item => state.tickets.filter(ticket => ticket.type === "server" && String(ticket.systemName || "").toLowerCase().includes(item.label.toLowerCase()) && ticket.step < 5).length;
  return `<section class="system-matrix"><div class="system-matrix-header"><div><span class="system-kicker">NĂNG LỰC MÁY CHỦ</span><h2>Danh mục vận hành</h2><p>Nội dung xử lý cơ bản và nâng cao theo từng mảng.</p></div><button class="btn btn-primary" data-action="new-ticket" data-ticket-type="server">＋ Tạo yêu cầu</button></div><div class="system-module-grid">${serverCatalog.map(item => `<article class="system-capability-card"><div class="system-capability-card-top"><span class="system-capability-icon">${item.icon}</span><span class="badge badge-purple">${openTickets(item)} đang mở</span></div><h3>${esc(item.label)}</h3><div class="system-skill"><b>Cơ bản</b><p>${esc(item.basic)}</p></div><div class="system-skill advanced"><b>Nâng cao</b><p>${esc(item.advanced)}</p></div><div class="system-card-actions"><button class="btn btn-primary module-create-btn" data-action="new-ticket" data-ticket-type="server" data-ticket-system="${esc(item.label)}">Tạo yêu cầu</button></div></article>`).join("")}</div></section>`;
}
function catalogMatrixHtml() {
  const rows = [
    ["1", "THIẾT BỊ", "Thiết bị", "Theo dõi thiết bị, trạng thái, vị trí, kiểm tra hoạt động cơ bản", "Quản lý tài sản, nâng cấp, bảo trì, phân bổ theo đơn vị"],
    ["2", "RACK", "Rack", "Patch dây; thay thiết bị; kiểm tra đèn / trạng thái; vệ sinh; tag label", "Thiết kế rack; power; cooling; capacity; redundancy; quy hoạch server room"],
    ["3", "MẠNG CƠ BẢN", "Mạng cơ bản", "Bấm dây; thay dây; tag label; bootcolor; kiểm tra kết nối", "Thiết kế hệ thống cáp; fiber; patch panel; rack; SFP; cable infrastructure"],
    ["4", "TV/MÁY CHIẾU", "TV / Máy chiếu", "Kết nối HDMI; setup TV; trình chiếu; xử lý cơ bản", "Quản lý tập trung; ứng dụng trong họp / trình chiếu"],
    ["5", "MÁY IN", "Máy in", "Cài driver; add printer; xử lý queue; thay toner; xử lý paper jam", "Triển khai hệ thống in Wi‑Fi; quản lý in tập trung"],
    ["6", "ĐIỆN THOẠI", "Điện thoại", "Setup điện thoại; IP Phone; Analog; thay thiết bị; kiểm tra kết nối", "VoIP; SIP; IMS; quản lý thiết bị tập trung; tích hợp hệ thống"],
    ["7", "PC/LAPTOP", "PC / Laptop", "Cài OS, phần mềm; setup máy mới; thay RAM/SSD; xử lý phần cứng/thường gặp", "Xử lý lỗi phần cứng; chuẩn hóa cấu hình; triển khai image; quản lý thiết bị tập trung"],
    ["8", "MÁY CHẤM CÔNG", "Máy chấm công", "Tạo user; đăng ký vân tay/khuôn mặt; đồng bộ; xử lý kết nối", "Quản lý máy; tích hợp API; database; đồng bộ hệ thống"],
    ["9", "UPS/POWER", "UPS / Power", "Kiểm tra trạng thái; kiểm tra pin; thay battery; xử lý lỗi cơ bản", "Tính toán thiết kế UPS; kế hoạch nguồn dự phòng"],
    ["10", "CAMERA", "Camera", "Lắp/thay camera; cài đặt IP; kiểm tra PoE; kiểm tra camera mất kết nối; thay disk NVR", "Thiết kế CCTV; storage; VMS/NVR; camera network; retention; phân quyền"],
    ["11", "TỔNG ĐÀI", "Tổng đài", "Cấu hình IP Phone; extension; thay máy; kiểm tra cuộc gọi; sửa lỗi đơn giản", "Thiết kế IP-PBX; SIP Trunk; IVR; Queue; Recording; VoIP VLAN; integration"],
    ["12", "STORAGE/BACKUP", "Storage / Backup", "Kiểm tra dung lượng; thay disk; kiểm tra backup job; thực hiện restore", "Thiết kế storage; RAID; NAS/SAN; snapshot; replication; backup strategy; DR"],
    ["13", "FIREWALL", "Firewall", "Kiểm tra trạng thái; kiểm tra rule cơ bản; mở port theo yêu cầu; kiểm tra kết nối", "Thiết kế policy; NAT; VPN; IDS/IPS; phân tích traffic; xử lý sự cố bảo mật"],
    ["14", "MẠNG", "Mạng", "Bấm/thay dây mạng; kiểm tra port; thay thiết bị; kiểm tra IP / Wi‑Fi", "Thiết kế LAN/WAN; VLAN; routing; VPN; Wi‑Fi system; redundancy; phân tích lỗi"],
    ["15", "SERVER", "Server", "Kiểm tra trạng thái; restart service; thay linh kiện; cài OS theo tài liệu; kiểm tra log cơ bản", "Thiết kế/ci/hành server; AD/DNS/DHCP; virtualization; cluster; migration; HA; xử lý sự cố"]
  ];

  return `
    <div class="card" style="margin:16px 0">
      <div class="card-head">
        <div><h3>Catalog IT theo yêu cầu</h3><p>STT • Lớp • Mảng • Cơ bản • Nâng cao</p></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>LỚP</th>
              <th>MẢNG</th>
              <th>CƠ BẢN</th>
              <th>NÂNG CAO</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(([stt, lop, mang, coBan, nangCao]) => `
              <tr>
                <td>${stt}</td>
                <td><b>${lop}</b></td>
                <td>${mang}</td>
                <td>${coBan}</td>
                <td>${nangCao}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function systemsPage() {
  return `<div class="page-title-row"><div><h2>HỆ THỐNG</h2><p>Storage/Backup, tổng đài và camera</p></div><button class="btn btn-primary" data-action="new-ticket" data-ticket-type="system">＋ Tạo yêu cầu hệ thống</button></div>${systemRequestsHtml()}${systemMatrixHtml()}`;
}

function systemMatrixHtml() {
  const openTickets = item => state.tickets.filter(ticket => ticket.type === "system" && String(ticket.systemName || "").toLowerCase().includes(item.label.toLowerCase()) && ticket.step < 5).length;
  return `<section class="system-matrix"><div class="system-matrix-header"><div><span class="system-kicker">NĂNG LỰC HỆ THỐNG</span><h2>Danh mục vận hành</h2><p>Nội dung xử lý cơ bản và nâng cao theo từng mảng.</p></div><button class="btn btn-primary" data-action="new-ticket" data-ticket-type="system">＋ Tạo yêu cầu</button></div><div class="system-module-grid">${systemCatalog.map(item => `<article class="system-capability-card"><div class="system-capability-card-top"><span class="system-capability-icon">${item.icon}</span><span class="badge badge-blue">${openTickets(item)} đang mở</span></div><h3>${esc(item.label)}</h3><div class="system-skill"><b>Cơ bản</b><p>${esc(item.basic)}</p></div><div class="system-skill advanced"><b>Nâng cao</b><p>${esc(item.advanced)}</p></div><div class="system-card-actions"><button class="btn btn-primary module-create-btn" data-action="new-ticket" data-ticket-type="system" data-ticket-system="${esc(item.label)}">Tạo yêu cầu</button></div></article>`).join("")}</div></section>`;
}

function systemRequestsHtml(type = "system", title = "Danh sách yêu cầu hệ thống") {
  const allRows = state.tickets.filter(ticket => ticket.type === type);
  const scopeLabel = type === "server" ? "Máy chủ" : type === "hardware" ? "Phần cứng" : "Hệ thống";
  const query = state.search.trim().toLowerCase();
  const filteredRows = allRows.filter(ticket => {
    const matchesQuery = !query || `${ticket.id} ${ticket.title} ${ticket.systemName} ${ticket.department} ${ticket.assignee}`.toLowerCase().includes(query);
    const matchesStatus = !state.systemRequestStatus || (ticket.status || "Chờ xử lý") === state.systemRequestStatus;
    return matchesQuery && matchesStatus;
  });
  const page = paginateList(`requests-${type}`, filteredRows, LIST_PAGE_SIZE, "yêu cầu");
  const open = allRows.filter(ticket => ticket.step < 5).length;
  const high = allRows.filter(ticket => ticket.step < 5 && ticket.priority === "Cao").length;
  const done = allRows.filter(ticket => ticket.step === 5).length;
  const requestRows = page.items.map(ticket => `<article class="system-request-row"><div class="system-request-id"><b>${esc(ticket.id)}</b><small>${esc(ticket.createdAtText || "")}</small></div><div class="system-request-main"><b>${esc(ticket.title)}</b><small>${esc(ticket.systemName || scopeLabel)} • ${esc(ticket.department || "Chưa có đơn vị")} • Phụ trách: ${esc(ticket.assignee || "Chưa phân công")}</small><div class="progress-line"><span style="width:${Math.min(100, ((ticket.step || 1) / 5) * 100)}%"></span></div></div><div class="system-request-status">${priorityBadge(ticket.priority)}${statusBadge(ticket.status)}<small>Bước ${ticket.step || 1}/5</small></div><div class="system-request-actions">${ticket.step < 5 ? `<button class="small-btn icon-action" title="Chuyển bước" aria-label="Chuyển bước yêu cầu" data-advance="${esc(ticket.id)}">→</button>` : ""}<button class="small-btn icon-action" title="Xem" aria-label="Xem yêu cầu" data-view-ticket="${esc(ticket.id)}">⌕</button>${ticketActionButtons(ticket)}</div></article>`).join("");
  const requestList = filteredRows.length ? `<div class="system-request-list">${requestRows}</div>` : `<div class="empty system-request-empty"><strong>Chưa có yêu cầu ${scopeLabel.toLowerCase()}</strong>Tạo yêu cầu đầu tiên để bắt đầu theo dõi.</div>`;
  return `<section class="system-requests"><div class="system-request-header"><div><span class="system-kicker">THEO DÕI XỬ LÝ</span><h2>${title}</h2><p>${filteredRows.length} yêu cầu${query || state.systemRequestStatus ? " phù hợp" : " đang theo dõi"}</p></div><button class="btn btn-primary" data-action="new-ticket" data-ticket-type="${type}">＋ Tạo yêu cầu</button></div><div class="system-request-overview"><div class="system-request-stats"><div><b>${open}</b><span>Đang mở</span></div><div><b>${high}</b><span>Ưu tiên cao</span></div><div><b>${done}</b><span>Hoàn tất</span></div></div><div class="system-request-toolbar"><span class="system-request-hint">Lọc theo trạng thái yêu cầu</span><select id="systemRequestStatus"><option value="">Tất cả trạng thái</option>${["Chờ kiểm tra", "Đang xử lý", "Hoàn tất", "Chờ xử lý"].map(status => `<option value="${status}" ${state.systemRequestStatus === status ? "selected" : ""}>${status}</option>`).join("")}</select></div></div>${requestList}${page.pagination}</section>`;
}

function systemCapabilityCatalogHtml() {
  const query = state.systemQuery.trim().toLowerCase();
  const filtered = systemCatalog.filter(item => {
    const matchesQuery = !query || `${item.label} ${item.basic} ${item.advanced}`.toLowerCase().includes(query);
    return matchesQuery;
  });
  const focus = systemCatalog.find(item => item.id === state.systemFocus);
  const openTickets = item => state.tickets.filter(ticket => ticket.type === "system" && String(ticket.systemName || "").toLowerCase().includes(item.label.toLowerCase()) && ticket.step < 5).length;
  const levelLabel = state.systemLevel === "basic" ? "Cơ bản" : state.systemLevel === "advanced" ? "Nâng cao" : "Tất cả năng lực";
  const focusPanel = focus ? `<div class="system-focus-panel"><div class="card-head"><div><span class="system-kicker">${focus.icon} ${esc(focus.group)}</span><h3>${esc(focus.label)}</h3><p>Chi tiết năng lực và yêu cầu đang mở</p></div><button class="btn btn-light" data-system-focus="">Đóng</button></div><div class="system-focus-grid"><div><b>Cơ bản</b><p>${esc(focus.basic)}</p></div><div><b>Nâng cao</b><p>${esc(focus.advanced)}</p></div></div><button class="btn btn-primary" data-action="new-ticket" data-ticket-type="system" data-ticket-system="${esc(focus.label)}">＋ Tạo yêu cầu ${esc(focus.label)}</button></div>` : "";
  return `<section class="system-capabilities"><div class="system-capability-header"><div><span class="system-kicker">NĂNG LỰC VẬN HÀNH</span><h2>Danh mục Hệ thống</h2><p>Tra cứu nội dung xử lý theo mảng và mở yêu cầu đúng quy trình.</p></div><div class="system-capability-stats"><strong>${systemCatalog.length}</strong><span>mảng hệ thống</span></div></div><div class="system-catalog-toolbar"><label class="system-search"><span>⌕</span><input id="systemCatalogSearch" value="${esc(state.systemQuery)}" placeholder="Tìm Server, Camera, Backup..."></label><div class="segmented-control" role="tablist" aria-label="Mức năng lực"><button class="${state.systemLevel === "all" ? "active" : ""}" data-system-level="all">Tất cả</button><button class="${state.systemLevel === "basic" ? "active" : ""}" data-system-level="basic">Cơ bản</button><button class="${state.systemLevel === "advanced" ? "active" : ""}" data-system-level="advanced">Nâng cao</button></div></div>${focusPanel}<div class="system-capability-meta"><span>${filtered.length} / ${systemCatalog.length} mảng</span><span>${levelLabel}</span></div><div class="system-capability-grid">${filtered.length ? filtered.map(item => `<article class="system-capability-card ${state.systemFocus === item.id ? "selected" : ""}"><div class="system-capability-card-top"><span class="system-capability-icon">${item.icon}</span><span class="badge badge-blue">${openTickets(item)} đang mở</span></div><h3>${esc(item.label)}</h3>${state.systemLevel !== "advanced" ? `<div class="system-skill"><b>Cơ bản</b><p>${esc(item.basic)}</p></div>` : ""}${state.systemLevel !== "basic" ? `<div class="system-skill advanced"><b>Nâng cao</b><p>${esc(item.advanced)}</p></div>` : ""}<div class="system-card-actions"><button class="small-btn" data-system-focus="${esc(item.id)}">Xem chi tiết</button><button class="small-btn primary" data-action="new-ticket" data-ticket-type="system" data-ticket-system="${esc(item.label)}">Tạo yêu cầu</button></div></article>`).join("") : `<div class="empty system-empty"><strong>Không tìm thấy mảng phù hợp</strong>Thử từ khóa khác hoặc chọn lại bộ lọc năng lực.</div>`}</div></section>`;
}

function assetsPage() {
  const sortedAssets = [...state.assets].sort((a, b) => {
    const departmentOrder = String(a.department || "Chưa phân loại").localeCompare(String(b.department || "Chưa phân loại"), "vi", { sensitivity: "base" });
    return departmentOrder || String(a.code || "").localeCompare(String(b.code || ""), "vi", { numeric: true, sensitivity: "base" });
  });
  const page = paginateList("assets", sortedAssets, LIST_PAGE_SIZE, "tài sản");
  let groupNumber = -1;
  const assetRows = page.items.map((asset, index) => {
    const department = asset.department || "Chưa phân loại";
    const previousDepartment = index ? page.items[index - 1].department || "Chưa phân loại" : "";
    if (department !== previousDepartment) groupNumber += 1;
    const groupKey = String(groupNumber);
    const groupRow = department !== previousDepartment ? `<tr class="asset-group-row"><td colspan="8"><button type="button" class="asset-group-toggle" data-asset-group="${groupKey}" aria-expanded="false"><span>▸</span>${esc(department)}</button></td></tr>` : "";
    return `${groupRow}<tr class="asset-group-item" data-asset-group-item="${groupKey}" hidden><td><b>${esc(asset.code)}</b></td><td><b>${esc(asset.name)}</b><small>${esc(asset.owner || "")}</small></td><td>${esc(asset.category)}</td><td>${esc(asset.serial || "-")}</td><td>${esc(asset.location || "-")}</td><td>${esc(asset.department || "-")}</td><td>${assetStatus(asset.status)}</td><td class="row-actions"><button class="small-btn icon-action" title="Nhân bản" aria-label="Nhân bản tài sản" data-duplicate-asset="${esc(asset.id)}">⧉</button><button class="small-btn icon-action" title="Sửa" aria-label="Sửa tài sản" data-edit-asset="${esc(asset.id)}">✎</button><button class="small-btn icon-action danger" title="Xóa" aria-label="Xóa tài sản" data-delete-asset="${esc(asset.id)}">×</button></td></tr>`;
  }).join("");
  return `<div class="page-title-row"><div><button class="link-btn" data-back-to-management>← Quay lại</button><h2 style="margin-top:8px">Tài sản / CCDC</h2><p>${state.assets.length} tài sản đang quản lý</p></div><button class="btn btn-primary" data-action="new-asset">＋ Thêm tài sản</button></div>
 <div class="stats"><div class="stat-card"><span class="icon">▤</span><div class="label">Tổng tài sản</div><div class="value">${state.assets.length}</div></div><div class="stat-card"><span class="icon">✓</span><div class="label">Đang sử dụng</div><div class="value">${state.assets.filter(a => a.status === "Đang sử dụng").length}</div></div><div class="stat-card"><span class="icon">↻</span><div class="label">Bảo trì</div><div class="value">${state.assets.filter(a => a.status === "Bảo trì").length}</div></div><div class="stat-card"><span class="icon">!</span><div class="label">Hỏng</div><div class="value">${state.assets.filter(a => a.status === "Hỏng").length}</div></div></div>
 <div class="card">${sortedAssets.length ? `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tài sản</th><th>Loại</th><th>Serial</th><th>Bộ phận sử dụng</th><th>Đơn vị / Phòng ban</th><th>Tình trạng</th><th></th></tr></thead><tbody>${assetRows}</tbody></table></div>${page.pagination}` : `<div class="empty"><strong>Chưa có tài sản</strong>Thêm thiết bị CNTT đầu tiên.</div>`}</div>`;
}
function assetStatus(s) { return `<span class="badge ${s === "Đang sử dụng" ? "badge-green" : s === "Hỏng" ? "badge-red" : s === "Bảo trì" ? "badge-orange" : "badge-gray"}">${esc(s)}</span>` }

function employeeReferenceMatches(row, codeField, nameField, previous) {
  const code = String(row[codeField] || "").trim();
  const name = String(row[nameField] || "").trim();
  return code === String(previous.employeeCode || "").trim() || (!code && name === String(previous.name || "").trim());
}

function employeeByNameOrCode(name, code = "") {
  return state.employees.find(employee => (code && employee.employeeCode === code) || employee.name === name);
}

async function syncEmployeeReferences(previous, updated) {
  const employeeCode = updated.employeeCode || previous.employeeCode || "";
  const oldName = previous.name || "";
  const updateReferences = async (collection, rows, getChanges) => {
    for (const row of rows) {
      const changes = getChanges(row, employeeCode, oldName, updated);
      if (Object.keys(changes).length) await updateDocRemote(collection, row.id, changes);
    }
  };

  await updateReferences("tickets", state.tickets, (ticket, code, name, employee) => {
    const changes = {};
    if (employeeReferenceMatches(ticket, "requesterEmployeeCode", "requester", previous)) Object.assign(changes, { requester: employee.name, requesterEmployeeCode: code, requesterTitle: employee.title || "" });
    if (employeeReferenceMatches(ticket, "assigneeEmployeeCode", "assignee", previous)) Object.assign(changes, { assignee: employee.name, assigneeEmployeeCode: code, assigneeTitle: employee.title || "" });
    return changes;
  });
  await updateReferences("maintenance", state.maintenance, (row, code, name, employee) => employeeReferenceMatches(row, "assigneeEmployeeCode", "assignee", previous) ? { assignee: employee.name, assigneeEmployeeCode: code, assigneeTitle: employee.title || "" } : {});
  await updateReferences("assets", state.assets, (row, code, name, employee) => employeeReferenceMatches(row, "ownerEmployeeCode", "owner", previous) ? { owner: employee.name, ownerEmployeeCode: code, ownerTitle: employee.title || "" } : {});
  await updateReferences("storeVisits", state.storeVisits, (row, code, name, employee) => {
    const performers = Array.isArray(row.performers) ? row.performers : String(row.performers || "").split(",").map(value => value.trim()).filter(Boolean);
    const performerCodes = Array.isArray(row.performerCodes) ? row.performerCodes : [];
    const indexes = performers.map((performer, index) => performerCodes[index] === previous.employeeCode || (!performerCodes[index] && performer === oldName) ? index : -1).filter(index => index >= 0);
    return indexes.length ? { performers: performers.map((performer, index) => indexes.includes(index) ? employee.name : performer), performerCodes: performers.map((performer, index) => indexes.includes(index) ? code : performerCodes[index] || "") } : {};
  });
  await updateReferences("departments", state.departments, (department, code, name, employee) => {
    const managers = department.managers?.length ? department.managers : [{ name: department.manager, title: department.title, employeeCode: department.employeeCode, phone: department.phone }].filter(manager => manager.name);
    const changed = managers.some(manager => manager.employeeCode === previous.employeeCode || (!manager.employeeCode && manager.name === oldName));
    return changed ? { managers: managers.map(manager => manager.employeeCode === previous.employeeCode || (!manager.employeeCode && manager.name === oldName) ? { ...manager, name: employee.name, title: employee.title || "", employeeCode: code, phone: employee.phone || manager.phone || "" } : manager) } : {};
  });
}

function maintenancePage() {
  const rows = state.maintenance.map(row => ({ ...row, status: maintenanceStatus(row) }));
  const page = paginateList("maintenance", rows, LIST_PAGE_SIZE, "lịch");
  return `<div class="page-title-row"><div><button class="link-btn" data-back-to-management>← Quay lại</button><h2 style="margin-top:8px">Bảo trì</h2><p>Theo dõi lịch bảo trì thiết bị và hệ thống</p></div><button class="btn btn-primary" data-action="new-maintenance-modal">＋ Tạo lịch bảo trì</button></div>
 <div class="grid-3"><div class="card"><div class="label muted">Đến hạn</div><div class="value" style="font-size:26px;font-weight:800;margin-top:7px">${rows.filter(x => x.status !== "Hoàn tất").length}</div></div><div class="card"><div class="label muted">Đã hoàn tất</div><div class="value" style="font-size:26px;font-weight:800;margin-top:7px">${rows.filter(x => x.status === "Hoàn tất").length}</div></div><div class="card"><div class="label muted">Thiết bị cần chú ý</div><div class="value" style="font-size:26px;font-weight:800;margin-top:7px">${state.assets.filter(a => ["Bảo trì", "Hỏng"].includes(a.status)).length}</div></div></div>
 <div class="card" style="margin-top:15px">${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Nội dung</th><th>Đối tượng</th><th>Phụ trách</th><th>Đến hạn</th><th>Chu kỳ</th><th>Trạng thái</th><th>Kết quả</th><th></th></tr></thead><tbody>${page.items.map(row => `<tr><td><b>${esc(row.title)}</b></td><td>${esc(row.target)}</td><td>${esc(row.assignee)}</td><td>${esc(row.dueDate || "-")}</td><td>${esc(row.cycle || "-")}</td><td>${statusBadge(row.status)}</td><td>${esc(row.result || "-")}</td><td class="row-actions"><button class="small-btn icon-action" title="Sửa" aria-label="Sửa lịch bảo trì" data-edit-maintenance="${esc(row.id)}">✎</button><button class="small-btn icon-action danger" title="Xóa" aria-label="Xóa lịch bảo trì" data-delete-maintenance="${esc(row.id)}">×</button></td></tr>`).join("")}</tbody></table></div>${page.pagination}` : `<div class="empty"><strong>Chưa có lịch bảo trì</strong>Hãy tạo lịch để theo dõi.</div>`}</div>`;
}

function storeVisitsPage() {
  const query = normalizeEmployeeSearch(state.search);
  const rows = [...state.storeVisits]
    .filter(row => !query || `${row.visitDate || ""} ${row.visitTime || ""} ${row.content || ""} ${row.department || ""} ${row.performers || ""} ${row.status || ""} ${row.notes || ""}`.toLowerCase().includes(query))
    .sort((a, b) => `${a.visitDate || ""} ${a.visitTime || ""}`.localeCompare(`${b.visitDate || ""} ${b.visitTime || ""}`));
  const page = paginateList("storeVisits", rows, LIST_PAGE_SIZE, "lịch");
  return `<div class="page-title-row"><div><button class="link-btn" data-back-to-management>← Quay lại</button><h2 style="margin-top:8px">Lịch đi cửa hàng</h2><p>${rows.length} lịch${query ? " phù hợp" : " đang theo dõi"}</p></div><button class="btn btn-primary" data-action="new-store-visit">＋ Thêm lịch</button></div>
  <div class="card store-visit-card"><div class="table-wrap"><table class="store-visit-table"><thead><tr><th>Ngày</th><th>Giờ</th><th>Nội dung xử lý</th><th>Đơn vị</th><th>Người thực hiện</th><th>Trạng thái</th><th>Ghi chú</th><th></th></tr></thead><tbody>${rows.length ? page.items.map(storeVisitRow).join("") : `<tr><td colspan="8"><div class="empty"><strong>Chưa có lịch đi cửa hàng</strong>Thêm lịch đầu tiên để theo dõi.</div></td></tr>`}</tbody></table></div>${page.pagination}</div>`;
}

function storeVisitRow(row) {
  const performers = Array.isArray(row.performers) ? row.performers : String(row.performers || "").split(",").map(name => name.trim()).filter(Boolean);
  const statusClass = row.status === "ĐÃ XỬ LÝ" ? "badge-green" : row.status === "ĐANG XỬ LÝ" ? "badge-blue" : row.status === "ĐÃ LÊN LỊCH" ? "badge-orange" : row.status === "CHẬM TIẾN ĐỘ" ? "badge-purple" : "badge-red";
  return `<tr><td><b>${esc(formatVisitDate(row.visitDate))}</b></td><td>${esc(row.visitTime || "-")}</td><td><b>${esc(row.content || "-")}</b></td><td>${esc(row.department || "-")}</td><td>${performers.length ? performers.map(name => `<span class="person-chip">${esc(name)}</span>`).join("") : "-"}</td><td><span class="badge ${statusClass}">${esc(row.status || "CHƯA XỬ LÝ")}</span></td><td>${esc(row.notes || "-")}</td><td class="row-actions"><button class="small-btn icon-action" title="Nhân bản" aria-label="Nhân bản lịch đi cửa hàng" data-duplicate-store-visit="${esc(row.id)}">⧉</button><button class="small-btn icon-action" title="Sửa" aria-label="Sửa lịch đi cửa hàng" data-edit-store-visit="${esc(row.id)}">✎</button><button class="small-btn icon-action danger" title="Xóa" aria-label="Xóa lịch đi cửa hàng" data-delete-store-visit="${esc(row.id)}">×</button></td></tr>`;
}

function formatVisitDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function departmentsPage() {
  const departmentOrder = ["BGD", "PKD", "PKT", "PNS", "PCSKH", ...Array.from({ length: 12 }, (_, i) => `HD${i + 1}`), "HDMT", "HDNCT", "HDVTA", "HDVTY", "HDCHAUTHANH", "HDLOTE", "HDST"];
  const normalizeDepartmentCode = value => String(value || "").toUpperCase().replace(/[ ._-]/g, "");
  const normalizeDepartmentName = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
  const leadershipRank = employee => { const title = normalizeDepartmentName(employee.title || employee.detailedTitle || ""); if (/^pho giam doc|pho giam doc/.test(title)) return 1; if (/giam doc/.test(title)) return 0; if (/truong phong/.test(title)) return 2; if (/pho phong/.test(title)) return 3; if (/giam sat/.test(title)) return 4; return 99 };
  const departments = [...state.departments].sort((a, b) => { const aIndex = departmentOrder.indexOf(normalizeDepartmentCode(a.code)), bIndex = departmentOrder.indexOf(normalizeDepartmentCode(b.code)); return (aIndex < 0 ? departmentOrder.length : aIndex) - (bIndex < 0 ? departmentOrder.length : bIndex) || String(a.name || "").localeCompare(String(b.name || ""), "vi") });
  const page = paginateList("departments", departments, LIST_PAGE_SIZE, "đơn vị");
  const departmentCards = page.items.map(d => {
    const managers = state.employees.filter(employee => normalizeDepartmentName(employee.department) === normalizeDepartmentName(d.name) && leadershipRank(employee) <= 4).sort((a, b) => leadershipRank(a) - leadershipRank(b) || String(a.name || "").localeCompare(String(b.name || ""), "vi"));
    return `<div class="card"><div style="display:flex;justify-content:space-between"><span class="badge badge-blue">${esc(d.code || "DV")}</span><div><button class="small-btn icon-action" title="Sửa" aria-label="Sửa đơn vị" data-edit-dept="${esc(d.id)}">✎</button><button class="small-btn icon-action danger" title="Xóa" aria-label="Xóa đơn vị" data-delete-dept="${esc(d.id)}">×</button></div></div><h3 style="font-size:13px;margin:14px 0 4px">${esc(d.name)}</h3>${managers.length ? managers.map(m => `<p class="muted" style="font-size:9px;margin:8px 0;white-space:pre-line"><b>${esc(m.name)}</b> - ${esc(m.title || "Chưa cập nhật")}<br>Mã NV: ${esc(m.employeeCode || "-")} | SĐT: ${esc(m.phone || "-")}</p>`).join("") : `<p class="muted" style="font-size:9px">Chưa có nhân sự từ cấp Giám sát</p>`}<div style="margin-top:13px;font-size:9px;color:#778792">Ticket: <b>${state.tickets.filter(t => t.department === d.name).length}</b></div></div>`;
  }).join("") || `<div class="card"><div class="empty"><strong>Chưa có đơn vị</strong>Thêm đơn vị đầu tiên.</div></div>`;
  return `<div class="page-title-row"><div><button class="link-btn" data-back-to-management>← Quay lại</button><h2 style="margin-top:8px">Đơn vị / Phòng ban</h2><p>${state.departments.length} đơn vị trong danh mục</p></div><div class="filters"><button class="btn btn-light" data-action="upload-departments">↑ Tải lên Excel</button><button class="btn btn-primary" data-action="new-department">＋ Thêm đơn vị</button></div></div>
 <div class="grid-3">${departmentCards}</div>${page.pagination}`;
}

function employeesPage() {
  const query = normalizeEmployeeSearch(state.search);
  const normalizeText = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase().replace(/[^A-Z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const namedWorkplaceOrder = [/MAU THAN|HDMT/, /NAM CAN THO|HDNCT/, /VINH THANH|HDVTA/, /VI THUY|HDVTY/, /CHAU THANH|HDCHAUTHANH/, /LO TE|HDLOTE/, /SOC TRANG|HDST/, /HAUS/];
  const workplaceSortKey = workplace => {
    const normalized = normalizeText(workplace);
    if (!normalized) return [999, 999, ""];
    if (/A0?1|VP CONG TY/.test(normalized)) return [0, 0, normalized];
    const headNumber = Number((normalized.match(/(?:HEAD|H)[^\d]*(\d{1,2})/) || normalized.match(/(?:^|[\s-])H0?(\d{1,2})(?:$|[\s-])/))?.[1] || normalized.match(/(?:^|[\s-])0?(\d{1,2})(?:$|[\s-])/)?.[1] || 999);
    if (/HEAD|H\d{1,2}/.test(normalized)) return [1, headNumber, normalized];
    const namedIndex = namedWorkplaceOrder.findIndex(pattern => pattern.test(normalized));
    if (namedIndex >= 0) return [2, namedIndex, normalized];
    if (/HDMT|HDNCT|HDVTA|HDVTY|HDCHAUTHANH|HDLOTE|HDST/.test(normalized)) return [2, Number((normalized.match(/(\d+)/)?.[1] || 999)), normalized];
    return [3, 999, normalized];
  };
  const rows = state.employees.filter(employee => normalizeEmployeeSearch(`${employee.name || ""} ${employee.employeeCode || employee.code || employee.maNV || ""} ${employee.phone || ""}`).includes(query));
  const workplaceOrder = (a, b) => { const aKey = workplaceSortKey(a), bKey = workplaceSortKey(b); return aKey[0] - bKey[0] || aKey[1] - bKey[1] || aKey[2].localeCompare(bKey[2], "vi") };
  const officeDepartmentOrder = ["Ban Giám đốc", "Ban Kiểm soát", "Phòng Kinh doanh", "Phòng Nhân sự - Đào tạo", "Phòng CSKH", "Kho tổng", "Khác", "Phòng Tài chính - Kế toán"];
  const headDepartmentOrder = ["Quản lý HEAD", "Kế toán", "Phụ tùng", "Dịch vụ", "Bán hàng", "Khác"];
  const normalizeDepartment = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
  const canonicalDepartment = (value, isOffice) => {
    const normalized = normalizeDepartment(value);
    if (isOffice && /(tai chinh|ke toan)/.test(normalized)) return "Phòng Tài chính - Kế toán";
    if (!isOffice) {
      if (/quan ly head|cua hang/.test(normalized)) return "Quản lý HEAD";
      if (/ke toan/.test(normalized)) return "Kế toán";
      if (/phu tung/.test(normalized)) return "Phụ tùng";
      if (/dich vu|ky thuat/.test(normalized)) return "Dịch vụ";
      if (/ban hang/.test(normalized)) return "Bán hàng";
    } else {
      if (/ban giam doc/.test(normalized)) return "Ban Giám đốc";
      if (/ban kiem soat/.test(normalized)) return "Ban Kiểm soát";
      if (/kinh doanh/.test(normalized)) return "Phòng Kinh doanh";
      if (/nhan su|dao tao/.test(normalized)) return "Phòng Nhân sự - Đào tạo";
      if (/cskh|cham soc khach hang/.test(normalized)) return "Phòng CSKH";
      if (/kho tong/.test(normalized)) return "Kho tổng";
    }
    const known = (isOffice ? officeDepartmentOrder : headDepartmentOrder).find(item => normalizeDepartment(item) === normalized);
    return known || String(value || "Chưa xác định bộ phận").replace(/\s+/g, " ").trim();
  };
  const employeeDepartment = (employee, isOffice) => {
    const order = isOffice ? officeDepartmentOrder : headDepartmentOrder;
    const department = canonicalDepartment(employee.department, isOffice);
    if (order.includes(department)) return department;
    for (const value of [employee.detailedTitle, employee.actingTitle, employee.title]) {
      const inferred = canonicalDepartment(value, isOffice);
      if (order.includes(inferred)) return inferred;
    }
    return department;
  };
  const workplaces = new Map();
  rows.forEach(employee => {
    const rawWorkplace = String(employee.workplace || "Chưa xác định nơi làm việc").replace(/\s+/g, " ").trim();
    const isOffice = workplaceSortKey(rawWorkplace)[0] === 0;
    const workplace = isOffice ? "A01-VP Công ty" : rawWorkplace;
    const workplaceKey = isOffice ? "office" : normalizeText(rawWorkplace);
    if (!workplaces.has(workplaceKey)) workplaces.set(workplaceKey, { workplace, employees: [] });
    workplaces.get(workplaceKey).employees.push(employee);
  });
  const roleRank = (employee, isOffice, department) => {
    const roles = isOffice
      ? [/^giam doc(?: |$)/, /^pho giam doc(?: |$)/, /^truong phong(?: |$)/, /^pho phong(?: |$)/, /^giam sat(?: |$)/, /^to truong(?: |$)/, /^to pho(?: |$)/, /^(?:chuyen vien|nhan vien)(?: |$)/]
      : normalizeDepartment(department) === normalizeDepartment("Quản lý HEAD")
        ? [/^cua hang truong(?: |$)/, /^cua hang pho(?: |$)/, /^ky thuat truong(?: |$)/, /^ky thuat pho(?: |$)/, /^to truong(?: |$)/, /^to pho(?: |$)/, /^nhan vien(?: |$)/]
        : normalizeDepartment(department) === normalizeDepartment("Dịch vụ")
          ? [/^ky thuat truong(?: |$)/, /^ky thuat pho(?: |$)/, /^nhan vien(?: |$)/]
          : [/^to truong(?: |$)/, /^to pho(?: |$)/, /^nhan vien(?: |$)/];
    const rankTitle = value => roles.findIndex(pattern => pattern.test(normalizeDepartment(value)));
    const primaryRank = rankTitle(employee.title);
    if (primaryRank >= 0) return primaryRank;
    const secondaryRank = rankTitle(`${employee.detailedTitle || ""} ${employee.actingTitle || ""}`);
    return secondaryRank < 0 ? roles.length : secondaryRank;
  };
  const renderEmployeeTable = employees => `<div class="table-wrap"><table class="employee-table"><thead><tr><th>Trạng thái</th><th>Mã</th><th>Họ và tên</th><th>ID chấm công</th><th>Chức danh</th><th>Điện thoại</th><th>Ngày sinh</th><th>Giới tính</th><th>Email</th><th></th></tr></thead><tbody>${employees.map(employee => `<tr><td><span class="badge badge-green">${esc(employee.status || "Đang làm việc")}</span></td><td><b>${esc(employee.employeeCode)}</b></td><td><b>${esc(employee.name)}</b></td><td>${esc(employee.attendanceId || "-")}</td><td>${esc(employee.title || "-")}<small>${esc(employee.detailedTitle || "")}${employee.actingTitle ? `<br>Kiêm nhiệm: ${esc(employee.actingTitle)}` : ""}</small></td><td>${esc(employee.phone || "-")}</td><td>${esc(employee.birthDate || "-")}</td><td>${esc(employee.gender || "-")}</td><td>${esc(employee.email || "-")}</td><td class="row-actions"><button class="small-btn icon-action" title="Sửa" aria-label="Sửa nhân viên" data-edit-employee="${esc(employee.id)}">✎</button><button class="small-btn icon-action danger" title="Xóa" aria-label="Xóa nhân viên" data-delete-employee="${esc(employee.id)}">×</button></td></tr>`).join("")}</tbody></table></div>`;
  const sortedWorkplaces = [...workplaces.values()].sort((a, b) => workplaceOrder(a.workplace, b.workplace));
  const groupedWorkplaces = sortedWorkplaces.map(({ workplace, employees }) => {
    const isOffice = workplaceSortKey(workplace)[0] === 0;
    const departmentOrder = isOffice ? officeDepartmentOrder : headDepartmentOrder;
    const departments = new Map();
    employees.forEach(employee => {
      const department = employeeDepartment(employee, isOffice);
      if (!departments.has(department)) departments.set(department, []);
      departments.get(department).push(employee);
    });
    const sortedDepartments = [...departments.entries()].sort(([a], [b]) => {
      const aIndex = departmentOrder.findIndex(item => normalizeDepartment(item) === normalizeDepartment(a));
      const bIndex = departmentOrder.findIndex(item => normalizeDepartment(item) === normalizeDepartment(b));
      return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex) || a.localeCompare(b, "vi");
    });
    const orderedDepartments = sortedDepartments.map(([department, members]) => {
      members.sort((a, b) => roleRank(a, isOffice, department) - roleRank(b, isOffice, department) || String(a.name || "").localeCompare(String(b.name || ""), "vi"));
      return { department, members };
    });
    return { workplace, employees, departments: orderedDepartments };
  });
  const orderedEmployees = groupedWorkplaces.flatMap(group => group.departments.flatMap(department => department.members));
  const totalPages = Math.max(1, Math.ceil(orderedEmployees.length / EMPLOYEE_PAGE_SIZE));
  state.employeePage = Math.max(1, Math.min(state.employeePage, totalPages));
  const pageStartIndex = (state.employeePage - 1) * EMPLOYEE_PAGE_SIZE;
  const pageEmployees = orderedEmployees.slice(pageStartIndex, pageStartIndex + EMPLOYEE_PAGE_SIZE);
  const pageEmployeeSet = new Set(pageEmployees);
  const groupedRows = groupedWorkplaces.map(({ workplace, employees, departments }) => {
    const visibleDepartments = departments.filter(department => department.members.some(employee => pageEmployeeSet.has(employee)));
    if (!visibleDepartments.length) return "";
    const visibleWorkplaceCount = visibleDepartments.reduce((count, department) => count + department.members.filter(employee => pageEmployeeSet.has(employee)).length, 0);
    const workplaceCountLabel = visibleWorkplaceCount === employees.length ? `${employees.length} nhân viên` : `${visibleWorkplaceCount}/${employees.length} nhân viên trang này`;
    const departmentRows = visibleDepartments.map(({ department, members }) => {
      const visibleMembers = members.filter(employee => pageEmployeeSet.has(employee));
      const memberCountLabel = visibleMembers.length === members.length ? `${members.length} nhân viên` : `${visibleMembers.length}/${members.length} nhân viên trang này`;
      return `<details class="employee-subgroup" open><summary><span>▸ ${esc(department)}</span><b>${memberCountLabel}</b></summary>${renderEmployeeTable(visibleMembers)}</details>`;
    }).join("");
    return `<details class="employee-group" open><summary><span>▸ ${esc(workplace)}</span><b>${workplaceCountLabel}</b></summary>${departmentRows}</details>`;
  }).join("");
  const pageEndIndex = Math.min(pageStartIndex + pageEmployees.length, orderedEmployees.length);
  const firstVisiblePage = Math.max(1, Math.min(state.employeePage - 2, totalPages - 4));
  const visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstVisiblePage + index);
  const pagination = orderedEmployees.length ? `<div class="employee-pagination"><div class="employee-pagination-summary"><strong>${pageStartIndex + 1}–${pageEndIndex}</strong><span>trên ${orderedEmployees.length} nhân viên${query ? " phù hợp" : ""}</span></div><nav class="employee-pagination-controls" aria-label="Phân trang danh sách nhân viên"><button type="button" class="employee-page-button" data-employee-page="first" title="Trang đầu" aria-label="Trang đầu" ${state.employeePage === 1 ? "disabled" : ""}>≪</button><button type="button" class="employee-page-button" data-employee-page="prev" title="Trang trước" aria-label="Trang trước" ${state.employeePage === 1 ? "disabled" : ""}>‹</button>${visiblePages.map(page => `<button type="button" class="employee-page-button${page === state.employeePage ? " active" : ""}" data-employee-page="${page}" aria-label="Trang ${page}" ${page === state.employeePage ? 'aria-current="page"' : ""}>${page}</button>`).join("")}<button type="button" class="employee-page-button" data-employee-page="next" title="Trang sau" aria-label="Trang sau" ${state.employeePage === totalPages ? "disabled" : ""}>›</button><button type="button" class="employee-page-button" data-employee-page="last" title="Trang cuối" aria-label="Trang cuối" ${state.employeePage === totalPages ? "disabled" : ""}>≫</button></nav></div>` : "";
  return `<div class="page-title-row"><div><button class="link-btn" data-back-to-management>← Quay lại</button><h2 style="margin-top:8px">Danh sách nhân viên</h2><p>${state.employees.length} nhân viên${query ? ` • ${rows.length} kết quả` : ""}</p></div><div class="employee-page-actions"><label class="employee-search"><span>⌕</span><input id="employeeSearch" value="${esc(state.search)}" placeholder="Tìm tên, mã NV, số điện thoại..."></label><button class="btn btn-light" data-action="delete-all-employees" ${state.employees.length ? "" : "disabled"}>Xóa toàn bộ</button><button class="btn btn-primary" data-action="upload-employees">↑ Tải lên Excel</button></div></div>
 <div class="employee-groups">${groupedRows || `<div class="card"><div class="empty"><strong>Chưa có nhân viên</strong>Hãy tải lên file Excel danh sách nhân viên.</div></div>`}</div>${pagination}`;
}

function managementPage() {
  const items = [
    { page: "assets", title: "Tài sản / CCDC", icon: "▤", desc: "Quản lý thiết bị, bộ phận và tình trạng sử dụng" },
    { page: "maintenance", title: "Bảo trì", icon: "↻", desc: "Lịch bảo trì định kỳ và theo dõi kết quả" },
    { page: "storeVisits", title: "Lịch đi cửa hàng", icon: "▦", desc: "Theo dõi lịch xử lý và thực hiện tại cửa hàng" },
    { page: "departments", title: "Đơn vị / Phòng ban", icon: "♙", desc: "Quản lý đơn vị, người phụ trách và bộ phận" },
    { page: "employees", title: "Nhân viên", icon: "♟", desc: "Danh sách nhân viên và thông tin chi tiết" }
  ];

  return `<div class="page-title-row"><div><h2>QUẢN LÝ</h2><p>Nhóm chức năng vận hành và điều hành</p></div></div>
  <div class="grid-2">${items.map(item => `<button class="quick-tool" data-page-jump="${item.page}" style="padding:18px 16px; min-height:120px; align-items:flex-start"><span class="quick-tool-icon" style="font-size:18px">${item.icon}</span><span><strong>${item.title}</strong><small>${item.desc}</small></span></button>`).join("")}</div>`;
}

function reportsPage() {
  const total = state.tickets.length;
  const done = state.tickets.filter(t => t.step === 5).length;
  const rate = total ? Math.round((done / total) * 100) : 0;
  const high = state.tickets.filter(t => t.priority === "Cao" && t.step < 5).length;
  const hw = state.tickets.filter(t => t.type === "hardware").length;
  const sy = total - hw;
  return `${catalogMatrixHtml()}<div class="page-title-row"><div><h2>Báo cáo</h2><p>KPI và tình hình xử lý vấn đề</p></div><div class="filters"><button class="btn btn-light" data-action="export-excel">Xuất Excel</button><button class="btn btn-primary" data-action="export-pdf">Xuất PDF</button></div></div>
  <div class="stats">${stat("Tổng phiếu", total, "Tất cả quy trình", "✓")}${stat("Hoàn tất", done, "Đã bàn giao / đóng", "✓")}${stat("Tỷ lệ hoàn tất", `${rate}%`, "Hiệu suất xử lý", "%")}${stat("Ưu tiên cao", high, "Đang mở", "!")}</div>
  <div class="grid-2"><div class="card"><div class="card-head"><div><h3>Phân bổ ticket</h3><p>Theo loại quy trình</p></div></div><div class="kpi-list"><div class="kpi"><label>Phần cứng</label><div class="progress-line"><span style="width:${total ? (hw / total) * 100 : 0}%"></span></div><strong>${hw}</strong></div><div class="kpi"><label>Quản trị hệ thống</label><div class="progress-line"><span style="width:${total ? (sy / total) * 100 : 0}%"></span></div><strong>${sy}</strong></div></div></div>
  <div class="card"><div class="card-head"><div><h3>Tình trạng tài sản</h3><p>Thiết bị CNTT / CCDC</p></div></div><div class="kpi-list">${["Đang sử dụng", "Dự phòng", "Bảo trì", "Hỏng", "Thanh lý"].map(s => `<div class="kpi"><label>${s}</label><div class="progress-line"><span style="width:${state.assets.length ? (state.assets.filter(a => a.status === s).length / state.assets.length) * 100 : 0}%"></span></div><strong>${state.assets.filter(a => a.status === s).length}</strong></div>`).join("")}</div></div></div>`;
}

async function saveOperation(e) {
  e.preventDefault();
  if (!canManage()) { toast("Chỉ IT hoặc Admin được ghi nhận vận hành", "error"); return }
  const form = e.target; const data = Object.fromEntries(new FormData(form).entries()); const kind = data.kind; delete data.kind;
  data.createdAt = Date.now(); data.createdAtText = nowText(); data.checkedAt = data.date;
  return true;
}
function openOperationsModal(kind) {
  const form = $("#operationsForm"); form.reset(); form.elements.kind.value = kind; form.elements.date.value = new Date().toISOString().slice(0, 10); form.elements.status.value = kind === "uptime" ? "UP" : "Đã kiểm tra"; syncDropdowns(form); $("#operationsModalTitle").textContent = kind === "uptime" ? "Ghi nhận uptime" : "Ghi nhận backup / khôi phục"; $("#operationsModal").classList.remove("hidden");
}
async function exportExcel() {
  try { const xlsx = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm"); const rows = state.tickets.map(t => ({ Ma: t.id, TieuDe: t.title, Loai: t.type, UuTien: t.priority, TrangThai: t.status, Buoc: t.step, DonVi: t.department, PhuTrach: t.assignee })); const book = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet(rows), "Tickets"); xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet(state.assets), "TaiSan"); xlsx.writeFile(book, `bao-cao-it-${new Date().toISOString().slice(0, 10)}.xlsx`); toast("Đã xuất báo cáo Excel", "success") } catch (error) { toast(error.message, "error") }
}
function exportPdf() { const previous = document.title; document.title = `Bao cao IT ${new Date().toISOString().slice(0, 10)}`; window.print(); document.title = previous }

function settingsPage() {
  return `<div class="grid-2"><div class="card"><div class="card-head"><div><h3>Firebase</h3><p>Trạng thái kết nối</p></div>${firebaseReady ? '<span class="badge badge-green">Đã kết nối</span>' : '<span class="badge badge-orange">Demo / chưa cấu hình</span>'}</div><p style="font-size:10px;line-height:1.8;color:#596a75">${firebaseReady ? "Dữ liệu đang được đọc/ghi trực tiếp trên Firestore." : "Mở js/firebase-config.js và điền firebaseConfig. Hiện giao diện đang chạy bằng dữ liệu demo trên trình duyệt."}</p><button class="btn btn-light" data-action="open-config-help">Xem hướng dẫn Firebase</button></div>
 <div class="card"><div class="card-head"><div><h3>Dữ liệu hiện tại</h3><p>Thống kê collection</p></div></div><div class="kpi-list">${[["tickets", "Phiếu"], ["assets", "Tài sản"], ["departments", "Đơn vị"], ["maintenance", "Bảo trì"]].map(x => `<div class="kpi"><label>${x[1]}</label><div class="progress-line"><span style="width:100%"></span></div><strong>${state[x[0]].length}</strong></div>`).join("")}</div></div></div>
 <div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Hướng dẫn triển khai</h3><p>HTML + CSS + JavaScript thuần</p></div></div><ol style="font-size:10px;line-height:2;color:#596a75"><li>Tạo Firebase Project và Web App.</li><li>Bật Firestore Database.</li><li>Bật Authentication → Email/Password nếu dùng đăng nhập.</li><li>Dán cấu hình Web App vào <b>js/firebase-config.js</b>.</li><li>Thiết lập Firestore Security Rules theo file <b>firebase/firestore.rules</b>.</li><li>Đưa thư mục này lên IIS, Firebase Hosting hoặc web server nội bộ.</li></ol></div>`;
}

function bindPage() {
  $$('[data-edit-employee]').forEach(b => b.onclick = () => openEmployeeModal(state.employees.find(employee => employee.id === b.dataset.editEmployee)));
  $$('[data-edit-asset]').forEach(b => b.onclick = () => openAssetModal(state.assets.find(asset => asset.id === b.dataset.editAsset)));
  $$('[data-duplicate-asset]').forEach(b => b.onclick = () => openAssetModal(state.assets.find(asset => asset.id === b.dataset.duplicateAsset), true));
  $$('[data-asset-group]').forEach(button => button.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    const groupKey = button.dataset.assetGroup;
    const expanded = button.getAttribute("aria-expanded") === "true";
    $$('[data-asset-group-item]').filter(row => row.dataset.assetGroupItem === groupKey).forEach(row => { row.hidden = expanded; });
    button.setAttribute("aria-expanded", String(!expanded));
    button.querySelector("span").textContent = expanded ? "▸" : "▾";
  });
  $$('[data-action="new-store-visit"]').forEach(b => b.onclick = () => openStoreVisitModal());
  $$('[data-edit-store-visit]').forEach(b => b.onclick = () => openStoreVisitModal(state.storeVisits.find(row => row.id === b.dataset.editStoreVisit)));
  $$('[data-duplicate-store-visit]').forEach(b => b.onclick = () => openStoreVisitModal(state.storeVisits.find(row => row.id === b.dataset.duplicateStoreVisit), true));
  $$('[data-delete-store-visit]').forEach(b => b.onclick = () => deleteStoreVisit(b.dataset.deleteStoreVisit));
  $$('[data-action="new-maintenance-modal"]').forEach(b => b.onclick = () => openMaintenanceModal());
  $$('[data-action="new-uptime"]').forEach(b => b.onclick = () => openOperationsModal("uptime"));
  $$('[data-action="new-backup"]').forEach(b => b.onclick = () => openOperationsModal("backup"));
  $$('[data-system-focus]').forEach(b => b.onclick = () => { state.systemFocus = b.dataset.systemFocus || ""; render() });
  $$('[data-system-level]').forEach(b => b.onclick = () => { state.systemLevel = b.dataset.systemLevel; render() });
  $("#systemCatalogSearch")?.addEventListener("input", event => { state.systemQuery = event.target.value; const cursor = event.target.selectionStart; render(); const input = $("#systemCatalogSearch"); if (input) { input.focus(); input.setSelectionRange(cursor, cursor) } });
  $("#systemRequestStatus")?.addEventListener("change", event => { state.systemRequestStatus = event.target.value; state.listPages["requests-system"] = 1; state.listPages["requests-server"] = 1; render() });
  $$('[data-action="export-excel"]').forEach(b => b.onclick = exportExcel);
  $$('[data-action="export-pdf"]').forEach(b => b.onclick = exportPdf);
  $$('[data-edit-maintenance]').forEach(b => b.onclick = () => openMaintenanceModal(state.maintenance.find(row => row.id === b.dataset.editMaintenance)));
  $$('[data-delete-maintenance]').forEach(b => b.onclick = () => deleteMaintenance(b.dataset.deleteMaintenance));
  $$('[data-comment-ticket]').forEach(form => form.onsubmit = event => { event.preventDefault(); saveComment(form.dataset.commentTicket, form) });
  $$('[data-advance]').forEach(b => b.onclick = () => advanceTicket(b.dataset.advance));
  $$('[data-duplicate-ticket]').forEach(b => b.onclick = () => { const ticket = state.tickets.find(item => item.id === b.dataset.duplicateTicket); if (ticket) openTicketModal(ticket.type, ticket, "", true) });
  $$('[data-edit-ticket]').forEach(b => b.onclick = () => { const ticket = state.tickets.find(item => item.id === b.dataset.editTicket); if (ticket) openTicketModal(ticket.type, ticket) });
  $$('[data-delete-ticket]').forEach(b => b.onclick = () => deleteTicket(b.dataset.deleteTicket));
  $$('[data-approve-ticket]').forEach(button => button.onclick = () => approveTicket(button.dataset.approveTicket, button.dataset.decision));
  $("#ticketType")?.addEventListener("change", event => { state.ticketType = event.target.value; state.listPages.tickets = 1; render() });
  $("#ticketPriority")?.addEventListener("change", event => { state.ticketPriority = event.target.value; state.listPages.tickets = 1; render() });
  $$('[data-delete-employee]').forEach(b => b.onclick = () => deleteEmployee(b.dataset.deleteEmployee));
  $$('[data-action="delete-all-employees"]').forEach(b => b.onclick = deleteAllEmployees);
  $$('[data-employee-page]').forEach(button => button.onclick = () => {
    const query = normalizeEmployeeSearch(state.search);
    const matchingCount = state.employees.filter(employee => normalizeEmployeeSearch(`${employee.name || ""} ${employee.employeeCode || employee.code || employee.maNV || ""} ${employee.phone || ""}`).includes(query)).length;
    const totalPages = Math.max(1, Math.ceil(matchingCount / EMPLOYEE_PAGE_SIZE));
    const requestedPage = button.dataset.employeePage;
    const page = requestedPage === "first" ? 1 : requestedPage === "last" ? totalPages : requestedPage === "next" ? state.employeePage + 1 : requestedPage === "prev" ? state.employeePage - 1 : Number(requestedPage);
    state.employeePage = Math.max(1, Math.min(page || 1, totalPages));
    render();
    document.querySelector(`[data-employee-page="${state.employeePage}"]`)?.focus();
  });
  $$('[data-list-page]').forEach(button => button.onclick = () => {
    const listKey = button.dataset.listPage;
    const currentPage = state.listPages[listKey] || 1;
    const totalPages = Number(button.dataset.totalPages) || 1;
    const action = button.dataset.pageAction;
    const page = action === "first" ? 1 : action === "last" ? totalPages : action === "next" ? currentPage + 1 : action === "prev" ? currentPage - 1 : Number(action);
    state.listPages[listKey] = Math.max(1, Math.min(page || 1, totalPages));
    render();
    document.querySelector(`[data-list-page="${listKey}"][data-page-action="${state.listPages[listKey]}"]`)?.focus();
  });
  $("#employeeSearch")?.addEventListener("input", event => { state.search = event.target.value; state.employeePage = 1; const cursor = event.target.selectionStart; render(); const input = $("#employeeSearch"); if (input) { input.focus(); input.setSelectionRange(cursor, cursor) } });
  $$('[data-back-to-management]').forEach(b => b.onclick = () => { state.page = "management"; render(); });
  $$("[data-page-jump]").forEach(b => b.onclick = () => { state.page = b.dataset.pageJump; render() });
  $$("[data-action='new-ticket']").forEach(b => b.onclick = () => openTicketModal(b.dataset.ticketType || b.dataset.type || "hardware", null, b.dataset.ticketSystem || ""));
  $$("[data-open-hardware-details]").forEach(button => button.onclick = () => $("#hardwareDetailsModal")?.classList.remove("hidden"));
  $$("[data-action='new-asset']").forEach(b => b.onclick = openAssetModal);
  $$("[data-action='new-department']").forEach(b => b.onclick = openDepartmentModal);
  $$("[data-action='new-maintenance']").forEach(() => toast("Module lịch bảo trì chi tiết sẽ dùng collection maintenance.", "success"));
  $$("[data-advance]").forEach(b => b.onclick = () => advanceTicket(b.dataset.advance));
    $$("[data-view-ticket]").forEach(b => b.onclick = () => viewTicket(b.dataset.viewTicket));
    $$("[data-delete-asset]").forEach(b => b.onclick = () => deleteAsset(b.dataset.deleteAsset));
    $$("[data-edit-dept]").forEach(b => b.onclick = () => openDepartmentModal(state.departments.find(d => d.id === b.dataset.editDept)));
    $$("[data-delete-dept]").forEach(b => b.onclick = () => deleteDepartment(b.dataset.deleteDept));
    $$('tr[data-ticket]').forEach(r => r.onclick = event => { if (!event.target.closest("button")) viewTicket(r.dataset.ticket) });
    $$("[data-action='upload-departments']").forEach(b => b.onclick = () => $("#departmentUpload").click());
    $$("[data-action='upload-employees']").forEach(b => b.onclick = () => $("#employeeUpload").click());
  $$("[data-delete-asset]").forEach(b => b.onclick = () => deleteAsset(b.dataset.deleteAsset));
  $$("[data-edit-dept]").forEach(b => b.onclick = () => openDepartmentModal(state.departments.find(d => d.id === b.dataset.editDept)));
  $$("[data-delete-dept]").forEach(b => b.onclick = () => deleteDepartment(b.dataset.deleteDept));
  $$('tr[data-ticket]').forEach(r => r.onclick = event => { if (!event.target.closest("button")) viewTicket(r.dataset.ticket) });
  $$("[data-action='upload-departments']").forEach(b => b.onclick = () => $("#departmentUpload").click());
  $$("[data-action='upload-employees']").forEach(b => b.onclick = () => $("#employeeUpload").click());
}

async function addDoc(collectionName, data) {
  if (firebaseReady) {
    const fs = await import(`${FBASE}/firebase-firestore.js`);
    const ref = await fs.addDoc(fs.collection(db, collectionName), data);
    await fs.addDoc(fs.collection(db, "audit"), { action: "CREATE", collection: collectionName, targetId: ref.id, createdAt: Date.now(), createdAtText: nowText(), user: actorName(), role: currentRole });
    return ref.id;
  }
  const id = collectionName === "tickets" ? `HD-${String(state.tickets.length + 1).padStart(4, "0")}` : uid();
  state[collectionName].unshift({ id, ...data });
  return id;
}
async function uploadEvidence(file, folder, recordId) {
  if (!file || !firebaseReady || !firebaseApp) return "";
  const storageMod = await import(`${FBASE}/firebase-storage.js`);
  const storage = storageMod.getStorage(firebaseApp);
  const fileRef = storageMod.ref(storage, `${folder}/${recordId || uid()}-${file.name}`);
  await storageMod.uploadBytes(fileRef, file);
  return storageMod.getDownloadURL(fileRef);
}
async function updateDocRemote(collectionName, id, data) {
  if (firebaseReady) {
    const fs = await import(`${FBASE}/firebase-firestore.js`);
    await fs.updateDoc(fs.doc(db, collectionName, id), data);
    await fs.addDoc(fs.collection(db, "audit"), { action: "UPDATE", collection: collectionName, targetId: id, changes: data, createdAt: Date.now(), createdAtText: nowText(), user: actorName(), role: currentRole });
  } else {
    const i = state[collectionName].findIndex(x => x.id === id); if (i >= 0) state[collectionName][i] = { ...state[collectionName][i], ...data };
  }
}
async function deleteDocRemote(collectionName, id) {
  if (firebaseReady) {
    const fs = await import(`${FBASE}/firebase-firestore.js`);
    await fs.deleteDoc(fs.doc(db, collectionName, id));
    await fs.addDoc(fs.collection(db, "audit"), { action: "DELETE", collection: collectionName, targetId: id, createdAt: Date.now(), createdAtText: nowText(), user: actorName(), role: currentRole });
  } else state[collectionName] = state[collectionName].filter(x => x.id !== id);
}

async function deleteTicket(id) {
  if (!canManage()) { toast("Chỉ IT hoặc Admin được xóa yêu cầu", "error"); return }
  const ticket = state.tickets.find(item => item.id === id);
  if (!ticket) return;
  try {
    await deleteDocRemote("tickets", id);
    toast("Đã xóa yêu cầu", "success");
    render();
  } catch (error) { toast(error.message, "error") }
}

async function saveTicket(e) {
  e.preventDefault(); const fd = new FormData(e.target); const data = Object.fromEntries(fd.entries());
  const edit = data.id; delete data.id;
  const evidenceFile = data.evidenceFile; delete data.evidenceFile;
  const existing = edit ? state.tickets.find(x => x.id === edit) : null;
  if (edit && !canManage() && existing?.createdByUid !== user?.uid) { toast("Bạn không có quyền sửa phiếu này", "error"); return }
  const requester = employeeByNameOrCode(data.requester, existing?.requesterEmployeeCode);
  const assignee = employeeByNameOrCode(data.assignee, existing?.assigneeEmployeeCode);
  if (requester) data.requesterEmployeeCode = requester.employeeCode || "";
  if (assignee) data.assigneeEmployeeCode = assignee.employeeCode || "";
  data.step = existing?.step || 1; data.status = existing?.status || "Chờ kiểm tra"; data.createdAt = existing?.createdAt || Date.now(); data.createdAtText = existing?.createdAtText || nowText(); data.updatedAt = Date.now(); data.updatedAtText = nowText(); data.createdByUid = existing?.createdByUid || user?.uid || "demo"; data.requesterUid = existing?.requesterUid || user?.uid || "demo";
  try { if (evidenceFile?.size) data.evidenceUrl = await uploadEvidence(evidenceFile, "ticket-evidence", edit); await (edit ? updateDocRemote("tickets", edit, data) : addDoc("tickets", data)); if (data.assignee && data.assignee !== existing?.assignee) await notify(data.assignee, "Bạn được giao ticket", data.title, edit || ""); closeModal("ticketModal"); toast(edit ? "Đã cập nhật phiếu" : "Đã tạo yêu cầu thành công", "success"); render() } catch (err) { toast(err.message, "error") }
}

async function saveComment(ticketId, form) {
  const text = form.elements.comment.value.trim();
  if (!text) return;
  try { await addDoc("comments", { ticketId, text, author: actorName(), authorUid: user?.uid || "demo", createdAt: Date.now(), createdAtText: nowText() }); form.reset(); viewTicket(ticketId); toast("Đã thêm bình luận", "success") } catch (error) { toast(error.message, "error") }
}

async function approveTicket(id, decision) {
  if (!canManage() && currentRole !== "department_manager") { toast("Bạn không có quyền phê duyệt", "error"); return }
  const ticket = state.tickets.find(item => item.id === id); if (!ticket) return;
  const approval = { ticketId: id, decision, approver: actorName(), role: currentRole, createdAt: Date.now(), createdAtText: nowText() };
  try { await updateDocRemote("tickets", id, { purchaseApproval: decision, approvalUpdatedAt: Date.now(), approvalUpdatedBy: actorName() }); await addDoc("approvals", approval); if (ticket.assignee) await notify(ticket.assignee, `Phê duyệt: ${decision}`, ticket.title, id); viewTicket(id); toast(`Đã ghi nhận ${decision.toLowerCase()}`, "success") } catch (error) { toast(error.message, "error") }
}

async function saveMaintenance(e) {
  e.preventDefault();
  if (!canManage()) { toast("Chỉ IT hoặc Admin được quản lý lịch bảo trì", "error"); return }
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const id = data.id; delete data.id;
  const evidenceFile = data.evidenceFile; delete data.evidenceFile;
  const existing = id ? state.maintenance.find(row => row.id === id) : null;
  data.createdAt = existing?.createdAt || Date.now(); data.createdAtText = existing?.createdAtText || nowText(); data.updatedAt = Date.now();
  const assignee = employeeByNameOrCode(data.assignee, existing?.assigneeEmployeeCode);
  if (assignee) data.assigneeEmployeeCode = assignee.employeeCode || "";
  try { if (evidenceFile?.size) data.evidenceUrl = await uploadEvidence(evidenceFile, "maintenance-evidence", id); await (id ? updateDocRemote("maintenance", id, data) : addDoc("maintenance", data)); closeModal("maintenanceModal"); toast(id ? "Đã cập nhật lịch bảo trì" : "Đã tạo lịch bảo trì", "success"); render() } catch (err) { toast(err.message, "error") }
}

function openMaintenanceModal(row = null) {
  const form = $("#maintenanceForm"); form.reset(); form.elements.id.value = row?.id || "";
  ["title", "target", "assignee", "dueDate", "cycle", "status", "result", "evidenceUrl"].forEach(field => { if (form.elements[field]) form.elements[field].value = row?.[field] || "" });
  renderEmployeePicker("maintenanceAssignee", row?.assignee || "", "#maintenanceForm");
  syncDropdowns(form);
  $("#maintenanceModalTitle").textContent = row ? "Chỉnh sửa lịch bảo trì" : "Tạo lịch bảo trì";
  $("#maintenanceModal").classList.remove("hidden");
}

async function deleteMaintenance(id) { if (!confirm("Xóa lịch bảo trì này?")) return; try { await deleteDocRemote("maintenance", id); toast("Đã xóa lịch bảo trì", "success"); render() } catch (e) { toast(e.message, "error") } }
async function saveAsset(e) {
  e.preventDefault(); const form = e.target; const data = Object.fromEntries(new FormData(form).entries()); const id = data.id; delete data.id;
  const existing = id ? state.assets.find(asset => asset.id === id) : null;
  data.createdAt = existing?.createdAt || Date.now(); data.createdAtText = existing?.createdAtText || nowText(); data.updatedAt = Date.now();
  const owner = employeeByNameOrCode(data.owner, existing?.ownerEmployeeCode);
  if (owner) data.ownerEmployeeCode = owner.employeeCode || "";
  try { await (id ? updateDocRemote("assets", id, data) : addDoc("assets", data)); closeModal("assetModal"); toast(id ? "Đã cập nhật tài sản" : "Đã thêm tài sản", "success"); render() } catch (err) { toast(err.message, "error") }
}
async function saveStoreVisit(e) {
  e.preventDefault();
  if (!canManage()) {
    toast("Bạn cần role admin hoặc it để tạo lịch đi cửa hàng", "error");
    return;
  }
  const form = e.target;
  const id = form.elements.id.value;
  const existing = id ? state.storeVisits.find(row => row.id === id) : null;
  const performers = getSelectedVisitPerformers();
  const data = {
    visitDate: form.elements.visitDate.value,
    visitTime: form.elements.visitTime.value,
    content: form.elements.content.value.trim(),
    department: form.elements.department.value.trim(),
    performers,
    performerCodes: performers.map(name => employeeByNameOrCode(name)?.employeeCode || ""),
    status: form.elements.status.value,
    notes: form.elements.notes.value.trim(),
    createdByUid: user?.uid || "demo",
    createdBy: actorName(),
    createdAt: existing?.createdAt || Date.now(),
    createdAtText: existing?.createdAtText || nowText(),
    updatedAt: Date.now()
  };
  try {
    await (id ? updateDocRemote("storeVisits", id, data) : addDoc("storeVisits", data));
    closeModal("storeVisitModal");
    toast(id ? "Đã cập nhật lịch" : "Đã thêm lịch đi cửa hàng", "success");
    render();
  } catch (err) {
    const message = String(err?.code || err?.message || "");
    toast(message.includes("permission-denied") ? "Không có quyền ghi lịch. Kiểm tra role admin/it trong Firebase." : err.message, "error");
  }
}

async function saveDepartment(e) {
  e.preventDefault(); const form = e.target; const id = form.elements.id.value; const data = { name: form.elements.name.value.trim(), code: form.elements.code.value.trim(), managers: [...form.querySelectorAll(".manager-row")].map(row => ({ name: row.querySelector("[data-field='name']").value.trim(), title: row.querySelector("[data-field='title']").value.trim(), employeeCode: row.querySelector("[data-field='employeeCode']").value.trim(), phone: row.querySelector("[data-field='phone']").value.trim() })).filter(manager => manager.name), updatedAt: Date.now(), updatedAtText: nowText() };
  try { if (id) await updateDocRemote("departments", id, data); else { data.createdAt = Date.now(); data.createdAtText = nowText(); await addDoc("departments", data) } closeModal("departmentModal"); toast(id ? "Đã cập nhật đơn vị" : "Đã thêm đơn vị", "success"); render() } catch (err) { toast(err.message, "error") }
}
function addManagerRow(manager = {}) {
  const row = document.createElement("div"); row.className = "manager-row"; row.style.cssText = "display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr auto;gap:7px;margin-bottom:8px;align-items:start";
  row.innerHTML = `<input data-field="name" placeholder="Họ tên" value="${esc(manager.name || "")}"><input data-field="title" placeholder="Chức danh" value="${esc(manager.title || "")}"><input data-field="employeeCode" placeholder="Mã NV" value="${esc(manager.employeeCode || "")}"><input data-field="phone" type="tel" placeholder="SĐT" value="${esc(manager.phone || "")}"><button type="button" class="small-btn" data-remove-manager>×</button>`;
  row.querySelector("[data-remove-manager]").onclick = () => { if ($("#managerRows").children.length > 1) row.remove() };
  $("#managerRows").append(row);
}
function setManagerRows(managers) {
  $("#managerRows").innerHTML = "";
  (managers?.length ? managers : [{}]).forEach(addManagerRow);
}
async function uploadDepartments(file) {
  const xlsx = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const workbook = xlsx.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const values = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  if (values.length < 2) throw new Error("File Excel cần có dòng tiêu đề và ít nhất một đơn vị.");
  const normalizeHeader = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
  const headers = values.shift().map(normalizeHeader);
  const findHeader = names => headers.findIndex(header => names.includes(header));
  const nameIndex = findHeader(["name", "ten don vi", "don vi", "ten phong ban"]), codeIndex = findHeader(["code", "ma don vi", "ma phong ban"]), titleIndex = findHeader(["title", "chuc danh"]), employeeCodeIndex = findHeader(["employeecode", "employee code", "ma nhan vien", "ma nv"]), phoneIndex = findHeader(["phone", "sdt", "so dien thoai", "dien thoai"]), managerIndex = findHeader(["manager", "ho ten", "nguoi quan ly", "nguoi phu trach"]);
  if (nameIndex < 0) throw new Error("Excel cần có cột Tên đơn vị hoặc name.");
  const imported = values.map(row => ({ name: String(row[nameIndex] || "").trim(), code: String(row[codeIndex] || "").trim(), manager: { name: String(row[managerIndex] || "").trim(), title: String(row[titleIndex] || "").trim(), employeeCode: String(row[employeeCodeIndex] || "").trim(), phone: String(row[phoneIndex] || "").trim() } })).filter(row => row.name);
  const rows = Object.values(imported.reduce((groups, row) => { const key = row.name.toLowerCase(); groups[key] ??= { name: row.name, code: row.code, managers: [] }; if (row.manager.name) groups[key].managers.push(row.manager); return groups }, {}));
  if (!rows.length) throw new Error("Không tìm thấy đơn vị hợp lệ trong file Excel.");
  for (const row of rows) { row.createdAt = Date.now(); row.createdAtText = nowText(); await addDoc("departments", row) }
  toast(`Đã tải lên ${rows.length} đơn vị`, "success"); render();
}
async function uploadEmployees(file) {
  if (!canManage()) throw new Error("Chỉ IT hoặc Admin được tải lên danh sách nhân viên.");
  const xlsx = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const workbook = xlsx.read(await file.arrayBuffer(), { type: "array" });
  const normalizeHeader = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
  const rows = [];
  for (const sheetName of workbook.SheetNames) {
    const values = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
    const headerRowIndex = values.findIndex(row => {
      const headers = row.map(normalizeHeader);
      return headers.some(header => ["ma", "code", "ma nhan vien", "ma nv"].includes(header)) && headers.some(header => ["ho va ten", "ho ten", "name"].includes(header));
    });
    if (headerRowIndex < 0) continue;
    const headers = values[headerRowIndex].map(normalizeHeader);
    const findHeader = names => headers.findIndex(header => names.includes(header));
    const indexes = { status: findHeader(["trang thai", "status"]), employeeCode: findHeader(["ma", "code", "ma nhan vien", "ma nv"]), name: findHeader(["ho va ten", "ho ten", "name"]), workplace: findHeader(["noi lam viec", "workplace"]), attendanceId: findHeader(["id cham cong", "ma cham cong", "id attendance", "attendance id"]), department: findHeader(["ten bo phan hien tai", "ten don vi", "bo phan", "department"]), title: findHeader(["chuc danh", "title"]), detailedTitle: findHeader(["chuc danh chi tiet", "detailed title"]), actingTitle: findHeader(["chuc danh ct kiem nhiem", "chuc danh kiem nhiem", "acting title"]), phone: findHeader(["dien thoai", "sdt", "so dien thoai", "phone"]), birthDate: findHeader(["ngay sinh", "birth date"]), gender: findHeader(["gioi tinh", "gender"]), email: findHeader(["email", "e-mail"]) };
    if (indexes.employeeCode < 0 || indexes.name < 0) continue;
    values.slice(headerRowIndex + 1).filter(row => row.some(value => String(value ?? "").trim())).forEach(row => {
      const employee = Object.fromEntries(Object.entries(indexes).map(([key, index]) => [key, String(index >= 0 ? (row[index] ?? "") : "").trim()]));
      if (employee.employeeCode && employee.name) rows.push(employee);
    });
  }
  if (!rows.length) throw new Error("Không tìm thấy nhân viên hợp lệ trong file Excel.");
  const duplicateCodes = rows.map(row => row.employeeCode).filter((code, index, all) => all.indexOf(code) !== index);
  if (duplicateCodes.length) throw new Error(`File có mã nhân viên trùng: ${[...new Set(duplicateCodes)].join(", ")}`);
  let updatedCount = 0, createdCount = 0;
  const existingRows = rows.map(row => ({ row, existing: state.employees.find(employee => employee.employeeCode === row.employeeCode) }));
  const now = Date.now();
  existingRows.forEach(({ row }) => { row.createdAt = row.createdAt || now; row.createdAtText = row.createdAtText || nowText(); });
  if (firebaseReady) {
    const fs = await import(`${FBASE}/firebase-firestore.js`);
    for (let start = 0; start < existingRows.length; start += 450) {
      const batch = fs.writeBatch(db);
      existingRows.slice(start, start + 450).forEach(({ row, existing }) => {
        if (existing) batch.update(fs.doc(db, "employees", existing.id), row);
        else batch.set(fs.doc(fs.collection(db, "employees")), row);
      });
      await batch.commit();
    }
    updatedCount = existingRows.filter(item => item.existing).length;
    createdCount = existingRows.length - updatedCount;
    await fs.addDoc(fs.collection(db, "audit"), { action: "BATCH_IMPORT", collection: "employees", createdCount, updatedCount, count: rows.length, createdAt: Date.now(), createdAtText: nowText(), user: actorName(), role: currentRole });
    for (const { row, existing } of existingRows) if (existing) await syncEmployeeReferences(existing, { ...existing, ...row });
  } else {
    for (const { row, existing } of existingRows) {
      if (existing) { await updateDocRemote("employees", existing.id, row); await syncEmployeeReferences(existing, { ...existing, ...row }); updatedCount += 1; }
      else { await addDoc("employees", row); createdCount += 1; }
    }
  }
  state.employeePage = 1;
  toast(`Đã nhập ${createdCount} mới, cập nhật ${updatedCount} nhân viên và đồng bộ dữ liệu liên quan`, "success"); render();
}
async function advanceTicket(id) {
  const t = state.tickets.find(x => x.id === id); if (!t) return;
  if (!canManage()) { toast("Chỉ IT hoặc Admin được chuyển bước", "error"); return }
  const step = Math.min(5, (t.step || 1) + 1), status = step === 5 ? "Hoàn tất" : "Đang xử lý";
  const history = { ticketId: id, createdByUid: t.createdByUid || user?.uid || "demo", department: t.department || "", fromStep: t.step || 1, toStep: step, status, note: t.resolution || t.description || "", evidenceUrl: t.evidenceUrl || "", actor: actorName(), role: currentRole, createdAt: Date.now(), createdAtText: nowText() };
  try {
    await updateDocRemote("tickets", id, { step, status, updatedAt: Date.now(), updatedAtText: nowText(), stepUpdatedAt: Date.now(), stepUpdatedBy: actorName() });
    await addDoc("ticketHistory", history);
    if (t.requester) await notify(t.requester, step === 5 ? "Ticket đã hoàn tất" : "Ticket đã chuyển bước", `${t.title} • Bước ${step}/5`, id);
    if (step === 5 && t.linkedAssetCode && t.handoverRecipient) {
      const asset = state.assets.find(item => item.code === t.linkedAssetCode);
      if (asset) {
        const handover = { ticketId: id, recipient: t.handoverRecipient, date: t.handoverDate || nowText(), actor: actorName(), record: t.handoverRecord || "" };
        await updateDocRemote("assets", asset.id, { owner: t.handoverRecipient, status: "Đang sử dụng", handoverHistory: [...(asset.handoverHistory || []), handover], updatedAt: Date.now() });
      }
    }
    toast(`Đã chuyển ${t.id} sang bước ${step}/5`, "success"); render();
  } catch (e) { toast(e.message, "error") }
}
async function deleteAsset(id) { if (!confirm("Xóa tài sản này?")) return; try { await deleteDocRemote("assets", id); toast("Đã xóa tài sản", "success"); render() } catch (e) { toast(e.message, "error") } }
async function deleteStoreVisit(id) { if (!confirm("Xóa lịch đi cửa hàng này?")) return; try { await deleteDocRemote("storeVisits", id); toast("Đã xóa lịch", "success"); render() } catch (e) { toast(e.message, "error") } }
async function deleteDepartment(id) { if (!confirm("Xóa đơn vị này?")) return; try { await deleteDocRemote("departments", id); toast("Đã xóa đơn vị", "success"); render() } catch (e) { toast(e.message, "error") } }
async function deleteEmployee(id) { if (!canManage()) { toast("Chỉ IT hoặc Admin được xóa nhân viên", "error"); return } if (!confirm("Xóa nhân viên này?")) return; try { await deleteDocRemote("employees", id); toast("Đã xóa nhân viên", "success"); render() } catch (e) { toast(e.message, "error") } }
async function deleteAllEmployees() {
  if (!canManage()) { toast("Chỉ IT hoặc Admin được xóa danh sách nhân viên", "error"); return }
  if (!state.employees.length || !confirm(`Bạn chắc chắn muốn xóa toàn bộ ${state.employees.length} nhân viên?`)) return;
  if (!confirm("Xác nhận lần cuối: dữ liệu nhân viên sẽ bị xóa khỏi Firebase.")) return;
  try {
    const employees = [...state.employees];
    if (firebaseReady) {
      const fs = await import(`${FBASE}/firebase-firestore.js`);
      for (let start = 0; start < employees.length; start += 450) {
        const batch = fs.writeBatch(db);
        employees.slice(start, start + 450).forEach(employee => batch.delete(fs.doc(db, "employees", employee.id)));
        await batch.commit();
      }
      await fs.addDoc(fs.collection(db, "audit"), { action: "BATCH_DELETE", collection: "employees", targetId: "all", count: employees.length, createdAt: Date.now(), createdAtText: nowText(), user: actorName(), role: currentRole });
    } else {
      state.employees = [];
    }
    state.employeePage = 1;
    toast(`Đã xóa ${employees.length} nhân viên`, "success");
    render();
  } catch (e) { toast(e.message, "error") }
}
function openEmployeeModal(employee) {
  const form = $("#employeeForm"); form.reset(); form.elements.id.value = employee.id; Object.keys(employee).forEach(key => { if (form.elements[key]) form.elements[key].value = employee[key] ?? "" }); $("#employeeModal").classList.remove("hidden");
}
async function saveEmployee(e) {
  e.preventDefault(); const form = e.target, id = form.elements.id.value; const data = Object.fromEntries(new FormData(form).entries()); delete data.id; data.updatedAt = Date.now(); data.updatedAtText = nowText();
  const previous = state.employees.find(employee => employee.id === id);
  try { await updateDocRemote("employees", id, data); await syncEmployeeReferences(previous || {}, { ...previous, ...data, id }); closeModal("employeeModal"); toast("Đã cập nhật nhân viên và đồng bộ các form liên quan", "success"); render() } catch (err) { toast(err.message, "error") }
}

function renderTicketStepper(step = 1) {
  const labels = ["Yêu cầu", "Kiểm tra / giao việc", "Đề xuất / xử lý", "Mua sắm CCDC", "Bàn giao"];
  const currentStep = Math.min(5, Math.max(1, Number(step) || 1));
  const stepper = $("#ticketStepper");
  if (!stepper) return;
  stepper.innerHTML = labels.map((label, index) => {
    const stepNumber = index + 1;
    const stateClass = stepNumber < currentStep ? "completed" : stepNumber === currentStep ? "current" : "pending";
    return `<button type="button" class="ticket-step ${stateClass}" data-ticket-step="${stepNumber}"><span>${stepNumber}</span><small>${label}</small></button>`;
  }).join("");
  showTicketStep(currentStep);
}
function showTicketStep(step = 1) {
  const stepFields = [
    ["type", "priority", "title", "department", "requester", "assignee", "systemName", "description", "resolution"],
    ["inspectionChecklist", "inspectionDate", "inspectionResult", "workAssignment", "inspectionDueDate"],
    ["proposal", "rootCause", "actionPlan", "impactLevel", "estimatedResolutionTime", "requiredSupport"],
    ["supplier", "quotationNumber", "estimatedCost", "purchaseApproval", "purchaseReason", "purchaseQuantity", "expectedPurchaseDate", "warrantyPeriod", "budgetSource", "purchaseDetails"],
    ["handoverRecipient", "handoverDate", "handoverCondition", "handoverStatus", "handoverAccessories", "handoverRecord", "linkedAssetCode", "handoverConfirmedBy", "handoverNotes", "evidenceFile", "evidenceUrl"]
  ];
  const currentStep = Math.min(5, Math.max(1, Number(step) || 1));
  const form = $("#ticketForm");
  if (!form) return;
  form.querySelectorAll(".form-grid > label").forEach(label => {
    const field = label.querySelector("[name]");
    label.hidden = !field || !stepFields[currentStep - 1].includes(field.name);
  });
  const sectionSteps = [1, 2, 3, 4, 5];
  form.querySelectorAll(".form-section").forEach((section, index) => { section.hidden = sectionSteps[index] !== currentStep; });
  $("#ticketStepper")?.querySelectorAll("[data-ticket-step]").forEach(button => {
    button.classList.toggle("selected", Number(button.dataset.ticketStep) === currentStep);
  });
}
function openTicketModal(type = "hardware", ticket = null, presetSystemName = "", duplicate = false) {
  enhanceDropdowns();
  $("#ticketModal").classList.remove("hidden"); const f = $("#ticketForm"); f.reset();
  $("#ticketModalTitle").textContent = duplicate ? "Nhân bản yêu cầu" : ticket ? "Chỉnh sửa yêu cầu" : "Tạo yêu cầu mới";
  renderTicketStepper(ticket?.step || 1);
  $("#ticketStepper")?.querySelectorAll("[data-ticket-step]").forEach(button => button.onclick = () => showTicketStep(button.dataset.ticketStep));
  f.elements.type.value = ticket?.type || type;
  if (presetSystemName) {
    f.elements.systemName.value = presetSystemName;
  }
  if (ticket) Object.keys(ticket).forEach(k => { if (f.elements[k] && (!duplicate || k !== "id")) f.elements[k].value = ticket[k] ?? "" });
  if (duplicate) f.elements.id.value = "";
  renderDepartmentPicker(f.elements.department.value || "", "#ticketForm .department-picker");
  syncDropdowns(f);
  ["requester", "assignee"].forEach(fieldName => {
    const picker = f.querySelector(`.employee-picker[data-field="${fieldName}"]`);
    if (!picker) return;
    const hiddenInput = picker.querySelector("input[type='hidden']");
    const selectedName = ticket?.[fieldName] || "";
    hiddenInput.value = selectedName;
    renderEmployeePicker(fieldName, selectedName);
  });
}
function openAssetModal(asset = null, duplicate = false) {
  const form = $("#assetForm");
  form.reset();
  form.elements.id.value = duplicate ? "" : asset?.id || "";
  ["code", "category", "name", "serial", "location", "status", "purchaseDate"].forEach(field => { if (form.elements[field]) form.elements[field].value = asset?.[field] || ""; });
  syncDropdowns(form);
  const ownerInput = form.querySelector(".employee-picker[data-field='assetOwner'] input[type='hidden']");
  ownerInput.value = asset?.owner || "";
  renderEmployeePicker("assetOwner", asset?.owner || "", "#assetForm");
  const departmentPicker = form.querySelector(".asset-picker[data-picker-type='department']");
  if (departmentPicker) { departmentPicker.querySelector("input[type='hidden']").value = asset?.department || ""; renderAssetPicker(departmentPicker, asset?.department || ""); }
  $("#assetModal h2").textContent = duplicate ? "Nhân bản tài sản / CCDC" : asset ? "Chỉnh sửa tài sản / CCDC" : "Thêm tài sản / CCDC";
  $("#assetModal").classList.remove("hidden");
}
function openStoreVisitModal(row = null, duplicate = false) {
  const form = $("#storeVisitForm");
  form.reset();
  form.elements.id.value = duplicate ? "" : row?.id || "";
  form.elements.visitDate.value = row?.visitDate || new Date().toISOString().slice(0, 10);
  form.elements.visitTime.value = row?.visitTime || "07:00";
  form.elements.content.value = row?.content || "";
  updateDepartmentsDatalist();
  form.elements.department.value = row?.department || "";
  renderDepartmentPicker(row?.department || "");
  form.elements.status.value = row?.status || "CHƯA XỬ LÝ";
  syncDropdowns(form);
  form.elements.notes.value = row?.notes || "";
  const selected = Array.isArray(row?.performers) ? row.performers : String(row?.performers || "").split(",").map(name => name.trim()).filter(Boolean);
  form.elements.performers.value = selected.join(", ");
  renderVisitPerformersPicker(selected);
  $("#storeVisitModalTitle").textContent = duplicate ? "Nhân bản lịch đi cửa hàng" : row ? "Chỉnh sửa lịch đi cửa hàng" : "Thêm lịch đi cửa hàng";
  $("#storeVisitModal").classList.remove("hidden");
}
function openDepartmentModal(department = null) { const form = $("#departmentForm"); $("#departmentModal").classList.remove("hidden"); form.reset(); form.elements.id.value = department?.id || ""; form.elements.name.value = department?.name || ""; form.elements.code.value = department?.code || ""; $("#departmentModal h2").textContent = department ? "Chỉnh sửa phòng ban / đơn vị" : "Thêm phòng ban / đơn vị"; setManagerRows(department?.managers?.length ? department.managers : department?.manager ? [{ name: department.manager, title: department.title, employeeCode: department.employeeCode, phone: department.phone }] : []) }
function closeModal(id) { $("#" + id)?.classList.add("hidden") }
function viewTicket(id) {
  const t = state.tickets.find(x => x.id === id); if (!t) return;
  const steps = t.type === "hardware" ? hardwareSteps : systemSteps;
  const historyHtml = state.ticketHistory.filter(item => item.ticketId === id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(item => {
    const evidence = item.evidenceUrl ? ` • <a href="${esc(item.evidenceUrl)}" target="_blank" rel="noreferrer">Bằng chứng</a>` : "";
    return `<p><b>Bước ${esc(item.fromStep)} → ${esc(item.toStep)}</b> • ${esc(item.actor || "-")} • ${esc(item.createdAtText || "-")}<br>${esc(item.note || "-")}${evidence}</p>`;
  }).join("") || "<p>Chưa có lịch sử chuyển bước.</p>";
  const commentsHtml = state.comments.filter(item => item.ticketId === id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(item => `<p><b>${esc(item.author || "-")}</b> • ${esc(item.createdAtText || "-")}<br>${esc(item.text)}</p>`).join("") || "<p>Chưa có bình luận.</p>";
  const approvalControls = canManage() || currentRole === "department_manager" ? `<div class="ticket-actions"><button class="small-btn" data-approve-ticket="${esc(id)}" data-decision="Đã duyệt">Duyệt</button><button class="small-btn" data-approve-ticket="${esc(id)}" data-decision="Từ chối">Từ chối</button></div>` : "";
  $("#page").innerHTML = `<div class="page-title-row"><div><button class="link-btn" data-back>← Quay lại</button><h2 style="margin-top:8px">${esc(t.title)}</h2><p>${esc(t.id)}</p></div><div><button class="btn btn-light icon-action" title="Nhân bản" aria-label="Nhân bản yêu cầu" data-duplicate-ticket="${esc(t.id)}">⧉</button><button class="btn btn-light icon-action" title="Sửa" aria-label="Sửa yêu cầu" data-edit-ticket="${esc(t.id)}">✎</button><button class="btn btn-light icon-action danger" title="Xóa" aria-label="Xóa yêu cầu" data-delete-ticket="${esc(t.id)}">×</button> ${t.step < 5 ? `<button class="btn btn-primary icon-action" title="Chuyển bước" aria-label="Chuyển bước yêu cầu" data-advance="${esc(t.id)}">→</button>` : ""}</div></div>
 <div class="detail-panel"><div class="detail-head"><div><h2>${esc(t.title)}</h2><p class="muted" style="font-size:9px;margin-top:5px">${esc(t.description || "Chưa có mô tả")}</p></div><div>${priorityBadge(t.priority)} ${statusBadge(t.status)}</div></div>
 <div class="detail-meta">${meta("Loại", t.type === "hardware" ? "Phần cứng" : "Quản trị hệ thống")}${meta("Đơn vị", t.department || "-")}${meta("Phụ trách", t.assignee || "-")}${meta("Thiết bị / hệ thống", t.systemName || "-")}</div>
 <div class="flow-steps">${steps.map((s, i) => `<div class="flow-step ${i + 1 < t.step ? "done" : ""} ${i + 1 === t.step ? "active" : ""}"><div class="n">${i + 1}</div><b>${esc(s[0])}</b><small>${esc(s[1])}</small></div>`).join("")}</div>
 <div class="detail-section"><h4>Hiện trạng / mô tả</h4><p>${esc(t.description || "Chưa cập nhật")}</p></div>
 <div class="detail-section"><h4>Kết quả / ghi chú xử lý</h4><p>${esc(t.resolution || "Chưa cập nhật")}</p></div>
 <div class="detail-section"><h4>Lịch sử xử lý</h4>${historyHtml}</div>
 <div class="detail-section"><h4>Bình luận</h4>${commentsHtml}<form class="inline-comment-form" data-comment-ticket="${esc(id)}"><textarea name="comment" rows="2" placeholder="Thêm bình luận hoặc cập nhật..."></textarea><button class="small-btn">Gửi bình luận</button></form></div>
 <div class="detail-section"><h4>Phê duyệt mua sắm</h4><p>Trạng thái: <b>${esc(t.purchaseApproval || "Chưa đề xuất")}</b></p>${approvalControls}</div>
 <div class="detail-section"><h4>Thông tin phiếu</h4><p>Tạo lúc: ${esc(t.createdAtText || "-")} • Người yêu cầu: ${esc(t.requester || "-")}</p></div></div>`;
  $$("[data-back]").forEach(b => b.onclick = renderTickets);
  $$("[data-edit-ticket]").forEach(b => b.onclick = () => openTicketModal(t.type, t));
  $$('[data-duplicate-ticket]').forEach(b => b.onclick = () => openTicketModal(t.type, t, "", true));
  $$('[data-delete-ticket]').forEach(b => b.onclick = () => deleteTicket(t.id));
  $$("[data-advance]").forEach(b => b.onclick = async () => { await advanceTicket(t.id); viewTicket(t.id) });
}
function renderTickets() { state.page = "tickets"; render() }
function meta(a, b) { return `<div class="meta-box"><small>${esc(a)}</small><b>${esc(b)}</b></div>` }

function updateDepartmentsDatalist() {
  const list = $("#departmentList"); if (list) list.innerHTML = state.departments.map(d => `<option value="${esc(d.name)}">`).join("");
  const assetDepartmentPicker = $("#assetForm .asset-picker[data-picker-type='department']");
  if (assetDepartmentPicker) renderAssetPicker(assetDepartmentPicker, assetDepartmentPicker.querySelector("input[type='hidden']").value || "");
  const departmentPicker = $("#storeVisitForm .department-picker");
  if (departmentPicker) renderDepartmentPicker(departmentPicker.querySelector("input[type='hidden']").value || "");
  const ticketDepartmentPicker = $("#ticketForm .department-picker");
  if (ticketDepartmentPicker) renderDepartmentPicker(ticketDepartmentPicker.querySelector("input[type='hidden']").value || "", "#ticketForm .department-picker");
}

function renderDepartmentPicker(selectedValue = "", pickerSelector = "#storeVisitForm .department-picker") {
  const picker = $(pickerSelector);
  if (!picker) return;
  const hiddenInput = picker.querySelector("input[type='hidden']");
  const button = picker.querySelector(".department-value");
  const menu = picker.querySelector(".department-menu");
  const search = picker.querySelector(".department-search input");
  const optionWrap = picker.querySelector(".department-options");
  const departments = state.departments;
  const normalized = value => normalizeEmployeeSearch(value);
  const renderOptions = (term = "") => {
    const query = normalized(term);
    const filtered = departments.filter(department => normalized(`${department.name || ""} ${department.code || ""}`).includes(query));
    optionWrap.innerHTML = filtered.length ? filtered.map(department => `<button type="button" class="department-option ${selectedValue === department.name ? "selected" : ""}" data-name="${esc(department.name)}"><span class="department-option-name">${esc(department.name)}</span><span class="department-option-meta">${esc(department.code || "Chưa có mã đơn vị")}</span></button>`).join("") : `<div class="department-empty">Không tìm thấy đơn vị</div>`;
    optionWrap.querySelectorAll(".department-option").forEach(option => {
      option.onclick = () => {
        selectedValue = option.dataset.name;
        hiddenInput.value = selectedValue;
        button.textContent = selectedValue;
        button.classList.add("has-value");
        menu.classList.add("hidden");
        search.value = "";
      };
    });
  };
  hiddenInput.value = selectedValue || hiddenInput.value || "";
  button.textContent = hiddenInput.value || (pickerSelector.startsWith("#ticketForm") ? "Chọn đơn vị" : "Chọn đơn vị / cửa hàng");
  button.classList.toggle("has-value", Boolean(hiddenInput.value));
  if (!picker.dataset.bound) {
    button.onclick = event => {
      event.stopPropagation();
      document.querySelectorAll(".employee-menu, .department-menu").forEach(element => element.classList.add("hidden"));
      menu.classList.toggle("hidden");
      if (!menu.classList.contains("hidden")) search.focus();
    };
    document.addEventListener("click", event => { if (!picker.contains(event.target)) menu.classList.add("hidden"); });
    picker.dataset.bound = "1";
  }
  search.oninput = event => renderOptions(event.target.value);
  renderOptions();
}

function enhanceDropdowns(root = document) {
  root.querySelectorAll("select:not([data-choice-enhanced])").forEach(select => {
    const picker = document.createElement("div");
    picker.className = "choice-picker";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-value";
    const menu = document.createElement("div");
    menu.className = "choice-menu hidden";
    menu.innerHTML = `<div class="choice-search"><input type="text" placeholder="Tìm lựa chọn..."></div><div class="choice-options"></div>`;
    select.dataset.choiceEnhanced = "1";
    select.classList.add("choice-native");
    select.parentNode.insertBefore(picker, select);
    picker.append(select, button, menu);
    const search = menu.querySelector("input");
    const optionWrap = menu.querySelector(".choice-options");
    const sync = () => {
      const option = select.options[select.selectedIndex];
      button.textContent = option?.textContent || "Chọn một lựa chọn";
      button.classList.toggle("has-value", Boolean(option));
      optionWrap.querySelectorAll(".choice-option").forEach(item => item.classList.toggle("selected", Number(item.dataset.index) === select.selectedIndex));
    };
    const renderOptions = (term = "") => {
      const query = normalizeEmployeeSearch(term);
      const options = [...select.options].filter(option => normalizeEmployeeSearch(option.textContent).includes(query));
      optionWrap.innerHTML = options.length ? options.map(option => `<button type="button" class="choice-option" data-index="${option.index}">${esc(option.textContent)}</button>`).join("") : `<div class="choice-empty">Không tìm thấy lựa chọn</div>`;
      optionWrap.querySelectorAll(".choice-option").forEach(option => {
        option.onclick = () => { select.selectedIndex = Number(option.dataset.index); select.dispatchEvent(new Event("change", { bubbles: true })); menu.classList.add("hidden"); search.value = ""; renderOptions(); };
      });
      sync();
    };
    select.addEventListener("change", sync);
    button.onclick = event => {
      event.stopPropagation();
      document.querySelectorAll(".choice-menu, .employee-menu, .department-menu").forEach(element => element.classList.add("hidden"));
      menu.classList.toggle("hidden");
      if (!menu.classList.contains("hidden")) search.focus();
    };
    document.addEventListener("click", event => { if (!picker.contains(event.target)) menu.classList.add("hidden"); });
    search.oninput = event => renderOptions(event.target.value);
    renderOptions();
  });
}

function syncDropdowns(root = document) {
  root.querySelectorAll("select[data-choice-enhanced]").forEach(select => select.dispatchEvent(new Event("change")));
}

function getSelectedVisitPerformers() {
  const value = $("#storeVisitForm .visit-performer-picker input[type='hidden']")?.value || "";
  return value.split(",").map(name => name.trim()).filter(Boolean);
}

function renderVisitPerformersPicker(selectedValues = []) {
  const picker = $("#storeVisitForm .visit-performer-picker");
  if (!picker) return;
  const hiddenInput = picker.querySelector("input[type='hidden']");
  const button = picker.querySelector(".visit-performer-value");
  const menu = picker.querySelector(".visit-performer-menu");
  const search = picker.querySelector(".visit-performer-search input");
  const optionWrap = picker.querySelector(".visit-performer-options");
  const selected = new Set(selectedValues.length ? selectedValues : hiddenInput.value.split(",").map(name => name.trim()).filter(Boolean));
  const updateValue = () => {
    const names = [...selected];
    hiddenInput.value = names.join(", ");
    button.textContent = names.length ? `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}` : "Chọn người thực hiện";
    button.classList.toggle("has-value", names.length > 0);
  };
  const renderOptions = (term = "") => {
    const query = normalizeEmployeeSearch(term);
    const filtered = getEmployeeOptions().filter(employee => employeeSearchText(employee).includes(query));
    optionWrap.innerHTML = filtered.length ? filtered.map(employee => {
      const code = employee.employeeCode || employee.code || employee.maNV || "N/A";
      return `<button type="button" class="visit-performer-option ${selected.has(employee.name) ? "selected" : ""}" data-name="${esc(employee.name)}"><span class="visit-performer-option-name">${esc(employee.name)}</span><span class="visit-performer-option-meta">${esc(employee.title || "Chưa cập nhật")} • ${esc(code)}</span><span class="visit-performer-check">✓</span></button>`;
    }).join("") : `<div class="department-empty">Không tìm thấy nhân viên</div>`;
    optionWrap.querySelectorAll(".visit-performer-option").forEach(option => {
      option.onclick = () => {
        const name = option.dataset.name;
        if (selected.has(name)) selected.delete(name); else selected.add(name);
        option.classList.toggle("selected", selected.has(name));
        updateValue();
      };
    });
  };
  if (!picker.dataset.bound) {
    button.onclick = event => {
      event.stopPropagation();
      document.querySelectorAll(".employee-menu, .department-menu, .visit-performer-menu").forEach(element => element.classList.add("hidden"));
      menu.classList.toggle("hidden");
      if (!menu.classList.contains("hidden")) search.focus();
    };
    document.addEventListener("click", event => { if (!picker.contains(event.target)) menu.classList.add("hidden"); });
    picker.dataset.bound = "1";
  }
  search.oninput = event => renderOptions(event.target.value);
  updateValue();
  renderOptions(search.value);
}

function buildEmployeeLabel(employee) {
  const employeeCode = employee.employeeCode || employee.code || employee.maNV || "N/A";
  return `${employee.name || ""} — ${employee.title || "Chưa cập nhật"} — ${employeeCode}`.trim();
}

function normalizeEmployeeSearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function employeeSearchText(employee) {
  return [employee.name, employee.employeeCode, employee.code, employee.maNV, employee.title, employee.department]
    .map(normalizeEmployeeSearch)
    .join(" ");
}

function getEmployeeOptions() {
  return [...new Map(state.employees
    .filter(employee => String(employee.name || "").trim())
    .map(employee => [normalizeEmployeeSearch(employee.name), employee])).values()];
}

function renderAssetPicker(picker, selectedValue = "") {
  if (!picker) return;
  const type = picker.dataset.pickerType;
  const hiddenInput = picker.querySelector("input[type='hidden']");
  const button = picker.querySelector(".asset-picker-value");
  const menu = picker.querySelector(".asset-picker-menu");
  const search = picker.querySelector(".asset-picker-search input");
  const optionWrap = picker.querySelector(".asset-picker-options");
  const source = type === "employee" ? getEmployeeOptions() : state.departments;
  const getCode = item => item.employeeCode || item.code || item.maNV || "";
  const getLabel = item => item.name || "";
  const updateValue = value => {
    hiddenInput.value = value;
    button.textContent = value || (type === "employee" ? "Chọn người sử dụng" : "Chọn đơn vị / phòng ban");
    button.classList.toggle("has-value", Boolean(value));
  };
  const renderOptions = (term = "") => {
    const query = normalizeEmployeeSearch(term);
    const filtered = source.filter(item => normalizeEmployeeSearch(`${getLabel(item)} ${getCode(item)}`).includes(query));
    optionWrap.innerHTML = filtered.length ? filtered.map(item => `<button type="button" class="asset-picker-option ${hiddenInput.value === getLabel(item) ? "selected" : ""}" data-value="${esc(getLabel(item))}"><span class="asset-picker-option-name">${esc(getLabel(item))}</span><span class="asset-picker-option-meta">${esc(getCode(item) || (type === "employee" ? item.title || "Chưa cập nhật" : "Chưa có mã đơn vị"))}</span><span class="asset-picker-check">✓</span></button>`).join("") : `<div class="asset-picker-empty">Không tìm thấy ${type === "employee" ? "nhân viên" : "đơn vị"}</div>`;
    optionWrap.querySelectorAll(".asset-picker-option").forEach(option => {
      option.onclick = () => { updateValue(option.dataset.value); menu.classList.add("hidden"); search.value = ""; renderOptions(); };
    });
  };
  updateValue(selectedValue || hiddenInput.value || "");
  if (!picker.dataset.bound) {
    button.onclick = event => { event.stopPropagation(); document.querySelectorAll(".employee-menu, .department-menu, .visit-performer-menu, .asset-picker-menu").forEach(element => element.classList.add("hidden")); menu.classList.toggle("hidden"); if (!menu.classList.contains("hidden")) search.focus(); };
    document.addEventListener("click", event => { if (!picker.contains(event.target)) menu.classList.add("hidden"); });
    picker.dataset.bound = "1";
  }
  search.oninput = event => renderOptions(event.target.value);
  renderOptions(search.value);
}

function renderEmployeePicker(fieldName, selectedValue = "", rootSelector = "#ticketForm") {
  const picker = $(`${rootSelector} .employee-picker[data-field="${fieldName}"]`);
  if (!picker) return;
  const employees = getEmployeeOptions();
  const hiddenInput = picker.querySelector("input[type='hidden']");
  const button = picker.querySelector(".employee-value");
  const menu = picker.querySelector(".employee-menu");
  const search = picker.querySelector(".employee-search input");
  const optionWrap = picker.querySelector(".employee-options");
  const defaultText = fieldName === "requester" ? "Chọn người yêu cầu" : fieldName === "assetOwner" ? "Chọn người sử dụng" : "Chọn người phụ trách";
  const setSelection = (employeeName) => {
    const employee = employees.find(item => item.name === employeeName) || null;
    hiddenInput.value = employee ? employee.name : "";
    button.textContent = employee ? buildEmployeeLabel(employee) : defaultText;
    button.classList.toggle("has-value", Boolean(employee));
    optionWrap.querySelectorAll(".employee-option").forEach(item => item.classList.toggle("selected", item.dataset.name === employeeName));
  };
  const renderOptions = (term = "") => {
    const q = normalizeEmployeeSearch(term);
    const filtered = employees.filter(employee => employeeSearchText(employee).includes(q));
    optionWrap.innerHTML = filtered.length ? filtered.map(employee => `<button type="button" class="employee-option ${selectedValue === employee.name ? "selected" : ""}" data-name="${esc(employee.name)}"><span class="employee-option-name">${esc(employee.name)}</span><span class="employee-option-meta">${esc(employee.title || "Chưa cập nhật")} • ${esc(employee.employeeCode || employee.code || employee.maNV || "N/A")}</span></button>`).join("") : `<div class="employee-empty">Không tìm thấy nhân viên</div>`;
    optionWrap.querySelectorAll(".employee-option").forEach(item => {
      item.onclick = () => {
        const chosenName = item.dataset.name;
        selectedValue = chosenName;
        setSelection(chosenName);
        menu.classList.add("hidden");
        search.value = "";
      };
    });
  };
  if (!picker.dataset.bound) {
    button.onclick = (event) => {
      event.stopPropagation();
      document.querySelectorAll(".employee-menu").forEach(el => el.classList.add("hidden"));
      menu.classList.toggle("hidden");
      if (!menu.classList.contains("hidden")) search.focus();
    };
    document.addEventListener("click", (event) => { if (!picker.contains(event.target)) menu.classList.add("hidden"); });
    picker.dataset.bound = "1";
  }
  search.oninput = e => renderOptions(e.target.value);
  renderOptions();
  setSelection(selectedValue || hiddenInput.value || "");
}

function updateEmployeesDatalist() {
  const list = $("#employeeList"); if (list) {
    const employees = [...new Map(state.employees.map(employee => [String(employee.name || "").trim(), employee])).values()].filter(employee => employee.name);
    list.innerHTML = employees.map(employee => `<option value="${esc(employee.name)}">${esc(employee.name)}${employee.title ? ` - ${esc(employee.title)}` : ""}</option>`).join("");
  }
  const requesterPicker = $("#ticketForm .employee-picker[data-field='requester']");
  const assigneePicker = $("#ticketForm .employee-picker[data-field='assignee']");
  if (requesterPicker) { renderEmployeePicker("requester", requesterPicker.querySelector("input").value || ""); }
  if (assigneePicker) { renderEmployeePicker("assignee", assigneePicker.querySelector("input").value || ""); }
  const visitPicker = $("#storeVisitForm .visit-performer-picker");
  if (visitPicker) { renderVisitPerformersPicker(visitPicker.querySelector("input[type='hidden']").value.split(",").map(name => name.trim()).filter(Boolean)); }
  const assetEmployeePicker = $("#assetForm .employee-picker[data-field='assetOwner']");
  if (assetEmployeePicker) renderEmployeePicker("assetOwner", assetEmployeePicker.querySelector("input[type='hidden']").value || "", "#assetForm");
  const maintenancePicker = $("#maintenanceForm .employee-picker[data-field='maintenanceAssignee']");
  if (maintenancePicker) renderEmployeePicker("maintenanceAssignee", maintenancePicker.querySelector("input[type='hidden']").value || "", "#maintenanceForm");
}

function toast(msg, type = "success") { const x = $("#toast"); x.textContent = msg; x.className = `toast show ${type}`; clearTimeout(window.__toast); window.__toast = setTimeout(() => x.className = "toast", 2800) }

async function login(e) {
  e.preventDefault(); if (!firebaseReady) { toast("Chưa cấu hình Firebase. Đang ở chế độ demo.", "error"); return }
  const button = e.target.querySelector("button[type=submit]");
  if (button) button.disabled = true;
  try {
    const a = await import(`${FBASE}/firebase-auth.js`);
    await a.signInWithEmailAndPassword(auth, $("#loginEmail").value, $("#loginPassword").value);
  } catch (err) {
    const messages = {
      "auth/configuration-not-found": "Firebase Authentication chưa được bật. Vào Firebase Console → Authentication → Get started, bật Email/Password và tạo tài khoản người dùng.",
      "auth/operation-not-allowed": "Phương thức Email/Password chưa được bật trong Firebase Authentication.",
      "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
      "auth/user-not-found": "Chưa có tài khoản này trong Firebase Authentication.",
      "auth/wrong-password": "Email hoặc mật khẩu không đúng.",
      "auth/too-many-requests": "Có quá nhiều lần thử đăng nhập. Vui lòng chờ rồi thử lại."
    };
    const errorText = String(err?.code || err?.message || "");
    const messageKey = Object.keys(messages).find(key => errorText.includes(key));
    toast(messages[messageKey] || `Đăng nhập thất bại: ${err.message}`, "error");
  } finally { if (button) button.disabled = false }
}
async function logout() {
  if (firebaseReady && auth) { const a = await import(`${FBASE}/firebase-auth.js`); await a.signOut(auth) }
  else { $("#appShell").classList.add("hidden"); $("#loginScreen").classList.remove("hidden") }
}

$("#loginForm").onsubmit = login;
$("#ticketForm").onsubmit = saveTicket;
$("#assetForm").onsubmit = saveAsset;
$("#storeVisitForm").onsubmit = saveStoreVisit;
$("#departmentForm").onsubmit = saveDepartment;
$("#employeeForm").onsubmit = saveEmployee;
$("#operationsForm").onsubmit = saveOperation;
$("#addManagerBtn").onclick = () => addManagerRow();
$("#departmentUpload").onchange = async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  try { await uploadDepartments(file) } catch (err) { toast(err.message || "Không đọc được file Excel", "error") }
};
$("#employeeUpload").onchange = async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  try { await uploadEmployees(file) } catch (err) { toast(err.message || "Không đọc được file Excel nhân viên", "error") }
};
$("#createTicketBtn").onclick = () => openTicketModal("hardware");
$("#globalSearch").oninput = e => { state.search = e.target.value; state.employeePage = 1; state.listPages = {}; if (["tickets", "employees", "storeVisits", "systems", "server"].includes(state.page)) render() };
$("#refreshBtn").onclick = () => { render(); toast("Đã làm mới", "success") };
$("#mobileMenu").onclick = () => $("#sidebar").classList.toggle("open");
$("#userMenu").onclick = logout;
$("#logoutBtn").onclick = logout;

$$(".nav-item").forEach(b => b.onclick = () => { state.page = b.dataset.page; $("#sidebar").classList.remove("open"); render() });
$$("[data-close]").forEach(b => b.onclick = () => closeModal(b.dataset.close));
document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".modal-backdrop").forEach(m => m.classList.add("hidden")) });
document.addEventListener("submit", event => {
  const form = event.target.closest("[data-comment-ticket]");
  if (form) { event.preventDefault(); saveComment(form.dataset.commentTicket, form) }
});
document.addEventListener("click", event => {
  const button = event.target.closest("[data-approve-ticket]");
  if (button) approveTicket(button.dataset.approveTicket, button.dataset.decision);
});

loadFirebase();
