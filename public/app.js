// app.js — Frontend logic for Fieldwork (Freelancer Collaboration Platform)
const API = '/api';
let USERS = [];
let PROJECTS = [];

// ---------- Utilities ----------
function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ---------- Health check ----------
async function checkHealth() {
  const dot = document.getElementById('dbStatusDot');
  const text = document.getElementById('dbStatusText');
  try {
    await api('/health');
    dot.className = 'status-dot ok';
    text.textContent = 'database connected';
  } catch (e) {
    dot.className = 'status-dot err';
    text.textContent = 'database unreachable';
  }
}

// ---------- Shared dropdown population ----------
function populateUserSelects() {
  const clients = USERS.filter(u => u.Role === 'Client');
  const freelancers = USERS.filter(u => u.Role === 'Freelancer');

  const fillSelect = (el, list, placeholder) => {
    el.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') +
      list.map(u => `<option value="${u.UserID}">${u.Name}</option>`).join('');
  };

  fillSelect(document.getElementById('projClient'), clients, 'Select client');
  fillSelect(document.getElementById('projFreelancer'), freelancers, 'Unassigned');
  fillSelect(document.getElementById('timeFreelancer'), freelancers, 'Select freelancer');
}

function populateProjectSelects() {
  const opts = PROJECTS.map(p => `<option value="${p.ProjectID}">${p.Title}</option>`).join('');
  ['timeProject', 'summaryProject', 'payProject', 'reviewProject'].forEach(id => {
    document.getElementById(id).innerHTML = `<option value="">Select project</option>` + opts;
  });
}

// ---------- Dashboard ----------
function showDashboardLoading(show) {
  const loader = document.getElementById('dashboardLoading');
  const content = document.getElementById('dashboardContent');
  if (show) {
    loader.style.display = 'flex';
    content.classList.add('is-loading');
  } else {
    loader.style.display = 'none';
    content.classList.remove('is-loading');
  }
}

async function loadDashboard() {
  showDashboardLoading(true);
  try {
    const [users, projects] = await Promise.all([api('/users'), api('/projects')]);
    USERS = users; PROJECTS = projects;
    populateUserSelects(); populateProjectSelects();

    document.getElementById('statProjects').textContent = projects.filter(p => p.Status !== 'Completed').length;
    document.getElementById('statUsers').textContent = users.filter(u => u.Role === 'Freelancer').length;

    let totalHours = 0, pendingCount = 0;
    for (const p of projects) {
      try {
        const summary = await api(`/timelogs/project/${p.ProjectID}/summary`);
        totalHours += summary.TotalHours || 0;
      } catch (e) {}
      try {
        const pays = await api(`/payments/project/${p.ProjectID}`);
        pendingCount += pays.filter(pay => pay.Status === 'Pending').length;
      } catch (e) {}
    }
    document.getElementById('statHours').textContent = totalHours.toFixed(1);
    document.getElementById('statPending').textContent = pendingCount;

    const list = document.getElementById('dashProjectsList');
    list.innerHTML = projects.slice(0, 6).map(p => `
      <div class="mini-row">
        <span>${p.Title} <span style="color:var(--hint)">— ${p.ClientName || 'Unknown client'}</span></span>
        <span class="tag ${p.Status === 'Completed' ? 'completed' : p.Status === 'Open' ? 'open' : ''}">${p.Status}</span>
      </div>
    `).join('') || '<p class="hint">No projects yet — create one in the Projects tab.</p>';

    showDashboardLoading(false);
  } catch (e) {
    showDashboardLoading(false);
    toast('Failed to load dashboard: ' + e.message, true);
  }
}

