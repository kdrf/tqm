// js/teacher-dashboard.js

// Format date helper
function sgDate(dt) {
    if (!dt) return 'Tarix yoxdur';
    return new Date(dt).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Parse metadata helper
function parseMeta(meta) {
    if (typeof meta === 'string') {
        try { return JSON.parse(meta); } catch(e) { return {}; }
    }
    return meta || {};
}


async function loadTeacherDashboard() {
  if (!window.currentProfile) return;
  const profile = window.currentProfile;

  // Set Profile Header Data
  const nameEl = document.getElementById('welcome-name');
  if (nameEl) nameEl.textContent = profile.full_name?.split(' ')[0] || 'Müəllim';

  // Get active test count
  const { count, error: countErr } = await supabaseClient
    .from('tests')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', profile.id);

  if (document.getElementById('stat-active-tests')) {
      document.getElementById('stat-active-tests').textContent = count || 0;
  }

  // Use !inner join to fetch all relevant sessions for this teacher's tests via cross-table filtering
  const { data: sessions, error: sessErr } = await supabaseClient
    .from('exam_sessions')
    .select('id, test_id, student_id, score, status, started_at, finished_at, tests!inner(title), profiles(full_name)')
    .eq('tests.teacher_id', profile.id)
    .order('started_at', { ascending: false });

  if (sessErr || !sessions || sessions.length === 0) {
      if (document.getElementById('stat-student-count')) document.getElementById('stat-student-count').textContent = '0';
      return showEmptyTeacherResults();
  }

  // Count Unique Students
  const uniqueStudentIds = new Set(sessions.map(s => s.student_id));
  if (document.getElementById('stat-student-count')) {
      document.getElementById('stat-student-count').textContent = uniqueStudentIds.size;
  }
  
  const completed = sessions.filter(s => s.status === 'completed' && s.score != null);
  
  if (completed.length > 0) {
      let sum = completed.reduce((a, b) => a + b.score, 0);
      if (document.getElementById('stat-avg-score')) document.getElementById('stat-avg-score').textContent = Math.round(sum / completed.length) + '%';
  } else {
      if (document.getElementById('stat-avg-score')) document.getElementById('stat-avg-score').textContent = '—';
  }

  // Populate weekly activity chart from session data
  populateWeeklyActivityChart(sessions);

  // Populate topic/subject mastery panel
  populateSubjectMasteryMini(sessions);

  // Result list and Public tests are handled by router or called here
  await loadPublicTestsForTeacher();
}

function showEmptyTeacherResults() {
  const recList = document.getElementById('teacher-results-tbody');
  if (recList) {
      recList.innerHTML = `
        <tr><td colspan="7" style="text-align:center; padding:40px; color:#94a3b8;">
            <div style="font-size:32px; margin-bottom:12px;">📊</div>
            <div>Hələ heç bir şagird imtahan verməyib.</div>
        </td></tr>
      `;
  }

  // Also clear loading spinners on charts
  const chartEl = document.getElementById('weekly-activity-chart');
  if (chartEl) {
    const cols = chartEl.querySelectorAll('.b-col');
    cols.forEach(c => c.style.height = '5%');
  }
  const masteryEl = document.getElementById('subject-mastery-mini');
  if (masteryEl) {
    masteryEl.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px;">Hələ məlumat yoxdur.</div>`;
  }
}

// Populate the weekly activity bar chart from session data
function populateWeeklyActivityChart(sessions) {
  const chartEl = document.getElementById('weekly-activity-chart');
  if (!chartEl) return;

  const now = new Date();
  const dayNames = ['Baz', 'B.e', 'Ç.a', 'Çər', 'C.a', 'Cüm', 'Şən'];
  const counts = [0, 0, 0, 0, 0, 0, 0]; // Sun=0 through Sat=6

  // Count sessions from last 7 days per weekday
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  sessions.forEach(s => {
    const d = new Date(s.started_at);
    if (d >= sevenDaysAgo) {
      counts[d.getDay()]++;
    }
  });

  const maxCount = Math.max(...counts, 1);
  // Reorder so Monday is first: Mon=1, Tue=2, ..., Sun=0
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const todayDay = now.getDay();

  chartEl.innerHTML = weekOrder.map(dayIdx => {
    const pct = Math.max(5, Math.round((counts[dayIdx] / maxCount) * 100));
    const isToday = dayIdx === todayDay;
    return `<div class="b-col${isToday ? ' active' : ''}" style="height:${pct}%"><span class="b-label">${dayNames[dayIdx]}</span></div>`;
  }).join('');
}

// Populate the subject mastery mini panel
function populateSubjectMasteryMini(sessions) {
  const container = document.getElementById('subject-mastery-mini');
  if (!container) return;

  const completed = sessions.filter(s => s.status === 'completed' && s.score != null);
  if (completed.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px;">Hələ məlumat yoxdur.</div>`;
    return;
  }

  // Group by subject
  const subjectMap = {};
  completed.forEach(s => {
    const subj = (s.tests && s.tests.title) ? s.tests.title.split(' - ')[0] : 'Digər';
    if (!subjectMap[subj]) subjectMap[subj] = { total: 0, count: 0 };
    subjectMap[subj].total += s.score;
    subjectMap[subj].count++;
  });

  const subjects = Object.entries(subjectMap)
    .map(([name, data]) => ({ name, avg: Math.round(data.total / data.count) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  container.innerHTML = subjects.map((s, i) => `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="display:flex; justify-content:space-between;">
        <span style="font-size:14px; font-weight:600; color:#1e293b;">${s.name}</span>
        <span style="font-size:14px; font-weight:700; color:${colors[i % colors.length]};">${s.avg}%</span>
      </div>
      <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
        <div style="width:${s.avg}%; height:100%; background:${colors[i % colors.length]}; border-radius:4px; transition:width 0.5s;"></div>
      </div>
    </div>
  `).join('');
}

async function loadTeacherTests() {
  const testsList = document.getElementById('teacher-active-tests-grid');
  const dedicatedGrid = document.getElementById('active-tests-dynamic-grid');
  if ((!testsList && !dedicatedGrid) || !window.currentProfile) return;

  const { data: tests, error } = await supabaseClient
    .from('tests')
    .select('*')
    .eq('teacher_id', window.currentProfile.id)
    .order('created_at', { ascending: false });

  const emptyHtml = `
    <div class="empty-state" style="text-align:center; padding:40px; color:#94a3b8; background:white; border-radius:16px;">
      <div style="font-size:32px; margin-bottom:12px;">📝</div>
      <div>Hələ heç bir imtahan yaratmamısınız.</div>
    </div>
  `;
  if (error || !tests || tests.length === 0) {
    if (testsList) testsList.innerHTML = emptyHtml;
    if (dedicatedGrid) dedicatedGrid.innerHTML = emptyHtml;
    return;
  }

  const testsHtml = tests.map(t => `
    <div class="test-card" style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
            <div>
                <span style="font-size:12px; font-weight:600; background:#f1f5f9; color:#475569; padding:4px 10px; border-radius:12px; margin-right:8px;">${t.subject}</span>
                <span style="font-size:12px; color:#64748b;">${sgDate(t.created_at)}</span>
            </div>
            <span style="font-size:12px; font-weight:700; color:${t.is_active ? '#16a34a' : '#ef4444'}; background:${t.is_active ? '#dcfce7' : '#fee2e2'}; padding:4px 10px; border-radius:12px;">
                ${t.is_active ? 'Aktiv' : 'Deaktiv'}
            </span>
        </div>
        <h3 style="font-size:18px; font-weight:700; color:#0f172a; margin-bottom:8px;">${t.title}</h3>
        <div style="font-size:13px; color:#64748b; display:flex; gap:16px; margin-bottom:16px;">
            <span>⏱ ${t.duration_minutes || 45} dəq</span>
            ${t.is_public ? '<span style="color:#2563eb">📢 İctimai</span>' : `<span>🔒 Kod: <b>${t.access_code || 'Yoxdur'}</b></span>`}
        </div>
        <div style="display:flex; gap:12px;">
            <button class="btn-outline" style="padding:8px 16px; border:1px solid #e2e8f0; border-radius:10px; font-size:13px; font-weight:600; color:#475569; cursor:pointer; background:white;" onclick="navigateTo('teacher-student-list')">Nəticələr</button>
            <button class="btn-outline" style="padding:8px 16px; border:1px solid #e2e8f0; border-radius:10px; font-size:13px; font-weight:600; color:#ef4444; cursor:pointer; background:white;" onclick="deleteTeacherTest('${t.id}')">Sil</button>
        </div>
    </div>
  `).join('');

  // Populate both the dashboard preview grid and the dedicated active tests page grid
  if (testsList) testsList.innerHTML = testsHtml;
  if (dedicatedGrid) dedicatedGrid.innerHTML = testsHtml;
}

// FIX C4: Real topics analysis — fetches sessions and groups by subject
async function loadTopicsAnalysis() {
  const container = document.getElementById('topics-analysis-container');
  if (!container || !window.currentProfile) return;

  container.innerHTML = `<div style="text-align:center;padding:60px;color:#94a3b8;"><span class="spinner" style="display:inline-block;width:24px;height:24px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin 0.8s linear infinite;"></span></div>`;

  const { data: sessions, error } = await supabaseClient
    .from('exam_sessions')
    .select('score, status, started_at, tests!inner(title, subject)')
    .eq('tests.teacher_id', window.currentProfile.id)
    .eq('status', 'completed')
    .not('score', 'is', null);

  if (error || !sessions || sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center; padding:50px; color:#94a3b8; background:white; border-radius:16px;">
        <div style="font-size:48px; margin-bottom:16px;">📈</div>
        <div>Təhlil etmək üçün kifayət qədər imtahan nəticəsi yoxdur.</div>
      </div>`;
    return;
  }

  // Group by subject
  const subjectMap = {};
  sessions.forEach(s => {
    const subj = (s.tests && s.tests.subject) ? s.tests.subject : 'Digər';
    if (!subjectMap[subj]) subjectMap[subj] = { total: 0, count: 0, scores: [] };
    subjectMap[subj].total += s.score;
    subjectMap[subj].count++;
    subjectMap[subj].scores.push(s.score);
  });

  const subjects = Object.entries(subjectMap)
    .map(([name, d]) => ({
      name,
      avg: Math.round(d.total / d.count),
      count: d.count,
      best: Math.max(...d.scores),
      worst: Math.min(...d.scores)
    }))
    .sort((a, b) => b.avg - a.avg);

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px;">
      ${subjects.map((s, i) => {
        const color = colors[i % colors.length];
        const level = s.avg >= 80 ? 'Yüksək' : (s.avg >= 50 ? 'Orta' : 'Zəif');
        const levelColor = s.avg >= 80 ? '#16a34a' : (s.avg >= 50 ? '#f59e0b' : '#ef4444');
        return `
        <div style="background:white; border-radius:16px; padding:24px; border:1px solid #e2e8f0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <span style="font-size:17px; font-weight:700; color:#0f172a;">${s.name}</span>
              <span style="font-size:12px; color:#64748b; margin-left:12px;">${s.count} imtahan</span>
            </div>
            <div style="text-align:right;">
              <span style="font-size:20px; font-weight:800; color:${color};">${s.avg}%</span>
              <span style="display:block; font-size:11px; font-weight:700; color:${levelColor};">${level}</span>
            </div>
          </div>
          <div style="height:10px; background:#f1f5f9; border-radius:5px; overflow:hidden; margin-bottom:12px;">
            <div style="width:${s.avg}%; height:100%; background:${color}; border-radius:5px; transition:width 0.6s;"></div>
          </div>
          <div style="display:flex; gap:16px; font-size:12px; color:#64748b;">
            <span>✅ Ən yaxşı: <b style="color:#16a34a">${s.best}%</b></span>
            <span>❌ Ən zəif: <b style="color:#ef4444">${s.worst}%</b></span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

// Load test results table stub (Teacher Results View)
async function loadTeacherResults() {
  const tbody = document.getElementById('teacher-results-tbody');
  
  if (!window.currentProfile) return;
  
  const { data: sessions, error } = await supabaseClient
    .from('exam_sessions')
    .select('id, test_id, student_id, score, status, started_at, finished_at, tests!inner(title, subject), profiles(full_name)')
    .eq('tests.teacher_id', window.currentProfile.id)
    .order('started_at', { ascending: false })
    .limit(20);

  if (!tbody) return;

  if (error || !sessions || sessions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:#94a3b8;">Hələ şagird nəticəsi yoxdur.</td></tr>`;
    return;
  }

  tbody.innerHTML = sessions.map(s => {
      const studentName = s.profiles?.full_name || 'Naməlum Şagird';
      const grade = '-'; // Grade doesn't exist on profiles
      const testName = s.tests?.title || '-';
      const subject = s.tests?.subject || '-';
      const score = s.score != null ? s.score + '%' : 'Bitməyib';
      const scoreColor = s.score >= 80 ? '#16a34a' : (s.score >= 50 ? '#f59e0b' : '#ef4444');
      const statusText = s.status === 'completed' ? 'Tamamlandı' : 'Davam edir';
      const statusClass = s.status === 'completed' ? 'done' : 'pending';
      
      return `
      <tr>
        <td>${studentName}</td>
        <td>${testName}</td>
        <td>${grade}</td>
        <td>${sgDate(s.started_at)}</td>
        <td style="font-weight:700; color:${scoreColor}">${score}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td><button class="btn-sm" onclick="window.navigateTo('teacher-student-detail:${s.id}')">Bax</button></td>
      </tr>
      `;
  }).join('');
}

async function loadPublicTestsForTeacher() {
  const publicGrid = document.getElementById('teacher-public-tests-grid');
  if (!publicGrid) return;
  
  const { data: tests, error } = await supabaseClient
    .from('tests')
    .select('*, profiles(full_name)')
    .eq('is_public', true)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error || !tests || tests.length === 0) {
    publicGrid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8; background:white; border-radius:16px;">
        📢 Hazırda ictimai test yoxdur.
      </div>
    `;
    return;
  }

  publicGrid.innerHTML = tests.map(t => {
    const author = (t.profiles && t.profiles.full_name) ? t.profiles.full_name : 'Müəllim';
    const isOwn = window.currentProfile && t.teacher_id === window.currentProfile.id;
    
    return `
    <div class="test-card" style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:start;">
            <span style="font-size:12px; font-weight:600; background:#f1f5f9; color:#475569; padding:4px 10px; border-radius:12px;">${t.subject}</span>
            <span style="font-size:12px; color:#94a3b8;">${sgDate(t.created_at)}</span>
        </div>
        <h3 style="font-size:16px; font-weight:700; color:#0f172a; margin:0;">${t.title}</h3>
        <div style="font-size:12px; color:#64748b; margin-bottom:8px;">
            👤 ${author} ${isOwn ? '<b style="color:#2563eb">(Sizin)</b>' : ''}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:12px; border-top:1px dashed #e2e8f0;">
             <span style="font-size:12px; color:#64748b;">⏱ ${t.duration_minutes || 45} dəq</span>
             <button onclick="navigateTo('teacher-student-list')" class="btn-outline" style="padding:6px 12px; border:1px solid #e2e8f0; border-radius:8px; font-size:12px; font-weight:600; color:#2563eb; cursor:pointer; background:white;">Bax</button>
        </div>
    </div>
    `;
  }).join('');
}
async function loadTeacherStudentList(searchQuery = '') {
    const grid = document.getElementById('teacher-students-grid');
    if (!grid || !window.currentProfile) return;

    // Show loading state
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:#94a3b8;"><span class="spinner" style="display:inline-block; width:24px; height:24px; border:3px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:spin 0.8s linear infinite; vertical-align:middle; margin-right:10px;"></span> Şagirdlər yüklənir...</div>`;

    // Fetch all sessions for tests owned by this teacher
    const { data: sessions, error } = await supabaseClient
        .from('exam_sessions')
        .select('id, test_id, student_id, score, status, started_at, finished_at, tests!inner(id), profiles(full_name)')
        .eq('tests.teacher_id', window.currentProfile.id)
        .order('started_at', { ascending: false });

    if (error || !sessions || sessions.length === 0) {
        updateStudentStats({ total: 0, avg: 0, activeWeek: 0 });
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:#94a3b8;">Hələ heç bir şagird imtahanda iştirak etməyib.</div>`;
        return;
    }

    // 3. Process data into student groups
    const studentMap = {};
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    sessions.forEach(s => {
        const sid = s.student_id;
        if (!studentMap[sid]) {
            studentMap[sid] = {
                id: sid,
                name: s.profiles?.full_name || 'Naməlum Şagird',
                grade: '-', // Removing grade as it's not in DB
                sessions: [],
                lastActive: new Date(s.started_at),
                totalScore: 0,
                maxScore: 0,
                completedCount: 0
            };
        }
        studentMap[sid].sessions.push(s);
        if (s.status === 'completed' && s.score != null) {
            studentMap[sid].totalScore += s.score;
            studentMap[sid].maxScore = Math.max(studentMap[sid].maxScore, s.score);
            studentMap[sid].completedCount++;
        }
        const sDate = new Date(s.started_at);
        if (sDate > studentMap[sid].lastActive) {
            studentMap[sid].lastActive = sDate;
        }
    });

    let students = Object.values(studentMap);

    // Search filter
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        students = students.filter(s => s.name.toLowerCase().includes(q) || s.grade.toLowerCase().includes(q));
    }

    // Sort by last active desc
    students.sort((a, b) => b.lastActive - a.lastActive);

    // 4. Update Overview Stats
    const totalUnique = students.length;
    let totalAvgSum = 0;
    let activeWeekCount = 0;

    students.forEach(s => {
        if (s.completedCount > 0) {
            totalAvgSum += (s.totalScore / s.completedCount);
        }
        if (s.lastActive >= oneWeekAgo) {
            activeWeekCount++;
        }
    });

    const overallAvg = totalUnique > 0 ? Math.round(totalAvgSum / totalUnique) : 0;
    updateStudentStats({ total: totalUnique, avg: overallAvg, activeWeek: activeWeekCount });

    // 5. Render Grid
    if (students.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8;">Axtarışa uyğun şagird tapılmadı.</div>`;
        return;
    }

    grid.innerHTML = students.map(s => {
        const initials = s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const avg = s.completedCount > 0 ? Math.round(s.totalScore / s.completedCount) : 0;
        
        // Activity status text
        const diffMs = now - s.lastActive;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        let activeText = 'Aktiv deyil';
        let activeColor = '#64748b';

        if (diffDays === 0) {
            activeText = 'Bugün aktiv';
            activeColor = '#16a34a';
        } else if (diffDays === 1) {
            activeText = 'Dünən aktiv';
            activeColor = '#64748b';
        } else {
            activeText = `${diffDays} gün əvvəl`;
            activeColor = '#94a3b8';
        }

        // Color based on performance
        const perfColor = avg >= 80 ? '#16a34a' : (avg >= 50 ? '#2563eb' : '#f97316');
        const perfGradient = avg >= 80 ? 'linear-gradient(90deg, #16a34a, #22c55e)' : (avg >= 50 ? 'linear-gradient(90deg, #2563eb, #3b82f6)' : 'linear-gradient(90deg, #f97316, #fb923c)');

        return `
        <div class="student-card-dynamic" style="background:white; border:1px solid #e5e7eb; border-radius:16px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:all 0.25s;">
            <div style="display:flex; align-items:start; gap:16px; margin-bottom:20px;">
              <div style="width:56px; height:56px; background:linear-gradient(135deg, #3b82f6, #2563eb); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:20px; font-weight:700; flex-shrink:0;">
                ${initials}
              </div>
              <div style="flex:1;">
                <h3 style="font-size:18px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">${s.name}</h3>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:13px; color:#64748b; font-weight:500;">${s.grade}</span>
                  <span style="width:4px; height:4px; background:#cbd5e1; border-radius:50%;"></span>
                  <span style="font-size:13px; color:${activeColor}; font-weight:600;">${activeText}</span>
                </div>
              </div>
            </div>

            <div style="margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="font-size:12px; color:#64748b; font-weight:600;">Ortalama Performans</span>
                <span style="font-size:14px; color:${perfColor}; font-weight:700;">${avg}%</span>
              </div>
              <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                <div style="width:${avg}%; height:100%; background:${perfGradient}; border-radius:4px;"></div>
              </div>
            </div>

            <div class="grid-2" style="gap:12px; padding:16px 0; border-top:1px solid #f1f5f9; border-bottom:1px solid #f1f5f9; margin-bottom:16px;">
              <div>
                <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Testlər</div>
                <div style="font-size:18px; font-weight:700; color:#0f172a;">${s.sessions.length}</div>
              </div>
              <div>
                <div style="font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Ən Yaxşı</div>
                <div style="font-size:18px; font-weight:700; color:#16a34a;">${s.maxScore}%</div>
              </div>
            </div>

            <a href="#teacher-student-detail:${s.sessions[0]?.id || ''}" class="btn-outline" style="display:block; width:100%; padding:10px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; text-align:center; font-size:14px; font-weight:600; color:#475569; text-decoration:none;">Analizə Bax</a>
        </div>
        `;
    }).join('');
}

function updateStudentStats(stats) {
    const heading = document.getElementById('teacher-total-students-heading');
    const statTotal = document.getElementById('teacher-stat-total-students');
    const statAvg = document.getElementById('teacher-stat-avg-performance');
    const statActive = document.getElementById('teacher-stat-active-week');

    if (heading) heading.textContent = `${stats.total} İştirakçı`;
    if (statTotal) statTotal.textContent = stats.total;
    if (statAvg) statAvg.textContent = `${stats.avg}%`;
    if (statActive) statActive.textContent = stats.activeWeek;
}

// Global search listener for student list
document.addEventListener('input', e => {
    if (e.target && e.target.placeholder === "Şagird axtar...") {
        loadTeacherStudentList(e.target.value);
    }
});

// ========================
// TEACHER TEST BUILDER
// ========================

let builderQuestions = [];
let builderSelectedSubject = '';

// Generate random 8-digit access code
function generateAccessCode() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// FIX C6: Guard flag prevents listener accumulation on repeated view visits
let _builderSubjectSelectInitialized = false;

// Initialize subject searchable select for builder
function initBuilderSubjectSelect() {
    const input = document.getElementById('builder-fen-input');
    const dropdown = document.getElementById('builder-fen-dropdown');
    const hidden = document.getElementById('builder-fen');
    if (!input || !dropdown) return;
    if (_builderSubjectSelectInitialized) return; // already set up
    _builderSubjectSelectInitialized = true;

    const subjects = APP_DATA.subjects || [];

    function renderDropdown(filter = '') {
        const filtered = subjects.filter(s =>
            s.name.toLowerCase().includes(filter.toLowerCase())
        );
        dropdown.innerHTML = filtered.map(s => `
            <div class="search-option" data-value="${s.value}" data-label="${s.name}">
                <span>${s.icon || ''}</span> ${s.name}
            </div>
        `).join('');
        dropdown.classList.add('visible');
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.search-option').forEach(opt => {
            opt.addEventListener('click', () => {
                input.value = opt.getAttribute('data-label');
                if (hidden) hidden.value = opt.getAttribute('data-value');
                builderSelectedSubject = opt.getAttribute('data-value');
                dropdown.classList.remove('visible');
                dropdown.style.display = 'none';
            });
        });
    }

    input.addEventListener('focus', () => renderDropdown(input.value));
    input.addEventListener('input', () => renderDropdown(input.value));
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#builder-fen-container')) {
            dropdown.classList.remove('visible');
            dropdown.style.display = 'none';
        }
    });
}

