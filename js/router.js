// --- Advanced SPA Router ---
(function () {
    const views = document.querySelectorAll('.view');

    // Core Navigation
    window.navigateTo = function (hash) {
        history.pushState({ view: hash }, '', window.location.pathname);
        sessionStorage.setItem('currentView', hash);
        showView(hash);
    };

    // Redirect without adding to browser history (avoids hashchange loop)
    function redirectTo(targetHash, msg, type) {
        if (typeof showToast === 'function' && msg) showToast(msg, type || 'warning');
        history.replaceState({ view: targetHash }, '', window.location.pathname);
        sessionStorage.setItem('currentView', targetHash);
        showView(targetHash);
    }

    async function showView(viewId) {
        let hash = viewId || 'landing';
        if (hash === '' || hash === '#') hash = 'landing';

        const parts = hash.split(':');
        const primaryId = parts[0];
        const subAction = parts[1];
        const subId = parts[2];

        // ── STEP 1: Immediately hide all views before any async work ──
        views.forEach(v => {
            v.style.display = 'none';
            v.classList.remove('active-view');
        });

        // ── STEP 2: Authentication & Role Guards ──
        const teacherRoutes = [
            'neticeler', 'teacher-create-test', 'teacher-active-tests',
            'teacher-profile', 'teacher-topics-detail', 'teacher-student-list',
            'teacher-student-detail'
        ];
        const studentRoutes = [
            'student-dashboard', 'student-generate', 'student-results',
            'student-profile', 'student-exam-room', 'student-completion-details',
            'student-library', 'student-result-detail-buraxilis', 'student-result-detail-blok',
            'student-exam-analysis'
        ];
        const isTeacherRoute = teacherRoutes.includes(primaryId);
        const isStudentRoute = studentRoutes.includes(primaryId);

        if (isTeacherRoute || isStudentRoute) {
            const { data: { session } } = await supabaseClient.auth.getSession();

            if (!session) {
                redirectTo('login', 'Zəhmət olmasa hesabınıza daxil olun.', 'warning');
                return;
            }

            // Populate currentProfile if missing (e.g. direct URL load)
            if (!window.currentProfile) {
                window.currentUser = session.user;
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', window.currentUser.id)
                    .single();
                window.currentProfile = profile
                    ? { ...profile, ...(window.currentUser.user_metadata || {}) }
                    : null;
            }

            if (window.currentProfile) {
                if (isTeacherRoute && window.currentProfile.role !== 'teacher') {
                    redirectTo('student-dashboard', 'Bu səhifə yalnız müəllimlər üçündür.', 'error');
                    return;
                }
                if (isStudentRoute && window.currentProfile.role !== 'student') {
                    redirectTo('neticeler', 'Bu səhifə yalnız şagirdlər üçündür.', 'error');
                    return;
                }
            }
        }

        // ── Update Page Title ──
        const titleMap = {
            'student-dashboard': 'Dashboard | TQM',
            'neticeler': 'Exam Panel | TQM',
            'teacher-active-tests': 'Tests | TQM',
            'teacher-create-test': 'Create Test | TQM',
            'teacher-student-list': 'Exam Sessions | TQM',
            'student-results': 'Exam Sessions | TQM',
            'teacher-profile': 'Profile | TQM',
            'student-profile': 'Profile | TQM',
            'student-library': 'Library | TQM',
            'student-exam-room': 'Exam Room | TQM',
            'landing': 'Home | TQM',
            'login': 'Login | TQM',
            'signup': 'Sign Up | TQM'
        };
        document.title = titleMap[primaryId] || 'TQM';

        // ── STEP 3: Resolve and display target view ──
        let targetView = document.getElementById(primaryId);
        if (!targetView) {
            console.warn(`View "${primaryId}" not found, falling back to landing.`);
            targetView = document.getElementById('landing');
        }

        if (!targetView) return;

        targetView.style.display = 'block';
        void targetView.offsetWidth; // force reflow for animation
        targetView.classList.add('active-view');

        // ── View-specific initializers ──
        if (primaryId === 'neticeler') {
            if (typeof loadTeacherDashboard === 'function') loadTeacherDashboard();
            if (typeof loadTeacherTests === 'function') loadTeacherTests();
            if (typeof loadTeacherResults === 'function') loadTeacherResults();
            if (typeof loadPublicTestsForTeacher === 'function') loadPublicTestsForTeacher();
        }
        if (primaryId === 'teacher-active-tests') {
            if (typeof loadTeacherTests === 'function') loadTeacherTests();
        }
        if (primaryId === 'teacher-topics-detail') {
            if (typeof loadTopicsAnalysis === 'function') loadTopicsAnalysis();
        }
        if (primaryId === 'teacher-student-list') {
            if (typeof loadTeacherStudentList === 'function') loadTeacherStudentList();
        }
        if (primaryId === 'teacher-student-detail') {
            // Check if there's an ID like #teacher-student-detail:sess_id
            if (subAction && typeof loadTeacherStudentDetail === 'function') {
                loadTeacherStudentDetail(subAction);
            }
        }
        if (primaryId === 'student-dashboard') {
            if (typeof loadStudentDashboard === 'function') loadStudentDashboard();
            if (typeof loadPublicTests === 'function') loadPublicTests();
        }
        if (primaryId === 'student-library') {
            if (typeof loadLibraryTests === 'function') loadLibraryTests();
        }
        if (primaryId === 'student-results') {
            if (typeof loadStudentResults === 'function') loadStudentResults();
            if (typeof loadGeneralAnalysis === 'function') loadGeneralAnalysis();
            const dash = document.getElementById('analytics-dashboard');
            const analysis = document.getElementById('test-analysis-view');
            if (subAction === 'detail' && subId) {
                if (dash) dash.classList.add('hidden-view');
                if (analysis) analysis.classList.remove('hidden-view');
                if (typeof openTestDetails === 'function') openTestDetails(subId, true);
            } else {
                if (dash) dash.classList.remove('hidden-view');
                if (analysis) analysis.classList.add('hidden-view');
            }
        }
        if (primaryId === 'teacher-create-test') {
            const stgSettings = document.getElementById('teacher-test-settings-stage');
            const stgBuilder = document.getElementById('teacher-test-builder-stage');
            const stgPublish = document.getElementById('teacher-test-publish-stage');
            if (hash === 'teacher-create-test') {
                if (stgSettings) stgSettings.style.display = 'block';
                if (stgBuilder) stgBuilder.style.display = 'none';
                if (stgPublish) stgPublish.style.display = 'none';

                // Reset all form fields to prevent stale data from previous exam creation
                const fenInput = document.getElementById('builder-fen-input');
                const fenHidden = document.getElementById('builder-fen');
                const sinif = document.getElementById('builder-sinif');
                const vaxt = document.getElementById('builder-vaxt');
                const codeInput = document.getElementById('builder-access-code');
                const codeGroup = document.getElementById('builder-code-group');
                const visPublic = document.getElementById('vis-public');
                const visLabelPublic = document.getElementById('vis-label-public');
                const visLabelPrivate = document.getElementById('vis-label-private');

                if (fenInput) fenInput.value = '';
                if (fenHidden) fenHidden.value = '';
                if (sinif) sinif.value = '';
                if (vaxt) vaxt.value = '45';
                if (codeInput) codeInput.value = '';
                if (codeGroup) codeGroup.style.display = 'none';
                if (visPublic) visPublic.checked = true;
                if (visLabelPublic) { visLabelPublic.style.borderColor = '#2563eb'; visLabelPublic.style.background = '#eff6ff'; }
                if (visLabelPrivate) { visLabelPrivate.style.borderColor = '#e2e8f0'; visLabelPrivate.style.background = 'white'; }

                // Reset global builder state
                if (typeof builderQuestions !== 'undefined') { window.builderQuestions = []; }
                if (typeof builderSelectedSubject !== 'undefined') { window.builderSelectedSubject = ''; }
            }
        }
        if (primaryId === 'student-exam-room') {
            if (!window.currentActiveTest) {
                redirectTo('student-dashboard', 'Aktiv imtahan tapılmadı.', 'info');
                setTimeout(() => {
                    if (typeof loadStudentDashboard === 'function') loadStudentDashboard();
                }, 50);
                return;
            }
            if (typeof initExamRoom === 'function') initExamRoom();
        }
        if (primaryId === 'student-exam-analysis') {
            if (typeof initExamAnalysis === 'function') initExamAnalysis();
        }
        if (primaryId === 'login' || primaryId === 'signup') {
            if (typeof window.randomizeAuthQuotes === 'function') {
                window.randomizeAuthQuotes();
            }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleHash(isLoad = false) {
        let hash = window.location.hash.substring(1);
        
        if (hash) {
            history.replaceState({ view: hash }, '', window.location.pathname);
        } else if (isLoad) {
            hash = sessionStorage.getItem('currentView') || 'landing';
            history.replaceState({ view: hash }, '', window.location.pathname);
        } else {
            hash = sessionStorage.getItem('currentView') || 'landing';
            history.replaceState({ view: hash }, '', window.location.pathname);
        }

        sessionStorage.setItem('currentView', hash);
        await showView(hash);
    }

    window.addEventListener('load', () => { handleHash(true); });
    window.addEventListener('hashchange', () => { handleHash(false); });
    
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.view) {
            sessionStorage.setItem('currentView', e.state.view);
            showView(e.state.view);
        } else {
            handleHash(true);
        }
    });

})();
