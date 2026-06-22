const app = document.querySelector("#app");
const toastEl = document.querySelector("#toast");
const API_BASES = location.protocol === "file:"
  ? ["http://127.0.0.1:8000"]
  : ["http://127.0.0.1:8000", ""];

const state = {
  mode: "login",
  role: "student",
  branch: "AI&DS",
  user: null,
  dashboard: "Home",
  branches: ["AI&DS", "AI&ML", "CSE(AI)", "CSE(DS)", "CSE(IOT)", "CSE(AI&ML)", "ECE", "EEE", "CIVIL"],
  notices: [],
  userData: { marks: [], payments: [], attendance: [] },
  students: [],
  sidebarOpen: false,
  reset: { username: "", email: "", otp: "" },
  faculty: {
    department: "Computer Science and Engineering",
    name: "Dr. Priya Sharma",
    experience: 12,
    perDayClasses: 5,
    subjects: ["Java", "Python", "Data Structures"],
    branches: ["AI&DS", "AI&ML", "CSE(AI)"],
    students: 126,
    feedback: "Excellent",
  },
  hod: null,
};

const api = async (path, options = {}) => {
  let lastError = null;

  for (let index = 0; index < API_BASES.length; index += 1) {
    const base = API_BASES[index];
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      const text = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const looksJson = contentType.includes("application/json") || text.trim().startsWith("{") || text.trim().startsWith("[");
      const data = looksJson ? JSON.parse(text) : null;

      if (!response.ok) {
        const message = data?.error || data?.message || text.trim() || `Request failed with status ${response.status}.`;
        if (index < API_BASES.length - 1) {
          lastError = new Error(message);
          continue;
        }
        throw new Error(message);
      }

      if (!data) {
        if (index < API_BASES.length - 1) {
          lastError = new Error("API returned non-JSON response.");
          continue;
        }
        throw new Error("API returned non-JSON response.");
      }

      return data;
    } catch (error) {
      lastError = error;
      if (index < API_BASES.length - 1) continue;
    }
  }

  throw lastError || new Error("Unable to reach the API.");
};

const toast = (message) => {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2600);
};

const branchOptions = () => state.branches.map((branch) => `<option value="${branch}">${branch}</option>`).join("");

const setRole = (role) => {
  state.role = role;
  renderAuth();
};

const authRoles = () => state.mode === "register" ? ["student", "faculty"] : ["student", "faculty", "hod"];

const authShell = (content) => `
  <section class="auth-shell">
    <aside class="brand-panel">
      <div class="brand-title">
        <div class="brand-lockup">
          <img class="logo-mark" src="logo.jpeg" alt="Annamacharya University logo">
          <span>Academic Portal</span>
        </div>
        <h1>Annamacharya University</h1>
        <p>A professional campus management system for secure attendance, reports, results and department workflows.</p>
      </div>
      <div class="brand-stats">
        <div><strong>1500</strong><span>Students</span></div>
        <div><strong>9</strong><span>Branches</span></div>
      </div>
    </aside>
    <section class="auth-panel">${content}</section>
  </section>
`;

