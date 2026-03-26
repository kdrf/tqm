// --- Authentication Logic (Supabase) ---

// Safe navigation helper: uses router's navigateTo if available, falls back to hash
function safeNavigate(view) {
    if (typeof window.navigateTo === 'function') {
        window.navigateTo(view);
    } else {
        // Router not ready yet — defer until it loads
        window.addEventListener('load', () => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo(view);
            } else {
                window.location.hash = view;
            }
        }, { once: true });
    }
}

async function checkUserSession() {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    if (sessionError) {
        console.error("Session Error:", sessionError);
    }

    if (session) {
        console.log("Session detected:", session);
        window.currentUser = session.user;
        
        const userId = window.currentUser?.id;
        
        if (!userId) {
            console.error("CRITICAL: session.user.id is undefined!", window.currentUser);
            return;
        }

        const { data: profile, error: profileError } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
        
        if (profileError) {
            console.error("Profile Fetch Error:", profileError);
        }

        window.currentProfile = profile ? { ...profile, ...(window.currentUser.user_metadata || {}) } : null;

        if (window.currentProfile) {
            let currentView = sessionStorage.getItem('currentView') || window.location.hash.substring(1) || '';
            const entryPages = ['', 'login', 'signup', 'landing'];

            if (entryPages.includes(currentView)) {
                // FIX A1/A4: Use safeNavigate instead of raw window.location.hash
                safeNavigate(window.currentProfile.role === 'teacher' ? 'neticeler' : 'student-dashboard');
            }
        }
    }
}

// Check session on load
checkUserSession();

// Setup Login
const loginBtn = document.querySelector('#login .auth-submit-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showToast('Zəhmət olmasa bütün sahələri doldurun.', 'warning');
            return;
        }

        loginBtn.textContent = 'Gözləyin...';
        loginBtn.disabled = true;

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        loginBtn.textContent = 'Daxil ol';
        loginBtn.disabled = false;

        if (error) {
            showToast('Hesaba girişdə xəta: ' + (error.message || 'Səhv baş verdi'), 'error');
        } else {
            showToast('Giriş uğurla tamamlandı!', 'success');
            // FIX A4: Use checkUserSession which now uses safeNavigate internally
            await checkUserSession();
        }
    });
}

// Setup Signup
const signupBtn = document.querySelector('#signup .auth-submit-btn');
if (signupBtn) {
    // --- Role Toggle: Show/hide student-specific fields ---
    const roleRadios = document.querySelectorAll('input[name="role"]');
    const studentExtraFields = document.getElementById('student-extra-fields');
    if (roleRadios && studentExtraFields) {
        roleRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'student' && radio.checked) {
                    studentExtraFields.style.display = 'block';
                    studentExtraFields.style.animation = 'none';
                    void studentExtraFields.offsetHeight;
                    studentExtraFields.style.animation = '';
                } else if (radio.value === 'teacher' && radio.checked) {
                    studentExtraFields.style.display = 'none';
                }
            });
        });
    }

    signupBtn.addEventListener('click', async () => {
        const fullname = document.getElementById('signup-fullname').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const role = document.querySelector('input[name="role"]:checked').value;

        if (!fullname || !email || !password) {
            showToast('Zəhmət olmasa bütün sahələri doldurun.', 'warning');
            return;
        }

        if (password.length < 7) {
            showToast('Şifrə ən azı 7 simvol olmalıdır.', 'warning');
            return;
        }

        // Student-specific validation & data collection
        let studentMeta = {};
        if (role === 'student') {
            const school = document.getElementById('signup-school').value.trim();
            const grade = document.getElementById('signup-grade').value;
            const group = document.getElementById('signup-group').value;
            const targetScore = document.getElementById('signup-target-score').value;
            const preparation = document.getElementById('signup-preparation').value;

            if (!grade || !group) {
                showToast('Zəhmət olmasa sinif və qrup seçin.', 'warning');
                return;
            }

            studentMeta = {
                school,
                grade,
                group,
                target_score: targetScore ? parseInt(targetScore) : null,
                preparation
            };
        }

        signupBtn.textContent = 'Gözləyin...';
        signupBtn.disabled = true;

        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { full_name: fullname, role: role, ...studentMeta }
            }
        });

        if (error) {
            showToast('Qeydiyyat xətası: ' + error.message, 'error');
            signupBtn.textContent = 'Hesab yarat';
            signupBtn.disabled = false;
            return;
        }

        if (data.user) {
            const { error: profileError } = await supabaseClient.from('profiles').insert([
                { id: data.user.id, role: role, full_name: fullname }
            ]);

            if (profileError) {
                showToast('Profil yaradılarkən xəta oldu!', 'error');
            } else {
                showToast('Qeydiyyat uğurla tamamlandı! Giriş edə bilərsiniz.', 'success');
                // FIX A2: Use safeNavigate instead of raw window.location.hash
                setTimeout(() => { safeNavigate('login'); }, 1500);
            }
        }

        signupBtn.textContent = 'Hesab yarat';
        signupBtn.disabled = false;
    });
}

// Setup Logout
// FIX A3: Corrected selector — only target elements that actually exist in the HTML
document.addEventListener('DOMContentLoaded', function () {
    // Use event delegation so dynamically rendered logout buttons also work
    document.body.addEventListener('click', async function(e) {
        const target = e.target.closest('#btn-logout, [data-action="logout"]');
        if (!target) return;
        e.preventDefault();
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            showToast('Çıxış xətası: ' + error.message, 'error');
        } else {
            window.currentUser = null;
            window.currentProfile = null;
            showToast('Hesabdan çıxış edildi.', 'info');
            safeNavigate('landing');
        }
    });
});
