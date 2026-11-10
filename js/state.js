export const accentOptions = [
  { name: 'emerald', value: 155 },
  { name: 'safir', value: 213 },
  { name: 'teracotta', value: 18 },
  { name: 'amber', value: 42 },
  { name: 'amethyst', value: 272 },
  { name: 'delima', value: 347 }
];

export function createEmptyState() {
  return {
    user: {
      name: 'Mahasiswa Baru',
      program: 'Teknik Informatika',
      semester: 1,
      totalSks: 0,
      targetSks: 0,
      streakTarget: 0,
      dailyHours: 2,
      notifications: true
    },
    settings: {
      themeMode: 'light',
      accent: 'emerald',
      fontSize: 'standard'
    },
    courses: [],
    notes: [],
    uploads: [],
    tips: [],
    distribution: [],
    flashcards: [
      {
        question: 'Catatan pertamamu belum ada. Tulis ringkasan belajar untuk membuat flashcard otomatis.',
        nextReview: 'hari ini',
        difficulty: 'easy'
      }
    ],
    flashcardsIndex: 0,
    selectedNoteId: null,
    timer: {
      seconds: 0,
      isRunning: false,
      startedAt: null
    }
  };
}

export const defaultState = createEmptyState();

export function loadState() {
  try {
    const saved = localStorage.getItem('catatanBelajarProgresifState');
    const safe = createEmptyState();
    if (!saved) return structuredClone(safe);

    const parsed = JSON.parse(saved);
    const hasLegacySampleData =
      (Array.isArray(parsed.notes) && parsed.notes.some((note) => note.title === 'Optimasi Tabel Hash' || note.title === 'Normalisasi Database')) ||
      (Array.isArray(parsed.courses) && parsed.courses.some((course) => course.id === 'algoritma' || course.id === 'basisdata')) ||
      (parsed.user && parsed.user.name === 'Nabila Rahman') ||
      (Array.isArray(parsed.uploads) && parsed.uploads.some((upload) => upload.name === 'Slide-Algoritma.pdf'));

    if (hasLegacySampleData) {
      localStorage.setItem('catatanBelajarProgresifState', JSON.stringify(safe));
      return structuredClone(safe);
    }

    const savedTheme = parsed?.settings?.themeMode;
    const themeMode = savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system' ? savedTheme : safe.settings.themeMode;

    return {
      user: { ...safe.user, ...(parsed.user || {}) },
      settings: { ...safe.settings, ...(parsed.settings || {}), themeMode },
      courses: Array.isArray(parsed.courses) ? parsed.courses : structuredClone(safe.courses),
      notes: Array.isArray(parsed.notes) ? parsed.notes : structuredClone(safe.notes),
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : structuredClone(safe.uploads),
      tips: Array.isArray(parsed.tips) ? parsed.tips : [...safe.tips],
      distribution: Array.isArray(parsed.distribution) ? parsed.distribution : structuredClone(safe.distribution),
      flashcards: Array.isArray(parsed.flashcards) && parsed.flashcards.length ? parsed.flashcards : structuredClone(safe.flashcards),
      flashcardsIndex: Number.isFinite(parsed.flashcardsIndex) ? Number(parsed.flashcardsIndex) : 0,
      selectedNoteId: parsed.selectedNoteId || null,
      timer: parsed.timer && typeof parsed.timer === 'object' ? { ...safe.timer, ...parsed.timer, startedAt: parsed.timer.startedAt ?? null } : structuredClone(safe.timer)
    };
  } catch (error) {
    console.warn('Unable to read saved state', error);
    localStorage.setItem('catatanBelajarProgresifState', JSON.stringify(createEmptyState()));
    return structuredClone(defaultState);
  }
}

export function saveState(state) {
  try {
    const cleanTimer = { ...state.timer };
    delete cleanTimer.intervalId;
    const payload = { ...state, timer: cleanTimer };
    localStorage.setItem('catatanBelajarProgresifState', JSON.stringify(payload));
  } catch (error) {
    console.warn('Penyimpanan gagal', error);
  }
}
