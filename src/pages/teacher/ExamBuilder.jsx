import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

export default function ExamBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('all');
  const [duration, setDuration] = useState(30);
  const [scheduledAt, setScheduledAt] = useState('');
  const [questions, setQuestions] = useState([]);
  const [preview, setPreview] = useState(false);
  const [publishedLink, setPublishedLink] = useState('');
  const [gradesList, setGradesList] = useState([]);

  useEffect(() => {
    api.get('/grades').then(res => setGradesList(res.data.data || []));
  }, []);

  useEffect(() => {
    if (isEdit && id !== 'new') {
      api.get(`/exams/${id}`).catch(() => {}).then(res => {
        if (!res) return;
        setTitle(res.data.title);
        setGrade(res.data.grade);
        setDuration(res.data.durationMinutes);
        setScheduledAt(res.data.scheduledAt ? new Date(res.data.scheduledAt).toISOString().slice(0, 16) : '');
        setQuestions(res.data.questions);
      });
    }
  }, [id]);

  const addQuestion = () => {
    setQuestions([...questions, { questionText: '', options: ['', '', '', ''], correctIndex: 0, timeLimitSeconds: 60 }]);
  };

  const updateQuestion = (index, updates) => {
    const copy = [...questions];
    copy[index] = { ...copy[index], ...updates };
    setQuestions(copy);
  };

  const updateOption = (qIdx, oIdx, value) => {
    const copy = [...questions];
    copy[qIdx].options[oIdx] = value;
    setQuestions(copy);
  };

  const moveQuestion = (index, dir) => {
    const copy = [...questions];
    const target = index + dir;
    if (target < 0 || target >= copy.length) return;
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setQuestions(copy);
  };

  const removeQuestion = (index) => {
    const copy = [...questions];
    copy.splice(index, 1);
    setQuestions(copy);
  };

  const handleSave = async (activate = false) => {
    const payload = { title, grade, durationMinutes: Number(duration), questions, isActive: activate };
    if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).toISOString();
    try {
      let examId = id;
      if (isEdit && id !== 'new') {
        await api.put(`/exams/${id}`, payload);
      } else {
        const res = await api.post('/exams', payload);
        examId = res.data._id;
      }
      if (activate) {
        const link = `${window.location.origin}/exam/${examId}`;
        setPublishedLink(link);
        navigator.clipboard.writeText(link);
      } else {
        navigate('/teacher/exams');
      }
    } catch (err) {
      alert('Error saving exam');
    }
  };

  return (
    <div className="exam-builder-page">
      <h1>{isEdit && id !== 'new' ? 'Edit Exam' : 'Create Exam'}</h1>
      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Grade</label>
            <select value={grade} onChange={e => setGrade(e.target.value)}>
              <option value="all">All</option>
              {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Duration (minutes)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Schedule Date (optional)</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="builder-actions">
        <button className="btn" onClick={addQuestion}>Add Question</button>
        <button className="btn btn-ghost" onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
      </div>

      {preview ? (
        <div className="card">
          <h3>Preview: {title}</h3>
          {questions.map((q, i) => (
            <div key={i} className="question-preview">
              <p><strong>Q{i + 1}.</strong> {q.questionText}</p>
              <ul>
                {q.options.map((opt, oi) => (
                  <li key={oi} style={{ color: oi === q.correctIndex ? 'var(--success)' : 'inherit' }}>{opt}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        questions.map((q, i) => (
          <div className="card question-card" key={i}>
            <div className="question-header">
              <span>Question {i + 1}</span>
              <div className="row-actions">
                <button className="btn btn-ghost" onClick={() => moveQuestion(i, -1)} disabled={i === 0}>Up</button>
                <button className="btn btn-ghost" onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1}>Down</button>
                <button className="btn btn-danger" onClick={() => removeQuestion(i)}>Delete</button>
              </div>
            </div>
            <div className="form-group">
              <label>Question Text</label>
              <textarea rows={2} value={q.questionText} onChange={e => updateQuestion(i, { questionText: e.target.value })} />
            </div>
            <div className="options-grid">
              {q.options.map((opt, oi) => (
                <div key={oi} className="form-group">
                  <label>Option {oi + 1}</label>
                  <input value={opt} onChange={e => updateOption(i, oi, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Correct Answer</label>
                <select value={q.correctIndex} onChange={e => updateQuestion(i, { correctIndex: Number(e.target.value) })}>
                  <option value={0}>Option 1</option>
                  <option value={1}>Option 2</option>
                  <option value={2}>Option 3</option>
                  <option value={3}>Option 4</option>
                </select>
              </div>
              <div className="form-group">
                <label>Time Limit (seconds)</label>
                <input type="number" value={q.timeLimitSeconds} onChange={e => updateQuestion(i, { timeLimitSeconds: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        ))
      )}

      {publishedLink && (
        <div className="card" style={{ background: '#dcfce7', borderColor: '#16a34a' }}>
          <h3>Exam Published!</h3>
          <p>Share this link with students:</p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input value={publishedLink} readOnly style={{ flex: 1 }} />
            <button className="btn btn-success" onClick={() => navigator.clipboard.writeText(publishedLink)}>Copy</button>
            <button className="btn btn-ghost" onClick={() => navigate('/teacher/exams')}>Back to Exams</button>
          </div>
        </div>
      )}

      <div className="builder-footer">
        <button className="btn btn-ghost" onClick={() => handleSave(false)}>Save as Draft</button>
        <button className="btn" onClick={() => handleSave(true)}>Save & Publish</button>
      </div>
    </div>
  );
}
