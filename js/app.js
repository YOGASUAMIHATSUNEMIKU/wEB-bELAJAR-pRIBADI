import { accentOptions, loadState, saveState, createEmptyState } from './state.js';
import { renderStats, renderCourseChips, renderFileUploads, renderTodayNotes, renderTips, renderDistribution, renderLibraryCards, renderProfileSummary, renderSettingsCourseList, renderSearchResults, renderAccentButtons } from './render.js';

const state = loadState();
let activeScreen = 'today';
let timerIntervalId = null;

const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg'];

function setSystemTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const mode = state.settings.themeMode || 'system';
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  document.body.dataset.theme = isDark ? 'dark' : 'light';
  document.querySelectorAll('[data-theme-option]').forEach((button) => {
    button.classList.toggle('active', button.dataset.themeOption === mode);
  });
}

function setThemeMode(mode) {
  state.settings.themeMode = mode;
  saveState(state);
  setSystemTheme();
}

function setFontSize(size) {
  state.settings.fontSize = size;
  saveState(state);
  document.body.dataset.fontSize = size;
  document.querySelectorAll('[data-font-size]').forEach((button) => {
    button.classList.toggle('active', button.dataset.fontSize === size);
  });
}

function ensureDefaultCourse() {
  if (state.courses.length) return;
  state.courses.push({
    id: 'umum',
    code: 'GEN',
    name: 'Umum',
    sks: 0,
    color: '#5f6d6d'
  });
}

function extractActiveCourseId() {
  const chosen = document.querySelector('#courseChips .mini-chip.active');
  return chosen?.dataset.courseId || state.courses[0]?.id || 'umum';
}

function createNoteFromText(title, content, courseId = 'umum', mode = 'draft') {
  const cleanTitle = (title || '').trim() || 'Catatan baru';
  const cleanContent = (content || '').trim();
  const normalizedCourseId = courseId || 'umum';
  ensureDefaultCourse();

  const course = state.courses.find((item) => item.id === normalizedCourseId) || state.courses[0];
  const note = {
    id: `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    courseId: normalizedCourseId,
    title: cleanTitle,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: 'Hari Ini',
    status: mode === 'enhance' ? 'Disempurnakan AI' : 'Catatan Asli',
    language: 'Markdown',
    snippet: cleanContent.length > 160 ? `${cleanContent.slice(0, 157)}...` : (cleanContent || 'Catatan baru dibuat dari ringkasan yang kamu tulis.'),
    tags: Array.from(new Set((cleanContent.match(/#[A-Za-z0-9_-]+/g) || []).map((tag) => tag.replace('#', '')).concat(cleanContent.split(/\s+/).slice(0, 4)).filter(Boolean))).slice(0, 4),
    improved: mode === 'enhance',
    bookmark: false,
    attachments: 0,
    createdAt: Date.now(),
    courseName: course?.name || 'Umum'
  };

  state.notes.unshift(note);
  const grouped = new Map();
  state.notes.forEach((entry) => {
    const key = entry.courseId || 'umum';
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });
  state.distribution = Array.from(grouped.entries()).map(([courseKey, count]) => {
    const info = state.courses.find((item) => item.id === courseKey) || { name: 'Umum', color: '#5f6d6d' };
    return { name: info.name, value: Math.min(100, count * 25) };
  });

  if (!state.tips.length) {
    state.tips = [
      'Buat satu pertanyaan untuk setiap catatan agar review lebih terarah.',
      'Gunakan ringkasan 3–5 poin agar mudah dipahami saat revisi.'
    ];
  }

  saveState(state);
  return note;
}

function updateUploadStatus(fileName, status, confidence = null, progress = null) {
  const item = state.uploads.find((entry) => entry.name === fileName);
  if (!item) return;
  item.status = status;
  if (confidence !== null) item.confidence = confidence;
  if (progress !== null) item.progress = progress;
  renderFileUploads(state);
}

function createUploadEntry(file) {
  const uploadId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `upload-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return {
    id: uploadId,
    name: file.name,
    status: 'Mengekstrak',
    confidence: null,
    size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
    progress: 5,
    extractedText: ''
  };
}

async function ensurePdfLib() {
  if (window.pdfjsLib) return window.pdfjsLib;
  const mod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs');
  mod.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs';
  window.pdfjsLib = mod;
  return mod;
}

async function extractPdfText(file) {
  const pdfjsLib = await ensurePdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str || '').join(' ');
    text += `${pageText}\n`;
  }
  return text.trim();
}

async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="tesseract.min.js"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Tesseract gagal dimuat.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Tesseract gagal dimuat.'));
    document.head.appendChild(script);
  });

  if (!window.Tesseract) {
    throw new Error('Tesseract belum siap.');
  }

  return window.Tesseract;
}

