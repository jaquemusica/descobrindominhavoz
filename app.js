// ==============================
// VOCALISTA — App Principal
// ==============================

const App = (() => {

  // Estado global
  let state = {
    currentUser: null,
    currentScreen: 'login',
    previousScreen: null,
    currentModule: null,
    currentExerciseIndex: 0,
    isPlaying: false,
    timerInterval: null,
    timerSeconds: 0,
    pitchHistory: [],
    sessionData: null,
    viewingStudentId: null,
  };

  // ======= NAVEGAÇÃO =======

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if (screen) {
      screen.classList.add('active');
      state.previousScreen = state.currentScreen;
      state.currentScreen = id;
    }
  }

  function goTo(page) {
    stopPlayback();
    const map = {
      'home':           'screen-home',
      'exercises':      'screen-exercises',
      'progress':       'screen-progress',
      'profile':        'screen-profile',
      'teacher':        'screen-teacher',
      'player':         'screen-player',
      'diagnosis':      'screen-diagnosis',
      'student-detail': 'screen-student-detail',
    };
    if (map[page]) showScreen(map[page]);
  }

  function goBack() {
    stopPlayback();
    if (state.previousScreen) showScreen(state.previousScreen);
    else goTo('home');
  }

  // ======= AUTENTICAÇÃO =======

  function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const user = DATA.users.find(u => u.email === email && u.password === password);

    if (!user) {
      alert('E-mail ou senha incorretos.');
      return;
    }

    state.currentUser = JSON.parse(JSON.stringify(user)); // cópia profunda
    loadUserSession();

    if (user.role === 'teacher') {
      renderTeacherPanel();
      showScreen('screen-teacher');
    } else {
      renderHome();
      showScreen('screen-home');
    }
  }

  function register() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!name || !email || !password) {
      alert('Preencha todos os campos.');
      return;
    }

    const exists = DATA.users.find(u => u.email === email);
    if (exists) {
      alert('Este e-mail já está cadastrado.');
      return;
    }

    const newUser = {
      id: 'student_' + Date.now(),
      name,
      email,
      password,
      role: 'student',
      unlockedModules: ['respiracao'], // primeiro módulo sempre liberado
      progress: { exercises: 0, pitchAvg: 0, streak: 0 },
      history: [],
    };

    DATA.users.push(newUser);
    state.currentUser = JSON.parse(JSON.stringify(newUser));
    renderHome();
    showScreen('screen-home');
  }

  function logout() {
    stopPlayback();
    state.currentUser = null;
    showScreen('screen-login');
  }

  // ======= PERSISTÊNCIA LOCAL =======

  function loadUserSession() {
    const saved = localStorage.getItem('vocalista_' + state.currentUser.id);
    if (saved) {
      const data = JSON.parse(saved);
      state.currentUser.progress = data.progress || state.currentUser.progress;
      state.currentUser.history = data.history || [];
      state.currentUser.unlockedModules = data.unlockedModules || state.currentUser.unlockedModules;
    }
  }

  function saveUserSession() {
    if (!state.currentUser) return;
    localStorage.setItem('vocalista_' + state.currentUser.id, JSON.stringify({
      progress: state.currentUser.progress,
      history: state.currentUser.history,
      unlockedModules: state.currentUser.unlockedModules,
    }));
  }

  // ======= TELA HOME =======

  function renderHome() {
    const user = state.currentUser;
    if (!user) return;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const firstName = user.name.split(' ')[0];
    document.getElementById('home-greeting').textContent = `${greeting}, ${firstName}!`;

    // Stats
    document.getElementById('stat-exercises').textContent = user.progress.exercises || 0;
    document.getElementById('stat-pitch').textContent = user.progress.pitchAvg ? user.progress.pitchAvg + '%' : '—';
    document.getElementById('stat-streak').textContent = (user.progress.streak || 0) + 'd';

    // Aula do dia — próximo exercício não concluído
    const nextLesson = getNextLesson();
    if (nextLesson) {
      document.getElementById('today-lesson-title').textContent = nextLesson.exercise.name;
      document.getElementById('today-lesson-sub').textContent = nextLesson.module.name + ' · ' + nextLesson.exercise.description;
    }

    // Módulos
    renderModulesGrid();
  }

  function getNextLesson() {
    const user = state.currentUser;
    for (const mod of DATA.modules) {
      if (!user.unlockedModules.includes(mod.id)) continue;
      for (const ex of mod.exercises) {
        const done = user.history.find(h => h.exerciseId === ex.id);
        if (!done) return { module: mod, exercise: ex };
      }
    }
    // Se tudo concluído, retorna o primeiro
    const firstMod = DATA.modules.find(m => user.unlockedModules.includes(m.id));
    if (firstMod) return { module: firstMod, exercise: firstMod.exercises[0] };
    return null;
  }

  function renderModulesGrid() {
    const user = state.currentUser;
    const grid = document.getElementById('modules-grid');
    if (!grid) return;

    grid.innerHTML = DATA.modules.map(mod => {
      const unlocked = user.unlockedModules.includes(mod.id);
      const done = mod.exercises.filter(e => user.history.find(h => h.exerciseId === e.id)).length;
      const total = mod.exercises.length;

      return `
        <div class="module-card ${unlocked ? '' : 'locked'}" 
             onclick="${unlocked ? `App.openModule('${mod.id}')` : ''}">
          ${unlocked
            ? `<div class="module-badge">Ativo</div>`
            : `<svg class="module-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`
          }
          <div class="module-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${mod.emoji === '🫁' ? '<path d="M12 2v20M8 6c0 0-4 2-4 8s4 6 4 6M16 6c0 0 4 2 4 8s-4 6-4 6"/>' :
                mod.emoji === '🎵' ? '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' :
                mod.emoji === '👄' ? '<path d="M12 19c-4 0-8-1.5-8-5v-2h16v2c0 3.5-4 5-8 5z"/><path d="M8 12V7a4 4 0 018 0v5"/>' :
                mod.emoji === '🎶' ? '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/>' :
                mod.emoji === '⚡' ? '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' :
                '<path d="M9 18V5l12-2v13M5 3v18M19 1v18"/>'}
            </svg>
          </div>
          <h4>${mod.name}</h4>
          <p>${unlocked ? `${done}/${total} exercícios` : 'Bloqueado'}</p>
        </div>
      `;
    }).join('');
  }

  function startTodayLesson() {
    const next = getNextLesson();
    if (next) openExercise(next.module, next.exercise, 0);
  }

  // ======= TELA EXERCÍCIOS =======

  function renderExercisesList() {
    const user = state.currentUser;
    const container = document.getElementById('exercises-list');
    if (!container) return;

    container.innerHTML = DATA.modules.map(mod => {
      const unlocked = user.unlockedModules.includes(mod.id);
      const exercises = mod.exercises.map((ex, idx) => {
        const done = user.history.find(h => h.exerciseId === ex.id);
        return `
          <div class="ex-card ${unlocked ? '' : 'locked'}"
               onclick="${unlocked ? `App.openExerciseById('${mod.id}', ${idx})` : ''}">
            <div class="ex-card-icon">${mod.emoji}</div>
            <div class="ex-card-info">
              <h4>${ex.name}</h4>
              <p>${ex.description}${done ? ' · ✓ Concluído' : ''}</p>
            </div>
            ${!unlocked ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B0A8CC" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="ex-category">
          <div class="ex-category-title">${mod.emoji} ${mod.name}</div>
          ${exercises}
        </div>
      `;
    }).join('');
  }

  function openModule(moduleId) {
    goTo('exercises');
    setTimeout(() => {
      const el = document.querySelector(`[data-module="${moduleId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function openExerciseById(moduleId, exerciseIndex) {
    const mod = DATA.modules.find(m => m.id === moduleId);
    if (!mod) return;
    const ex = mod.exercises[exerciseIndex];
    if (!ex) return;
    openExercise(mod, ex, exerciseIndex);
  }

  function openExercise(mod, ex, index) {
    state.currentModule = mod;
    state.currentExerciseIndex = index;
    state.pitchHistory = [];
    state.isPlaying = false;

    document.getElementById('player-breadcrumb').textContent =
      `${mod.name} · Exercício ${index + 1} de ${mod.exercises.length}`;
    document.getElementById('player-title').textContent = ex.name;
    document.getElementById('player-instruction').textContent = ex.instruction;
    document.getElementById('pitch-note').textContent = '—';
    document.getElementById('pitch-status').textContent = 'Pressione play para começar';
    document.getElementById('pitch-bar').style.width = '0%';
    document.getElementById('timer-display').textContent = '0:00';

    // Reset play/pause icons
    document.getElementById('play-icon').style.display = '';
    document.getElementById('pause-icon').style.display = 'none';

    resetWaveform();
    showScreen('screen-player');
  }

  // ======= PLAYER =======

  function togglePlay() {
    if (state.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    state.isPlaying = true;
    document.getElementById('play-icon').style.display = 'none';
    document.getElementById('pause-icon').style.display = '';
    startTimer();
    startWaveAnimation();

    PitchDetector.start(
      ({ freq, score, noteInfo }) => {
        if (!state.isPlaying) return;

        if (noteInfo) {
          document.getElementById('pitch-note').textContent = noteInfo.display;
          document.getElementById('pitch-bar').style.width = score + '%';
          document.getElementById('pitch-status').textContent = `Afinação: ${score}%`;
          state.pitchHistory.push(score);
        } else {
          document.getElementById('pitch-note').textContent = '—';
          document.getElementById('pitch-status').textContent = 'Cante algo...';
        }
      },
      (err) => {
        console.warn('Microfone não disponível:', err);
        document.getElementById('pitch-status').textContent = 'Microfone não disponível';
        // Simulação para demo
        startPitchSimulation();
      }
    );
  }

  function pausePlayback() {
    state.isPlaying = false;
    document.getElementById('play-icon').style.display = '';
    document.getElementById('pause-icon').style.display = 'none';
    stopTimer();
    stopWaveAnimation();
    PitchDetector.stop();
  }

  function stopPlayback() {
    if (state.isPlaying) {
      state.isPlaying = false;
      stopTimer();
      stopWaveAnimation();
      PitchDetector.stop();
    }
  }

  // Simulação de pitch para demo (quando mic não disponível)
  let simInterval = null;
  function startPitchSimulation() {
    const notes = ['C4','D4','E4','F4','G4','A4','B4','C5'];
    simInterval = setInterval(() => {
      if (!state.isPlaying) { clearInterval(simInterval); return; }
      const note = notes[Math.floor(Math.random() * notes.length)];
      const score = Math.floor(55 + Math.random() * 40);
      document.getElementById('pitch-note').textContent = note;
      document.getElementById('pitch-bar').style.width = score + '%';
      document.getElementById('pitch-status').textContent = `Afinação: ${score}% (simulado)`;
      state.pitchHistory.push(score);
    }, 500);
  }

  function prevExercise() {
    if (!state.currentModule) return;
    stopPlayback();
    const newIdx = Math.max(0, state.currentExerciseIndex - 1);
    const ex = state.currentModule.exercises[newIdx];
    openExercise(state.currentModule, ex, newIdx);
  }

  function nextExercise() {
    if (!state.currentModule) return;
    stopPlayback();
    const newIdx = Math.min(state.currentModule.exercises.length - 1, state.currentExerciseIndex + 1);
    const ex = state.currentModule.exercises[newIdx];
    openExercise(state.currentModule, ex, newIdx);
  }

  function finishExercise() {
    stopPlayback();

    const user = state.currentUser;
    const mod = state.currentModule;
    const ex = mod.exercises[state.currentExerciseIndex];

    // Calcula métricas
    const avgPitch = state.pitchHistory.length
      ? Math.round(state.pitchHistory.reduce((a, b) => a + b, 0) / state.pitchHistory.length)
      : Math.floor(60 + Math.random() * 30); // fallback demo

    const sustain = Math.round(Math.min(100, avgPitch + Math.random() * 15));
    const breath = Math.round(Math.max(30, avgPitch - Math.random() * 20));
    const overall = Math.round((avgPitch + sustain + breath) / 3);
    const prevBest = user.history.filter(h => h.exerciseId === ex.id)
      .reduce((max, h) => Math.max(max, h.score || 0), 0);
    const evolution = overall - prevBest;

    // Seleciona feedback aleatório do banco
    const feedbacks = ex.feedbacks || ['Bom trabalho! Continue praticando.'];
    const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];

    // Salva no histórico
    const session = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      moduleName: mod.name,
      score: overall,
      pitch: avgPitch,
      sustain,
      breath,
      durationSeconds: state.timerSeconds,
      date: new Date().toISOString(),
    };

    user.history.unshift(session);
    user.progress.exercises = (user.progress.exercises || 0) + 1;
    user.progress.pitchAvg = Math.round(
      user.history.reduce((a, h) => a + (h.pitch || 0), 0) / user.history.length
    );
    user.progress.streak = (user.progress.streak || 0) + 1;

    saveUserSession();

    // Renderiza diagnóstico
    renderDiagnosis({
      subtitle: `${ex.name} · ${mod.name}`,
      overall, avgPitch, sustain, breath, evolution, feedback
    });

    goTo('diagnosis');
  }

  // ======= DIAGNÓSTICO =======

  function renderDiagnosis({ subtitle, overall, avgPitch, sustain, breath, evolution, feedback }) {
    document.getElementById('diag-subtitle').textContent = subtitle;
    document.getElementById('score-center').textContent = overall + '%';
    document.getElementById('m-pitch').textContent = avgPitch + '%';
    document.getElementById('m-sustain').textContent = sustain + '%';
    document.getElementById('m-breath').textContent = breath + '%';
    document.getElementById('m-evolution').textContent = (evolution >= 0 ? '+' : '') + evolution + '%';
    document.getElementById('feedback-text').textContent = feedback;

    // Anima o anel SVG
    setTimeout(() => {
      const circle = document.getElementById('score-circle');
      const circumference = 251.2;
      const offset = circumference - (overall / 100) * circumference;
      circle.style.transition = 'stroke-dashoffset 1s ease';
      circle.style.strokeDashoffset = offset;
    }, 200);

    // Anima as barras
    setTimeout(() => {
      document.getElementById('mf-pitch').style.width = avgPitch + '%';
      document.getElementById('mf-sustain').style.width = sustain + '%';
      document.getElementById('mf-breath').style.width = breath + '%';
      document.getElementById('mf-evolution').style.width = Math.min(100, Math.abs(evolution) * 3) + '%';
    }, 400);
  }

  // ======= PROGRESSO =======

  function renderProgress() {
    const user = state.currentUser;
    const list = document.getElementById('history-list');
    if (!list) return;

    if (!user.history || user.history.length === 0) {
      list.innerHTML = '<div class="empty-state">Nenhuma sessão registrada ainda.<br>Complete um exercício para começar!</div>';
      return;
    }

    list.innerHTML = user.history.slice(0, 20).map(h => {
      const date = new Date(h.date);
      const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return `
        <div class="history-item">
          <div class="history-item-left">
            <h4>${h.exerciseName}</h4>
            <p>${h.moduleName} · ${dateStr}</p>
          </div>
          <div class="history-score">${h.score}%</div>
        </div>
      `;
    }).join('');
  }

  // ======= PERFIL =======

  function renderProfile() {
    const user = state.currentUser;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('profile-avatar').textContent = initials;
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-email').textContent = user.email;
  }

  // ======= PAINEL PROFESSORA =======

  function loadStudentData(s) {
    const saved = localStorage.getItem('vocalista_' + s.id);
    if (saved) {
      const data = JSON.parse(saved);
      s.progress = data.progress || s.progress;
      s.unlockedModules = data.unlockedModules || s.unlockedModules;
      s.history = data.history || s.history || [];
    }
    return s;
  }

  function daysSinceLastPractice(s) {
    if (!s.history || s.history.length === 0) return 999;
    const last = new Date(s.history[0].date);
    const now = new Date();
    return Math.floor((now - last) / (1000 * 60 * 60 * 24));
  }

  function practicedToday(s) {
    if (!s.history || s.history.length === 0) return false;
    const last = new Date(s.history[0].date);
    const now = new Date();
    return last.toDateString() === now.toDateString();
  }

  function weekMinutes(s) {
    if (!s.history || s.history.length === 0) return 0;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return s.history
      .filter(h => new Date(h.date) >= weekAgo)
      .reduce((acc, h) => acc + (h.durationSeconds || 0), 0);
  }

  function renderTeacherPanel() {
    const teacher = state.currentUser;
    const studentIds = teacher.students || [];
    const students = DATA.users
      .filter(u => studentIds.includes(u.id))
      .map(s => loadStudentData(JSON.parse(JSON.stringify(s))));

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const firstName = teacher.name.split(' ')[0];
    const greetEl = document.getElementById('teacher-greeting');
    if (greetEl) greetEl.textContent = `${greeting}, ${firstName}!`;

    document.getElementById('teacher-subtitle').textContent =
      `${students.length} aluno${students.length !== 1 ? 's' : ''} ativo${students.length !== 1 ? 's' : ''}`;

    const activeToday = students.filter(s => practicedToday(s)).length;
    const inactive = students.filter(s => daysSinceLastPractice(s) >= 3).length;
    document.getElementById('tstat-active').textContent = activeToday;
    document.getElementById('tstat-inactive').textContent = inactive;
    const warnBox = document.getElementById('tstat-warn-box');
    if (warnBox) warnBox.classList.toggle('warn-active', inactive > 0);

    const list = document.getElementById('students-list');
    if (!list) return;

    list.innerHTML = students.map(s => {
      const unlocked = s.unlockedModules.length;
      const total = DATA.modules.length;
      const pct = Math.round((unlocked / total) * 100);
      const initials = s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const days = daysSinceLastPractice(s);
      const mins = weekMinutes(s);
      const minsStr = mins >= 60
        ? Math.floor(mins / 60) + 'h' + (mins % 60 ? (mins % 60) + 'min' : '')
        : mins + 'min';

      let badgeHtml = '';
      if (practicedToday(s)) {
        badgeHtml = `<span class="student-badge badge-ok">Praticou hoje</span>`;
      } else if (days >= 3) {
        badgeHtml = `<span class="student-badge badge-warn">${days}d sem praticar</span>`;
      } else {
        badgeHtml = `<span class="student-badge badge-neutral">Há ${days}d</span>`;
      }

      const moduleTagsHtml = s.unlockedModules.map(id => {
        const mod = DATA.modules.find(m => m.id === id);
        return mod ? `<span class="module-tag">${mod.name}</span>` : '';
      }).join('');

      return `
        <div class="student-card-teacher" onclick="App.openStudentDetail('${s.id}')">
          <div class="student-card-top">
            <div class="student-avatar">${initials}</div>
            <div class="student-card-info">
              <div class="student-name">${s.name} ${badgeHtml}</div>
              <div class="student-meta">${s.progress.exercises || 0} exercícios · ${minsStr} essa semana</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:.4"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="student-prog-wrap">
            <div class="student-prog" style="width:${pct}%"></div>
          </div>
          <div class="student-card-bottom">
            <div class="student-metrics-mini">
              <span class="mini-metric"><strong>${s.progress.pitchAvg || '—'}${s.progress.pitchAvg ? '%' : ''}</strong> afinação</span>
              <span class="mini-metric"><strong>${s.progress.streak || 0}d</strong> sequência</span>
              <span class="mini-metric"><strong>${unlocked}/${total}</strong> módulos</span>
            </div>
          </div>
          <div class="module-tags-row">${moduleTagsHtml}</div>
        </div>
      `;
    }).join('');
  }

  function openStudentDetail(studentId) {
    const raw = DATA.users.find(u => u.id === studentId);
    if (!raw) return;
    const s = loadStudentData(JSON.parse(JSON.stringify(raw)));
    state.viewingStudentId = studentId;

    document.getElementById('detail-name').textContent = s.name;
    document.getElementById('detail-email').textContent = s.email;

    const days = daysSinceLastPractice(s);
    const mins = weekMinutes(s);
    const minsStr = mins >= 60
      ? Math.floor(mins / 60) + 'h' + (mins % 60 ? (mins % 60) + 'min' : '')
      : mins + 'min';

    document.getElementById('detail-metrics').innerHTML = `
      <div class="detail-metrics-grid">
        <div class="detail-metric-box">
          <div class="detail-metric-val">${s.progress.pitchAvg || '—'}${s.progress.pitchAvg ? '%' : ''}</div>
          <div class="detail-metric-lbl">Afinação média</div>
        </div>
        <div class="detail-metric-box">
          <div class="detail-metric-val">${s.progress.streak || 0}d</div>
          <div class="detail-metric-lbl">Sequência atual</div>
        </div>
        <div class="detail-metric-box">
          <div class="detail-metric-val">${s.progress.exercises || 0}</div>
          <div class="detail-metric-lbl">Total exercícios</div>
        </div>
        <div class="detail-metric-box ${days >= 3 ? 'metric-warn' : ''}">
          <div class="detail-metric-val">${days === 999 ? 'nunca' : days + 'd'}</div>
          <div class="detail-metric-lbl">Última prática</div>
        </div>
        <div class="detail-metric-box">
          <div class="detail-metric-val">${minsStr}</div>
          <div class="detail-metric-lbl">Esta semana</div>
        </div>
        <div class="detail-metric-box">
          <div class="detail-metric-val">${s.unlockedModules.length}/${DATA.modules.length}</div>
          <div class="detail-metric-lbl">Módulos</div>
        </div>
      </div>
    `;

    document.getElementById('detail-modules').innerHTML = DATA.modules.map(mod => {
      const unlocked = s.unlockedModules.includes(mod.id);
      const done = (s.history || []).filter(h =>
        mod.exercises.some(e => e.id === h.exerciseId)
      ).length;
      const total = mod.exercises.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return `
        <div class="detail-module-item ${unlocked ? '' : 'locked'}">
          <span class="detail-module-emoji">${mod.emoji}</span>
          <div class="detail-module-info">
            <div class="detail-module-name">${mod.name}</div>
            ${unlocked
              ? `<div class="detail-module-sub">${done}/${total} exercícios · ${pct}%</div>
                 <div class="detail-module-bar"><div class="detail-module-fill" style="width:${pct}%"></div></div>`
              : `<div class="detail-module-sub" style="opacity:.5">Bloqueado</div>`
            }
          </div>
          ${!unlocked ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>` : ''}
        </div>
      `;
    }).join('');

    const history = s.history || [];
    document.getElementById('detail-history').innerHTML = history.length === 0
      ? `<div class="empty-state">Nenhuma sessão ainda.</div>`
      : history.slice(0, 30).map(h => {
          const date = new Date(h.date);
          const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const mod = DATA.modules.find(m => m.exercises.some(e => e.id === h.exerciseId));
          const modName = mod ? mod.name : h.moduleName || '—';
          const scoreColor = h.score >= 80 ? 'score-good' : h.score >= 60 ? 'score-mid' : 'score-low';
          return `
            <div class="history-item-detail">
              <div class="history-item-left">
                <div class="history-ex-name">${h.exerciseName}</div>
                <div class="history-ex-meta">${modName} · ${dateStr} às ${timeStr}</div>
                <div class="history-ex-metrics">
                  <span>Afinação: <strong>${h.pitch || '—'}${h.pitch ? '%' : ''}</strong></span>
                  <span>Sustentação: <strong>${h.sustain || '—'}${h.sustain ? '%' : ''}</strong></span>
                </div>
              </div>
              <div class="history-score ${scoreColor}">${h.score}%</div>
            </div>
          `;
        }).join('');

    const nextMod = DATA.modules.find(m => !s.unlockedModules.includes(m.id));
    const btn = document.getElementById('detail-unlock-btn');
    if (btn) {
      if (nextMod) {
        btn.textContent = `Liberar: ${nextMod.emoji} ${nextMod.name}`;
        btn.onclick = () => unlockNextModule(studentId);
        btn.disabled = false;
        btn.style.opacity = '1';
      } else {
        btn.textContent = 'Todos os módulos liberados!';
        btn.disabled = true;
        btn.style.opacity = '0.5';
      }
    }

    showScreen('screen-student-detail');
  }

  function unlockNextModule(studentId) {
    const student = DATA.users.find(u => u.id === studentId);
    if (!student) return;

    const saved = localStorage.getItem('vocalista_' + studentId);
    if (saved) {
      const data = JSON.parse(saved);
      student.unlockedModules = data.unlockedModules || student.unlockedModules;
    }

    const next = DATA.modules.find(m => !student.unlockedModules.includes(m.id));
    if (!next) {
      alert(`${student.name} já tem todos os módulos liberados!`);
      return;
    }

    student.unlockedModules.push(next.id);

    const existing = saved ? JSON.parse(saved) : {};
    existing.unlockedModules = student.unlockedModules;
    localStorage.setItem('vocalista_' + studentId, JSON.stringify(existing));

    alert(`Módulo "${next.name}" liberado para ${student.name}!`);
    openStudentDetail(studentId);
  }

  // ======= TIMER =======

  function startTimer() {
    state.timerSeconds = 0;
    state.timerInterval = setInterval(() => {
      state.timerSeconds++;
      const m = Math.floor(state.timerSeconds / 60);
      const s = state.timerSeconds % 60;
      const el = document.getElementById('timer-display');
      if (el) el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  // ======= WAVEFORM =======

  function startWaveAnimation() {
    document.querySelectorAll('.wave-bar').forEach(b => b.classList.add('playing'));
  }

  function stopWaveAnimation() {
    document.querySelectorAll('.wave-bar').forEach(b => b.classList.remove('playing'));
  }

  function resetWaveform() {
    document.querySelectorAll('.wave-bar').forEach(b => b.classList.remove('playing'));
  }

  // ======= INIT =======

  function init() {
    // Renderiza telas quando navegamos para elas
    document.addEventListener('click', (e) => {
      const screen = document.querySelector('.screen.active');
      if (!screen) return;

      if (screen.id === 'screen-exercises') renderExercisesList();
      if (screen.id === 'screen-progress') renderProgress();
      if (screen.id === 'screen-profile') renderProfile();
      if (screen.id === 'screen-teacher') renderTeacherPanel();
    });

    // Registra service worker para PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // Inicia ao carregar
  window.addEventListener('DOMContentLoaded', init);

  // API pública
  return {
    login, register, logout,
    showScreen, goTo, goBack,
    openModule, openExerciseById, openExercise,
    startTodayLesson,
    togglePlay, prevExercise, nextExercise, finishExercise,
    unlockNextModule, openStudentDetail,
    renderHome, renderExercisesList, renderProgress, renderProfile, renderTeacherPanel,
  };

})();
