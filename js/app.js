import { firebaseConfig, DEMO_MODE } from "./firebase-config.js";

const FBASE = "https://www.gstatic.com/firebasejs/10.12.5";
let firebaseReady = false, auth = null, db = null;
let user = null;
let state = { page: "dashboard", tickets: [], assets: [], departments: [], employees: [], maintenance: [], storeVisits: [], audit: [], search: "", employeePage: 1 };
let unsubscribers = [];

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
const systemCatalog = [
  ["🖥", "Máy chủ", "Server / dịch vụ nền"], ["🌐", "Mạng", "Router / Switch / VLAN / Wi-Fi"],
  ["🛡", "Firewall", "Internet / NAT / VPN / DMZ"], ["📹", "Camera / NVR", "Camera, đầu ghi, lưu trữ"],
  ["▦", "BRAVO", "ERP / cơ sở dữ liệu"], ["✉", "ZNS", "Zalo Notification Service"],
  ["◫", "Ứng dụng", "Website / API / Web app"], ["🗄", "Database", "SQL Server / dữ liệu"],
  ["💾", "Backup", "Sao lưu / khôi phục"], ["🔐", "Phân quyền", "Tài khoản / quyền truy cập"]
];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
const nowText = () => new Date().toLocaleString("vi-VN");
const uid = () => Math.random().toString(36).slice(2, 10);

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
    auth = authMod.getAuth(app); db = fsMod.getFirestore(app);
    firebaseReady = true;
    authMod.onAuthStateChanged(auth, u => {
      user = u;
      if (u) { showApp(); subscribeData(fsMod); }
      else { $("#appShell").classList.add("hidden"); $("#loginScreen").classList.remove("hidden"); }
    });
  } catch (e) { console.error(e); toast("Không khởi tạo được Firebase: " + e.message, "error"); if (DEMO_MODE) { seedDemo(); showApp() } }
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
  const collections = ["tickets", "assets", "departments", "employees", "maintenance", "storeVisits", "audit"];
  collections.forEach(name => {
    const q = ["employees", "departments", "storeVisits"].includes(name) ? fs.collection(db, name) : fs.query(fs.collection(db, name), fs.orderBy("createdAt", "desc"));
    const un = fs.onSnapshot(q, snap => {
      state[name] = snap.docs.map(d => ({ id: d.id, ...d.data() })); updateDepartmentsDatalist(); updateEmployeesDatalist(); render();
    }, err => console.warn(name, err));
    unsubscribers.push(un);
  });
}

function render() {
  const pages = {
    dashboard: ["Tổng quan", "Theo dõi toàn bộ hoạt động CNTT của Hồng Đức"],
    tickets: ["Vấn đề / Ticket", "Tiếp nhận, phân công, xử lý và bàn giao"],
    hardware: ["Quy trình phần cứng", "Yêu cầu → Kiểm tra → Xử lý → Mua sắm → Bàn giao"],
    systems: ["Quản trị hệ thống", "Giám sát → Phân quyền → Tích hợp → Bảo trì → Sao lưu"],
    assets: ["Tài sản / CCDC", "Theo dõi thiết bị, vị trí, người sử dụng và tình trạng"],
    maintenance: ["Bảo trì", "Lập lịch và theo dõi bảo trì hệ thống / thiết bị"],
    storeVisits: ["Lịch đi cửa hàng", "Theo dõi lịch xử lý tại các cửa hàng / đơn vị"],
    departments: ["Đơn vị / Phòng ban", "Quản lý đơn vị, người phụ trách và nhu cầu CNTT"],
    employees: ["Danh sách nhân viên", "Tra cứu và cập nhật thông tin nhân viên"],
    reports: ["Báo cáo", "KPI và tình hình xử lý vấn đề"],
    settings: ["Cấu hình", "Firebase, dữ liệu và hướng dẫn triển khai"]
  };
  const [t, sub] = pages[state.page] || pages.dashboard; $("#pageTitle").textContent = t; $("#pageSubtitle").textContent = sub;
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === state.page));
  $("#navOpenCount").textContent = state.tickets.filter(t => t.step < 5).length;
  const map = { dashboard: dashboardPage, tickets: ticketsPage, hardware: hardwarePage, systems: systemsPage, assets: assetsPage, maintenance: maintenancePage, storeVisits: storeVisitsPage, departments: departmentsPage, employees: employeesPage, reports: reportsPage, settings: settingsPage };
  $("#page").innerHTML = map[state.page]();
  bindPage();
}

function dashboardPage() {
  const open = state.tickets.filter(t => t.step < 5).length, high = state.tickets.filter(t => t.step < 5 && t.priority === "Cao").length, done = state.tickets.filter(t => t.step === 5).length;
  const hardware = state.tickets.filter(t => t.type === "hardware").length, systems = state.tickets.filter(t => t.type === "system").length;
  return `<div class="hero"><div class="eyebrow">IT OPERATIONS • HỒNG ĐỨC</div><h2>Quản lý vấn đề CNTT<br>từ yêu cầu đến hoàn tất.</h2><p>Một trung tâm để tiếp nhận sự cố, theo dõi phần cứng, quản trị hệ thống, tài sản, bảo trì và sao lưu.</p><div class="hero-actions"><button class="btn btn-primary" data-action="new-ticket">＋ Tạo yêu cầu</button><button class="btn btn-light" data-page-jump="hardware">Xem quy trình phần cứng</button></div></div>
  <div class="stats">
    ${stat("Vấn đề đang mở", open, "Cần theo dõi", "✓")}
    ${stat("Ưu tiên cao", high, "Cần xử lý sớm", "!")}
    ${stat("Tổng tài sản", state.assets.length, "Thiết bị / CCDC", "▤")}
    ${stat("Đã hoàn tất", done, "Phiếu hoàn thành", "✓")}
  </div>
  <div class="grid-2">
    <section class="card"><div class="card-head"><div><h3>Vấn đề gần đây</h3><p>Phiếu mới nhất trên hệ thống</p></div><button class="link-btn" data-page-jump="tickets">Xem tất cả →</button></div>${ticketTable(state.tickets.slice(0, 7))}</section>
    <section class="card"><div class="card-head"><div><h3>Quy trình CNTT</h3><p>Hai quy trình chính</p></div></div><div class="workflow-mini">
      <div class="workflow-item"><div class="workflow-icon">🧰</div><div><b>Phần cứng</b><small>5 bước từ yêu cầu đến bàn giao</small></div><span class="count">${hardware}</span></div>
      <div class="workflow-item"><div class="workflow-icon">🖥</div><div><b>Quản trị hệ thống</b><small>Vận hành, phân quyền, tích hợp, backup</small></div><span class="count">${systems}</span></div>
      <div class="workflow-item"><div class="workflow-icon">📦</div><div><b>Tài sản / CCDC</b><small>Quản lý thiết bị CNTT</small></div><span class="count">${state.assets.length}</span></div>
    </div></section>
  </div>`;
}
function stat(label, value, hint, icon) { return `<div class="stat-card"><span class="icon">${icon}</span><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>` }