// Render a question card in the builder
function renderBuilderQuestion(index) {
    const q = builderQuestions[index];
    return `
    <div class="builder-question-item" data-index="${index}">
        <div class="builder-q-header">
            <span class="builder-q-num">Sual ${index + 1}</span>
            <div class="builder-actions">
                <button type="button" class="action-btn-mini delete" onclick="deleteBuilderQuestion(${index})" title="Sil">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
            </div>
        </div>
        <input type="text" class="builder-input" placeholder="Sualı daxil edin..." value="${q.text}" onchange="builderQuestions[${index}].text=this.value" style="margin-bottom:20px;">
        ${q.options.map((opt, oi) => `
            <div class="builder-option-row ${q.correctIndex === oi ? 'is-correct' : ''}">
                <div class="correct-checkbox-wrapper">
                    <input type="radio" name="correct-${index}" class="correct-checkbox" ${q.correctIndex === oi ? 'checked' : ''} onchange="builderQuestions[${index}].correctIndex=${oi}; refreshBuilderUI();">
                </div>
                <input type="text" class="builder-input" placeholder="Variant ${String.fromCharCode(65 + oi)}" value="${opt}" onchange="builderQuestions[${index}].options[${oi}]=this.value" style="flex:1;">
            </div>
        `).join('')}
    </div>
    `;
}

