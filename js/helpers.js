export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function getSelectedCourseName(courseId, courses) {
  const course = courses.find((item) => item.id === courseId);
  return course ? course.name : 'Umum';
}

export function findCourseColor(courseId, courses) {
  const course = courses.find((entry) => entry.id === courseId);
  return course ? course.color : '#5f6d6d';
}

export function countStats(notes) {
  const total = notes.length || 0;
  const improved = notes.filter((note) => note.improved).length || 0;
  const activeCourses = new Set(notes.map((note) => note.courseId)).size || 0;
  const now = Date.now();
  const diffThisWeek = notes.filter((note) => {
    if (!note.createdAt) return false;
    return now - Number(note.createdAt) <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return { total, improved, activeCourses, diffThisWeek };
}