// ---------- Projects ----------
async function loadProjects() {
  PROJECTS = await api('/projects');
  populateProjectSelects();
  const tbody = document.querySelector('#projectsTable tbody');
  tbody.innerHTML = PROJECTS.map(p => `
    <tr>
      <td>${p.Title}</td>
      <td>${p.ClientName || '—'}</td>
      <td>${p.FreelancerName || 'Unassigned'}</td>
      <td><span class="tag ${p.Status === 'Completed' ? 'completed' : p.Status === 'Open' ? 'open' : ''}">${p.Status}</span></td>
      <td>
        <select onchange="updateProjectStatus(${p.ProjectID}, this.value)">
          <option ${p.Status === 'Open' ? 'selected' : ''}>Open</option>
          <option ${p.Status === 'InProgress' ? 'selected' : ''}>InProgress</option>
          <option ${p.Status === 'Completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="hint">No projects yet.</td></tr>';
}

window.updateProjectStatus = async (id, status) => {
  try {
    await api(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ Status: status }) });
    toast('Project status updated');
    loadProjects();
  } catch (e) { toast(e.message, true); }
};

document.getElementById('projectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/projects', {
      method: 'POST',
      body: JSON.stringify({
        ClientID: document.getElementById('projClient').value,
        FreelancerID: document.getElementById('projFreelancer').value || null,
        Title: document.getElementById('projTitle').value,
        Description: document.getElementById('projDesc').value,
        Status: 'Open'
      })
    });
    toast('Project created');
    e.target.reset();
    loadProjects();
  } catch (e2) { toast(e2.message, true); }
});

// ---------- Files ----------
async function loadFiles() {
  try {
    const files = await api('/files');
    const tbody = document.querySelector('#filesTable tbody');
    tbody.innerHTML = files.map(f => `
      <tr>
        <td>${f.name}</td>
        <td class="num">${f.sizeKB} KB</td>
        <td>${fmtDate(f.lastModified)}</td>
        <td>
          <div class="action-btns">
            <a href="${f.url}" target="_blank" rel="noopener" class="btn-primary btn-sm" style="text-decoration:none;">Download</a>
            <button class="btn-danger btn-sm" onclick="deleteFile('${f.name}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="hint">No files uploaded yet.</td></tr>';
  } catch (e) {
    document.getElementById('fileHint').textContent = 'Could not reach Blob Storage — check AZURE_STORAGE_CONNECTION_STRING in .env';
  }
}

window.deleteFile = async (name) => {
  try {
    await api(`/files/${encodeURIComponent(name)}`, { method: 'DELETE' });
    toast('File deleted');
    loadFiles();
  } catch (e) { toast(e.message, true); }
};

document.getElementById('fileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('fileInput');
  if (!fileInput.files.length) return;
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  try {
    const res = await fetch(`${API}/files/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
    toast('File uploaded');
    e.target.reset();
    loadFiles();
  } catch (e2) { toast(e2.message, true); }
});

// ---------- Time Tracking ----------
async function loadTimeLogsForProject(projectId) {
  if (!projectId) { document.querySelector('#timeTable tbody').innerHTML = ''; return; }
  const logs = await api(`/timelogs/project/${projectId}`);
  const project = PROJECTS.find(p => p.ProjectID == projectId);
  const tbody = document.querySelector('#timeTable tbody');
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td>${project ? project.Title : '—'}</td>
      <td>${l.FreelancerName}</td>
      <td>${fmtDate(l.StartTime)}</td>
      <td>${fmtDate(l.EndTime)}</td>
      <td class="num">${l.HoursLogged}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="hint">No time logged yet for this project.</td></tr>';
}

document.getElementById('timeProject').addEventListener('change', (e) => loadTimeLogsForProject(e.target.value));

document.getElementById('summaryProject').addEventListener('change', async (e) => {
  const box = document.getElementById('summaryBox');
  if (!e.target.value) { box.textContent = 'Select a project to see logged hours.'; return; }
  try {
    const summary = await api(`/timelogs/project/${e.target.value}/summary`);
    const hrs = summary.TotalHours ? Number(summary.TotalHours).toFixed(2) : '0.00';
    box.textContent = `${summary.TotalSessions || 0} session(s) · ${hrs} total hours logged`;
  } catch (e2) { box.textContent = 'Could not load summary.'; }
});

document.getElementById('timeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const result = await api('/timelogs', {
      method: 'POST',
      body: JSON.stringify({
        ProjectID: document.getElementById('timeProject').value,
        FreelancerID: document.getElementById('timeFreelancer').value,
        StartTime: document.getElementById('timeStart').value,
        EndTime: document.getElementById('timeEnd').value
      })
    });
    document.getElementById('timeHint').textContent = `Logged ${result.HoursLogged} hours.`;
    e.target.reset();
    loadTimeLogsForProject(document.getElementById('timeProject').value);
  } catch (e2) { toast(e2.message, true); }
});

// ---------- Payments ----------
async function loadPaymentsForProject() {
  let rows = [];
  for (const p of PROJECTS) {
    try {
      const pays = await api(`/payments/project/${p.ProjectID}`);
      rows.push(...pays.map(pay => ({ ...pay, Title: p.Title })));
    } catch (e) {}
  }
  renderPaymentsTable(rows);
}

function renderPaymentsTable(rows) {
  const tbody = document.querySelector('#paymentsTable tbody');
  tbody.innerHTML = rows.map(pay => `
    <tr>
      <td>${pay.Title || '—'}</td>
      <td class="num">₹${Number(pay.Amount).toFixed(2)}</td>
      <td><span class="tag ${pay.Status === 'Completed' ? 'completed' : 'open'}">${pay.Status}</span></td>
      <td>${fmtDate(pay.PaymentDate)}</td>
      <td>${pay.Status === 'Pending' ? `<button class="btn-success btn-sm" onclick="markPaid(${pay.PaymentID})">Mark Paid</button>` : ''}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="hint">No payments yet.</td></tr>';
}

window.markPaid = async (id) => {
  try {
    await api(`/payments/${id}/pay`, { method: 'PUT' });
    toast('Payment marked as completed');
    loadPaymentsForProject();
  } catch (e) { toast(e.message, true); }
};

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/payments', {
      method: 'POST',
      body: JSON.stringify({
        ProjectID: document.getElementById('payProject').value,
        Amount: document.getElementById('payAmount').value
      })
    });
    toast('Invoice raised');
    e.target.reset();
    loadPaymentsForProject();
  } catch (e2) { toast(e2.message, true); }
});