function refreshBuilderUI() {
    const list = document.getElementById('builder-questions-list');
    if (list) {
        list.innerHTML = builderQuestions.map((_, i) => renderBuilderQuestion(i)).join('');
    }
}

window.deleteBuilderQuestion = function(index) {
    builderQuestions.splice(index, 1);
    refreshBuilderUI();
};

// Initialize builder event listeners
document.addEventListener('DOMContentLoaded', () => {
    initBuilderSubjectSelect();

    // Stage 1 → Stage 2: Settings → Builder
    const startBtn = document.getElementById('btn-start-builder');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const subject = builderSelectedSubject || document.getElementById('builder-fen')?.value;
            const grade = document.getElementById('builder-sinif')?.value;
            const time = document.getElementById('builder-vaxt')?.value;

            if (!subject) return showToast('Zəhmət olmasa fənn seçin.', 'error');
            if (!grade) return showToast('Zəhmət olmasa sinif seçin.', 'error');

            // Update builder meta
            const subjectLabel = (APP_DATA.fennLabels && APP_DATA.fennLabels[subject]) || subject;
            const metaTitle = document.getElementById('builder-meta-title');
            const metaDesc = document.getElementById('builder-meta-desc');
            if (metaTitle) metaTitle.textContent = 'Sualların Hazırlanması';
            if (metaDesc) metaDesc.textContent = `${subjectLabel} \u2022 ${grade}-cı sinif \u2022 ${time || 45} dəq`;

            // Initialize with one empty question if none exist
            if (builderQuestions.length === 0) {
                builderQuestions.push({ text: '', options: ['', '', '', '', ''], correctIndex: 0 });
            }
            refreshBuilderUI();

            // Switch stages
            document.getElementById('teacher-test-settings-stage').style.display = 'none';
            document.getElementById('teacher-test-builder-stage').style.display = 'block';
        });
    }

    // Back to Settings
    const backBtn = document.getElementById('btn-builder-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('teacher-test-builder-stage').style.display = 'none';
            document.getElementById('teacher-test-settings-stage').style.display = 'block';
        });
    }

    // Add Question
    const addBtn = document.getElementById('btn-add-question');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            builderQuestions.push({ text: '', options: ['', '', '', '', ''], correctIndex: 0 });
            refreshBuilderUI();
            // Scroll to new question
            const list = document.getElementById('builder-questions-list');
            if (list) list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    // Publish Test
    const publishBtn = document.getElementById('btn-builder-publish');
    if (publishBtn) {
        publishBtn.addEventListener('click', async () => {
            // Validate
            const validQuestions = builderQuestions.filter(q =>
                q.text.trim() && q.options.every(o => o.trim())
            );

            if (validQuestions.length === 0) {
                return showToast('ən azı 1 tam sual daxil edin.', 'error');
            }

            if (!window.currentProfile) return showToast('Giriş edin.', 'error');

            publishBtn.disabled = true;
            publishBtn.textContent = 'Dərc edilir...';

            const subject = builderSelectedSubject || document.getElementById('builder-fen')?.value || 'Qarışıq';
            const grade = document.getElementById('builder-sinif')?.value || '';
            const time = parseInt(document.getElementById('builder-vaxt')?.value) || 45;
            const visRadio = document.querySelector('input[name="builder-visibility"]:checked');
            const isPublic = visRadio ? visRadio.value === 'public' : true;

            const subjectLabel = (APP_DATA.fennLabels && APP_DATA.fennLabels[subject]) || subject;
            const title = `${subjectLabel} - Sınaq`;
            // Use teacher-defined code if provided; otherwise auto-generate 8-digit
            let accessCode = ''
            const inputCode = (document.getElementById('builder-access-code')?.value || '').trim();
            if (!isPublic) {
                if (inputCode.length === 8) {
                    accessCode = inputCode;
                } else if (inputCode.length > 0) {
                    publishBtn.disabled = false;
                    publishBtn.textContent = 'D\u0259rc Et';
                    return showToast('Giri\u015f kodu d\u0259qiq 8 simvol olmal\u0131d\u0131r.', 'error');
                } else {
                    accessCode = generateAccessCode();
                }
            }

            try {
                // Insert test
                const { data: test, error: testErr } = await supabaseClient
                    .from('tests')
                    .insert({
                        teacher_id: window.currentProfile.id,
                        title: title,
                        subject: subjectLabel,
                        grade: grade,
                        duration_minutes: time,
                        access_code: isPublic ? null : accessCode,
                        is_active: true,
                        is_public: isPublic,
                        metadata: { source: 'manual_builder' }
                    })
                    .select()
                    .single();

                if (testErr || !test) {
                    throw new Error(testErr?.message || 'Test yaratıla bilmədi');
                }

                // Insert questions
                const qRows = validQuestions.map((q, i) => ({
                    test_id: test.id,
                    question_text: q.text,
                    options: q.options,
                    correct_index: q.correctIndex,
                    order_index: i + 1
                }));

                const { error: qErr } = await supabaseClient
                    .from('questions')
                    .insert(qRows);

                if (qErr) {
                    throw new Error(qErr?.message || 'Suallar əlavə edilə bilmədi');
                }

                // Show success stage
                document.getElementById('teacher-test-builder-stage').style.display = 'none';
                const publishStage = document.getElementById('teacher-test-publish-stage');
                publishStage.style.display = 'block';

                const codeEl = document.getElementById('published-test-code');
                const publicBlock = document.getElementById('publish-public-block');
                const codeBlock = document.getElementById('publish-code-block');
                const descEl = document.getElementById('publish-success-desc');

                if (isPublic) {
                    if (publicBlock) publicBlock.style.display = 'block';
                    if (codeBlock) codeBlock.style.display = 'none';
                    if (descEl) descEl.textContent = 'Test b\u00fct\u00fcn \u015fagirdl\u0259r\u0259 a\u00e7\u0131q olaraq paylan\u015fd\u0131.';
                } else {
                    if (publicBlock) publicBlock.style.display = 'none';
                    if (codeBlock) codeBlock.style.display = 'inline-block';
                    if (codeEl) codeEl.textContent = '#' + accessCode;
                    if (descEl) descEl.textContent = '\u015eagirdl\u0259rl\u0259 payla\u015fmaq \u00fc\u00e7\u00fcn a\u015fa\u011f\u0131dak\u0131 kodu kopyalay\u0131n.';
                }

                // Reset builder state for next use
                builderQuestions = [];
                builderSelectedSubject = '';

                showToast('Test u\u011furla yarad\u0131ld\u0131!', 'success');

            } catch (err) {
                console.error('Test publish error:', err);
                showToast('X\u0259ta: ' + err.message, 'error');
            } finally {
                publishBtn.disabled = false;
                publishBtn.textContent = 'D\u0259rc Et';
            }
        });
    }
});