async function extractImageText(file) {
  const tesseract = await ensureTesseract();
  const result = await tesseract.recognize(file, 'ind+eng', {
    logger: (message) => {
      if (message?.status === 'recognizing text' && typeof message.progress === 'number') {
        const progress = Math.min(95, Math.round(message.progress * 100));
        updateUploadStatus(file.name, 'Mengekstrak', null, progress);
      }
    }
  });
  return result?.data?.text || '';
}

async function extractTextFile(file) {
  return file.text();
}

function addNoteFromExtractedFile(fileName, text) {
  if (!text || !text.trim()) return;
  const title = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  createNoteFromText(title, text, extractActiveCourseId(), 'draft');
  renderStats(state);
  renderTodayNotes(state);
  renderLibraryCards({ ...state, notes: getVisibleNotes() });
  renderSearchResults(state, '');
  renderDistribution(state);
  renderTips(state);
}

async function processFile(file) {
  if (file.size > 25 * 1024 * 1024) {
    return { ok: false, message: 'Ukuran file melebihi 25 MB.' };
  }

  const supportedByType = allowedTypes.includes(file.type) || /\.(pdf|png|jpg|jpeg|txt|md)$/i.test(file.name);
  if (!supportedByType) {
    return { ok: false, message: 'Format file tidak didukung.' };
  }

  if (/\.(docx|doc)$/i.test(file.name)) {
    const entry = createUploadEntry(file);
    entry.status = 'Tidak didukung';
    entry.progress = 100;
    state.uploads.unshift(entry);
    renderFileUploads(state);
    return { ok: false, message: 'Format .docx/.doc belum didukung pada versi ini. Gunakan PDF, PNG/JPG, atau TXT/MD.' };
  }

  const entry = createUploadEntry(file);
  state.uploads.unshift(entry);
  renderFileUploads(state);

  try {
    const type = file.type || file.name.split('.').pop().toLowerCase();
    let extracted = '';

    if (type === 'application/pdf' || file.name.endsWith('.pdf')) {
      extracted = await extractPdfText(file);
      entry.status = extracted ? 'Teks PDF' : 'Gagal';
      entry.confidence = extracted ? 96 : 0;
      entry.progress = 100;
      entry.extractedText = extracted;
      renderFileUploads(state);
      if (extracted) addNoteFromExtractedFile(file.name, extracted);
      return { ok: !!extracted, status: extracted ? 'Teks PDF' : 'Gagal', text: extracted, confidence: 96, extractedText: extracted };
    }

    if (/png|jpg|jpeg/i.test(type) || /png|jpe?g/i.test(file.name)) {
      extracted = await extractImageText(file);
      entry.status = extracted ? 'OCR Teks' : 'Gagal';
      entry.confidence = extracted ? 91 : 0;
      entry.progress = 100;
      entry.extractedText = extracted;
      renderFileUploads(state);
      if (extracted) addNoteFromExtractedFile(file.name, extracted);
      return { ok: !!extracted, status: extracted ? 'OCR Teks' : 'Gagal', text: extracted, confidence: extracted ? 91 : 0, extractedText: extracted };
    }

    if (type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      extracted = await extractTextFile(file);
      entry.status = 'Teks tersimpan';
      entry.progress = 100;
      entry.extractedText = extracted;
      renderFileUploads(state);
      if (extracted) addNoteFromExtractedFile(file.name, extracted);
      return { ok: true, status: 'Teks tersimpan', text: extracted, extractedText: extracted };
    }

    entry.status = 'Gagal';
    entry.progress = 100;
    renderFileUploads(state);
    return { ok: false, message: 'Berkas yang dipilih belum didukung untuk ekstraksi otomatis.' };
  } catch (error) {
    entry.status = 'Gagal';
    entry.progress = 100;
    renderFileUploads(state);
    return { ok: false, message: 'Ekstraksi gagal. Coba file lain atau edit hasil secara manual.' };
  }
}

