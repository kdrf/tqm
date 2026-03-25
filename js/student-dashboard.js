// js/student-dashboard.js

// Format date helper
function sgDate(dt) {
    if (!dt) return 'Tarix yoxdur';
    return new Date(dt).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Format duration helper
function formatTime(secs) {
    if (!secs) return '00:00';
    let m = Math.floor(secs / 60);
    let s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Parse metadata helper
function parseMeta(meta) {
    if (typeof meta === 'string') {
        try { return JSON.parse(meta); } catch(e) { return {}; }
    }
    return meta || {};
}


async function loadStudentDashboard() {
  if (!window.currentProfile) return;
  const profile = window.currentProfile;

  // Set Profile Header Data
  const nameEl = document.getElementById('student-welcome-name');
  if (nameEl) nameEl.textContent = profile.full_name?.split(' ')[0] || 'Tələbə';

  const descEl = document.getElementById('student-school-desc');
  if (descEl) {
    const schoolName = profile.school || 'Məktəb qeyd edilməyib';
    descEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      ${schoolName}
    `;
    descEl.style.display = 'flex';
    descEl.style.alignItems = 'center';
    descEl.style.gap = '6px';
  }

  const badgesEl = document.getElementById('student-badges');
  if (badgesEl) {
    // FIX D2: Real badge values from profile
    let gradeStr = profile.grade ? profile.grade + '-cu sinif' : 'Sinif yoxdur';
    let groupStr = profile.exam_group || profile.group || 'Qrup yoxdur';
    let levelStr = profile.preparation === 'advanced' ? 'Yüksək' : (profile.preparation === 'beginner' ? 'Başlanğıc' : 'Orta');
    
    badgesEl.innerHTML = `
      <span style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; font-size:12px; font-weight:700; padding:6px 12px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;">📌 ${groupStr}</span>
      <span style="background:#f8fafc; color:#475569; border:1px solid #e2e8f0; font-size:12px; font-weight:700; padding:6px 12px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;">📖 ${gradeStr}</span>
      <span style="background:#fefce8; color:#ca8a04; border:1px solid #fef08a; font-size:12px; font-weight:700; padding:6px 12px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;">⚡ ${levelStr}</span>
    `;
  }

  // Load overall stats
  const { data: sessions, error } = await supabaseClient
    .from('exam_sessions')
    .select('*, tests(title, subject)')
    .eq('student_id', profile.id)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    return;
  }

  const completed = sessions ? sessions.filter(s => s.status === 'completed' && s.score != null) : [];
  
  const elCount = document.getElementById('student-stat-count');
  const elAvg = document.getElementById('student-stat-avg');
  if (elCount) elCount.textContent = completed.length;
  if (elAvg) {
    if (completed.length === 0) {
      elAvg.textContent = '—'; // FIX D3
    } else {
      let sum = completed.reduce((a, b) => a + b.score, 0);
      elAvg.textContent = Math.round(sum / completed.length) + '%';
    }
  }

  // Load Recent Exams History
  const recentGrid = document.getElementById('student-recent-exams-grid');
  if (recentGrid) {
    if (!completed || completed.length === 0) {
        recentGrid.innerHTML = `
          <div class="exam-card" style="align-items:center;justify-content:center;display:flex;color:#94a3b8;font-size:14px;padding:30px;">
            Hələ heç bir imtahan verməmisiniz. İctimai testlərə qoşulub yoxlayın!
          </div>
        `;
    } else {
        recentGrid.innerHTML = completed.slice(0, 5).map(s => {
            const subject = (s.tests && s.tests.subject) ? s.tests.subject : 'QarıÅŸıq';
            const title = (s.tests && s.tests.title) ? s.tests.title : 'İmtahan';
            const scoreColor = s.score >= 80 ? '#2563eb' : (s.score >= 50 ? '#f97316' : '#ef4444');
            const bgTrackColor = '#f1f5f9';
            
            return `
            <div class="exam-card" 
                 onclick="window.navigateTo('student-results:detail:${s.id}')"
                 style="box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; margin-bottom: 0; cursor: pointer;">
                <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${subject}</div>
                <h3 style="font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 24px;">${title}</h3>
                
                <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 12px;">
                    <span style="font-size: 36px; font-weight: 800; color: ${scoreColor}; line-height: 1;">${s.score}</span>
                    <span style="font-size: 16px; font-weight: 600; color: #94a3b8;">/ 100</span>
                </div>
                
                <div style="width: 100%; height: 8px; background: ${bgTrackColor}; border-radius: 4px; overflow: hidden; margin-bottom: 24px;">
                    <div style="height: 100%; width: ${s.score}%; background: ${scoreColor}; border-radius: 4px; transition: width 1s;"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; padding-top: 16px;">
                    <span style="font-size: 13px; color: #64748b; font-weight: 500;">${sgDate(s.started_at)}</span>
                    <a onclick="window.navigateTo('student-results:detail:${s.id}')" style="font-size: 13px; font-weight: 700; color: ${scoreColor}; text-decoration: none; cursor:pointer;">Analiz et →</a>
                </div>
            </div>
            `;
        }).join('');
    }
  }

  await loadPublicTests();
  await loadStudentResults();
}

async function loadPublicTests() {
  const publicGrid = document.getElementById('public-tests-grid');
  if (!publicGrid) return;
  
  publicGrid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:30px;color:#94a3b8;font-size:14px;">
      <span style="display:inline-block;width:18px;height:18px;border:2px solid #e2e8f0;border-top-color:#a855f7;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:8px;"></span>
      Testlər yüklənir...
    </div>
  `;

  const { data: tests, error } = await supabaseClient
    .from('tests')
    .select('*, profiles(full_name)')
    .eq('is_public', true)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) {
    console.error('Error fetching public tests:', error);
    publicGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#ef4444;">Xəta baş verdi.</div>`;
    return;
  }

  if (!tests || tests.length === 0) {
    publicGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:30px;color:#94a3b8;font-size:14px;">
        Hazırda ictimai testlər tapılmadı. Müəllimlər tərəfindən əlavə edilməsini gözləyin.
      </div>
    `;
    return;
  }

  publicGrid.innerHTML = tests.map(t => {
    const meta = parseMeta(t.metadata);
    const author = (t.profiles && t.profiles.full_name) ? t.profiles.full_name : 'Müəllim';
    const tag = (t.subject && t.subject !== 'null') ? t.subject : 'Qarışıq';
    return `
      <div class="exam-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <span class="subject-tag">${tag}</span>
          <span style="font-size:12px; color:#64748b; font-weight:500;">${t.duration_minutes || 45} dəq</span>
        </div>
        <h3 style="font-size:16px; font-weight:700; color:#0f172a; margin-bottom:6px;">${t.title}</h3>
        <p style="font-size:13px; color:#64748b; margin-bottom:16px; line-height:1.4;">${(meta.description && String(meta.description).toLowerCase() !== 'null') ? meta.description : 'Müəllim tərəfindən sınaq'}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:12px; border-top:1px dashed #e2e8f0;">
          <div style="font-size:12px; color:#94a3b8;">👤 ${author}</div>
          <button onclick="startPublicTest('${t.id}')" style="background:#f3e8ff; color:#7c3aed; padding:6px 12px; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;" onmouseover="this.style.background='#e9d5ff'" onmouseout="this.style.background='#f3e8ff'">Başla</button>
        </div>
      </div>
    `;
  }).join('');
}

// Public test start handler attached to public tests
window.startPublicTest = async function(testId) {
    if(typeof showToast === 'function') showToast('İmtahan tapılır...', 'info');

    // Fetch test details
    const { data: test, error } = await supabaseClient
        .from('tests')
        .select('*')
        .eq('id', testId)
        .single();

    if (error || !test) return showToast('İmtahan tapılmadı', 'error');
    if (!test.is_active) return showToast('Bu imtahan hazırda aktiv deyil', 'warning');

    // Create session
    const { data: session, error: sessErr } = await supabaseClient
        .from('exam_sessions')
        .insert({
            test_id: test.id,
            student_id: window.currentProfile.id,
            status: 'in_progress',
            score: null
        }).select().single();

    if (sessErr) return showToast('İmtahan sessiyası yaradıla bilmədi', 'error');

    // Initialize global state for exam.js
    window.currentActiveTest = test;
    window.currentActiveSession = session;
    
    showToast('İmtahan otaÄŸına keçilir...', 'success');
    
    // Defer redirect slightly to allow toast to render
    setTimeout(() => {
        window.location.hash = 'student-exam-room';
    }, 500);
};

// Join test handler
document.addEventListener('DOMContentLoaded', () => {
    const joinBtn = document.getElementById('btn-quick-join');
    if(joinBtn) {
        joinBtn.addEventListener('click', () => {
            const codeInput = document.getElementById('quick-exam-code');
            const code = codeInput ? codeInput.value.trim() : '';
            if(!code) return showToast('Zəhmət olmasa imtahan kodunu yazın', 'error');
            
            showToast('Kod üzrə giriÅŸ axtarılır...', 'info');
            
            supabaseClient.from('tests').select('*').eq('access_code', code).single()
            .then(({data, error}) => {
                if(error || !data) {
                    showToast('İmtahan tapılmadı və ya kod səhvdir.', 'error');
                } else if (!data.is_active) {
                    showToast('İmtahan aktiv deyil.', 'error');
                } else {
                    showToast(`"${data.title}" imtahanına keçid edilir...`, 'success');
                    // We reuse the startPublicTest handler but directly with the full test data
                    // Actually, let's just create a shared handler or call startPublicTest(data.id)
                    if (typeof startPublicTest === 'function') {
                        startPublicTest(data.id);
                    }
                }
            });
        });
    }
});


// Load Student Results full list
async function loadStudentResults() {
  const container = document.getElementById('student-results-list');
  if (!container || !window.currentProfile) return;

  const { data: sessions, error } = await supabaseClient
    .from('exam_sessions')
    .select('*, tests(title, subject)')
    .eq('student_id', window.currentProfile.id)
    .eq('status', 'completed')
    .order('started_at', { ascending: false });

  if (error || !sessions || sessions.length === 0) {
    container.innerHTML = `
      <div class="results-empty" style="text-align:center;padding:50px 20px;color:#94a3b8; background:white; border-radius:16px;">
        <div style="font-size:40px; margin-bottom:12px;">ğŸ“‰</div>
        <div>Hələ heç bir nəticəyə sahib deyilsiniz. Testləri həll etdikcə burada görünəcək.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = sessions.map(s => `
    <div class="result-card" onclick="window.navigateTo('student-results:detail:${s.id}')" style="background:white; padding:20px; border-radius:16px; margin-bottom:16px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">
      <div>
        <div style="font-size:12px; color:#64748b; margin-bottom:4px; font-weight:600;">${(s.tests && s.tests.subject) ? s.tests.subject : 'Mövzu'} • ${sgDate(s.started_at)}</div>
        <h3 style="font-size:16px; font-weight:700; color:#0f172a; margin-bottom:8px;">${(s.tests && s.tests.title) ? s.tests.title : 'Qarışıq Test'}</h3>
      </div>
      <div style="text-align:right;">
        <div style="font-size:24px; font-weight:800; color:${s.score >= 80 ? '#16a34a' : (s.score >= 50 ? '#f59e0b' : '#ef4444')};">${s.score}%</div>
        <div style="font-size:12px; color:#94a3b8;">Xal</div>
      </div>
    </div>
  `).join('');
}


async function loadGeneralAnalysis() {
    if (!window.currentProfile) return;
    const profile = window.currentProfile;

    // Fetch all completed sessions with test details
    const { data: sessions, error } = await supabaseClient
        .from('exam_sessions')
        .select('*, tests(title, subject)')
        .eq('student_id', profile.id)
        .eq('status', 'completed')
        .not('score', 'is', null)
        .order('started_at', { ascending: false });

    if (error) {
        console.error('Error fetching sessions for analysis:', error);
        return;
    }

    const total = sessions.length;
    let avg = 0;
    let bestSubject = '—';
    let worstSubject = '—';

    if (total > 0) {
        const sum = sessions.reduce((a, b) => a + b.score, 0);
        avg = Math.round(sum / total);

        // Calculate subject performance
        const subjectStats = {};
        sessions.forEach(s => {
            const sub = (s.tests && s.tests.subject) ? s.tests.subject : 'QarıÅŸıq';
            if (!subjectStats[sub]) subjectStats[sub] = { sum: 0, count: 0 };
            subjectStats[sub].sum += s.score;
            subjectStats[sub].count += 1;
        });

        const subjectAverages = Object.keys(subjectStats).map(sub => ({
            name: sub,
            avg: Math.round(subjectStats[sub].sum / subjectStats[sub].count)
        }));

        subjectAverages.sort((a, b) => b.avg - a.avg);
        bestSubject = subjectAverages[0].name;
        worstSubject = subjectAverages[subjectAverages.length - 1].name;

        // Populate Top Stats
        const elTotal = document.getElementById('an-total');
        const elAvg = document.getElementById('an-avg');
        const elBest = document.getElementById('an-best');
        const elWorst = document.getElementById('an-worst');

        if(elTotal) elTotal.textContent = total;
        if(elAvg) elAvg.textContent = avg + '%';
        if(elBest) elBest.textContent = bestSubject;
        if(elWorst) elWorst.textContent = worstSubject;

        // Update sub-labels for context
        const elTotalSub = document.getElementById('an-total-sub');
        const elAvgSub = document.getElementById('an-avg-sub');
        const elBestSub = document.getElementById('an-best-sub');
        const elWorstSub = document.getElementById('an-worst-sub');

        if(elTotalSub) elTotalSub.textContent = 'Ãœmumi imtahan';
        if(elAvgSub) elAvgSub.textContent = 'Orta müvəffəqiyyət';
        if(elBestSub) elBestSub.textContent = `Mənimsəmə: ${subjectAverages[0].avg}%`;
        if(elWorstSub) elWorstSub.textContent = `Mənimsəmə: ${subjectAverages[subjectAverages.length - 1].avg}%`;

        // Render Dynamics Chart (Last 5)
        const last5 = [...sessions].slice(0, 5).reverse();
        const chartContainer = document.getElementById('student-bar-chart');
        if (chartContainer) {
            chartContainer.innerHTML = last5.map((s, i) => {
                const date = new Date(s.started_at).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short' });
                return `
                    <div class="bar-group">
                        <div class="bar" style="height: ${s.score}%;" title="${s.score}%">
                            <span style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: #64748b;">${s.score}%</span>
                        </div>
                        <span class="bar-label">${date}</span>
                    </div>
                `;
            }).join('');
        }

        // Render Topic List
        const topicList = document.getElementById('student-topic-list');
        if (topicList) {
            topicList.innerHTML = subjectAverages.map(sub => `
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
                        <span style="font-weight: 600; color: #1e293b;">${sub.name}</span>
                        <span style="font-weight: 700; color: #2563eb;">${sub.avg}%</span>
                    </div>
                    <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${sub.avg}%; background: ${sub.avg >= 80 ? '#10b981' : (sub.avg >= 50 ? '#3b82f6' : '#f59e0b')}; border-radius: 4px;"></div>
                    </div>
                </div>
            `).join('');
        }
    } else {
        // No data state
        const elTotal = document.getElementById('an-total');
        if(elTotal) elTotal.textContent = '0';
        
        const chartContainer = document.getElementById('student-bar-chart');
        if (chartContainer) chartContainer.innerHTML = `<div style="display:flex;align-items:flex-end;justify-content:center;height:100%;color:#94a3b8;font-size:13px;padding-bottom:8px;">Hələ imtahan yoxdur</div>`;
        
        const topicList = document.getElementById('student-topic-list');
        if (topicList) topicList.innerHTML = `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Analiz üçün kifayət qədər məlumat yoxdur.</div>`;
    }
}


// --- Library Logic ---
let librarySearchQuery = '';
let libraryCategory = 'Hamısı';

async function loadLibraryTests() {
  const libGrid = document.getElementById('library-public-tests-grid');
  if (!libGrid) return;
  
  libGrid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#94a3b8;">
      <span class="spinner" style="display:inline-block;width:24px;height:24px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:10px;"></span>
      Testlər yüklənir...
    </div>
  `;

  let query = supabaseClient
    .from('tests')
    .select('*, profiles(full_name)')
    .eq('is_public', true)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (libraryCategory !== 'Hamısı') {
    query = query.eq('subject', libraryCategory);
  }

  if (librarySearchQuery) {
    query = query.ilike('title', `%${librarySearchQuery}%`);
  }

  const { data: tests, error } = await query;

  if (error) {
    console.error('Error fetching library tests:', error);
    libGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#ef4444;padding:40px;">Xəta baÅŸ verdi.</div>`;
    return;
  }

  if (!tests || tests.length === 0) {
    libGrid.innerHTML = `
      <div class="results-empty" style="text-align:center;padding:50px 20px;color:#94a3b8; grid-column:1/-1;">
        Kitabxanada aktiv test yoxdur.
      </div>
    `;
    return;
  }

  libGrid.innerHTML = tests.map(t => {
    const meta = parseMeta(t.metadata);
    const author = (t.profiles && t.profiles.full_name) ? t.profiles.full_name : 'Müəllim';
    const tag = t.subject || 'QarıÅŸıq';
    return `
      <div class="exam-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <span class="subject-tag">${tag}</span>
          <span style="font-size:12px; color:#64748b; font-weight:500;">${t.duration_minutes || 45} dəq</span>
        </div>
        <h3 style="font-size:16px; font-weight:700; color:#0f172a; margin-bottom:6px;">${t.title}</h3>
        <p style="font-size:13px; color:#64748b; margin-bottom:16px; line-height:1.4;">${meta.description || 'Müəllim tərəfindən sınaq'}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:12px; border-top:1px dashed #e2e8f0;">
          <div style="font-size:12px; color:#94a3b8;">ğŸ‘¤ ${author}</div>
          <button onclick="startPublicTest('${t.id}')" style="background:#f3e8ff; color:#7c3aed; padding:6px 12px; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;" onmouseover="this.style.background='#e9d5ff'" onmouseout="this.style.background='#f3e8ff'">BaÅŸla</button>
        </div>
      </div>
    `;
  }).join('');
}

// Event Listeners for Library
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('library-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      librarySearchQuery = e.target.value.trim();
      loadLibraryTests();
    });
  }

  const catBtns = document.querySelectorAll('.library-categories .category-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      libraryCategory = btn.textContent;
      loadLibraryTests();
    });
  });
});