function ticketTable(rows) {
  if (!rows.length) return `<div class="empty"><strong>Chưa có phiếu</strong>Hãy tạo yêu cầu đầu tiên.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Vấn đề</th><th>Loại</th><th>Ưu tiên</th><th>Trạng thái</th><th>Bước</th></tr></thead><tbody>${rows.map(ticketRow).join("")}</tbody></table></div>`;
}
function ticketRow(t) {
  return `<tr data-ticket="${esc(t.id)}"><td><b>${esc(t.id)}</b><small>${esc(t.createdAtText || "")}</small></td><td><b>${esc(t.title)}</b><small>${esc(t.department || "")}</small></td><td>${typeBadge(t.type)}</td><td>${priorityBadge(t.priority)}</td><td>${statusBadge(t.status)}</td><td>${t.step || 1}/5</td></tr>`;
}
function typeBadge(t) { return `<span class="badge ${t === "hardware" ? "badge-orange" : "badge-blue"}">${t === "hardware" ? "Phần cứng" : "Hệ thống"}</span>` }
function priorityBadge(p) { return `<span class="badge ${p === "Cao" ? "badge-red" : p === "Trung bình" ? "badge-orange" : "badge-gray"}">${esc(p)}</span>` }
function statusBadge(s) { return `<span class="badge ${s === "Hoàn tất" ? "badge-green" : s === "Đang xử lý" ? "badge-blue" : "badge-gray"}">${esc(s || "Chờ xử lý")}</span>` }

function ticketsPage() {
  const q = state.search.toLowerCase(), rows = state.tickets.filter(t => `${t.id} ${t.title} ${t.department} ${t.systemName}`.toLowerCase().includes(q));
  return `<div class="page-title-row"><div><h2>Danh sách vấn đề</h2><p>${rows.length} phiếu phù hợp</p></div><div class="filters"><select id="ticketType"><option value="">Tất cả loại</option><option value="hardware">Phần cứng</option><option value="system">Hệ thống</option></select><select id="ticketPriority"><option value="">Tất cả ưu tiên</option><option>Cao</option><option>Trung bình</option><option>Thấp</option></select><button class="btn btn-primary" data-action="new-ticket">＋ Tạo phiếu</button></div></div>
 <div class="card">${ticketTable(rows)}</div>`;
}

function workflowPage(type, title, steps) {
  const rows = state.tickets.filter(t => t.type === type);
  return `<div class="flow-steps">${steps.map((s, i) => {
    const count = rows.filter(t => (t.step || 1) === i + 1).length;
    return `<div class="flow-step ${count ? "active" : ""} ${i === 0 ? "done" : ""}"><div class="n">${i + 1}</div><b>${esc(s[0])}</b><small>${esc(s[1])}</small><div class="step-count">${count} phiếu</div></div>`
  }).join("")}</div>
 <div class="card"><div class="card-head"><div><h3>${title}</h3><p>Có thể chuyển từng phiếu sang bước tiếp theo.</p></div><button class="btn btn-primary" data-action="new-ticket" data-type="${type}">＋ Tạo yêu cầu</button></div>
 ${rows.length ? rows.map(t => `<div class="ticket-card"><div>${type === "hardware" ? "🧰" : "🖥"}</div><div class="ticket-main"><b>${esc(t.title)}</b><small>${esc(t.id)} • ${esc(t.department || "Chưa có đơn vị")} • ${esc(t.assignee || "Chưa phân công")}</small><div class="progress-line" style="margin-top:9px"><span style="width:${((t.step || 1) / 5) * 100}%"></span></div></div><div>${statusBadge(t.status)}<small style="display:block;text-align:center;margin-top:4px;color:#8a98a3;font-size:8px">Bước ${t.step || 1}/5</small></div><div class="ticket-actions">${t.step < 5 ? `<button class="small-btn" data-advance="${esc(t.id)}">Chuyển bước</button>` : ""}<button class="small-btn" data-view-ticket="${esc(t.id)}">Xem</button></div></div>`).join("") : `<div class="empty"><strong>Chưa có phiếu ${type === "hardware" ? "phần cứng" : "hệ thống"}</strong>Tạo yêu cầu để bắt đầu quy trình.</div>`}</div>`;
}
function hardwarePage() { return workflowPage("hardware", "Quy trình phần cứng", hardwareSteps) }
function systemsPage() { return `<div class="card" style="margin-bottom:16px"><div class="card-head"><div><h3>Đối tượng quản trị hệ thống</h3><p>Danh mục giám sát theo quy trình quản trị hệ thống</p></div></div><div class="system-grid">${systemCatalog.map(s => `<div class="system-tile"><div class="sys-icon">${s[0]}</div><b>${s[1]}</b><small>${s[2]}</small><div class="health"><span class="dot"></span> Theo dõi</div></div>`).join("")}</div></div>${workflowPage("system", "Quy trình quản trị hệ thống", systemSteps)}` }