function bindFileInput() {
  const input = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const previewBtn = document.getElementById('previewUploadBtn');
  if (!input || !dropzone) return;

  const triggerSelect = () => input.click();
  dropzone.addEventListener('click', triggerSelect);
  previewBtn?.addEventListener('click', triggerSelect);

  input.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      const result = await processFile(file);
      if (result.ok && result.extractedText) {
        const preview = document.createElement('div');
        preview.className = 'extract-preview';
        preview.textContent = result.extractedText.slice(0, 800) || 'Tidak ada teks yang terekstrak.';
        const listItem = document.querySelector(`[data-upload-name="${CSS.escape(file.name)}"]`);
        if (listItem) {
          const existing = listItem.querySelector('.extract-preview');
          if (!existing) listItem.appendChild(preview);
        }
      }
    }
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.style.borderColor = 'var(--accent)';
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.style.borderColor = 'rgba(128, 139, 135, 0.5)';
    });
  });

  dropzone.addEventListener('drop', async (event) => {
    const files = Array.from(event.dataTransfer.files || []);
    for (const file of files) {
      await processFile(file);
    }
  });
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safeSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((safeSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(safeSeconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function renderFlashcard() {
  const questionEl = document.getElementById('flashcardQuestion');
  const metaEl = document.getElementById('flashcardMeta');
  if (!questionEl || !metaEl) return;

  const card = state.flashcards[state.flashcardsIndex || 0];
  questionEl.textContent = card?.question || 'Tidak ada kartu aktif.';
  metaEl.textContent = `Kartu balik • Ulasan berikutnya: ${card?.nextReview || 'hari ini'}`;
}

function getCurrentEditorNoteId() {
  return document.body.dataset.editingNoteId || null;
}

function clearCurrentEditorNoteId() {
  delete document.body.dataset.editingNoteId;
}

function updateExistingNoteFromEditor(noteId, title, content, mode = 'draft') {
  if (!noteId) return null;
  const existing = state.notes.find((entry) => entry.id === noteId);
  if (!existing) return null;

  const cleanTitle = (title || '').trim() || 'Catatan baru';
  const cleanContent = (content || '').trim();
  const snippet = cleanContent.length > 160 ? `${cleanContent.slice(0, 157)}...` : (cleanContent || 'Catatan baru dibuat dari ringkasan yang kamu tulis.');

  existing.title = cleanTitle;
  existing.snippet = snippet;
  existing.tags = Array.from(new Set((cleanContent.match(/#[A-Za-z0-9_-]+/g) || []).map((tag) => tag.replace('#', '')).concat(cleanContent.split(/\s+/).slice(0, 4)).filter(Boolean))).slice(0, 4);
  existing.improved = mode === 'enhance';
  existing.status = mode === 'enhance' ? 'Disempurnakan AI' : 'Catatan Asli';
  existing.language = 'Markdown';
  existing.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  existing.date = 'Hari Ini';
  existing.updatedAt = Date.now();
  existing.bookmark = Boolean(existing.bookmark);
  existing.courseId = existing.courseId || 'umum';
  state.selectedNoteId = noteId;
  saveState(state);
  return existing;
}

function getVisibleNotes() {
  const searchInput = document.getElementById('librarySearch');
  const sortSelect = document.getElementById('sortSelect');
  const courseFilter = document.getElementById('courseFilter');
  const statusFilter = document.getElementById('statusFilter');

  const query = (searchInput?.value || '').trim().toLowerCase();
  const sortMode = sortSelect?.value || 'Terbaru';
  const courseValue = courseFilter?.value || 'all';
  const statusValue = statusFilter?.value || 'Semua';

  let notes = [...state.notes];

  if (query) {
    notes = notes.filter((note) => {
      const haystack = `${note.title} ${note.snippet} ${(note.tags || []).join(' ')} ${getSelectedCourseName(note.courseId, state.courses)}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  if (courseValue !== 'all') {
    notes = notes.filter((note) => note.courseId === courseValue);
  }

  if (statusValue === 'Sudah Disempurnakan') {
    notes = notes.filter((note) => note.improved);
  } else if (statusValue === 'Catatan Asli') {
    notes = notes.filter((note) => !note.improved);
  }

  if (sortMode === 'Terlama') {
    notes.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } else if (sortMode === 'Frekuensi ulasan') {
    notes.sort((a, b) => (b.attachments || 0) - (a.attachments || 0));
  } else {
    notes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  return notes;
}

function renderLibraryCourseOptions() {
  const select = document.getElementById('courseFilter');
  if (!select) return;

  const options = ['<option value="all">Semua mata kuliah</option>']
    .concat(state.courses.map((course) => `<option value="${course.id}">${course.name}</option>`))
    .join('');

  select.innerHTML = options;
  const currentValue = select.dataset.value || 'all';
  if (state.courses.some((course) => course.id === currentValue)) {
    select.value = currentValue;
  } else {
    select.value = 'all';
  }
  select.dataset.value = select.value;
}

function renderDetailPanel() {
  const detailTitle = document.getElementById('detailTitle');
  const detailMeta = document.getElementById('detailMeta');
  const detailContent = document.getElementById('detailContent');
  const note = state.notes.find((entry) => entry.id === state.selectedNoteId) || state.notes[0];

  if (!detailTitle || !detailMeta || !detailContent) return;

  if (note && state.selectedNoteId !== note.id) {
    state.selectedNoteId = note.id;
  }

  if (!note) {
    state.selectedNoteId = null;
    detailTitle.textContent = 'Belum ada catatan';
    detailMeta.innerHTML = '<span class="tag">Kosong</span><span>Mulai dengan catatan baru</span>';
    detailContent.innerHTML = `
      <div class="empty-state">
        <h3>Belum ada catatan yang dipilih</h3>
        <p class="muted">Buat catatan baru dari halaman Hari Ini, lalu pilih catatan itu untuk melihat detail lengkap.</p>
      </div>
    `;
    return;
  }

  const course = state.courses.find((entry) => entry.id === note.courseId) || state.courses[0] || { name: 'Umum' };
  detailTitle.textContent = note.title;
  detailMeta.innerHTML = `
    <span class="tag">${course.name}</span>
    <span>${note.date}</span>
    <span>${note.time}</span>
    <span>${note.attachments || 0} lampiran</span>
  `;

  detailContent.innerHTML = `
    <div class="observe-box">
      <div class="box">
        <strong>TL;DR</strong>
        <div class="muted">${note.snippet || 'Catatan ini masih perlu diperluas agar lebih jelas.'}</div>
      </div>
      <div class="box">
        <strong>Status</strong>
        <div class="muted">${note.status}</div>
      </div>
    </div>

    <h4>Catatan asli</h4>
    <p>${note.snippet || 'Belum ada ringkasan yang tertulis.'}</p>

    <h4>Versi Sempurna</h4>
    <div class="content-block" style="margin-top:14px; background: var(--panel-strong);">
      <h5>Ringkasan</h5>
      <p>${note.snippet || 'Catatan ini dapat dikembangkan menjadi ringkasan yang lebih terstruktur.'}</p>
      <h5>Tag</h5>
      <div class="tag-row">
        ${(note.tags && note.tags.length ? note.tags : ['ringkasan', 'belajar']).map((tag) => `<span class="tag">${tag}</span>`).join('')}
      </div>
      <h5>Catatan AI</h5>
      <ul class="audit-list">
        <li>Gunakan pola pikir "fakta → konsep → aplikasi" agar ringkasan lebih mudah dicerna.</li>
        <li>Tambahkan satu contoh nyata untuk memperkuat pemahaman pada materi ini.</li>
      </ul>
    </div>
  `;
}

function buildAiAnswer(question) {
  const normalized = question.toLowerCase();

  if (!state.notes.length) {
    return 'Belum ada catatan yang tersimpan. Tulis catatan pertamamu, lalu tanyakan lagi agar AI bisa menjawab berdasarkan isi catatanmu.';
  }

  const matching = state.notes.filter((note) => {
    const haystack = `${note.title} ${note.snippet} ${note.tags.join(' ')}`.toLowerCase();
    return haystack.includes(normalized) || normalized.includes(note.title.toLowerCase()) || normalized.includes((note.tags || []).join(' ').toLowerCase());
  });

  const primaryNote = matching[0] || state.notes[0];
  const context = `${primaryNote.title}. ${primaryNote.snippet}`.trim();

  if (normalized.includes('hash') || normalized.includes('collision') || normalized.includes('load factor')) {
    return `Berdasarkan catatan “${primaryNote.title}”, fokus utamanya adalah ${context}. Singkatnya: collision meningkat ketika beban tabel terlalu tinggi, maka strategi distribusi data dan penanganan collision harus dipilih dengan cermat.`;
  }

  if (normalized.includes('normal') || normalized.includes('database') || normalized.includes('3nf') || normalized.includes('erd')) {
    return `Dari catatan “${primaryNote.title}”, fokus utamanya adalah memisahkan data ke bentuk yang lebih teratur supaya relasi antar entitas lebih jelas. 1NF, 2NF, dan 3NF membantu mengurangi redundansi sekaligus menjaga integritas data.`;
  }

  if (normalized.includes('sistem') || normalized.includes('use case') || normalized.includes('kebutuhan')) {
    return `Catatan “${primaryNote.title}” menekankan bahwa kebutuhan sistem mesti ditangkap dari stakeholder sebelum dijadikan use case dan validasi. Tujuannya memastikan solusi yang dibuat sesuai kebutuhan bisnis, bukan hanya fitur yang tampak menarik.`;
  }

  if (normalized.includes('kuis') || normalized.includes('latihan') || normalized.includes('soal')) {
    return `Berdasarkan catatanmu, coba jawab pertanyaan ini: 1) apa fokus utama dari ${primaryNote.title}? 2) dua poin paling penting apa yang diambil dari catatan itu? 3) bagaimanakah konsep ini bisa diterapkan pada studi kasus nyata?`;
  }

  return `Berdasarkan catatan “${primaryNote.title}”, jawaban yang paling relevan adalah: ${context}. Jika mau, saya bisa ringkas lebih sederhana, ubah jadi kuis, atau jelaskan langkah demi langkah.`;
}

function appendChatBubble(text, type = 'user') {
  const chatBox = document.getElementById('chatBox');
  if (!chatBox) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type === 'ai' ? 'ai' : ''}`.trim();
  bubble.textContent = text;
  chatBox.appendChild(bubble);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function sendQaMessage() {
  const input = document.getElementById('qaInput');
  if (!input) return;

  const question = input.value.trim();
  if (!question) return;

  appendChatBubble(question, 'user');
  input.value = '';

  setTimeout(() => {
    appendChatBubble(buildAiAnswer(question), 'ai');
  }, 250);
}

function advanceFlashcard(result) {
  if (!state.flashcards.length) return;
  const current = state.flashcards[state.flashcardsIndex || 0];
  if (current) {
    const nextMinute = result === 'lupa' ? 5 : result === 'ragu' ? 15 : 30;
    current.nextReview = `${String(nextMinute).padStart(2, '0')}.00`;
  }

  state.flashcardsIndex = (state.flashcardsIndex + 1) % state.flashcards.length;
  renderFlashcard();
  saveState(state);
}

function renderTimer() {
  const timerEl = document.getElementById('timerValue');
  if (!timerEl) return;

  const elapsed = state.timer.isRunning && state.timer.startedAt
    ? Math.max(0, Math.floor((Date.now() - Number(state.timer.startedAt)) / 1000))
    : Number(state.timer.seconds || 0);

  state.timer.seconds = elapsed;
  timerEl.textContent = formatDuration(elapsed);
}

function startTimer() {
  if (state.timer.isRunning) return;
  state.timer.isRunning = true;
  state.timer.startedAt = Date.now() - (Number(state.timer.seconds || 0) * 1000);
  clearInterval(timerIntervalId);
  timerIntervalId = setInterval(() => {
    renderTimer();
  }, 1000);
  renderTimer();
  saveState(state);
}

function pauseTimer() {
  if (!state.timer.isRunning) return;
  state.timer.isRunning = false;
  const elapsed = Math.max(0, Math.floor((Date.now() - Number(state.timer.startedAt || Date.now())) / 1000));
  state.timer.seconds = elapsed;
  state.timer.startedAt = null;
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  renderTimer();
  saveState(state);
}

function resetTimer() {
  state.timer.isRunning = false;
  state.timer.seconds = 0;
  state.timer.startedAt = null;
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  renderTimer();
  saveState(state);
}

function selectNoteAndOpenDetail(noteId) {
  if (!noteId) return;
  state.selectedNoteId = noteId;
  saveState(state);
  renderLibraryCards(state);
  renderTodayNotes(state);
  renderDetailPanel();
  activeScreen = 'detail';
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.dataset.screen === activeScreen);
  });
  document.querySelectorAll('.nav-btn').forEach((nav) => {
    nav.classList.toggle('active', nav.dataset.screen === activeScreen);
  });
}

function toggleBookmark(noteId) {
  const note = state.notes.find((entry) => entry.id === noteId);
  if (!note) return;

  note.bookmark = !note.bookmark;
  saveState(state);
  renderLibraryCards({ ...state, notes: getVisibleNotes() });
  renderTodayNotes(state);
  renderDetailPanel();
}

function bindNoteCardSelection() {
  const libraryContainer = document.getElementById('libraryCards');
  if (libraryContainer && !libraryContainer.dataset.boundSelection) {
    libraryContainer.addEventListener('click', (event) => {
      const bookmarkButton = event.target.closest('.bookmark');
      if (bookmarkButton) {
        event.stopPropagation();
        toggleBookmark(bookmarkButton.dataset.bookmarkNoteId);
        return;
      }

      const card = event.target.closest('.library-card');
      if (!card) return;
      const noteId = card.dataset.noteId;
      if (!noteId) return;
      selectNoteAndOpenDetail(noteId);
    });
    libraryContainer.dataset.boundSelection = 'true';
  }

  const todayContainer = document.getElementById('todaysNotesList');
  if (todayContainer && !todayContainer.dataset.boundSelection) {
    todayContainer.addEventListener('click', (event) => {
      const row = event.target.closest('.note-row');
      if (!row) return;
      const noteId = row.dataset.noteId;
      if (!noteId) return;
      selectNoteAndOpenDetail(noteId);
    });
    todayContainer.dataset.boundSelection = 'true';
  }
}

function bindLibraryFilters() {
  const searchInput = document.getElementById('librarySearch');
  const sortSelect = document.getElementById('sortSelect');
  const courseFilter = document.getElementById('courseFilter');
  const statusFilter = document.getElementById('statusFilter');

  const refreshLibraryCards = () => {
    renderLibraryCards({ ...state, notes: getVisibleNotes() });
  };

  searchInput?.addEventListener('input', refreshLibraryCards);

  sortSelect?.addEventListener('change', refreshLibraryCards);

  courseFilter?.addEventListener('change', () => {
    courseFilter.dataset.value = courseFilter.value;
    refreshLibraryCards();
  });

  statusFilter?.addEventListener('change', refreshLibraryCards);
}

function bindGlobalEvents() {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      activeScreen = button.dataset.screen;
      document.querySelectorAll('.screen').forEach((screen) => {
        screen.classList.toggle('active', screen.dataset.screen === activeScreen);
      });
      document.querySelectorAll('.nav-btn').forEach((nav) => {
        nav.classList.toggle('active', nav.dataset.screen === activeScreen);
      });

      if (activeScreen === 'detail') {
        renderDetailPanel();
      }
    });
  });

  document.getElementById('quickThemeToggle')?.addEventListener('click', () => {
    setThemeMode(state.settings.themeMode === 'dark' ? 'light' : 'dark');
  });

  document.querySelectorAll('[data-theme-option]').forEach((button) => {
    button.addEventListener('click', () => setThemeMode(button.dataset.themeOption));
  });

  document.querySelectorAll('[data-font-size]').forEach((button) => {
    button.addEventListener('click', () => setFontSize(button.dataset.fontSize));
  });

  document.getElementById('flashcardResetBtn')?.addEventListener('click', () => {
    state.flashcardsIndex = 0;
    renderFlashcard();
  });

  document.querySelectorAll('[data-flashcard-action]').forEach((button) => {
    button.addEventListener('click', () => advanceFlashcard(button.dataset.flashcardAction));
  });

  const qaInput = document.getElementById('qaInput');
  const sendQaButton = document.querySelector('#screen-qa .btn.primary');
  qaInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendQaMessage();
    }
  });
  sendQaButton?.addEventListener('click', sendQaMessage);

  document.getElementById('timerStartBtn')?.addEventListener('click', startTimer);
  document.getElementById('timerPauseBtn')?.addEventListener('click', pauseTimer);
  document.getElementById('timerResetBtn')?.addEventListener('click', resetTimer);
  document.getElementById('timerFocusBtn')?.addEventListener('click', () => {
    const button = document.getElementById('timerFocusBtn');
    if (button) button.classList.toggle('active');
  });

  document.getElementById('globalSearchInput')?.addEventListener('input', (event) => {
    renderSearchResults(state, event.target.value);
  });

  document.getElementById('searchOverlayInput')?.addEventListener('input', (event) => {
    renderSearchResults(state, event.target.value);
  });

  document.getElementById('globalSearchBox')?.addEventListener('click', () => {
    document.getElementById('searchOverlay')?.classList.add('active');
    document.getElementById('searchOverlayInput')?.focus();
  });

  document.getElementById('searchOverlay')?.addEventListener('click', (event) => {
    if (event.target.id === 'searchOverlay') {
      event.currentTarget.classList.remove('active');
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById('searchOverlay')?.classList.add('active');
      document.getElementById('searchOverlayInput')?.focus();
    }
    if (event.key === 'Escape') {
      document.getElementById('searchOverlay')?.classList.remove('active');
    }
  });

  document.getElementById('saveDraftBtn')?.addEventListener('click', () => {
    const title = document.getElementById('quickNoteTitle')?.value || '';
    const content = document.getElementById('quickNoteEditor')?.value || '';
    if (!content.trim()) return;

    const editingNoteId = getCurrentEditorNoteId();
    if (editingNoteId) {
      updateExistingNoteFromEditor(editingNoteId, title, content, 'draft');
      renderStats(state);
      renderTodayNotes(state);
      renderLibraryCards({ ...state, notes: getVisibleNotes() });
      renderDistribution(state);
      renderSearchResults(state, '');
      renderDetailPanel();
      bindNoteCardSelection();
      clearCurrentEditorNoteId();
      document.getElementById('draftSaved').textContent = 'perubahan disimpan';
    } else {
      createNoteFromText(title, content, extractActiveCourseId(), 'draft');
      renderStats(state);
      renderTodayNotes(state);
      renderLibraryCards({ ...state, notes: getVisibleNotes() });
      renderDistribution(state);
      renderSearchResults(state, '');
      bindNoteCardSelection();
      document.getElementById('draftSaved').textContent = 'disimpan baru saja';
    }

    document.getElementById('quickNoteEditor').value = '';
    if (document.getElementById('quickNoteTitle')) document.getElementById('quickNoteTitle').value = '';
    document.getElementById('wordCount').textContent = '0 kata';
  });

  document.getElementById('saveEnhanceBtn')?.addEventListener('click', () => {
    const title = document.getElementById('quickNoteTitle')?.value || '';
    const content = document.getElementById('quickNoteEditor')?.value || '';
    if (!content.trim()) return;

    const editingNoteId = getCurrentEditorNoteId();
    if (editingNoteId) {
      updateExistingNoteFromEditor(editingNoteId, title, content, 'enhance');
      renderStats(state);
      renderTodayNotes(state);
      renderLibraryCards({ ...state, notes: getVisibleNotes() });
      renderDistribution(state);
      renderSearchResults(state, '');
      renderDetailPanel();
      bindNoteCardSelection();
      clearCurrentEditorNoteId();
      document.getElementById('draftSaved').textContent = 'catatan disempurnakan';
    } else {
      createNoteFromText(title, content, extractActiveCourseId(), 'enhance');
      renderStats(state);
      renderTodayNotes(state);
      renderLibraryCards({ ...state, notes: getVisibleNotes() });
      renderDistribution(state);
      renderSearchResults(state, '');
      bindNoteCardSelection();
      document.getElementById('draftSaved').textContent = 'disimpan & disempurnakan';
    }

    document.getElementById('quickNoteEditor').value = '';
    if (document.getElementById('quickNoteTitle')) document.getElementById('quickNoteTitle').value = '';
    document.getElementById('wordCount').textContent = '0 kata';
  });

  document.getElementById('quickNoteEditor')?.addEventListener('input', () => {
    const textarea = document.getElementById('quickNoteEditor');
    const value = textarea.value.trim();
    const count = value ? value.split(/\s+/).length : 0;
    document.getElementById('wordCount').textContent = `${count} kata`;
  });
}

