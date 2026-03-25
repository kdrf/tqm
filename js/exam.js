// js/exam.js

let examQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let timeSpentOnQuestions = {}; // { questionId: seconds }
let questionStartTime = null;
let examInterval = null;
let timeRemaining = 0; // in seconds

async function initExam() {
    // If state is missing (e.g. page refresh), try to recover from Supabase
    if (!window.currentActiveTest || !window.currentActiveSession) {
        console.log("No active state. Attempting recovery...");
        const { data: { session: authSession } } = await supabaseClient.auth.getSession();
        if (authSession) {
            const userId = authSession.user.id;
            const { data: recoveredSess, error: recErr } = await supabaseClient
                .from('exam_sessions')
                .select('*, tests(*)')
                .eq('student_id', userId)
                .eq('status', 'in_progress')
                .order('started_at', { ascending: false })
                .limit(1)
                .single();

            if (!recErr && recoveredSess) {
                window.currentActiveSession = recoveredSess;
                window.currentActiveTest = recoveredSess.tests;
                console.log("Session recovered:", recoveredSess.id);
            }
        }
    }

    if (!window.currentActiveTest || !window.currentActiveSession) {
        console.error("No active test or session found.");
        document.getElementById('exam-questions-container').innerHTML = `
          <div style="text-align:center; padding: 40px; color:#64748b;">
            Davam edən imtahan tapılmadı. Zəhmət olmasa panelə qayıdıb yenidən başlayın.
            <br><br>
            <button onclick="window.navigateTo('student-dashboard')" style="background:#3b82f6; color:white; padding:8px 16px; border:none; border-radius:8px; cursor:pointer;">Panelə qayıt</button>
          </div>
        `;
        return;
    }

    // Reset state
    examQuestions = [];
    currentQuestionIndex = 0;
    userAnswers = {};
    timeSpentOnQuestions = {};
    questionStartTime = null;
    if (examInterval) clearInterval(examInterval);

    // Setup UI
    document.getElementById('active-exam-title').textContent = window.currentActiveTest.title;
    document.getElementById('exam-questions-container').innerHTML = `<div class="generating-state visible"><span class="spinner"></span> Suallar yüklənir...</div>`;
    document.getElementById('btn-prev-question').style.display = 'none';
    document.getElementById('btn-next-question').style.display = 'block';
    document.getElementById('btn-finish-exam').style.display = 'none';

    // Fetch Questions
    supabaseClient
        .from('questions')
        .select('*')
        .eq('test_id', window.currentActiveTest.id)
        .order('order_index', { ascending: true })
        .then(({ data: questions, error }) => {
            if (error || !questions || questions.length === 0) {
                document.getElementById('exam-questions-container').innerHTML = `
                  <div style="text-align:center; padding: 40px; color:#ef4444;">
                    Suallar tapılmadı və ya xəta baş verdi.
                  </div>
                `;
                return;
            }

            examQuestions = questions;
            examQuestions.forEach(q => { timeSpentOnQuestions[q.id] = 0; });
            questionStartTime = Date.now();

            startTimer(window.currentActiveTest.duration_minutes || 45);
            renderQuestion();
        });
}

function renderQuestion(isNew = true) {
    const container = document.getElementById('exam-questions-container');
    const q = examQuestions[currentQuestionIndex];
    if (!q) return;

    document.getElementById('exam-question-indicator').textContent = `Sual ${currentQuestionIndex + 1}`;

    // Ensure options array
    let options = [];
    if (typeof q.options === 'string') {
        try { options = JSON.parse(q.options); } catch(e) {}
    } else if (Array.isArray(q.options)) {
        options = q.options;
    }

    const html = `
        <div class="question-card" style="background:white; border-radius:16px; padding:32px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01); border:1px solid #f1f5f9; margin-bottom:24px;">
            <h3 style="font-size:18px; font-weight:700; line-height:1.6; color:#0f172a; margin-bottom:28px;">${currentQuestionIndex + 1}. ${q.question_text}</h3>
            <div class="options-list" style="display:flex; flex-direction:column; gap:12px;">
                ${options.map((opt, idx) => {
                    const isSelected = userAnswers[q.id] === idx;
                    return `
                    <div class="option-item ${isSelected ? 'selected' : ''}"
                         onclick="selectOption('${q.id}', ${idx})"
                         style="padding:16px 20px; border:2px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}; border-radius:12px; cursor:pointer; background:${isSelected ? '#eff6ff' : 'white'}; display:flex; align-items:center; gap:16px;">
                        <div style="width:24px; height:24px; border-radius:50%; border:2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}; background:${isSelected ? '#3b82f6' : 'white'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            ${isSelected ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                        </div>
                        <span style="font-size:15px; color:${isSelected ? '#1e3a8a' : '#334155'}; font-weight:${isSelected ? '600' : '500'}; line-height:1.5;">${opt}</span>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Toggle Buttons
    document.getElementById('btn-prev-question').style.display = currentQuestionIndex > 0 ? 'block' : 'none';
    document.getElementById('btn-next-question').style.display = currentQuestionIndex < examQuestions.length - 1 ? 'block' : 'none';
    document.getElementById('btn-finish-exam').style.display = 'block';
}