function renderAuth() {
  const isRegister = state.mode === "register";
  const isReset = state.mode === "reset";
  app.innerHTML = authShell(`
    <form class="auth-card" id="${isRegister ? "registerForm" : isReset ? "resetForm" : "loginForm"}">
      ${isRegister ? `<div class="eyebrow">New Account</div>` : ""}
      <h2>${isRegister ? "Register user" : isReset ? "Reset password" : "Welcome back"}</h2>
      <p class="muted">${isRegister ? "Create student or faculty access. The data is saved in the local database." : isReset ? "Student and faculty users can verify an OTP and set a new password." : "Choose your login type and continue securely."}</p>
      ${location.protocol === "file:" ? `<p class="server-note">For login and registration, keep the local server running at http://127.0.0.1:8000.</p>` : ""}
      <div class="segmented ${isReset ? "hidden" : ""}">
        ${authRoles().map((role) => `<button type="button" class="${state.role === role ? "active" : ""}" onclick="setRole('${role}')">${role.toUpperCase()}</button>`).join("")}
      </div>
      ${isRegister ? registerFields() : isReset ? resetFields() : loginFields()}
      <div class="toolbar">
        <button class="primary" type="submit">${isRegister ? "Save Registration" : isReset ? "Reset Password" : "Login"}</button>
        <button class="ghost" type="button" onclick="${isReset ? "backToLogin()" : "toggleMode()"}">${isRegister || isReset ? "Back to Login" : "New User Register"}</button>
      </div>
      ${!isRegister && !isReset ? `<button class="link-button" type="button" onclick="forgotPassword()">Forgot password?</button>` : ""}
    </form>
  `);
  document.querySelector("form").addEventListener("submit", isRegister ? register : isReset ? resetPassword : login);
}

function loginFields() {
  return `
    <div class="grid">
      <label>Username<input name="username" required placeholder="Enter username"></label>
      <label>Password<input name="password" type="password" minlength="6" required placeholder="Enter password"></label>
      ${state.role === "hod" ? `<p class="private-note">HOD access is private and available only to the authorized department head.</p>` : `<label>Branch<select name="branch">${branchOptions()}</select></label>`}
    </div>
  `;
}

function registerFields() {
  return `
    <div class="grid two">
      <label>Full Name<input name="full_name" required></label>
      <label>Username<input name="username" required></label>
      <label>Set Password<input name="password" type="password" minlength="6" required></label>
      <label>Email ID<input name="email" type="email" required></label>
      <label>Mobile Number<input name="mobile" pattern="[0-9]{10}" required></label>
      <label>Branch<select name="branch">${branchOptions()}</select></label>
    </div>
  `;
}

function resetFields() {
  return `
    <div class="grid">
      <label>Username<input name="username" required value="${state.reset.username}" placeholder="Student or faculty username"></label>
      <button class="ghost" type="button" onclick="sendOtp()">Send OTP</button>
      ${state.reset.email ? `<p class="private-note">OTP sent to ${state.reset.email}. Demo OTP: <strong>${state.reset.otp}</strong></p>` : ""}
      <label>OTP<input name="otp" required placeholder="Enter OTP"></label>
      <label>New Password<input name="password" type="password" minlength="6" required placeholder="Minimum 6 characters"></label>
    </div>
  `;
}

function toggleMode() {
  state.mode = state.mode === "login" ? "register" : "login";
  if (state.mode === "register" && state.role === "hod") state.role = "student";
  renderAuth();
}

function backToLogin() {
  state.mode = "login";
  state.reset = { username: "", email: "", otp: "" };
  renderAuth();
}

async function register(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ ...form, role: state.role }),
    });
    toast(data.message);
    state.mode = "login";
    renderAuth();
  } catch (error) {
    toast(error.message);
  }
}

async function login(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const user = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ ...form, role: state.role }),
    });
    state.user = user;
    state.dashboard = "Home";
    if (user.role === "hod") state.hod = await api("/api/hod");
    if (user.role !== "hod") await loadUser(user.username);
    if (user.role === "faculty") await loadStudents();
    renderDashboard();
  } catch (error) {
    toast(error.message);
  }
}

async function forgotPassword() {
  const username = document.querySelector("[name='username']").value;
  state.mode = "reset";
  state.reset.username = username || "";
  renderAuth();
}

async function sendOtp() {
  const username = document.querySelector("[name='username']").value;
  if (!username) return toast("Enter your username first.");
  try {
    const data = await api("/api/forgot", { method: "POST", body: JSON.stringify({ username }) });
    state.reset = { username, email: data.email, otp: data.otp };
    renderAuth();
    toast(data.message);
  } catch (error) {
    toast(error.message);
  }
}

async function resetPassword(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const data = await api("/api/reset-password", {
      method: "POST",
      body: JSON.stringify(form),
    });
    toast(data.message);
    backToLogin();
  } catch (error) {
    toast(error.message);
  }
}

async function loadUser(username) {
  const data = await api(`/api/user/${encodeURIComponent(username)}`);
  state.userData = data;
  state.user = data.user;
}

async function loadNotices() {
  const data = await api("/api/notices");
  state.notices = data.notices;
}

async function loadStudents() {
  const data = await api("/api/students");
  state.students = data.students;
}

function dashboardNav() {
  const common = ["Home", "Digital Notice Board", "Profile"];
  const specific = state.user.role === "student"
    ? ["Attendance", "Results", "Fee Payments", "Support"]
    : state.user.role === "faculty"
      ? ["Classes", "Give Attendance", "Mid Marks", "Labs Marking", "Feedback"]
      : ["Reports", "Department Strength", "Faculty Review"];
  return [...common, ...specific];
}

function renderDashboard() {
  const nav = dashboardNav();
  app.innerHTML = `
    <section class="app-shell ${state.sidebarOpen ? "menu-open" : ""}">
      <button class="menu-backdrop" onclick="toggleMenu()" aria-label="Close menu"></button>
      <aside class="sidebar">
        <div class="side-brand">
          <img src="logo.jpeg" alt="">
          <strong>Annamacharya<br>University</strong>
        </div>
        <nav class="nav">
          ${nav.map((item) => `<button class="${state.dashboard === item ? "active" : ""}" onclick="openView('${item}')">${item}</button>`).join("")}
          <button onclick="logout()">Logout</button>
        </nav>
      </aside>
      <main class="content">
        <header class="topbar">
          <button class="menu-button" onclick="toggleMenu()" aria-label="Open menu">☰</button>
          <div>
            <div class="eyebrow">${state.user.role.toUpperCase()} DASHBOARD</div>
            <h1>Welcome to Annamacharya University</h1>
          </div>
        </header>
        ${viewContent()}
      </main>
    </section>
  `;
}

function openView(view) {
  state.dashboard = view;
  state.sidebarOpen = false;
  renderDashboard();
}

function toggleMenu() {
  state.sidebarOpen = !state.sidebarOpen;
  renderDashboard();
}

function logout() {
  state.user = null;
  state.mode = "login";
  state.role = "student";
  renderAuth();
}

function viewContent() {
  if (state.dashboard === "Home") return homeView();
  if (state.dashboard === "Digital Notice Board") return noticesView();
  if (state.dashboard === "Profile") return profileView();
  if (state.user.role === "student") return studentView();
  if (state.user.role === "faculty") return facultyView();
  return hodView();
}

function homeView() {
  const role = state.user.role;
  const kpis = role === "student"
    ? [["Attendance", "92%"], ["Latest CGPA", "9.5"], ["Fee Status", "1 Due"], ["Branch", state.user.branch]]
    : role === "faculty"
      ? [["Per Day Classes", state.faculty.perDayClasses], ["Subjects", "3"], ["Students", state.faculty.students], ["Feedback", state.faculty.feedback]]
      : [["Students", "1500", "openStudentPdf()"], ["Faculty Members", "20", "openFacultyMembers()"], ["Branch", state.hod.branch], ["Reports", "3"]];
  return `
    <section class="kpis">${kpis.map(([label, value, action]) => `<article class="card ${action ? "clickable" : ""}" ${action ? `onclick="${action}"` : ""}><span class="muted">${label}</span><br><strong>${value}</strong></article>`).join("")}</section>
    <section class="panel-grid">
      <article class="card"><h3>Quick Actions</h3><div class="toolbar">${dashboardNav().slice(1, 7).map((item) => `<button class="ghost" onclick="openView('${item}')">${item}</button>`).join("")}</div></article>
      <article class="card"><h3>Today</h3><p class="muted">Campus portal is active. Data changes are saved instantly in the database.</p><span class="badge">Working</span></article>
    </section>
  `;
}

function noticesView() {
  return `
    <section class="card">
      <div class="row"><h3>Digital Notice Board</h3><button class="ghost" onclick="refreshNotices()">Refresh</button></div>
      ${state.notices.map((notice) => `<div class="notice"><strong>${notice.title}</strong><span class="muted">${notice.body}</span><span class="badge">${notice.audience}</span></div>`).join("")}
    </section>
  `;
}

async function refreshNotices() {
  await loadNotices();
  renderDashboard();
  toast("Notice board refreshed.");
}

function profileView() {
  if (state.user.role === "hod") {
    return `<section class="card"><h3>HOD Profile</h3><p><strong>${state.hod.name}</strong></p><p>Profession: ${state.hod.profession}</p><p>Branch: ${state.hod.branch}</p></section>`;
  }
  return `
    <form class="card grid two" onsubmit="saveProfile(event)">
      <label>Full Name<input name="full_name" value="${state.user.full_name}" required></label>
      <label>Email<input name="email" type="email" value="${state.user.email}" required></label>
      <label>Mobile<input name="mobile" value="${state.user.mobile}" required></label>
      <label>Branch<select name="branch">${state.branches.map((branch) => `<option ${branch === state.user.branch ? "selected" : ""}>${branch}</option>`).join("")}</select></label>
      <button class="primary" type="submit">Save Profile</button>
    </form>
  `;
}

async function saveProfile(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  await api("/api/profile", { method: "POST", body: JSON.stringify({ ...form, username: state.user.username }) });
  await loadUser(state.user.username);
  renderDashboard();
  toast("Profile saved.");
}

function studentView() {
  if (state.dashboard === "Attendance") {
    return `<section class="card"><h3>Student Attendance</h3>${attendanceTable()}</section>`;
  }
  if (state.dashboard === "Results") {
    return tableCard("Results", ["Semester", "CGPA / Status"], [
      ["1st Semester", "7.45"],
      ["2nd Semester", "8.57"],
      ["3rd Semester", "9.2"],
      ["4th Semester", "9.5"],
      ["5th Semester", "Running"],
    ]);
  }
  if (state.dashboard === "Fee Payments") {
    return tableCard("Fee Payments", ["Fee", "Amount", "Status"], state.userData.payments.map((payment) => [payment.label, `Rs. ${payment.amount}`, payment.status]));
  }
  return `<section class="card support-card"><h3>Student Support</h3><p class="muted">Scholarship helpdesk, transport office, library service and examination cell requests are ready.</p><button class="primary" onclick="toast('Support request submitted.')">Submit Request</button></section>`;
}

function facultyView() {
  if (state.dashboard === "Classes") {
    return tableCard("Per Day Classes", ["Subject", "Branch", "Students"], state.faculty.subjects.map((subject, index) => [subject, state.faculty.branches[index], [42, 38, 46][index]]));
  }
  if (state.dashboard === "Give Attendance") {
    return attendanceForm();
  }
  if (state.dashboard === "Mid Marks" || state.dashboard === "Labs Marking") {
    return marksForm(state.dashboard === "Mid Marks" ? "Mid Marks" : "Mid Lab");
  }
  return `
    <section class="card">
      <h3>Faculty Feedback</h3>
      <label>Experience 1 to 30 years<input type="range" min="1" max="30" value="${state.faculty.experience}" oninput="saveExperience(this.value)"></label>
      <p><strong>${state.faculty.experience} years</strong></p>
      <p>Automatic feedback: <span class="badge">${state.faculty.feedback}</span></p>
    </section>
  `;
}

function attendanceForm() {
  return `
    <section>
      <form class="card grid" onsubmit="saveAttendance(event)">
        <h3>Give Attendance</h3>
        <label>Registered Student<select name="student_username" required onchange="syncStudentBranch(this.value)">
          ${state.students.map((student) => `<option value="${student.username}">${student.full_name} - ${student.branch}</option>`).join("")}
        </select></label>
        <label>Subject<select name="subject">${state.faculty.subjects.map((s) => `<option>${s}</option>`).join("")}</select></label>
        <label>Branch<select name="branch">${state.branches.map((b) => `<option>${b}</option>`).join("")}</select></label>
        <label>Status<select name="status"><option>Present</option><option>Absent</option></select></label>
        <button class="primary" type="submit">Save Attendance</button>
      </form>
    </section>
  `;
}

async function saveAttendance(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  const data = await api("/api/attendance", { method: "POST", body: JSON.stringify({ ...form, faculty_username: state.user.username }) });
  state.userData.attendance = data.attendance;
  renderDashboard();
  toast(data.message);
}

function marksForm(category) {
  const defaultSubject = category === "Mid Lab" ? "Java Lab" : "Java";
  return `
    <form class="card grid two" onsubmit="saveMark(event, '${category}')">
      <h3>${category}</h3>
      <label>Student Username<input name="student_username" value="student" required></label>
      <label>Subject<input name="subject" value="${defaultSubject}" required></label>
      <label>Marks<input name="score" type="number" min="0" max="100" value="${category === "Mid Lab" ? 70 : 80}" required></label>
      <label>Total<input name="total" type="number" value="100" required></label>
      <button class="primary" type="submit">Save Marks</button>
    </form>
  `;
}

async function saveMark(event, category) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  await api("/api/marks", { method: "POST", body: JSON.stringify({ ...form, category }) });
  toast("Marks saved.");
}

function saveExperience(value) {
  state.faculty.experience = Number(value);
  state.faculty.feedback = value > 20 ? "Excellent" : value > 10 ? "Good" : "Better";
  renderDashboard();
  toast("Experience saved automatically.");
}

function attendanceTable() {
  const rows = state.userData.attendance.length
    ? state.userData.attendance.map((item) => [item.subject, item.branch, item.status, item.created_at || ""])
    : [["No attendance marked yet", "-", "-", "-"]];
  return `
    <table class="table">
      <thead><tr><th>Subject</th><th>Branch</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function syncStudentBranch(username) {
  const selected = state.students.find((student) => student.username === username);
  const branch = document.querySelector("[name='branch']");
  if (selected && branch) branch.value = selected.branch;
}

function openStudentPdf() {
  window.open("IB.Tech_RollList-2024-25.pdf", "_blank");
}

function openFacultyMembers() {
  state.dashboard = "Faculty Members";
  renderDashboard();
}

function hodView() {
  if (state.dashboard === "Reports") {
    return `<section class="card"><h3>Reports</h3>${state.hod.reports.map((item) => `<div class="notice"><strong>${item}</strong><span class="muted">Updated by department dashboard</span></div>`).join("")}</section>`;
  }
  if (state.dashboard === "Department Strength") {
    return `<section class="kpis"><article class="card clickable" onclick="openStudentPdf()"><span class="muted">Number of Students</span><br><strong>${state.hod.students}</strong></article><article class="card clickable" onclick="openFacultyMembers()"><span class="muted">Faculty Members</span><br><strong>20</strong></article><article class="card"><span class="muted">Branch</span><br><strong>${state.hod.branch}</strong></article></section>`;
  }
  if (state.dashboard === "Faculty Members") {
    const names = ["Sunilkumar", "Swathi", "Venkatesh.V", "J.Krishna", "Janardhan.K", "Joshna", "Nandini", "Saraswathi", "Nagarajkumar", "Narmatha", "Ghouse", "Vijaykumar", "Subramanyam", "Joshna", "Venkatesh Goud", "Hari Krishna", "Harinath", "B.Harikrishna", "K.Kiran Kumar", "Bhageerath"];
    return `<section class="card"><div class="row"><h3>Faculty Members</h3><button class="ghost" onclick="openView('Department Strength')">Back</button></div><div class="member-grid">${names.map((name, index) => `<div class="member-row"><strong>${index + 1}</strong><span>${name}</span></div>`).join("")}</div></section>`;
  }
  return `<section class="card"><h3>Faculty Review</h3><p>Name: ${state.hod.name}</p><p>Profession: ${state.hod.profession}</p><p>Branch: ${state.hod.branch}</p><button class="primary" onclick="toast('Review report approved.')">Approve Review</button></section>`;
}

function tableCard(title, headers, rows) {
  return `
    <section class="card">
      <h3>${title}</h3>
      <table class="table">
        <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </section>
  `;
}

(async function init() {
  try {
    const boot = await api("/api/bootstrap");
    state.branches = boot.branches;
    await loadNotices();
  } catch {
    toast("Start the backend service to use database features.");
  }
  renderAuth();
})();
