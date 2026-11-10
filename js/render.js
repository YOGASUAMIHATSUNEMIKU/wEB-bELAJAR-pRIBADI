import { escapeHtml, getSelectedCourseName, findCourseColor, countStats } from './helpers.js';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function renderStats(state) {
  const stats = countStats(state.notes);
  const shell = document.getElementById('statsRow');
  if (!shell) return;
  const total = stats.total;
  const improvedPct = total ? Math.round((stats.improved / total) * 100) : 0;
  const cards = [
    { label: 'Total Catatan', value: total, delta: total ? `+${stats.diffThisWeek} minggu ini` : 'Belum ada catatan' },
    { label: 'Mata Kuliah Aktif', value: stats.activeCourses, delta: total ? `${state.user.totalSks || 0} SKS total` : '0 SKS total' },
    { label: 'AI Disempurnakan', value: `${stats.improved} / ${total}`, delta: total ? `${improvedPct}%` : '0%' },
    { label: 'Streak', value: `${state.user.streakTarget || 0} hari`, delta: total ? 'target' : 'target' }
  ];

  shell.innerHTML = cards.map((card) => `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(card.label)}</div>
      <div class="stat-value">
        <strong>${escapeHtml(String(card.value))}</strong>
        <span class="delta">${escapeHtml(card.delta)}</span>
      </div>
    </div>
  `).join('');
}

export function renderCourseChips(state) {
  const container = document.getElementById('courseChips');
  if (!container) return;
  container.innerHTML = state.courses.map((course, index) => `
    <button class="mini-chip ${index === 0 ? 'active' : ''}" type="button" data-course-id="${escapeHtml(course.id)}">${escapeHtml(course.name)}</button>
  `).join('');
}

export function renderFileUploads(state) {
  const container = document.getElementById('uploadList');
  if (!container) return;
  container.innerHTML = state.uploads.map((upload) => {
    const statusClass = upload.status === 'Mengekstrak' ? 'extracting' : upload.status === 'OCR Diekstrak' ? 'ocr' : upload.status === 'Gagal' ? 'failed' : 'ready';
    const confidence = upload.confidence ? ` · ${upload.confidence}%` : '';
    const progress = typeof upload.progress === 'number' ? Math.min(100, Math.max(0, upload.progress)) : upload.status === 'OCR Diekstrak' ? 100 : upload.status === 'Siap Dianalisis' ? 100 : 35;
    return `
      <div class="upload-item" data-upload-name="${escapeHtml(upload.name)}">
        <div style="flex:1; min-width:0;">
          <div><strong>${escapeHtml(upload.name)}</strong></div>
          <div class="muted">${escapeHtml(upload.size)}${escapeHtml(confidence)}</div>
          <div class="upload-progress"><span style="width:${progress}%"></span></div>
        </div>
        <div class="status-badge ${statusClass}">${escapeHtml(upload.status)}</div>
      </div>
    `;
  }).join('');
}