// ---------- Profiles & Reviews ----------
async function loadProfiles() {
  USERS = await api('/users');
  populateUserSelects();
  const grid = document.getElementById('profilesGrid');
  const ratings = await Promise.all(USERS.map(u =>
    u.Role === 'Freelancer' ? api(`/reviews/freelancer/${u.UserID}/rating`).catch(() => ({})) : Promise.resolve({})
  ));
  grid.innerHTML = USERS.map((u, i) => {
    const r = ratings[i];
    const ratingText = r && r.AvgRating ? `★ ${Number(r.AvgRating).toFixed(1)} (${r.TotalReviews})` : 'No reviews yet';
    return `
      <div class="profile-card">
        <span class="role">${u.Role}</span>
        <h3>${u.Name}</h3>
        ${u.Bio ? `<p class="bio-text">"${u.Bio}"</p>` : '<p class="bio-text" style="opacity:0.5">No bio added yet.</p>'}
        ${u.Role === 'Freelancer' ? `<p class="rating-text">${ratingText}</p>` : ''}
        ${u.PortfolioLink ? `<a href="${u.PortfolioLink}" target="_blank" rel="noopener">View portfolio →</a>` : ''}
        <div style="margin-top:12px;padding-top:10px;border-top:1.5px solid #ccc;">
          <button class="btn-danger btn-sm" onclick="deleteProfile(${u.UserID}, '${u.Name.replace(/'/g, "\\'")}')">Delete Profile</button>
        </div>
      </div>
    `;
  }).join('') || '<p class="hint">No profiles yet.</p>';
}

window.deleteProfile = async (id, name) => {
  if (!confirm(`Delete profile for "${name}"? This cannot be undone.`)) return;
  try {
    await api(`/users/${id}`, { method: 'DELETE' });
    toast('Profile deleted');
    loadProfiles();
    loadDashboard();
  } catch (e) { toast(e.message, true); }
};

document.getElementById('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/users', {
      method: 'POST',
      body: JSON.stringify({
        Name: document.getElementById('userName').value,
        Email: document.getElementById('userEmail').value,
        Role: document.getElementById('userRole').value,
        Bio: document.getElementById('userBio').value,
        PortfolioLink: document.getElementById('userPortfolio').value
      })
    });
    toast('Profile created');
    e.target.reset();
    loadProfiles();
  } catch (e2) { toast(e2.message, true); }
});

document.getElementById('reviewForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/reviews', {
      method: 'POST',
      body: JSON.stringify({
        ProjectID: document.getElementById('reviewProject').value,
        Rating: document.getElementById('reviewRating').value,
        Comment: document.getElementById('reviewComment').value
      })
    });
    toast('Review submitted');
    e.target.reset();
    loadProfiles();
  } catch (e2) { toast(e2.message, true); }
});

// ---------- Navigation ----------
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`view-${btn.dataset.view}`).classList.add('active');

    const view = btn.dataset.view;
    if (view === 'dashboard') loadDashboard();
    if (view === 'projects') loadProjects();
    if (view === 'files') loadFiles();
    if (view === 'profiles') loadProfiles();
    if (view === 'time') loadProjects();
    if (view === 'payments') loadProjects().then(loadPaymentsForProject);
  });
});

// ---------- Init ----------
checkHealth();
loadDashboard();