// --- Teacher Test Card Actions ---
window.deleteTeacherTest = async function(testId) {
    // FIX C1: Use toast-based confirmation instead of blocking confirm()
    if (!window.__deleteConfirmPending) {
        window.__deleteConfirmId = testId;
        showToast('Silmək üçün düyməyə yenidən basın.', 'warning');
        window.__deleteConfirmPending = true;
        setTimeout(() => { window.__deleteConfirmPending = false; window.__deleteConfirmId = null; }, 3000);
        return;
    }
    if (window.__deleteConfirmId !== testId) {
        window.__deleteConfirmPending = false;
        window.__deleteConfirmId = null;
        return;
    }
    window.__deleteConfirmPending = false;
    window.__deleteConfirmId = null;

    const { error } = await supabaseClient
        .from('tests')
        .delete()
        .eq('id', testId);

    // FIX C1: Inverted condition corrected — reload on SUCCESS, show error on failure
    if (!error) {
        showToast('Test uğurla silindi.', 'success');
        if (typeof loadTeacherDashboard === 'function') loadTeacherDashboard();
        if (typeof loadTeacherTests === 'function') loadTeacherTests();
    } else {
        showToast('Test silinərkən xəta: ' + (error.message || 'Bilinməyən xəta'), 'error');
    }
};