function assetsPage() {
  return `<div class="page-title-row"><div><h2>Tài sản / CCDC</h2><p>${state.assets.length} tài sản đang quản lý</p></div><button class="btn btn-primary" data-action="new-asset">＋ Thêm tài sản</button></div>
 <div class="stats"><div class="stat-card"><span class="icon">▤</span><div class="label">Tổng tài sản</div><div class="value">${state.assets.length}</div></div><div class="stat-card"><span class="icon">✓</span><div class="label">Đang sử dụng</div><div class="value">${state.assets.filter(a => a.status === "Đang sử dụng").length}</div></div><div class="stat-card"><span class="icon">↻</span><div class="label">Bảo trì</div><div class="value">${state.assets.filter(a => a.status === "Bảo trì").length}</div></div><div class="stat-card"><span class="icon">!</span><div class="label">Hỏng</div><div class="value">${state.assets.filter(a => a.status === "Hỏng").length}</div></div></div>
 <div class="card">${state.assets.length ? `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tài sản</th><th>Loại</th><th>Serial</th><th>Vị trí</th><th>Đơn vị</th><th>Tình trạng</th><th></th></tr></thead><tbody>${state.assets.map(a => `<tr><td><b>${esc(a.code)}</b></td><td><b>${esc(a.name)}</b><small>${esc(a.owner || "")}</small></td><td>${esc(a.category)}</td><td>${esc(a.serial || "-")}</td><td>${esc(a.location || "-")}</td><td>${esc(a.department || "-")}</td><td>${assetStatus(a.status)}</td><td><button class="small-btn" data-delete-asset="${esc(a.id)}">Xóa</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty"><strong>Chưa có tài sản</strong>Thêm thiết bị CNTT đầu tiên.</div>`}</div>`;
}
function assetStatus(s) { return `<span class="badge ${s === "Đang sử dụng" ? "badge-green" : s === "Hỏng" ? "badge-red" : s === "Bảo trì" ? "badge-orange" : "badge-gray"}">${esc(s)}</span>` }

function maintenancePage() {
  const rows = state.maintenance;
  return `<div class="page-title-row"><div><h2>Bảo trì</h2><p>Theo dõi lịch bảo trì thiết bị và hệ thống</p></div><button class="btn btn-primary" data-action="new-maintenance">＋ Tạo lịch bảo trì</button></div>
 <div class="grid-3"><div class="card"><div class="label muted">Đến hạn</div><div class="value" style="font-size:26px;font-weight:800;margin-top:7px">${rows.filter(x => x.status !== "Hoàn tất").length}</div></div><div class="card"><div class="label muted">Đã hoàn tất</div><div class="value" style="font-size:26px;font-weight:800;margin-top:7px">${rows.filter(x => x.status === "Hoàn tất").length}</div></div><div class="card"><div class="label muted">Thiết bị cần chú ý</div><div class="value" style="font-size:26px;font-weight:800;margin-top:7px">${state.assets.filter(a => ["Bảo trì", "Hỏng"].includes(a.status)).length}</div></div></div>
 <div class="card" style="margin-top:15px">${rows.length ? ticketTable(rows.map(x => ({ ...x, id: x.id, title: x.title, department: x.department, type: "system", priority: x.priority || "Trung bình", status: x.status, step: 5, createdAtText: x.date }))) : `<div class="empty"><strong>Chưa có lịch bảo trì</strong>Hãy tạo lịch để theo dõi.</div>`}</div>`;
}

function storeVisitsPage() {
  const query = normalizeEmployeeSearch(state.search);
  const rows = [...state.storeVisits]
    .filter(row => !query || `${row.visitDate || ""} ${row.visitTime || ""} ${row.content || ""} ${row.department || ""} ${row.performers || ""} ${row.status || ""} ${row.notes || ""}`.toLowerCase().includes(query))
    .sort((a, b) => `${a.visitDate || ""} ${a.visitTime || ""}`.localeCompare(`${b.visitDate || ""} ${b.visitTime || ""}`));
  return `<div class="page-title-row"><div><h2>Lịch đi cửa hàng</h2><p>${rows.length} lịch${query ? " phù hợp" : " đang theo dõi"}</p></div><button class="btn btn-primary" data-action="new-store-visit">＋ Thêm lịch</button></div>
  <div class="card store-visit-card"><div class="table-wrap"><table class="store-visit-table"><thead><tr><th>Ngày</th><th>Giờ</th><th>Nội dung xử lý</th><th>Đơn vị</th><th>Người thực hiện</th><th>Trạng thái</th><th>Ghi chú</th><th></th></tr></thead><tbody>${rows.length ? rows.map(storeVisitRow).join("") : `<tr><td colspan="8"><div class="empty"><strong>Chưa có lịch đi cửa hàng</strong>Thêm lịch đầu tiên để theo dõi.</div></td></tr>`}</tbody></table></div></div>`;
}

function storeVisitRow(row) {
  const performers = Array.isArray(row.performers) ? row.performers : String(row.performers || "").split(",").map(name => name.trim()).filter(Boolean);
  const statusClass = row.status === "ĐÃ XỬ LÝ" ? "badge-green" : row.status === "ĐANG XỬ LÝ" ? "badge-blue" : row.status === "ĐÃ LÊN LỊCH" ? "badge-orange" : row.status === "CHẬM TIẾN ĐỘ" ? "badge-purple" : "badge-red";
  return `<tr><td><b>${esc(formatVisitDate(row.visitDate))}</b></td><td>${esc(row.visitTime || "-")}</td><td><b>${esc(row.content || "-")}</b></td><td>${esc(row.department || "-")}</td><td>${performers.length ? performers.map(name => `<span class="person-chip">${esc(name)}</span>`).join("") : "-"}</td><td><span class="badge ${statusClass}">${esc(row.status || "CHƯA XỬ LÝ")}</span></td><td>${esc(row.notes || "-")}</td><td class="row-actions"><button class="small-btn" data-edit-store-visit="${esc(row.id)}">Sửa</button><button class="small-btn" data-delete-store-visit="${esc(row.id)}">Xóa</button></td></tr>`;
}

function formatVisitDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function departmentsPage() {
  const departmentOrder = ["BGD", "PKD", "PKT", "PNS", "PCSKH", ...Array.from({ length: 12 }, (_, i) => `HD${i + 1}`), "HDMT", "HDNCT", "HDVTA", "HDVTY", "HDCHAUTHANH", "HDLOTE", "HDST"];
  const normalizeDepartmentCode = value => String(value || "").toUpperCase().replace(/[ ._-]/g, "");
  const departments = [...state.departments].sort((a, b) => { const aIndex = departmentOrder.indexOf(normalizeDepartmentCode(a.code)), bIndex = departmentOrder.indexOf(normalizeDepartmentCode(b.code)); return (aIndex < 0 ? departmentOrder.length : aIndex) - (bIndex < 0 ? departmentOrder.length : bIndex) || String(a.name || "").localeCompare(String(b.name || ""), "vi") });
  return `<div class="page-title-row"><div><h2>Đơn vị / Phòng ban</h2><p>${state.departments.length} đơn vị trong danh mục</p></div><div class="filters"><button class="btn btn-light" data-action="upload-departments">↑ Tải lên Excel</button><button class="btn btn-primary" data-action="new-department">＋ Thêm đơn vị</button></div></div>
 <div class="grid-3">${departments.map(d => { const managers = d.managers?.length ? d.managers : [{ name: d.manager, title: d.title, employeeCode: d.employeeCode, phone: d.phone }].filter(m => m.name); return `<div class="card"><div style="display:flex;justify-content:space-between"><span class="badge badge-blue">${esc(d.code || "DV")}</span><div><button class="small-btn" data-edit-dept="${esc(d.id)}">Sửa</button> <button class="small-btn" data-delete-dept="${esc(d.id)}">Xóa</button></div></div><h3 style="font-size:13px;margin:14px 0 4px">${esc(d.name)}</h3>${managers.length ? managers.map(m => `<p class="muted" style="font-size:9px;margin:8px 0;white-space:pre-line"><b>${esc(m.name)}</b> - ${esc(m.title || "Chưa cập nhật")}<br>Mã NV: ${esc(m.employeeCode || "-")} | SĐT: ${esc(m.phone || "-")}</p>`).join("") : `<p class="muted" style="font-size:9px">Chưa có người quản lý</p>`}<div style="margin-top:13px;font-size:9px;color:#778792">Ticket: <b>${state.tickets.filter(t => t.department === d.name).length}</b></div></div>` }).join("") || `<div class="card"><div class="empty"><strong>Chưa có đơn vị</strong>Thêm đơn vị đầu tiên.</div></div>`}</div>`;
}

function employeesPage() {
  const query = state.search.toLowerCase().trim();
  const normalizeText = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase().replace(/[^A-Z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const workplaceSortKey = workplace => {
    const normalized = normalizeText(workplace);
    if (!normalized) return [999, 999, ""];
    if (/A0?1|VP CONG TY/.test(normalized)) return [0, 0, normalized];
    const headNumber = Number((normalized.match(/(?:HEAD|H)[^\d]*(\d{1,2})/) || normalized.match(/(?:^|[\s-])H0?(\d{1,2})(?:$|[\s-])/))?.[1] || normalized.match(/(?:^|[\s-])0?(\d{1,2})(?:$|[\s-])/)?.[1] || 999);
    if (/HEAD|H\d{1,2}/.test(normalized)) return [1, headNumber, normalized];
    if (/HDMT|HDNCT|HDVTA|HDVTY|HDCHAUTHANH|HDLOTE|HDST/.test(normalized)) return [2, Number((normalized.match(/(\d+)/)?.[1] || 999)), normalized];
    return [3, 999, normalized];
  };
  const employeeTitleRank = employee => { const title = `${employee.title || ""} ${employee.detailedTitle || ""}`.toLowerCase(); return /nhân viên|nhan vien|chuyên viên|chuyen vien/.test(title) ? 1 : 0 };
  const rows = state.employees.filter(employee => Object.values(employee).join(" ").toLowerCase().includes(query)).sort((a, b) => { const aKey = workplaceSortKey(a.workplace), bKey = workplaceSortKey(b.workplace); return aKey[0] - bKey[0] || aKey[1] - bKey[1] || aKey[2].localeCompare(bKey[2], "vi") || String(a.department || "").localeCompare(String(b.department || ""), "vi") || employeeTitleRank(a) - employeeTitleRank(b) || String(a.name || "").localeCompare(String(b.name || ""), "vi") });
  const pageSize = 50, totalPages = Math.max(1, Math.ceil(rows.length / pageSize)); state.employeePage = Math.min(Math.max(1, state.employeePage), totalPages); const start = (state.employeePage - 1) * pageSize; const pageRows = rows.slice(start, start + pageSize);
  const workplaceGroups = pageRows.reduce((groups, employee) => { const workplace = employee.workplace || "Chưa xác định nơi làm việc"; const department = employee.department || "Chưa xác định bộ phận"; groups[workplace] ??= {}; groups[workplace][department] ??= []; groups[workplace][department].push(employee); return groups }, {});
  const officeDepartmentOrder = ["Ban Giám đốc", "Ban Kiểm soát", "Kế toán", "Phòng Kinh doanh", "Phòng Nhân sự - Đào tạo", "Phòng CSKH", "Kho tổng", "Khác", "Phòng Tài chính - Kế toán"];
  const headDepartmentOrder = ["Quản lý HEAD", "Kế toán", "Phụ tùng", "Dịch vụ", "Bán hàng", "Khác"];
  const normalizeDepartment = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
  const sortedDepartments = (workplace, departments) => { const order = /H\d{1,2}/i.test(workplace) ? headDepartmentOrder : officeDepartmentOrder; return Object.entries(departments).sort(([a], [b]) => { const aIndex = order.findIndex(item => normalizeDepartment(item) === normalizeDepartment(a)), bIndex = order.findIndex(item => normalizeDepartment(item) === normalizeDepartment(b)); return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex) || a.localeCompare(b, "vi") }) };
  const sortedWorkplaces = Object.entries(workplaceGroups).sort(([a], [b]) => { const aKey = workplaceSortKey(a), bKey = workplaceSortKey(b); return aKey[0] - bKey[0] || aKey[1] - bKey[1] || aKey[2].localeCompare(bKey[2], "vi") });
  const groupedRows = sortedWorkplaces.map(([workplace, departments]) => `<details class="employee-group" open><summary><span>▸ ${esc(workplace)}</span><b>${Object.values(departments).flat().length} nhân viên</b></summary>${sortedDepartments(workplace, departments).map(([department, employees]) => `<details class="employee-subgroup" open><summary><span>▸ ${esc(department)}</span><b>${employees.length}</b></summary><div class="table-wrap"><table><thead><tr><th>Trạng thái</th><th>Mã</th><th>Họ và tên</th><th>Chức danh</th><th>Điện thoại</th><th>Ngày sinh</th><th>Giới tính</th><th>Email</th><th></th></tr></thead><tbody>${employees.map(employee => `<tr><td><span class="badge badge-green">${esc(employee.status || "Đang làm việc")}</span></td><td><b>${esc(employee.employeeCode)}</b></td><td><b>${esc(employee.name)}</b></td><td>${esc(employee.title || "-")}<small>${esc(employee.detailedTitle || "")}</small></td><td>${esc(employee.phone || "-")}</td><td>${esc(employee.birthDate || "-")}</td><td>${esc(employee.gender || "-")}</td><td>${esc(employee.email || "-")}</td><td><button class="small-btn" data-edit-employee="${esc(employee.id)}">Sửa</button> <button class="small-btn" data-delete-employee="${esc(employee.id)}">Xóa</button></td></tr>`).join("")}</tbody></table></div></details>`).join("")}</details>`).join("");
  return `<div class="page-title-row"><div><h2>Danh sách nhân viên</h2><p>${state.employees.length} nhân viên${query ? ` • ${rows.length} kết quả` : ""}</p></div><div class="filters"><button class="btn btn-light" data-action="delete-all-employees" ${state.employees.length ? "" : "disabled"}>Xóa toàn bộ</button><button class="btn btn-primary" data-action="upload-employees">↑ Tải lên Excel</button></div></div>
 <div class="employee-groups">${groupedRows || `<div class="card"><div class="empty"><strong>Chưa có nhân viên</strong>Hãy tải lên file Excel danh sách nhân viên.</div></div>`}</div><div class="pagination"><button class="small-btn" data-employee-page="prev" ${state.employeePage === 1 ? "disabled" : ""}>← Trước</button><span>Trang ${state.employeePage} / ${totalPages}</span><button class="small-btn" data-employee-page="next" ${state.employeePage === totalPages ? "disabled" : ""}>Sau →</button></div>`;
}

function reportsPage() {
  const total = state.tickets.length, done = state.tickets.filter(t => t.step === 5).length;
  const rate = total ? Math.round(done / total * 100) : 0;
  const high = state.tickets.filter(t => t.priority === "Cao" && t.step < 5).length;
  const hw = state.tickets.filter(t => t.type === "hardware").length, sy = total - hw;
  return `<div class="stats">${stat("Tổng phiếu", total, "Tất cả quy trình", "✓")}${stat("Hoàn tất", done, "Đã bàn giao / đóng", "✓")}${stat("Tỷ lệ hoàn tất", rate + "%", "Hiệu suất xử lý", "%")}${stat("Ưu tiên cao", high, "Đang mở", "!")}</div>
 <div class="grid-2"><div class="card"><div class="card-head"><div><h3>Phân bổ ticket</h3><p>Theo loại quy trình</p></div></div><div class="kpi-list"><div class="kpi"><label>Phần cứng</label><div class="progress-line"><span style="width:${total ? hw / total * 100 : 0}%"></span></div><strong>${hw}</strong></div><div class="kpi"><label>Quản trị hệ thống</label><div class="progress-line"><span style="width:${total ? sy / total * 100 : 0}%"></span></div><strong>${sy}</strong></div></div></div>
 <div class="card"><div class="card-head"><div><h3>Tình trạng tài sản</h3><p>Thiết bị CNTT / CCDC</p></div></div><div class="kpi-list">${["Đang sử dụng", "Dự phòng", "Bảo trì", "Hỏng", "Thanh lý"].map(s => `<div class="kpi"><label>${s}</label><div class="progress-line"><span style="width:${state.assets.length ? state.assets.filter(a => a.status === s).length / state.assets.length * 100 : 0}%"></span></div><strong>${state.assets.filter(a => a.status === s).length}</strong></div>`).join("")}</div></div></div>
 <div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Danh sách ưu tiên cao</h3><p>Cần theo dõi ngay</p></div></div>${ticketTable(state.tickets.filter(t => t.priority === "Cao" && t.step < 5))}</div>`;
}

function settingsPage() {
  return `<div class="grid-2"><div class="card"><div class="card-head"><div><h3>Firebase</h3><p>Trạng thái kết nối</p></div>${firebaseReady ? '<span class="badge badge-green">Đã kết nối</span>' : '<span class="badge badge-orange">Demo / chưa cấu hình</span>'}</div><p style="font-size:10px;line-height:1.8;color:#596a75">${firebaseReady ? "Dữ liệu đang được đọc/ghi trực tiếp trên Firestore." : "Mở js/firebase-config.js và điền firebaseConfig. Hiện giao diện đang chạy bằng dữ liệu demo trên trình duyệt."}</p><button class="btn btn-light" data-action="open-config-help">Xem hướng dẫn Firebase</button></div>
 <div class="card"><div class="card-head"><div><h3>Dữ liệu hiện tại</h3><p>Thống kê collection</p></div></div><div class="kpi-list">${[["tickets", "Phiếu"], ["assets", "Tài sản"], ["departments", "Đơn vị"], ["maintenance", "Bảo trì"]].map(x => `<div class="kpi"><label>${x[1]}</label><div class="progress-line"><span style="width:100%"></span></div><strong>${state[x[0]].length}</strong></div>`).join("")}</div></div></div>
 <div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Hướng dẫn triển khai</h3><p>HTML + CSS + JavaScript thuần</p></div></div><ol style="font-size:10px;line-height:2;color:#596a75"><li>Tạo Firebase Project và Web App.</li><li>Bật Firestore Database.</li><li>Bật Authentication → Email/Password nếu dùng đăng nhập.</li><li>Dán cấu hình Web App vào <b>js/firebase-config.js</b>.</li><li>Thiết lập Firestore Security Rules theo file <b>firebase/firestore.rules</b>.</li><li>Đưa thư mục này lên IIS, Firebase Hosting hoặc web server nội bộ.</li></ol></div>`;
}

function bindPage() {
  $$('[data-edit-employee]').forEach(b => b.onclick = () => openEmployeeModal(state.employees.find(employee => employee.id === b.dataset.editEmployee)));
  $$('[data-action="new-store-visit"]').forEach(b => b.onclick = () => openStoreVisitModal());
  $$('[data-edit-store-visit]').forEach(b => b.onclick = () => openStoreVisitModal(state.storeVisits.find(row => row.id === b.dataset.editStoreVisit)));
  $$('[data-delete-store-visit]').forEach(b => b.onclick = () => deleteStoreVisit(b.dataset.deleteStoreVisit));
  $$('[data-action="new-maintenance"]').forEach(() => toast("Module lịch bảo trì chi tiết sẽ dùng collection maintenance.", "success"));
  $$('[data-delete-employee]').forEach(b => b.onclick = () => deleteEmployee(b.dataset.deleteEmployee));
  $$('[data-action="delete-all-employees"]').forEach(b => b.onclick = deleteAllEmployees);
  $$('[data-employee-page]').forEach(b => b.onclick = () => { const query = state.search.toLowerCase().trim(); const totalPages = Math.max(1, Math.ceil(state.employees.filter(employee => Object.values(employee).join(" ").toLowerCase().includes(query)).length / 50)); state.employeePage = Math.max(1, Math.min(b.dataset.employeePage === "next" ? state.employeePage + 1 : state.employeePage - 1, totalPages)); render() });
  $$("[data-page-jump]").forEach(b => b.onclick = () => { state.page = b.dataset.pageJump; render() });
  $$("[data-action='new-ticket']").forEach(b => b.onclick = () => openTicketModal(b.dataset.type || "hardware"));
  $$("[data-action='new-asset']").forEach(b => b.onclick = openAssetModal);
  $$("[data-action='new-department']").forEach(b => b.onclick = openDepartmentModal);
  $$("[data-action='new-maintenance']").forEach(() => toast("Module lịch bảo trì chi tiết sẽ dùng collection maintenance.", "success"));
  $$("[data-advance]").forEach(b => b.onclick = () => advanceTicket(b.dataset.advance));
    $$("[data-view-ticket]").forEach(b => b.onclick = () => viewTicket(b.dataset.viewTicket));
    $$("[data-delete-asset]").forEach(b => b.onclick = () => deleteAsset(b.dataset.deleteAsset));
    $$("[data-edit-dept]").forEach(b => b.onclick = () => openDepartmentModal(state.departments.find(d => d.id === b.dataset.editDept)));
    $$("[data-delete-dept]").forEach(b => b.onclick = () => deleteDepartment(b.dataset.deleteDept));
    $$("tr[data-ticket]").forEach(r => r.onclick = () => viewTicket(r.dataset.ticket));
    $$("[data-action='upload-departments']").forEach(b => b.onclick = () => $("#departmentUpload").click());
    $$("[data-action='upload-employees']").forEach(b => b.onclick = () => $("#employeeUpload").click());
  $$("[data-delete-asset]").forEach(b => b.onclick = () => deleteAsset(b.dataset.deleteAsset));
  $$("[data-edit-dept]").forEach(b => b.onclick = () => openDepartmentModal(state.departments.find(d => d.id === b.dataset.editDept)));
  $$("[data-delete-dept]").forEach(b => b.onclick = () => deleteDepartment(b.dataset.deleteDept));
  $$("tr[data-ticket]").forEach(r => r.onclick = () => viewTicket(r.dataset.ticket));
  $$("[data-action='upload-departments']").forEach(b => b.onclick = () => $("#departmentUpload").click());
  $$("[data-action='upload-employees']").forEach(b => b.onclick = () => $("#employeeUpload").click());
}

async function addDoc(collectionName, data) {
  if (firebaseReady) {
    const fs = await import(`${FBASE}/firebase-firestore.js`);
    const ref = await fs.addDoc(fs.collection(db, collectionName), data);
    await fs.addDoc(fs.collection(db, "audit"), { action: "CREATE", collection: collectionName, targetId: ref.id, createdAt: Date.now(), createdAtText: nowText(), user: user?.email || "demo" });
    return ref.id;
  }
  const id = collectionName === "tickets" ? `HD-${String(state.tickets.length + 1).padStart(4, "0")}` : uid();
  state[collectionName].unshift({ id, ...data });
  return id;
}
async function updateDocRemote(collectionName, id, data) {
  if (firebaseReady) {
    const fs = await import(`${FBASE}/firebase-firestore.js`);
    await fs.updateDoc(fs.doc(db, collectionName, id), data);
  } else {
    const i = state[collectionName].findIndex(x => x.id === id); if (i >= 0) state[collectionName][i] = { ...state[collectionName][i], ...data };
  }
}
async function deleteDocRemote(collectionName, id) {
  if (firebaseReady) {
    const fs = await import(`${FBASE}/firebase-firestore.js`);
    await fs.deleteDoc(fs.doc(db, collectionName, id));
  } else state[collectionName] = state[collectionName].filter(x => x.id !== id);
}

async function saveTicket(e) {
  e.preventDefault(); const fd = new FormData(e.target); const data = Object.fromEntries(fd.entries());
  const edit = data.id; delete data.id;
  const existing = edit ? state.tickets.find(x => x.id === edit) : null;
  data.step = existing?.step || 1; data.status = existing?.status || "Chờ kiểm tra"; data.createdAt = existing?.createdAt || Date.now(); data.createdAtText = existing?.createdAtText || nowText();
  try { await (edit ? updateDocRemote("tickets", edit, data) : addDoc("tickets", data)); closeModal("ticketModal"); toast(edit ? "Đã cập nhật phiếu" : "Đã tạo yêu cầu thành công", "success"); render() } catch (err) { toast(err.message, "error") }
}
async function saveAsset(e) {
  e.preventDefault(); const data = Object.fromEntries(new FormData(e.target).entries()); data.createdAt = Date.now(); data.createdAtText = nowText();
  try { await addDoc("assets", data); closeModal("assetModal"); toast("Đã thêm tài sản", "success"); render() } catch (err) { toast(err.message, "error") }
}
async function saveStoreVisit(e) {
  e.preventDefault();
  const form = e.target;
  const id = form.elements.id.value;
  const existing = id ? state.storeVisits.find(row => row.id === id) : null;
  const data = {
    visitDate: form.elements.visitDate.value,
    visitTime: form.elements.visitTime.value,
    content: form.elements.content.value.trim(),
    department: form.elements.department.value.trim(),
    performers: getSelectedVisitPerformers(),
    status: form.elements.status.value,
    notes: form.elements.notes.value.trim(),
    createdAt: existing?.createdAt || Date.now(),
    createdAtText: existing?.createdAtText || nowText(),
    updatedAt: Date.now()
  };
  try { await (id ? updateDocRemote("storeVisits", id, data) : addDoc("storeVisits", data)); closeModal("storeVisitModal"); toast(id ? "Đã cập nhật lịch" : "Đã thêm lịch đi cửa hàng", "success"); render() } catch (err) { toast(err.message, "error") }
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
  const xlsx = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const workbook = xlsx.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const values = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  if (values.length < 2) throw new Error("File Excel cần có dòng tiêu đề và ít nhất một nhân viên.");
  const normalizeHeader = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
  const headers = values.shift().map(normalizeHeader);
  const findHeader = names => headers.findIndex(header => names.includes(header));
  const indexes = { employeeCode: findHeader(["ma", "code", "ma nhan vien", "ma nv"]), name: findHeader(["ho va ten", "ho ten", "name"]), workplace: findHeader(["noi lam viec", "workplace"]), department: findHeader(["ten bo phan hien tai", "ten don vi", "bo phan", "department"]), title: findHeader(["chuc danh", "title"]), detailedTitle: findHeader(["chuc danh chi tiet", "detailed title"]), phone: findHeader(["dien thoai", "sdt", "so dien thoai", "phone"]), birthDate: findHeader(["ngay sinh", "birth date"]), gender: findHeader(["gioi tinh", "gender"]), email: findHeader(["email", "e-mail"]) };
  if (indexes.employeeCode < 0 || indexes.name < 0) throw new Error("Excel cần có ít nhất cột Mã và Họ và tên.");
  const rows = values.map(row => Object.fromEntries(Object.entries(indexes).map(([key, index]) => [key, String(index >= 0 ? (row[index] ?? "") : "").trim()]))).filter(row => row.employeeCode && row.name);
  if (!rows.length) throw new Error("Không tìm thấy nhân viên hợp lệ trong file Excel.");
  for (const row of rows) { row.createdAt = Date.now(); row.createdAtText = nowText(); const existing = state.employees.find(employee => employee.employeeCode === row.employeeCode); if (existing) await updateDocRemote("employees", existing.id, row); else await addDoc("employees", row) }
  toast(`Đã nhập ${rows.length} nhân viên`, "success"); render();
}
async function advanceTicket(id) {
  const t = state.tickets.find(x => x.id === id); if (!t) return;
  const step = Math.min(5, (t.step || 1) + 1), status = step === 5 ? "Hoàn tất" : "Đang xử lý";
  try { await updateDocRemote("tickets", id, { step, status, updatedAt: Date.now(), updatedAtText: nowText() }); toast(`Đã chuyển ${t.id} sang bước ${step}/5`, "success"); render() } catch (e) { toast(e.message, "error") }
}
async function deleteAsset(id) { if (!confirm("Xóa tài sản này?")) return; try { await deleteDocRemote("assets", id); toast("Đã xóa tài sản", "success"); render() } catch (e) { toast(e.message, "error") } }
async function deleteStoreVisit(id) { if (!confirm("Xóa lịch đi cửa hàng này?")) return; try { await deleteDocRemote("storeVisits", id); toast("Đã xóa lịch", "success"); render() } catch (e) { toast(e.message, "error") } }
async function deleteDepartment(id) { if (!confirm("Xóa đơn vị này?")) return; try { await deleteDocRemote("departments", id); toast("Đã xóa đơn vị", "success"); render() } catch (e) { toast(e.message, "error") } }
async function deleteEmployee(id) { if (!confirm("Xóa nhân viên này?")) return; try { await deleteDocRemote("employees", id); toast("Đã xóa nhân viên", "success"); render() } catch (e) { toast(e.message, "error") } }
async function deleteAllEmployees() {
  if (!state.employees.length || !confirm(`Bạn chắc chắn muốn xóa toàn bộ ${state.employees.length} nhân viên?`)) return;
  if (!confirm("Xác nhận lần cuối: dữ liệu nhân viên sẽ bị xóa khỏi Firebase.")) return;
  try { for (const employee of [...state.employees]) await deleteDocRemote("employees", employee.id); state.employeePage = 1; toast("Đã xóa toàn bộ danh sách nhân viên", "success"); render() } catch (e) { toast(e.message, "error") }
}
function openEmployeeModal(employee) {
  const form = $("#employeeForm"); form.reset(); form.elements.id.value = employee.id; Object.keys(employee).forEach(key => { if (form.elements[key]) form.elements[key].value = employee[key] ?? "" }); $("#employeeModal").classList.remove("hidden");
}
async function saveEmployee(e) {
  e.preventDefault(); const form = e.target, id = form.elements.id.value; const data = Object.fromEntries(new FormData(form).entries()); delete data.id; data.updatedAt = Date.now(); data.updatedAtText = nowText();
  try { await updateDocRemote("employees", id, data); closeModal("employeeModal"); toast("Đã cập nhật nhân viên", "success"); render() } catch (err) { toast(err.message, "error") }
}

function openTicketModal(type = "hardware", ticket = null) {
  $("#ticketModal").classList.remove("hidden"); const f = $("#ticketForm"); f.reset();
  $("#ticketModalTitle").textContent = ticket ? "Chỉnh sửa yêu cầu" : "Tạo yêu cầu mới";
  f.elements.type.value = ticket?.type || type;
  if (ticket) Object.keys(ticket).forEach(k => { if (f.elements[k]) f.elements[k].value = ticket[k] ?? "" });
  ["requester", "assignee"].forEach(fieldName => {
    const picker = f.querySelector(`.employee-picker[data-field="${fieldName}"]`);
    if (!picker) return;
    const hiddenInput = picker.querySelector("input[type='hidden']");
    const selectedName = ticket?.[fieldName] || "";
    hiddenInput.value = selectedName;
    renderEmployeePicker(fieldName, selectedName);
  });
}
function openAssetModal() { $("#assetModal").classList.remove("hidden"); $("#assetForm").reset() }
function openStoreVisitModal(row = null) {
  const form = $("#storeVisitForm");
  form.reset();
  form.elements.id.value = row?.id || "";
  form.elements.visitDate.value = row?.visitDate || new Date().toISOString().slice(0, 10);
  form.elements.visitTime.value = row?.visitTime || "07:00";
  form.elements.content.value = row?.content || "";
  updateDepartmentsDatalist();
  form.elements.department.value = row?.department || "";
  renderDepartmentPicker(row?.department || "");
  form.elements.status.value = row?.status || "CHƯA XỬ LÝ";
  form.elements.notes.value = row?.notes || "";
  const selected = Array.isArray(row?.performers) ? row.performers : String(row?.performers || "").split(",").map(name => name.trim()).filter(Boolean);
  form.elements.performers.value = selected.join(", ");
  renderVisitPerformersPicker(selected);
  $("#storeVisitModalTitle").textContent = row ? "Chỉnh sửa lịch đi cửa hàng" : "Thêm lịch đi cửa hàng";
  $("#storeVisitModal").classList.remove("hidden");
}
function openDepartmentModal(department = null) { const form = $("#departmentForm"); $("#departmentModal").classList.remove("hidden"); form.reset(); form.elements.id.value = department?.id || ""; form.elements.name.value = department?.name || ""; form.elements.code.value = department?.code || ""; $("#departmentModal h2").textContent = department ? "Chỉnh sửa phòng ban / đơn vị" : "Thêm phòng ban / đơn vị"; setManagerRows(department?.managers?.length ? department.managers : department?.manager ? [{ name: department.manager, title: department.title, employeeCode: department.employeeCode, phone: department.phone }] : []) }
function closeModal(id) { $("#" + id)?.classList.add("hidden") }
function viewTicket(id) {
  const t = state.tickets.find(x => x.id === id); if (!t) return;
  const steps = t.type === "hardware" ? hardwareSteps : systemSteps;
  $("#page").innerHTML = `<div class="page-title-row"><div><button class="link-btn" data-back>← Quay lại</button><h2 style="margin-top:8px">${esc(t.title)}</h2><p>${esc(t.id)}</p></div><div><button class="btn btn-light" data-edit-ticket="${esc(t.id)}">Chỉnh sửa</button> ${t.step < 5 ? `<button class="btn btn-primary" data-advance="${esc(t.id)}">Chuyển bước</button>` : ""}</div></div>
 <div class="detail-panel"><div class="detail-head"><div><h2>${esc(t.title)}</h2><p class="muted" style="font-size:9px;margin-top:5px">${esc(t.description || "Chưa có mô tả")}</p></div><div>${priorityBadge(t.priority)} ${statusBadge(t.status)}</div></div>
 <div class="detail-meta">${meta("Loại", t.type === "hardware" ? "Phần cứng" : "Quản trị hệ thống")}${meta("Đơn vị", t.department || "-")}${meta("Phụ trách", t.assignee || "-")}${meta("Thiết bị / hệ thống", t.systemName || "-")}</div>
 <div class="flow-steps">${steps.map((s, i) => `<div class="flow-step ${i + 1 < t.step ? "done" : ""} ${i + 1 === t.step ? "active" : ""}"><div class="n">${i + 1}</div><b>${esc(s[0])}</b><small>${esc(s[1])}</small></div>`).join("")}</div>
 <div class="detail-section"><h4>Hiện trạng / mô tả</h4><p>${esc(t.description || "Chưa cập nhật")}</p></div>
 <div class="detail-section"><h4>Kết quả / ghi chú xử lý</h4><p>${esc(t.resolution || "Chưa cập nhật")}</p></div>
 <div class="detail-section"><h4>Thông tin phiếu</h4><p>Tạo lúc: ${esc(t.createdAtText || "-")} • Người yêu cầu: ${esc(t.requester || "-")}</p></div></div>`;
  $$("[data-back]").forEach(b => b.onclick = renderTickets);
  $$("[data-edit-ticket]").forEach(b => b.onclick = () => openTicketModal(t.type, t));
  $$("[data-advance]").forEach(b => b.onclick = async () => { await advanceTicket(t.id); viewTicket(t.id) });
}
function renderTickets() { state.page = "tickets"; render() }
function meta(a, b) { return `<div class="meta-box"><small>${esc(a)}</small><b>${esc(b)}</b></div>` }

function updateDepartmentsDatalist() {
  const list = $("#departmentList"); if (list) list.innerHTML = state.departments.map(d => `<option value="${esc(d.name)}">`).join("");
  const departmentPicker = $("#storeVisitForm .department-picker");
  if (departmentPicker) renderDepartmentPicker(departmentPicker.querySelector("input[type='hidden']").value || "");
  const ticketDepartmentField = $("#ticketForm select[name='department']");
  if (ticketDepartmentField) {
    const currentValue = ticketDepartmentField.value || "";
    const options = state.departments.map(d => `<option value="${esc(d.name)}">${esc(d.name)}</option>`).join("");
    ticketDepartmentField.innerHTML = `<option value="">Chọn đơn vị</option>${options}`;
    ticketDepartmentField.value = currentValue;
  }
}

function renderDepartmentPicker(selectedValue = "") {
  const picker = $("#storeVisitForm .department-picker");
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
  button.textContent = hiddenInput.value || "Chọn đơn vị / cửa hàng";
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

function getSelectedVisitPerformers() {
  return [...document.querySelectorAll("#storeVisitForm .visit-performer-option.selected")].map(option => option.dataset.name);
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
  const departmentManagers = state.departments.flatMap(department => {
    if (department.managers?.length) return department.managers.map(manager => ({ ...manager, department: department.name }));
    return department.manager ? [{ name: department.manager, title: department.title, employeeCode: department.employeeCode, phone: department.phone, department: department.name }] : [];
  });
  return [...new Map([...state.employees, ...departmentManagers]
    .filter(employee => String(employee.name || "").trim())
    .map(employee => [normalizeEmployeeSearch(employee.name), employee])).values()];
}

function renderEmployeePicker(fieldName, selectedValue = "") {
  const picker = $(`#ticketForm .employee-picker[data-field="${fieldName}"]`);
  if (!picker) return;
  const employees = getEmployeeOptions();
  const hiddenInput = picker.querySelector("input[type='hidden']");
  const button = picker.querySelector(".employee-value");
  const menu = picker.querySelector(".employee-menu");
  const search = picker.querySelector(".employee-search input");
  const optionWrap = picker.querySelector(".employee-options");
  const defaultText = fieldName === "requester" ? "Chọn người yêu cầu" : "Chọn người phụ trách";
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
$("#globalSearch").oninput = e => { state.search = e.target.value; state.employeePage = 1; if (["tickets", "employees"].includes(state.page)) render() };
$("#refreshBtn").onclick = () => { render(); toast("Đã làm mới", "success") };
$("#mobileMenu").onclick = () => $("#sidebar").classList.toggle("open");
$("#userMenu").onclick = logout;
$("#logoutBtn").onclick = logout;

$$(".nav-item").forEach(b => b.onclick = () => { state.page = b.dataset.page; $("#sidebar").classList.remove("open"); render() });
$$("[data-close]").forEach(b => b.onclick = () => closeModal(b.dataset.close));
document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".modal-backdrop").forEach(m => m.classList.add("hidden")) });

loadFirebase();