window.selectOption = function(questionId, optionIndex) {
    userAnswers[questionId] = optionIndex;
    renderQuestion(false);
};

// Helper to accumulate time for the current question
function accumulateTimeForCurrentQuestion() {
    const q = examQuestions[currentQuestionIndex];
    if (q && questionStartTime) {
        const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
        timeSpentOnQuestions[q.id] = (timeSpentOnQuestions[q.id] || 0) + elapsed;
    }
}

// Event Listeners for Buttons
document.addEventListener('DOMContentLoaded', () => {
    const btnNext = document.getElementById('btn-next-question');
    const btnPrev = document.getElementById('btn-prev-question');
    const btnFinish = document.getElementById('btn-finish-exam');

    if (btnNext) btnNext.addEventListener('click', () => {
        if (currentQuestionIndex < examQuestions.length - 1) {
            accumulateTimeForCurrentQuestion();
            currentQuestionIndex++;
            questionStartTime = Date.now();
            renderQuestion();
        }
    });

    if (btnPrev) btnPrev.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            accumulateTimeForCurrentQuestion();
            currentQuestionIndex--;
            questionStartTime = Date.now();
            renderQuestion();
        }
    });

    // FIX B2: Removed confirm() — direct finish on click
    if (btnFinish) btnFinish.addEventListener('click', () => {
        accumulateTimeForCurrentQuestion();
        finishExam();
    });
});

function startTimer(minutes) {
    timeRemaining = minutes * 60;
    updateTimerDisplay();

    examInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(examInterval);
            // FIX B1: Replaced blocking alert() with non-blocking toast
            if (typeof showToast === 'function') showToast('Vaxt bitdi! Cavablarınız avtomatik göndərilir.', 'warning');
            finishExam();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const badge = document.getElementById('exam-timer');
    if (!badge) return;

    let m = Math.floor(timeRemaining / 60);
    let s = timeRemaining % 60;
    badge.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    if (timeRemaining < 300) { // last 5 minutes
        badge.style.background = '#fee2e2';
        badge.style.color = '#ef4444';
    } else {
        badge.style.background = 'rgba(15, 23, 42, 0.05)';
        badge.style.color = '#475569';
    }
}

async function finishExam() {
    if (examInterval) clearInterval(examInterval);

    const container = document.getElementById('exam-questions-container');
    container.innerHTML = `<div class="generating-state visible"><span class="spinner"></span> Nəticələr hesablanır...</div>`;

    let correctCount = 0;
    let answeredCount = 0;
    const answerInserts = [];

    // Calculate score
    for (const q of examQuestions) {
        const selected = userAnswers[q.id];
        const isCorrect = (selected === q.correct_index);
        if (isCorrect) correctCount++;

        if (selected !== undefined) {
            answeredCount++;
            answerInserts.push({
                session_id: window.currentActiveSession.id,
                question_id: q.id,
                selected_index: selected,
                is_correct: isCorrect,
                time_spent_seconds: timeSpentOnQuestions[q.id] || 0
            });
        }
    }

    const totalQuestions = examQuestions.length;
    const wrongCount = answeredCount - correctCount;
    const unansweredCount = totalQuestions - answeredCount;
    let finalScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // Submit answers
    if (answerInserts.length > 0) {
        await supabaseClient.from('student_answers').insert(answerInserts);
    }

    const sessionId = window.currentActiveSession.id;
    const testTitle = window.currentActiveTest?.title || 'İmtahan';

    // Update Session
    await supabaseClient.from('exam_sessions')
        .update({
            score: finalScore,
            status: 'completed',
            finished_at: new Date().toISOString()
        })
        .eq('id', sessionId);

    if (typeof showToast === 'function') showToast('İmtahan bitdi! Nəticələr saxlanıldı.', 'success');

    // Store result summary for exam analysis page
    window.lastExamResult = {
        score: finalScore,
        correct: correctCount,
        wrong: wrongCount,
        unanswered: unansweredCount,
        total: totalQuestions,
        sessionId: sessionId,
        testTitle: testTitle
    };

    // Cleanup
    window.currentActiveTest = null;
    window.currentActiveSession = null;

    // FIX B4: Added '#' prefix so router correctly picks up the hash
    window.location.hash = '#student-exam-analysis';
}

// Hook into the router
window.initExamRoom = initExam;
