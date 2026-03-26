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

    // We can hide the global indicator since we will build it explicitly into the question header, like the mockup.
    const indicator = document.getElementById('exam-question-indicator');
    if (indicator) indicator.style.display = 'none';

    let options = [];
    if (typeof q.options === 'string') {
        try { options = JSON.parse(q.options); } catch(e) {}
    } else if (Array.isArray(q.options)) {
        options = q.options;
    }

    const labels = ['A variantı', 'B variantı', 'C variantı', 'D variantı', 'E variantı'];

    const html = `
        <div style="background: white; border-radius: 16px; padding: 48px; max-width: 800px; margin: 0 auto; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.03);">
            
            <!-- Top: Question Number -->
            <div style="font-size: 14px; font-weight: 600; color: #a78bfa; margin-bottom: 16px; font-family: 'Plus Jakarta Sans', sans-serif;">
                Sual ${currentQuestionIndex + 1}
            </div>

            <!-- Header: Question Text -->
            <div style="margin-bottom: 48px;">
                <h2 style="font-size: 18px; font-weight: 600; color: #334155; line-height: 1.7; margin: 0; font-family: 'Inter', sans-serif;">
                    ${q.question_text}
                </h2>
            </div>

            <!-- Options List -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${options.map((opt, idx) => {
                    const isSelected = userAnswers[q.id] === idx;
                    const defaultLabel = String.fromCharCode(65 + idx) + ' variantı'; // e.g. "A variantı"
                    const label = labels[idx] || defaultLabel;
                    
                    const bg = isSelected ? '#ffffff' : '#ffffff';
                    const shadow = isSelected ? '0 8px 20px -6px rgba(124, 58, 237, 0.15)' : 'none';
                    const border = isSelected ? '1px solid white' : '1px solid #f1f5f9';
                    const leftBorder = isSelected ? '4px solid #7c3aed' : '4px solid transparent';
                    const textColor = isSelected ? '#334155' : '#94a3b8';

                    // Custom Radio Button
                    const radioBorder = isSelected ? '2px solid #7c3aed' : '2px solid #cbd5e1';
                    const radioInner = isSelected ? '<div style="width:10px; height:10px; background:#7c3aed; border-radius:50%;"></div>' : '';

                    return `
                    <div onclick="selectOption('${q.id}', ${idx})" 
                         style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; background: ${bg}; border: ${border}; border-left: ${leftBorder}; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; box-shadow: ${shadow};">
                        
                        <div style="font-size: 16px; color: ${textColor}; font-weight: ${isSelected ? '600' : '500'}; line-height: 1.5; padding-right: 16px; display: flex; text-align: left;">
                            <span style="min-width: 80px; margin-right: 8px;">${label}</span>
                            <span>${opt}</span>
                        </div>

                        <!-- Custom Radio Circle -->
                        <div style="width: 22px; height: 22px; border-radius: 50%; border: ${radioBorder}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s ease;">
                            ${radioInner}
                        </div>
                        
                    </div>
                    `;
                }).join('')}
            </div>

        </div>
    `;

    container.innerHTML = html;

    // Toggle Navigation Buttons
    const btnPrev = document.getElementById('btn-prev-question');
    const btnNext = document.getElementById('btn-next-question');
    const btnFinish = document.getElementById('btn-finish-exam');

    if (btnPrev) btnPrev.style.display = currentQuestionIndex > 0 ? 'inline-flex' : 'none';
    
    // Always show finish button now, as requested.
    if (btnFinish) btnFinish.style.display = 'inline-flex';

    if (currentQuestionIndex < examQuestions.length - 1) {
        if (btnNext) btnNext.style.display = 'inline-flex';
    } else {
        if (btnNext) btnNext.style.display = 'none';
    }
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