function syncSettingsInputs() {
  const fieldMap = {
    settingsName: 'name',
    settingsProgram: 'program',
    settingsSemester: 'semester',
    settingsTotalSks: 'totalSks',
    settingsTargetSks: 'targetSks',
    settingsStreakTarget: 'streakTarget',
    browserNotif: 'notifications'
  };
  Object.entries(fieldMap).forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (!element) return;
    if (element.type === 'checkbox') {
      element.checked = Boolean(state.user[key]);
      return;
    }
    element.value = state.user[key] ?? '';
  });

  const dailyHoursValue = document.getElementById('dailyHoursValue');
  if (dailyHoursValue) {
    dailyHoursValue.textContent = `${state.user.dailyHours || 2} jam`;
  }
}

function bindSettingsForm() {
  const targetMap = {
    settingsName: 'name',
    settingsProgram: 'program',
    settingsSemester: 'semester',
    settingsTotalSks: 'totalSks',
    settingsTargetSks: 'targetSks',
    settingsStreakTarget: 'streakTarget',
    browserNotif: 'notifications'
  };

  Object.entries(targetMap).forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (!element) return;

    const applyValue = () => {
      if (element.type === 'checkbox') {
        state.user[key] = Boolean(element.checked);
      } else if (element.type === 'number') {
        state.user[key] = Number(element.value) || 0;
      } else {
        state.user[key] = element.value;
      }
      saveState(state);
      renderProfileSummary(state);
      renderStats(state);
    };

    element.addEventListener('input', applyValue);
    element.addEventListener('change', applyValue);
  });

  const hoursValue = document.getElementById('dailyHoursValue');
  const minus = document.getElementById('dailyHoursMinus');
  const plus = document.getElementById('dailyHoursPlus');

  minus?.addEventListener('click', () => {
    state.user.dailyHours = Math.max(1, (state.user.dailyHours || 1) - 1);
    if (hoursValue) hoursValue.textContent = `${state.user.dailyHours} jam`;
    saveState(state);
    renderProfileSummary(state);
  });

  plus?.addEventListener('click', () => {
    state.user.dailyHours = Math.min(12, (state.user.dailyHours || 1) + 1);
    if (hoursValue) hoursValue.textContent = `${state.user.dailyHours} jam`;
    saveState(state);
    renderProfileSummary(state);
  });

  const exportBtn = document.getElementById('exportJsonBtn');
  const importBtn = document.getElementById('importJsonBtn');

  exportBtn?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catatan-belajar-export.json';
    link.click();
    URL.revokeObjectURL(url);
  });

  importBtn?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON');
        }
        Object.assign(state, parsed, {
          settings: { ...state.settings, ...(parsed.settings || {}) },
          user: { ...state.user, ...(parsed.user || {}) },
          timer: { ...state.timer, ...(parsed.timer || {}) }
        });
        saveState(state);
        renderStats(state);
        renderCourseChips(state);
        renderFileUploads(state);
        renderTodayNotes(state);
        renderTips(state);
        renderDistribution(state);
        renderLibraryCards({ ...state, notes: getVisibleNotes() });
        renderProfileSummary(state);
        renderSettingsCourseList(state);
        renderSearchResults(state, '');
        renderAccentButtons(state);
        renderFlashcard();
        renderTimer();
        syncSettingsInputs();
      } catch (error) {
        window.alert('File impor tidak valid.');
      }
    };
    input.click();
  });

  document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    saveState(state);
    renderProfileSummary(state);
    renderStats(state);
    const button = document.getElementById('saveSettingsBtn');
    if (!button) return;
    const original = button.textContent;
    button.textContent = 'Tersimpan';
    setTimeout(() => {
      button.textContent = original;
    }, 1200);
  });

  document.getElementById('resetDefaultSettingsBtn')?.addEventListener('click', () => {
    const resetState = createEmptyState();
    Object.assign(state, resetState);
    saveState(state);
    renderProfileSummary(state);
    renderStats(state);
    renderFileUploads(state);
    renderTodayNotes(state);
    renderTips(state);
    renderDistribution(state);
    renderLibraryCards({ ...state, notes: getVisibleNotes() });
    renderSettingsCourseList(state);
    renderAccentButtons(state);
    renderFlashcard();
    renderTimer();
    syncSettingsInputs();
    setSystemTheme();
    document.documentElement.style.setProperty('--accent-h', '155');
  });

  document.getElementById('deleteAllDataBtn')?.addEventListener('click', () => {
    const shouldClear = window.confirm('Hapus semua data catatan dan unggahan di browser ini?');
    if (!shouldClear) return;
    const emptyState = createEmptyState();
    Object.assign(state, emptyState);
    localStorage.removeItem('catatanBelajarProgresifState');
    saveState(state);
    renderProfileSummary(state);
    renderStats(state);
    renderFileUploads(state);
    renderTodayNotes(state);
    renderTips(state);
    renderDistribution(state);
    renderLibraryCards({ ...state, notes: getVisibleNotes() });
    renderSettingsCourseList(state);
    renderAccentButtons(state);
    renderFlashcard();
    renderTimer();
    syncSettingsInputs();
  });
}

