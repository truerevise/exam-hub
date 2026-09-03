import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const examEl = document.getElementById('exam');
const subjectEl = document.getElementById('subject');
if (!examEl || !subjectEl) return;

const normalize = value => String(value ?? '').trim().toLowerCase();
const display = value => String(value ?? '').trim();

const TG_SET_SUBJECTS = [
  'Geography', 'Chemical Sciences', 'Commerce', 'Computer Science & Applications',
  'Economics', 'Education', 'English', 'Earth Sciences', 'Life Sciences',
  'Journalism & Mass Communication', 'Management', 'Hindi', 'History', 'Law',
  'Mathematical Sciences', 'Physical Sciences', 'Physical Education', 'Philosophy',
  'Political Science', 'Psychology', 'Public Administration', 'Sociology', 'Telugu',
  'Urdu', 'Library & Information Science', 'Sanskrit', 'Social Work',
  'Environmental Science', 'Linguistics'
];

const isTelanganaSet = exam => {
  const key = normalize(exam).replace(/[–—]/g, '-');
  return /\btelangana\s*(?:state\s*)?(?:-|\s)?set\b/.test(key)
    || /\btg\s*(?:-|\s)?set\b/.test(key)
    || key === 'ts-set'
    || key === 'ts set';
};

let subjectsByExam = new Map();
let loaded = false;

function add(map, exam, subject) {
  exam = display(exam); subject = display(subject);
  if (!exam || !subject) return;
  const key = normalize(exam);
  if (!map.has(key)) map.set(key, new Map());
  map.get(key).set(normalize(subject), subject);
}

function setOptions(subjects, preferred = '') {
  const values = [...new Set(subjects.filter(Boolean))];
  const previous = preferred || subjectEl.value;
  subjectEl.innerHTML = '';

  if (!values.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'No subjects available for this exam';
    subjectEl.appendChild(o);
    subjectEl.disabled = true;
    return;
  }

  subjectEl.disabled = false;
  values.forEach(subject => {
    const o = document.createElement('option');
    o.value = subject;
    o.textContent = subject;
    subjectEl.appendChild(o);
  });

  const match = values.find(s => normalize(s) === normalize(previous));
  subjectEl.value = match || values[0];
}

function syncSeriesTitle() {
  const exam = display(examEl.value);
  const subject = display(subjectEl.value);
  const seriesEl = document.getElementById('previousExam');
  if (!exam || !subject || !seriesEl || !isTelanganaSet(exam)) return;

  const current = display(seriesEl.value);
  const paperMatch = current.match(/\bpaper\s*\d+\b/i);
  const paper = paperMatch ? paperMatch[0] : 'Paper 2';
  const yearMatch = current.match(/\b(?:19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';
  const suffix = [paper, year].filter(Boolean).join(' — ');

  seriesEl.value = `${exam} — ${subject}${suffix ? ` — ${suffix}` : ''}`;
}

function renderSubjects(exam, preferred = '') {
  if (isTelanganaSet(exam)) {
    setOptions(TG_SET_SUBJECTS, preferred);
    syncSeriesTitle();
    return;
  }

  const key = normalize(exam);
  const map = subjectsByExam.get(key) || new Map();
  const subjects = [...map.values()].sort((a, b) => a.localeCompare(b));
  setOptions(subjects, preferred);
}

async function loadExamSubjectMap() {
  try {
    const map = new Map();
    const [questionsSnap, examsSnap, subjectsSnap] = await Promise.all([
      getDocs(collection(db, 'questions')),
      getDocs(collection(db, 'exams')),
      getDocs(collection(db, 'subjects')).catch(() => ({ docs: [] }))
    ]);

    questionsSnap.docs.forEach(d => {
      const q = d.data() || {};
      add(map, q.exam, q.subject);
    });

    examsSnap.docs.forEach(d => {
      const x = d.data() || {};
      add(map, x.name || x.title, x.subject);
    });

    subjectsSnap.docs.forEach(d => {
      const x = d.data() || {};
      if (x.exam || x.examName) add(map, x.exam || x.examName, x.name || d.id);
    });

    subjectsByExam = map;
    loaded = true;
    renderSubjects(examEl.value);
  } catch (error) {
    console.error('Exam/subject filter failed:', error);
  }
}

examEl.addEventListener('change', () => {
  if (loaded) renderSubjects(examEl.value);
});

subjectEl.addEventListener('change', () => {
  if (isTelanganaSet(examEl.value)) syncSeriesTitle();
});

const subjectObserver = new MutationObserver(() => {
  if (!loaded || !isTelanganaSet(examEl.value)) return;
  const signature = [...subjectEl.options].map(o => normalize(o.value)).join('|');
  const expected = TG_SET_SUBJECTS.map(normalize).join('|');
  if (signature !== expected) renderSubjects(examEl.value, subjectEl.value);
});
subjectObserver.observe(subjectEl, { childList: true });

document.getElementById('saveSubject')?.addEventListener('click', async () => {
  const input = document.getElementById('newSubject');
  const name = display(input?.value);
  const exam = display(examEl.value);
  if (!name || !exam) return;

  try {
    await setDoc(doc(db, 'subjects', 'subject-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)), {
      name,
      exam,
      examName: exam,
      updatedAt: serverTimestamp()
    }, { merge: true });

    add(subjectsByExam, exam, name);
    renderSubjects(exam, name);
  } catch (error) {
    console.error('Could not associate new subject with exam:', error);
  }
});

loadExamSubjectMap();