// --- Teacher Student Detail Analysis ---
window.loadTeacherStudentDetail = async function(sessionId) {
    if (!sessionId || !window.currentProfile) return;
    
    const container = document.getElementById('teacher-analysis-view');
    if (!container) return;

    // Loading State
    container.innerHTML = `<div style="text-align:center; padding:100px; color:#64748b;"><span class="spinner" style="display:inline-block; width:30px; height:30px; border:3px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:20px;"></span><div>Analiz çəkilir...</div></div>`;

    try {
        // 1. Fetch Session & Test Data
        const { data: session, error: sessErr } = await supabaseClient
            .from('exam_sessions')
            .select('*, tests(*)')
            .eq('id', sessionId)
            .single();

        if (sessErr || !session) throw new Error("Sessiya tapılmadı və ya xəta baş verdi.");

        // Fetch student profile directly so we don't depend on grade issues 
        const { data: studentProfile } = await supabaseClient
            .from('profiles')
            .select('full_name, user_metadata')
            .eq('id', session.student_id)
            .single();
            
        const studentName = studentProfile?.full_name || 'Naməlum Şagird';
        const studentGrade = studentProfile?.user_metadata?.grade ? studentProfile.user_metadata.grade + '-cı Sinif' : '';

        // 2. Fetch Answers & Questions
        const { data: answers, error: ansErr } = await supabaseClient
            .from('student_answers')
            .select('*, questions(*)')
            .eq('session_id', sessionId);

        if (ansErr) throw new Error("Cavablar tapılmadı.");

        // 3. Calculate Stats
        const testTitle = session.tests?.title || 'İmtahan';
        const testSubject = session.tests?.subject || '';
        const score = session.score || 0;
        
        let correctCount = 0;
        let totalSeconds = 0;
        let minTime = Infinity, maxTime = -Infinity, fastAns = 0, slowAns = 0, minIdx = 0, maxIdx = 0;
        const totalQ = answers ? answers.length : 0;
        
        if (answers && answers.length > 0) {
            answers.forEach((ans, idx) => {
                if (ans.is_correct) correctCount++;
                const t = ans.time_spent_seconds || 0;
                totalSeconds += t;
                if (t < 20) fastAns++;
                else if (t > 60) slowAns++;
                if (t > 0 && t < minTime) { minTime = t; minIdx = idx + 1; }
                if (t > maxTime) { maxTime = t; maxIdx = idx + 1; }
            });
        }
        
        if (minTime === Infinity) minTime = 0;
        if (maxTime === -Infinity) maxTime = 0;
        if (totalSeconds === 0 && session.started_at && session.finished_at) {
            totalSeconds = Math.round((new Date(session.finished_at) - new Date(session.started_at)) / 1000);
        }

        const formatDuration = (s) => s < 60 ? `${s} san` : `${Math.floor(s/60)} dəq ${s%60} san`;
        const avgSecs = totalQ ? Math.round(totalSeconds / totalQ) : 0;
        const fastPct = totalQ ? Math.round((fastAns / totalQ) * 100) : 0;
        const slowPct = totalQ ? Math.round((slowAns / totalQ) * 100) : 0;
        const normalPct = 100 - fastPct - slowPct;

        // 4. Render Layout
        container.innerHTML = `
        <div class="analysis-summary-card" style="background:white; border-radius:20px; padding:32px; margin-bottom:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); border:1px solid #f1f5f9;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:24px;">
                <div>
                    <h2 style="font-size:24px; font-weight:800; color:#0f172a; margin:0 0 8px 0; letter-spacing:-0.02em;">${studentName} - ${testTitle}</h2>
                    <p style="color:#64748b; font-size:15px; margin:0; display:flex; gap:12px;">
                        <span>${sgDate(session.started_at)}</span>
                        ${testSubject ? `<span>• ${testSubject}</span>` : ''}
                        ${studentGrade ? `<span>• ${studentGrade}</span>` : ''}
                    </p>
                </div>
                
                <div style="display:flex; gap:16px;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px 24px; border-radius:16px; min-width:120px; text-align:center;">
                        <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Nəticə</div>
                        <div style="font-size:32px; font-weight:800; color:${score >= 50 ? '#2563eb' : '#ef4444'}; line-height:1;">${score}%</div>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px 24px; border-radius:16px; min-width:120px; text-align:center;">
                        <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Vaxt</div>
                        <div style="font-size:24px; font-weight:700; color:#0f172a; line-height:1.2;">${formatDuration(totalSeconds)}</div>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px 24px; border-radius:16px; min-width:120px; text-align:center;">
                        <div style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Düzgün</div>
                        <div style="font-size:24px; font-weight:700; color:#10b981; line-height:1.2;">${correctCount} / ${totalQ}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid-2" style="gap:24px; margin-bottom:32px;">
            <!-- Time Management -->
            <div style="background:white; padding:24px; border-radius:20px; border:1px solid #f1f5f9; box-shadow:0 4px 6px -1px rgba(0,0,0,0.02);">
                <div style="font-size:16px; font-weight:700; color:#0f172a; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Vaxt İdarəetməsi
                </div>
                <div style="font-size:14px; color:#64748b; line-height:1.6; margin-bottom:20px;">
                    <div style="margin-bottom:8px; display:flex; justify-content:space-between;"><span>• Orta sual vaxtı:</span> <b style="color:#1e293b">${avgSecs} san</b></div>
                    <div style="margin-bottom:8px; display:flex; justify-content:space-between;"><span>• Ən sürətli cavab:</span> <b style="color:#1e293b">${minTime} san ${minIdx ? '(Sual '+minIdx+')' : ''}</b></div>
                    <div style="display:flex; justify-content:space-between;"><span>• Ən yavaş cavab:</span> <b style="color:#1e293b">${maxTime} san ${maxIdx ? '(Sual '+maxIdx+')' : ''}</b></div>
                </div>
                <div style="display:flex; height:12px; border-radius:6px; overflow:hidden; margin-bottom:12px;">
                    <div style="width:${fastPct}%; background:#10b981;"></div>
                    <div style="width:${normalPct}%; background:#3b82f6;"></div>
                    <div style="width:${slowPct}%; background:#f59e0b;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.02em;">
                    <div style="color:#10b981;">Sürətli</div>
                    <div style="color:#3b82f6;">Normal</div>
                    <div style="color:#f59e0b;">Yavaş</div>
                </div>
            </div>
            
            <!-- Quick Insights Box -->
            <div style="background:#f8fafc; padding:24px; border-radius:20px; border:1px solid #e2e8f0;">
                <h3 style="font-size:15px; font-weight:700; color:#0f172a; margin-bottom:12px;">Sürətli Təhlil</h3>
                <p style="font-size:14px; color:#475569; line-height:1.6; margin-bottom:16px;">
                    Şagird bu sınaqda ümumi ${score}% nəticə toplayıb və sualların ${correctCount} ədədini doğru cavablandırıb. 
                    ${slowAns > totalQ/3 ? 'Bəzi sualların cavablandırılmasında yavaşlama müşahidə olunur.' : ''}
                    ${fastAns > totalQ/2 && score < 50 ? 'Cavablar çox sürətli və düşünülmədən verilib.' : ''}
                </p>
                <div style="font-size:13px; font-weight:500; color:#2563eb; background:#eff6ff; padding:12px; border-radius:8px; border-left:3px solid #3b82f6;">
                    Bu təhlil xüsusi olaraq müəllim izlənməsi üçün hazırlanmışdır.
                </div>
            </div>
        </div>

        <h3 style="margin-bottom:20px; color:#0f172a; font-size:20px; font-weight:800;">Sual Analizi</h3>
        <div id="teacher-review-questions-list">
            ${answers && answers.length > 0 ? answers.map((ans, i) => {
                const q = ans.questions || {};
                let opts = [];
                try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options || []; } catch(e){}
                
                const isCorr = ans.is_correct;
                const timeStr = ans.time_spent_seconds ? `${ans.time_spent_seconds} san` : '-';
                const ansIdx = ans.selected_index;
                const corrIdx = q.correct_index;

                return `
                <div class="review-card ${isCorr ? 'correct' : 'wrong'}" style="background:white; border:1px solid ${isCorr ? '#bbf7d0' : '#fecaca'}; border-left:4px solid ${isCorr ? '#22c55e' : '#ef4444'}; border-radius:12px; padding:20px; margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:16px;">
                        <span style="font-size:14px; font-weight:700; color:#0f172a;">Sual ${i+1}</span>
                        <div style="display:flex; gap:8px;">
                            <span style="font-size:11px; font-weight:600; background:#f1f5f9; color:#475569; padding:4px 8px; border-radius:6px;">🕒 ${timeStr}</span>
                            <span style="font-size:11px; font-weight:700; background:${isCorr ? '#dcfce7' : '#fee2e2'}; color:${isCorr ? '#166534' : '#991b1b'}; padding:4px 8px; border-radius:6px;">${isCorr ? 'DÜZGÜN' : 'SƏHV'}</span>
                        </div>
                    </div>
                    <div style="font-size:15px; color:#334155; margin-bottom:16px; line-height:1.5;">${q.question_text || 'Sual mətni tapılmadı'}</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${opts.map((opt, oIdx) => {
                            let bg = '#f8fafc', border = '#e2e8f0', color = '#475569', fw = '400';
                            if (ansIdx === oIdx && !isCorr) { bg = '#fef2f2'; border = '#f87171'; color = '#991b1b'; fw = '600'; }
                            if (corrIdx === oIdx) { bg = '#ecfdf5'; border = '#34d399'; color = '#065f46'; fw = '700'; }
                            return `<div style="padding:10px 16px; border-radius:8px; border:1px solid ${border}; background:${bg}; color:${color}; font-size:14px; font-weight:${fw};">
                                ${String.fromCharCode(65+oIdx)}) ${opt}
                                ${ansIdx === oIdx ? ' <span style="font-size:12px; margin-left:8px;">(Seçilib)</span>' : ''}
                                ${corrIdx === oIdx && !isCorr ? ' <span style="font-size:12px; margin-left:8px;">(Doğru)</span>' : ''}
                            </div>`;
                        }).join('')}
                    </div>
                </div>
                `;
            }).join('') : '<div style="padding:20px; color:#64748b;">Cavablar tapılmadı.</div>'}
        </div>
        `;

    } catch (e) {
        console.error("Detail load error:", e);
        container.innerHTML = `<div style="text-align:center; padding:100px; color:#ef4444;"><div style="font-size:40px; margin-bottom:16px;">⚠️</div>Məlumat yüklənərkən xəta baş verdi: ${e.message}</div>`;
    }
};