function handleDetailDelete() {
  if (!state.selectedNoteId) return;
  const note = state.notes.find((entry) => entry.id === state.selectedNoteId);
  if (!note) return;

  const confirmed = window.confirm(`Hapus catatan "${note.title}" dari perpustakaan?`);
  if (!confirmed) return;

  state.notes = state.notes.filter((entry) => entry.id !== note.id);
  state.selectedNoteId = state.notes[0]?.id || null;
  saveState(state);

  renderStats(state);
  renderTodayNotes(state);
  renderDistribution(state);
  renderLibraryCards({ ...state, notes: getVisibleNotes() });
  renderSearchResults(state, '');
  renderDetailPanel();
}

function handleDetailEdit() {
  if (!state.selectedNoteId) return;
  const note = state.notes.find((entry) => entry.id === state.selectedNoteId);
  if (!note) return;

  const titleInput = document.getElementById('quickNoteTitle');
  const editor = document.getElementById('quickNoteEditor');
  if (titleInput && editor) {
    document.body.dataset.editingNoteId = note.id;
    titleInput.value = note.title;
    editor.value = note.snippet || note.title;
    const count = editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0;
    const wordCount = document.getElementById('wordCount');
    if (wordCount) wordCount.textContent = `${count} kata`;
    activeScreen = 'today';
    document.querySelectorAll('.screen').forEach((screen) => {
      screen.classList.toggle('active', screen.dataset.screen === activeScreen);
    });
    document.querySelectorAll('.nav-btn').forEach((nav) => {
      nav.classList.toggle('active', nav.dataset.screen === activeScreen);
    });
    editor.focus();
  }
}