export function renderTodayNotes(state) {
  const container = document.getElementById('todaysNotesList');
  if (!container) return;
  if (!state.notes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Belum ada catatan</h3>
        <p class="muted">Tulis catatan pertamamu di panel Hari Ini untuk mulai melacak progres belajar.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.notes.map((note) => `
    <div class="note-row" data-note-id="${escapeHtml(note.id || '')}">
      <div class="row-head">
        <div class="course-mark">
          <span class="dot" style="background:${escapeHtml(findCourseColor(note.courseId, state.courses))};"></span>
          ${escapeHtml(getSelectedCourseName(note.courseId, state.courses))}
        </div>
        <span class="muted">${escapeHtml(note.time)}</span>
      </div>
      <div class="note-title">${escapeHtml(note.title)}</div>
      <div class="snippet">${escapeHtml(note.snippet)}</div>
      <div class="note-meta">
        <span class="language-pill">${escapeHtml(note.language)}</span>
        <span>${escapeHtml(note.status)}</span>
      </div>
    </div>
  `).join('');
}

export function renderTips(state) {
  const container = document.getElementById('tipsList');
  if (!container) return;
  if (!state.tips.length) {
    container.innerHTML = '<div class="tip-item"><span>Belum ada tips AI. Tulis catatan pertama untuk menghasilkan saran personal.</span><span class="muted">AI</span></div>';
    return;
  }

  container.innerHTML = state.tips.map((tip) => `
    <div class="tip-item"><span>${escapeHtml(tip)}</span><span class="muted">AI</span></div>
  `).join('');
}

export function renderDistribution(state) {
  const container = document.getElementById('distributionList');
  if (!container) return;
  if (!state.distribution.length) {
    container.innerHTML = '<div class="distribution-item"><span>Belum ada data belajar</span><span class="muted">0%</span></div>';
    return;
  }

  container.innerHTML = state.distribution.map((item) => `
    <div class="distribution-item">
      <span>${escapeHtml(item.name)}</span>
      <div style="width:120px">
        <div class="bar"><span style="width:${escapeHtml(String(item.value))}%"></span></div>
      </div>
    </div>
  `).join('');
}

export function renderLibraryCards(state) {
  const container = document.getElementById('libraryCards');
  if (!container) return;
  if (!state.notes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Perpustakaan masih kosong</h3>
        <p class="muted">Belum ada catatan tersimpan. Tulis satu catatan pertama untuk memulai progres belajar.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.notes.map((note) => `
    <article class="library-card" data-note-id="${escapeHtml(note.id || '')}" style="cursor:pointer; ${state.selectedNoteId === note.id ? 'outline:2px solid var(--accent);' : ''}">
      <div class="thumb">${escapeHtml(note.language || 'Catatan')}</div>
      <div>
        <div class="library-card-header">
          <div class="course-mark">
            <span class="dot" style="background:${escapeHtml(findCourseColor(note.courseId, state.courses))};"></span>
            ${escapeHtml(getSelectedCourseName(note.courseId, state.courses))}
          </div>
          <span class="muted">${escapeHtml(note.date)}</span>
        </div>
        <h3 style="margin:10px 0 8px;">${escapeHtml(note.title)}</h3>
        <div class="tag-row">
          ${(note.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('') || '<span class="tag">umum</span>'}
        </div>
        <div class="library-footer">
          <span>📎 ${escapeHtml(String(note.attachments))} lampiran</span>
          <span>🔖 ${escapeHtml(note.bookmark ? 'Disimpan' : 'Belum')}</span>
          <span>⏱ ${escapeHtml(note.time)}</span>
        </div>
      </div>
      <button class="bookmark" data-bookmark-note-id="${escapeHtml(note.id || '')}" aria-label="Bookmark catatan" style="${note.bookmark ? 'color: var(--warning); background: rgba(215,125,47,0.14);' : ''}">★</button>
    </article>
  `).join('');
}

export function renderProfileSummary(state) {
  const initials = state.user.name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'NA';
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const sidebarName = document.getElementById('sidebarName');
  const sidebarProgram = document.getElementById('sidebarProgram');
  const sidebarSemester = document.getElementById('sidebarSemester');
  const semesterChip = document.getElementById('semesterChip');
  const streakChip = document.getElementById('streakChip');
  const greeting = document.getElementById('greetingHeading');

  if (sidebarAvatar) sidebarAvatar.textContent = initials;
  if (sidebarName) sidebarName.textContent = state.user.name;
  if (sidebarProgram) sidebarProgram.textContent = state.user.program;
  if (sidebarSemester) sidebarSemester.textContent = `Semester ${state.user.semester}`;
  if (semesterChip) semesterChip.textContent = `Semester ${state.user.semester}`;
  if (streakChip) streakChip.textContent = `🔥 ${state.user.streakTarget || 0} hari`;
  if (greeting) greeting.textContent = getGreeting();

  const dailyHoursValue = document.getElementById('dailyHoursValue');
  if (dailyHoursValue) dailyHoursValue.textContent = `${state.user.dailyHours || 0} jam`;
}

export function renderSettingsCourseList(state) {
  const container = document.getElementById('settingsCourseList');
  if (!container) return;
  container.innerHTML = state.courses.map((course) => `
    <div class="course-item">
      <div class="course-info">
        <span class="dot" style="background:${escapeHtml(course.color)};"></span>
        <div>
          <strong>${escapeHtml(course.name)}</strong><br />
          <span class="muted">${escapeHtml(course.code)} • ${escapeHtml(String(course.sks))} SKS</span>
        </div>
      </div>
      <button class="btn ghost">Kelola</button>
    </div>
  `).join('');
}

export function renderSearchResults(state, query) {
  const container = document.getElementById('searchResults');
  if (!container) return;
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    container.innerHTML = '<div class="search-result">Ketik kata kunci untuk mencari catatan, topik, atau materi.</div>';
    return;
  }

  if (!state.notes.length) {
    container.innerHTML = '<div class="search-result">Belum ada catatan untuk dicari. Tulis catatan pertama untuk mulai.</div>';
    return;
  }

  const matches = state.notes.filter((note) => {
    const haystack = `${note.title} ${note.snippet} ${getSelectedCourseName(note.courseId, state.courses)} ${note.tags.join(' ')}`.toLowerCase();
    return haystack.includes(normalized);
  });

  container.innerHTML = (matches.length ? matches : state.notes).slice(0, 6).map((note) => `
    <div class="search-result">
      <strong>${escapeHtml(note.title)}</strong>
      <div class="muted">${escapeHtml(getSelectedCourseName(note.courseId, state.courses))} • ${escapeHtml(note.status)}</div>
    </div>
  `).join('');
}

export function renderAccentButtons(state) {
  const grid = document.getElementById('accentGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const options = [
    { name: 'emerald', value: 155 },
    { name: 'safir', value: 213 },
    { name: 'teracotta', value: 18 },
    { name: 'amber', value: 42 },
    { name: 'amethyst', value: 272 },
    { name: 'delima', value: 347 }
  ];
  options.forEach((option) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'accent-swatch ' + (state.settings.accent === option.name ? 'active' : '');
    swatch.style.background = `hsl(${option.value} 56% 42%)`;
    swatch.title = option.name;
    swatch.addEventListener('click', () => {
      const root = document.documentElement;
      root.style.setProperty('--accent-h', String(option.value));
      state.settings.accent = option.name;
      renderAccentButtons(state);
    });
    grid.appendChild(swatch);
  });
}
