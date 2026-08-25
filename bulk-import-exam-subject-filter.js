import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const examEl = document.getElementById('exam');
const subjectEl = document.getElementById('subject');
if (!examEl || !subjectEl) return;

const normalize = value => String(value ?? '').trim().toLowerCase();
const display = value => String(value ?? '').trim();
let subjectsByExam = new Map();
let allSubjects = [];
let loaded = false;

function add(map, exam, subject) {
  exam = display(exam); subject = display(subject);
  if (!exam || !subject) return;
  const key = normalize(exam);
  if (!map.has(key)) map.set(key, new Map());
  map.get(key).set(normalize(subject), subject);
}

function renderSubjects(exam, preferred = '') {
  const key = normalize(exam);
  const map = subjectsByExam.get(key) || new Map();
  const subjects = [...map.values()].sort((a,b) => a.localeCompare(b));
  const previous = preferred || subjectEl.value;
  subjectEl.innerHTML = '';
  if (!subjects.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'No subjects available for this exam';
    subjectEl.appendChild(o);
    subjectEl.disabled = true;
    return;
  }
  subjectEl.disabled = false;
  subjects.forEach(subject => {
    const o = document.createElement('option');
    o.value = subject;
    o.textContent = subject;
    subjectEl.appendChild(o);
  });
  const match = subjects.find(s => normalize(s) === normalize(previous));
  subjectEl.value = match || subjects[0];
}

async function loadExamSubjectMap() {
  try {
    const map = new Map();
    const [questionsSnap, examsSnap, subjectsSnap] = await Promise.all([
      getDocs(collection(db, 'questions')),
      getDocs(collection(db, 'exams')),
      getDocs(collection(db, 'subjects')).catch(() => ({ docs: [] }))
    ]);

    // Questions are the source of truth: only subjects actually used by an exam appear.
    questionsSnap.docs.forEach(d => {
      const q = d.data() || {};
      add(map, q.exam, q.subject);
    });

    // Preserve exam-level subject metadata for exams that do not have questions yet.
    examsSnap.docs.forEach(d => {
      const x = d.data() || {};
      add(map, x.name || x.title, x.subject);
    });

    // Use an explicitly associated exam field if present on subject documents.
    subjectsSnap.docs.forEach(d => {
      const x = d.data() || {};
      if (x.exam || x.examName) add(map, x.exam || x.examName, x.name || d.id);
    });

    subjectsByExam = map;
    allSubjects = [...new Set([...map.values()].flatMap(m => [...m.values()]))].sort((a,b) => a.localeCompare(b));
    loaded = true;
    renderSubjects(examEl.value);
  } catch (error) {
    console.error('Exam/subject filter failed:', error);
  }
}

examEl.addEventListener('change', () => {
  if (loaded) renderSubjects(examEl.value);
});

// When admin creates a new subject, associate it with the currently selected exam.
document.getElementById('saveSubject')?.addEventListener('click', async () => {
  const input = document.getElementById('newSubject');
  const name = display(input?.value);
  const exam = display(examEl.value);
  if (!name || !exam) return;
  try {
    await setDoc(doc(db, 'subjects', 'subject-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0,100)), {
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