// Profile modal controls
window.openProfileModal = async function() {
  const modal = document.getElementById('profile-edit-modal');
  if (modal) modal.style.display = 'flex';

  // Re-fetch fresh profile data from DB to ensure pre-fill is always current
  if (window.currentProfile && window.currentProfile.id) {
    const { data: freshProfile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', window.currentProfile.id)
      .single();
    if (!error && freshProfile) {
      Object.assign(window.currentProfile, freshProfile);
    }
  }

  // Pre-fill fields directly from profile columns
  const p = window.currentProfile;
  if (p) {
    const el = (id) => document.getElementById(id);
    if (el('edit-school')) el('edit-school').value = p.school || '';
    if (el('edit-grade')) el('edit-grade').value = p.grade || '';
    if (el('edit-group')) el('edit-group').value = p.exam_group || '';
    if (el('edit-target-score')) el('edit-target-score').value = p.target_score || '';
    if (el('edit-preparation')) el('edit-preparation').value = p.preparation || 'intermediate';
  }
};

window.closeProfileModal = function() {
  const modal = document.getElementById('profile-edit-modal');
  if (modal) modal.style.display = 'none';
};

window.saveProfileChanges = async function() {
  if (!window.currentProfile) return showToast('Profil tapılmadı', 'error');

  const school = document.getElementById('edit-school')?.value?.trim() || '';
  const grade = document.getElementById('edit-grade')?.value || '';
  const group = document.getElementById('edit-group')?.value || '';
  const targetScore = document.getElementById('edit-target-score')?.value || '';
  const preparation = document.getElementById('edit-preparation')?.value || '';

  const updates = {
    school: school,
    grade: grade,
    exam_group: group,
    target_score: parseInt(targetScore) || null,
    preparation: preparation
  };

  const { error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('id', window.currentProfile.id);

  if (error) {
    console.error('Profile update error:', error);
    showToast('Profil yenilənərkən xəta baÅŸ verdi: ' + error.message, 'error');
  } else {
    // Update local state
    Object.assign(window.currentProfile, updates);
    showToast('Profil uÄŸurla yeniləndi!', 'success');
    closeProfileModal();
    // Refresh dashboard to reflect changes
    if (typeof loadStudentDashboard === 'function') loadStudentDashboard();
  }
};

// --- Library Tab Switcher ---
window.switchLibraryTab = function(tabId, el) {
    // Remove active class from all tabs
    document.querySelectorAll('.library-tab').forEach(t => t.classList.remove('active'));
    // Add active class to clicked tab
    if (el) el.classList.add('active');
    
    // Hide all sub-views
    document.getElementById('lib-public').classList.remove('active');
    document.getElementById('lib-private').classList.remove('active');
    
    // Show selected sub-view
    const target = document.getElementById('lib-' + tabId);
    if (target) target.classList.add('active');
};

// --- Test Analysis Logic ---
window.openTestDetails = async function(sessionId, isFromRouter = false) {
    if (!isFromRouter) {
        window.navigateTo(`student-results:detail:${sessionId}`);
        return;
    }
    
    document.getElementById('analysis-header-title').textContent = 'Yüklənir...';
    document.getElementById('review-questions-list').innerHTML = `<div class="generating-state visible"><span class="spinner"></span> Sual analizi çəkilir...</div>`;
    
    // Hide default header stats to avoid showing old data
    document.getElementById('analysis-stat-result').textContent = '...';
    document.getElementById('analysis-stat-time').textContent = '...';
    document.getElementById('analysis-stat-correct').textContent = '...';

    // Fetch session and test data
    const { data: session, error: sessErr } = await supabaseClient
        .from('exam_sessions')
        .select('*, tests(*)')
        .eq('id', sessionId)
        .single();

    if (sessErr || !session) {
        document.getElementById('review-questions-list').innerHTML = `<div style="color:red; padding: 20px;">Sessiya tapılmadı!</div>`;
        return;
    }

    // Fetch answers and questions
    const { data: answers, error: ansErr } = await supabaseClient
        .from('student_answers')
        .select('*, questions(*)')
        .eq('session_id', sessionId);

    if (ansErr) {
        document.getElementById('review-questions-list').innerHTML = `<div style="color:red; padding: 20px;">Cavablar tapılmadı!</div>`;
        return;
    }

    const test = session.tests || {};
    document.getElementById('analysis-header-title').textContent = test.title || 'İmtahan';
    document.getElementById('analysis-header-meta').textContent = `${(test.subject ? test.subject + ' â€¢ ' : '')}${sgDate(session.started_at)}`;
    document.getElementById('analysis-stat-result').textContent = `${session.score || 0}%`;

    let correctCount = answers ? answers.filter(a => a.is_correct).length : 0;
    let totalQuestions = answers ? answers.length : 0; // Assuming all answered
    
    // Calculate time taken from answers sum (more accurate for active time)
    let totalSeconds = 0;
    if (answers && answers.length > 0) {
        totalSeconds = answers.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0);
    }
    
    // Fallback to session diff if answers sum is 0 but timestamps exist
    if (totalSeconds === 0 && session.started_at && session.finished_at) {
        totalSeconds = Math.round((new Date(session.finished_at) - new Date(session.started_at)) / 1000);
    }

    function formatDuration(seconds) {
        if (seconds < 60) return `${seconds} san`;
        let mins = Math.floor(seconds / 60);
        let secs = seconds % 60;
        return secs > 0 ? `${mins} dəq ${secs} san` : `${mins} dəq`;
    }

    document.getElementById('analysis-stat-time').textContent = formatDuration(totalSeconds);

    // Time Management Calculation
    let fastAnswers = 0; // < 20s
    let normalAnswers = 0; // 20 - 60s
    let slowAnswers = 0; // > 60s
    let minTime = Infinity;
    let maxTime = -Infinity;
    let minTimeIdx = -1;
    let maxTimeIdx = -1;
    
    if (answers && answers.length > 0) {
        answers.forEach((ans, idx) => {
            const t = ans.time_spent_seconds || 0;
            if (t < 20) fastAnswers++;
            else if (t <= 60) normalAnswers++;
            else slowAnswers++;

            if (t > 0) { // only count actual effort
                if (t < minTime) { minTime = t; minTimeIdx = idx + 1; }
                if (t > maxTime) { maxTime = t; maxTimeIdx = idx + 1; }
            }
        });
    }
    
    if (minTime === Infinity) minTime = 0;
    if (maxTime === -Infinity) maxTime = 0;

    const fastPct = totalQuestions ? Math.round((fastAnswers / totalQuestions) * 100) : 0;
    const normalPct = totalQuestions ? Math.round((normalAnswers / totalQuestions) * 100) : 0;
    const slowPct = totalQuestions ? Math.round((slowAnswers / totalQuestions) * 100) : 0;

    document.getElementById('time-management-content').innerHTML = `
        <div style="font-size:14px; color:#64748b; line-height:1.6; margin-bottom: 20px;">
            <div style="margin-bottom:8px; display:flex; justify-content:space-between;"><span>â€¢ Orta sual vaxtı:</span> <b style="color:#1e293b">${totalQuestions ? Math.round(totalSeconds / totalQuestions) : 0} san</b></div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between;"><span>â€¢ Æn sürətli cavab:</span> <b style="color:#1e293b">${minTime} san ${minTimeIdx > 0 ? '(Sual ' + minTimeIdx + ')' : ''}</b></div>
            <div style="margin-bottom:8px; display:flex; justify-content:space-between;"><span>â€¢ Æn yavaÅŸ cavab:</span> <b style="color:#1e293b">${maxTime} san ${maxTimeIdx > 0 ? '(Sual ' + maxTimeIdx + ')' : ''}</b></div>
        </div>

        <div style="display:flex; height:12px; border-radius:6px; overflow:hidden; margin-bottom:12px;">
            <div style="width:${fastPct}%; background:#10b981;" title="Sürətli (${fastAnswers} sual)"></div>
            <div style="width:${normalPct}%; background:#3b82f6;" title="Normal (${normalAnswers} sual)"></div>
            <div style="width:${slowPct}%; background:#f59e0b;" title="YavaÅŸ (${slowAnswers} sual)"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.02em;">
            <div style="color:#10b981;">Sürətli</div>
            <div style="color:#3b82f6;">Normal</div>
            <div style="color:#f59e0b;">YavaÅŸ</div>
        </div>
    `;

    // AI Performance stub
    let insightPhrase = "";
    if (session.score >= 80) insightPhrase = "Æla nəticə! Mövzunu yaxÅŸı mənimsəmisiniz. Sürətli cavablandırma bacarıÄŸınız diqqət çəkir.";
    else if (session.score >= 50) insightPhrase = "Orta nəticə. Bəzi konseptlərdə və ya vaxt idarəetməsində yavaÅŸlama var. Səhv etdiyiniz sualların izahına diqqətlə baxın.";
    else insightPhrase = "Zəif nəticə. Bu fənn üzrə əsas anlayıÅŸları yenidən təkrarlamaq faydalı olardı.";

    let timeInsight = "";
    if (slowAnswers > totalQuestions / 2) timeInsight = " Sualların çoxunda düÅŸünmək üçün uzun vaxt sərf etmisiniz.";
    else if (fastAnswers > totalQuestions / 2 && session.score < 50) timeInsight = " Ã‡ox sürətli lakin diqqətsiz cavab verməyiniz ehtimal olunur, diqqətli olun.";

    document.getElementById('ai-performance-insights').innerHTML = `
      <div style="background:#f0f9ff; border-left:4px solid #3b82f6; padding:16px; border-radius:12px; margin-bottom:16px;">
        <p style="margin-bottom:8px; font-size:15px; font-weight:600; color:#1e3a8a;">Sizə özəl analiz:</p>
        <p style="margin-bottom:12px; line-height:1.5;">Sizin nəticəniz <b>${session.score}%</b> təÅŸkil edir. ${insightPhrase}${timeInsight}</p>
        <div style="font-size:13px; color:#64748b; font-style:italic;">
            Tips: Səhv cavablandırdıÄŸınız <b style="color:#ef4444">${totalQuestions - correctCount}</b> sual üzərində vizual təhlil aparmaqla sürətinizi və dəqiqliyinizi artıra bilərsiniz.
        </div>
      </div>
    `;

    // Render Review Questions
    if (!answers || answers.length === 0) {
        document.getElementById('review-questions-list').innerHTML = `<div style="padding: 20px; color: #64748b;">Suallar və cavablar tapılmadı. Ola bilsin testi yarımçıq saxlamısınız.</div>`;
        return;
    }

    const reviewHtml = answers.map((ans, idx) => {
        const q = ans.questions;
        if (!q) return '';
        
        let options = [];
        if (typeof q.options === 'string') {
            try { options = JSON.parse(q.options); } catch(e) {}
        } else if (Array.isArray(q.options)) {
            options = q.options;
        }

        return `
            <div class="review-question-card" data-correct="${ans.is_correct}" style="border-left-color: ${ans.is_correct ? '#10b981' : '#ef4444'}">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="font-size:16px; font-weight:700; color:#0f172a;">Sual ${idx + 1}</div>
                        <div style="font-size:12px; color:#64748b; font-weight:500; display:flex; align-items:center; gap:4px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            ${ans.time_spent_seconds || 0} san
                        </div>
                    </div>
                    <div style="font-size:12px; font-weight:700; padding:4px 8px; border-radius:6px; background:${ans.is_correct ? '#d1fae5' : '#fee2e2'}; color:${ans.is_correct ? '#059669' : '#b91c1c'};">
                        ${ans.is_correct ? 'DÃœZGÃœN' : 'SÆHV'}
                    </div>
                </div>
                <p style="font-size:15px; color:#334155; margin-bottom:16px; line-height:1.5;">${q.question_text}</p>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${options.map((opt, oIdx) => {
                        let isSelected = ans.selected_index === oIdx;
                        let isActuallyCorrect = q.correct_index === oIdx;
                        
                        let bgColor = '#f8fafc';
                        let borderColor = '#e2e8f0';
                        let textColor = '#475569';
                        let icon = '';

                        if (isActuallyCorrect) {
                            bgColor = '#ecfdf5';
                            borderColor = '#10b981';
                            textColor = '#065f46';
                            icon = 'âœ“';
                        } else if (isSelected && !isActuallyCorrect) {
                            bgColor = '#fef2f2';
                            borderColor = '#ef4444';
                            textColor = '#991b1b';
                            icon = 'âœ•';
                        }

                        return `
                            <div style="padding:12px 16px; border:2px solid ${borderColor}; border-radius:8px; background:${bgColor}; color:${textColor}; display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:600;">
                                <span>${opt}</span>
                                <span style="font-weight:800;">${icon}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('review-questions-list').innerHTML = reviewHtml;
    
    // FIX D7: Use navigateTo instead of raw hash assignment
    document.getElementById('btn-back-analytics').onclick = function() {
        window.navigateTo('student-dashboard');
    };
};

window.filterAnalysis = function(type) {
    const cards = document.querySelectorAll('.review-question-card');
    const bAll = document.getElementById('filter-all');
    const bWrong = document.getElementById('filter-wrong');
    
    if (type === 'all') {
        if(bAll) bAll.style.cssText = "background:#3b82f6; color:white; border-radius:10px;";
        if(bWrong) bWrong.style.cssText = "background:#f1f5f9; color:#475569; border-radius:10px;";
        cards.forEach(c => c.style.display = 'block');
    } else {
        if(bAll) bAll.style.cssText = "background:#f1f5f9; color:#475569; border-radius:10px;";
        if(bWrong) bWrong.style.cssText = "background:#3b82f6; color:white; border-radius:10px;";
        cards.forEach(c => {
            if (c.getAttribute('data-correct') === 'true') {
                c.style.display = 'none';
            } else {
                c.style.display = 'block';
            }
        });
    }
};

// --- Exam Analysis Page Initializer ---
window.initExamAnalysis = function() {
    const loadingEl = document.getElementById('exam-analysis-loading');
    const contentEl = document.getElementById('exam-analysis-content');
    if (!loadingEl || !contentEl) return;

    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';

    const r = window.lastExamResult;
    // FIX D8: Friendly message + safe redirect when result is missing (page refresh)
    if (!r) {
        if (typeof showToast === 'function') showToast('Nəticəni görmək üçün imtahana qayıdın.', 'warning');
        setTimeout(() => { window.navigateTo('student-dashboard'); }, 1200);
        return;
    }

    const el = id => document.getElementById(id);
    const score     = r.score || 0;
    const correct   = r.correct || 0;
    const wrong     = r.wrong || 0;
    const total     = r.total || 0;
    const sessionId = r.sessionId || '';

    // Color scheme
    const scoreColor = score >= 80 ? '#16a34a' : (score >= 50 ? '#f59e0b' : '#ef4444');
    const scoreBg    = score >= 80
        ? 'linear-gradient(90deg,#16a34a,#22c55e)'
        : (score >= 50 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#f87171)');

    // Score hero
    if (el('ea-score-emoji')) el('ea-score-emoji').textContent = score >= 80 ? 'ğŸ†' : (score >= 50 ? 'ğŸ“ˆ' : 'ğŸ’ª');
    if (el('ea-test-title')) el('ea-test-title').textContent = r.testTitle || 'Test';
    if (el('ea-score-val'))  { el('ea-score-val').textContent = score; el('ea-score-val').style.color = scoreColor; }
    if (el('ea-score-label')) {
        el('ea-score-label').textContent = score >= 80 ? 'Æla nəticə!' : (score >= 50 ? 'Orta nəticə' : 'YaxÅŸılaÅŸmaq olar');
        el('ea-score-label').style.color = scoreColor;
    }

    // Stats
    if (el('ea-total'))   el('ea-total').textContent   = total;
    if (el('ea-correct')) el('ea-correct').textContent = correct;
    if (el('ea-wrong'))   el('ea-wrong').textContent   = wrong;

    // Progress bar
    if (el('ea-score-fraction')) el('ea-score-fraction').textContent = `${correct} / ${total}`;
    if (el('ea-score-bar')) {
        el('ea-score-bar').style.background = scoreBg;
        setTimeout(() => { el('ea-score-bar').style.width = score + '%'; }, 120);
    }

    // AI motivational message
    let aiEmoji, aiTitle, aiMessage, aiBg, aiBorder, aiTitleColor, aiMsgColor;
    if (score >= 80) {
        aiEmoji = '🌟'; aiBg = '#f0fdf4'; aiBorder = '#16a34a'; aiTitleColor = '#14532d'; aiMsgColor = '#166534';
        aiTitle   = 'Əla nəticə! Sən çox yaxşı işlədin!';
        aiMessage = `${score}% — bu həqiqətən görkəmli bir nəticədir! Mövzuları dərindən mənimsəmisən, bu sürəti qoru. Gündən-günə daha da güclənirsən — uğurun açarı məhz bu cür ardıcıllıqdır. 💪`;
    } else if (score >= 50) {
        aiEmoji = '📘'; aiBg = '#fffbeb'; aiBorder = '#f59e0b'; aiTitleColor = '#78350f'; aiMsgColor = '#92400e';
        aiTitle   = 'Yaxşı başlanğıc — davam et!';
        aiMessage = `${score}% — orta bir nəticədir, amma bu inkişafın başlanğıcıdır. Səhv etdiyin suallara diqqətlə bax, hansı mövzularda boşluğun olduğunu müəyyən et. Hər addımda bir az daha irəliləyirsən! 🎯`;
    } else {
        aiEmoji = '🚀'; aiBg = '#eff6ff'; aiBorder = '#2563eb'; aiTitleColor = '#1e3a8a'; aiMsgColor = '#1e40af';
        aiTitle   = 'Narahat olma — bu bir başlanğıcdır!';
        aiMessage = `${score}% — bu dəfə çətin oldu, lakin hər sınaq sənə bir şey öyrədir. Əsas anlayışları yenidən nəzərdən keçir, əvvəlcədən baxdığın suallara qayıt. Uğur sadəcə davam etməkdir — sən bacararsan! 💙`;
    }

    const aiBlock = el('ea-ai-block');
    if (aiBlock) { aiBlock.style.background = aiBg; aiBlock.style.borderLeftColor = aiBorder; }
    if (el('ea-ai-emoji'))   el('ea-ai-emoji').textContent = aiEmoji;
    if (el('ea-ai-title'))   { el('ea-ai-title').textContent = aiTitle; el('ea-ai-title').style.color = aiTitleColor; }
    if (el('ea-ai-message')) { el('ea-ai-message').textContent = aiMessage; el('ea-ai-message').style.color = aiMsgColor; }

    // Wire up detail button
    const detailBtn = el('ea-btn-detailed');
    if (detailBtn) {
        detailBtn.onclick = function() {
            // FIX D6: navigateTo removes the double-hash issue
            window.navigateTo(sessionId ? `student-results:detail:${sessionId}` : 'student-results');
        };
    }

    setTimeout(() => { loadingEl.style.display = 'none'; contentEl.style.display = 'block'; }, 350);
};

// --- selectChip: Toggle difficulty chips in student-generate view ---
window.selectChip = function(el, groupName) {
    // Remove active state from all chips in this group
    const parent = el.closest('.form-group') || el.parentElement.parentElement;
    parent.querySelectorAll('.diff-chip').forEach(chip => {
        chip.classList.remove('active');
        chip.style.background = '#f1f5f9';
        chip.style.color = '#64748b';
    });
    // Also uncheck all radios in this group
    parent.querySelectorAll(`input[name="${groupName}"]`).forEach(r => r.checked = false);

    // Activate clicked chip
    el.classList.add('active');
    el.style.background = '#2563eb';
    el.style.color = 'white';

    // Check the corresponding radio
    const radio = el.closest('label')?.querySelector(`input[name="${groupName}"]`);
    if (radio) radio.checked = true;
};

// --- Modal Join (btn-submit-code) ---
document.addEventListener('DOMContentLoaded', () => {
    const submitCodeBtn = document.getElementById('btn-submit-code');
    if (submitCodeBtn) {
        submitCodeBtn.addEventListener('click', async () => {
            const codeInput = document.getElementById('exam-code-input');
            const code = codeInput ? codeInput.value.trim() : '';
            if (!code || code.length < 4) {
                return showToast('Zəhmət olmasa düzgün imtahan kodunu daxil edin.', 'error');
            }

            showToast('Kod yoxlanılır...', 'info');

            const { data, error } = await supabaseClient
                .from('tests')
                .select('*')
                .eq('access_code', code) // FIX D11: removed toUpperCase
                .single();

            if (error || !data) {
                return showToast('İmtahan tapılmadı və ya kod səhvdir.', 'error');
            }
            if (!data.is_active) {
                return showToast('Bu imtahan hazırda aktiv deyil.', 'warning');
            }

            // Close modal
            document.getElementById('modal-join').style.display = 'none';

            showToast(`"${data.title}" imtahanına keçid edilir...`, 'success');
            if (typeof startPublicTest === 'function') {
                startPublicTest(data.id);
            }
        });
    }

    // --- PDF Download button ---
    const pdfBtn = document.getElementById('btn-download-pdf');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // --- Student Generate: Subject searchable select ---
    const studentFenInput = document.getElementById('student-fen-input');
    const studentFenDropdown = document.getElementById('student-fen-dropdown');
    const studentFenHidden = document.getElementById('student-fen-hidden');
    if (studentFenInput && studentFenDropdown) {
        const subjects = APP_DATA.subjects || [];
        function renderStudentSubjects(filter = '') {
            const filtered = subjects.filter(s =>
                s.name.toLowerCase().includes(filter.toLowerCase())
            );
            studentFenDropdown.innerHTML = filtered.map(s => `
                <div class="search-option" data-value="${s.value}" data-label="${s.name}">
                    <span>${s.icon || ''}</span> ${s.name}
                </div>
            `).join('');
            studentFenDropdown.classList.add('visible');
            studentFenDropdown.style.display = 'block';

            studentFenDropdown.querySelectorAll('.search-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    studentFenInput.value = opt.getAttribute('data-label');
                    if (studentFenHidden) studentFenHidden.value = opt.getAttribute('data-value');
                    studentFenDropdown.classList.remove('visible');
                    studentFenDropdown.style.display = 'none';
                });
            });
        }
        studentFenInput.addEventListener('focus', () => renderStudentSubjects(studentFenInput.value));
        studentFenInput.addEventListener('input', () => renderStudentSubjects(studentFenInput.value));
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#student-fen-container')) {
                studentFenDropdown.classList.remove('visible');
                studentFenDropdown.style.display = 'none';
            }
        });
    }

    // --- Student AI Test Generation (btn-student-gen) ---
    const genBtn = document.getElementById('btn-student-gen');
    if (genBtn) {
        genBtn.addEventListener('click', async () => {
            const subject = studentFenHidden?.value || studentFenInput?.value || '';
            const grade = document.getElementById('student-grade')?.value || '9';
            const qCount = parseInt(document.getElementById('student-q-count')?.value) || 10;
            const diffRadio = document.querySelector('input[name="difficulty"]:checked');
            const difficulty = diffRadio ? diffRadio.value : 'orta';
            const testType = document.getElementById('student-test-type')?.value || 'multi';
            const timeLimit = parseInt(document.getElementById('student-time')?.value) || 45;
            const topic = document.getElementById('student-topic')?.value?.trim() || '';

            if (!subject) return showToast('Zəhmət olmasa fənn seçin.', 'error');
            if (!window.currentProfile) return showToast('GiriÅŸ edin.', 'error');

            genBtn.disabled = true;
            genBtn.textContent = 'â³ Suallar hazırlanır...';

            const subjectLabel = (APP_DATA.fennLabels && APP_DATA.fennLabels[subject]) || subject;
            const diffLabel = (APP_DATA.cetinlikLabels && APP_DATA.cetinlikLabels[difficulty]) || difficulty;

            const prompt = `Sən bir müəllim robotu (AI) olaraq Azərbaycan dilində ${qCount} ədəd çoxseçimli sual yaratmalısan.
Fənn: ${subjectLabel}
Sinif: ${grade}
Ã‡ətinlik: ${diffLabel}
${topic ? 'Mövzu: ' + topic : ''}

Hər sual üçün:
- question_text: sualın mətni
- options: tam 5 variant (array)
- correct_index: düzgün cavabın indeksi (0-4)

YALNIZ JSON array formatında cavab ver, baÅŸqa heç nə yazma. Format:
[{"question_text":"...","options":["A","B","C","D","E"],"correct_index":0},...]`;

            try {
                const response = await fetch(GROQ_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GROQ_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: GROQ_MODEL,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        max_tokens: 4096
                    })
                });

                if (!response.ok) throw new Error('API xətası: ' + response.status);

                const result = await response.json();
                const raw = result.choices?.[0]?.message?.content || '';

                // Extract JSON from response
                let questions;
                const jsonMatch = raw.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    questions = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('AI-dən düzgün cavab alınmadı');
                }

                if (!Array.isArray(questions) || questions.length === 0) {
                    throw new Error('Suallar yaradıla bilmədi');
                }

                // Create test in Supabase
                const title = `${subjectLabel} - AI Sınaq`;
                const { data: test, error: testErr } = await supabaseClient
                    .from('tests')
                    .insert({
                        teacher_id: window.currentProfile.id,
                        title: title,
                        subject: subjectLabel,
                        grade: grade,
                        duration_minutes: timeLimit,
                        is_active: true,
                        is_public: false,
                        metadata: { source: 'ai_generated', difficulty: difficulty, topic: topic }
                    })
                    .select()
                    .single();

                if (testErr || !test) throw new Error('Test yaratıla bilmədi');

                // Insert questions
                const qRows = questions.map((q, i) => ({
                    test_id: test.id,
                    question_text: q.question_text,
                    options: q.options,
                    correct_index: q.correct_index,
                    order_index: i + 1
                }));

                const { error: qErr } = await supabaseClient
                    .from('questions')
                    .insert(qRows);

                if (qErr) throw new Error('Suallar əlavə edilə bilmədi');

                showToast('Test hazırdır! İmtahan başlayır...', 'success');
                startPublicTest(test.id);

            } catch (err) {
                console.error('AI Generation error:', err);
                showToast('Xəta: ' + err.message, 'error');
            } finally {
                genBtn.disabled = false;
                genBtn.textContent = 'Testi Hazırla və BaÅŸla';
            }
        });
    }
});