function handleDetailAddRelated() {
  if (!state.selectedNoteId) return;
  const note = state.notes.find((entry) => entry.id === state.selectedNoteId);
  if (!note) return;

  const titleInput = document.getElementById('quickNoteTitle');
  const editor = document.getElementById('quickNoteEditor');
  const suggestion = `Catatan terkait: ${note.title}\n\n- Konsep utama\n- Persoalan yang muncul\n- Contoh penerapan`;
  if (titleInput && editor) {
    document.body.dataset.editingNoteId = note.id;
    titleInput.value = `Catatan terkait: ${note.title}`;
    editor.value = suggestion;
    const wordCount = document.getElementById('wordCount');
    if (wordCount) wordCount.textContent = `${editor.value.trim().split(/\s+/).length} kata`;
    activeScreen = 'today';
    document.querySelectorAll('.screen').forEach((screen) => {
      screen.classList.toggle('active', screen.dataset.screen === activeScreen);
    });
    document.querySelectorAll('.nav-btn').forEach((nav) => {
      nav.classList.toggle('active', nav.dataset.screen === activeScreen);
    });
    editor.focus();
  }
}

function bindDetailActions() {
  document.getElementById('detailDeleteBtn')?.addEventListener('click', handleDetailDelete);
  document.getElementById('detailEditBtn')?.addEventListener('click', handleDetailEdit);
  document.getElementById('detailAddRelatedBtn')?.addEventListener('click', handleDetailAddRelated);
}

function init() {
  const accent = accentOptions.find((option) => option.name === state.settings.accent) || accentOptions[0];
  document.body.dataset.fontSize = state.settings.fontSize || 'standard';
  document.documentElement.style.setProperty('--accent-h', String(accent.value));
  setSystemTheme();

  renderStats(state);
  renderCourseChips(state);
  renderFileUploads(state);
  renderTodayNotes(state);
  renderTips(state);
  renderDistribution(state);
  renderLibraryCourseOptions();
  renderLibraryCards(state);
  renderProfileSummary(state);
  renderSettingsCourseList(state);
  renderSearchResults(state, '');
  renderAccentButtons(state);
  renderFlashcard();
  renderTimer();
  renderDetailPanel();
  syncSettingsInputs();
  bindGlobalEvents();
  bindFileInput();
  bindSettingsForm();
  bindDetailActions();
  bindLibraryFilters();
  bindNoteCardSelection();

  if (state.timer.isRunning && state.timer.startedAt) {
    clearInterval(timerIntervalId);
    timerIntervalId = setInterval(() => renderTimer(), 1000);
  }
}

document.addEventListener('DOMContentLoaded', init);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', setSystemTheme);
