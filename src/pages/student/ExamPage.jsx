import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api.js';

export default function ExamPage() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [error, setError] = useState('');

  // QR verification states
  const [qrCode, setQrCode] = useState('');
  const [verifiedStudent, setVerifiedStudent] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [alreadyTaken, setAlreadyTaken] = useState(null);

  // Exam states
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const flagReasonsRef = useRef([]);
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);
  const hasSubmittedRef = useRef(false);

  // Fetch exam
  useEffect(() => {
    api.get(`/exams/${examId}`)
      .then(res => setExam(res.data))
      .catch(err => setError(err.response?.data?.message || 'Exam not found'));
  }, [examId]);

  // Anti-cheat listeners
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) flagExam('fullscreen_exit');
    };
    const onVisibility = () => {
      if (document.hidden) flagExam('tab_switch');
    };
    const onCopy = (e) => { e.preventDefault(); flagExam('copy_attempt'); };
    const onPaste = (e) => { e.preventDefault(); flagExam('paste_attempt'); };
    const onCut = (e) => { e.preventDefault(); };
    const onContext = (e) => e.preventDefault();
    const onKeyDown = (e) => {
      if (e.key === 'PrintScreen') { e.preventDefault(); flagExam('screenshot_attempt'); }
      if (e.ctrlKey && ['c','v','x','a','p','s','u'].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === 'F12') e.preventDefault();
    };
    const devtoolsInterval = setInterval(() => {
      if (window.outerWidth - window.innerWidth > 160) flagExam('devtools_open');
    }, 2000);

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('cut', onCut);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKeyDown);
      clearInterval(devtoolsInterval);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const flagExam = (reason) => {
    if (!flagReasonsRef.current.includes(reason)) {
      flagReasonsRef.current = [...flagReasonsRef.current, reason];
    }
  };

  const verifyQr = async () => {
    if (!qrCode.trim()) return;
    setVerifying(true);
    setError('');
    setAlreadyTaken(null);
    try {
      const res = await api.post(`/exams/${examId}/verify-student`, { qrCode: qrCode.trim() });
      setVerifiedStudent(res.data);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.result) {
        setAlreadyTaken(err.response.data.result);
        setVerifiedStudent(null);
      } else {
        setError(err.response?.data?.message || 'Verification failed');
        setVerifiedStudent(null);
      }
    } finally {
      setVerifying(false);
    }
  };

  const startExam = async () => {
    if (!verifiedStudent) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch (e) {}
    startedAtRef.current = new Date().toISOString();
    hasSubmittedRef.current = false;
    setStarted(true);
    setAnswers(Array(exam.questions.length).fill(-1));
    setCurrentIndex(0);
    setTimeLeft(exam.questions[0]?.timeLimitSeconds || 60);
  };

  // Timer effect
  useEffect(() => {
    if (!started || hasSubmittedRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time ran out for current question
          if (hasSubmittedRef.current) return 0;

          setCurrentIndex(prevIdx => {
            if (prevIdx + 1 < exam.questions.length) {
              setTimeLeft(exam.questions[prevIdx + 1]?.timeLimitSeconds || 60);
              return prevIdx + 1;
            }
            // Last question - submit
            if (!hasSubmittedRef.current) {
              hasSubmittedRef.current = true;
              performSubmit(prevIdx, -1);
            }
            return prevIdx;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [started, exam]);

  const performSubmit = async (lastIndex, lastAnswer) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);

    const finalAnswers = [...answers];
    finalAnswers[lastIndex] = lastAnswer;

    const payload = {
      studentId: verifiedStudent?.studentId || null,
      studentName: verifiedStudent?.fullName || '',
      startedAt: startedAtRef.current,
      answers: exam.questions.map((_, i) => ({
        questionIndex: i,
        selectedIndex: finalAnswers[i] ?? -1,
        answeredAt: new Date().toISOString()
      })),
      flagReasons: flagReasonsRef.current
    };

    try {
      const res = await api.post(`/exams/${examId}/submit`, payload);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswer = (selectedIndex) => {
    if (hasSubmittedRef.current) return;

    setAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentIndex] = selectedIndex;
      return newAnswers;
    });

    if (currentIndex + 1 < exam.questions.length) {
      setCurrentIndex(currentIndex + 1);
      setTimeLeft(exam.questions[currentIndex + 1]?.timeLimitSeconds || 60);
    } else {
      // Last question
      if (!hasSubmittedRef.current) {
        hasSubmittedRef.current = true;
        performSubmit(currentIndex, selectedIndex);
      }
    }
  };

  if (error && !result) {
    return (
      <div className="exam-page">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>{error}</h2>
          <button className="btn btn-ghost" onClick={() => window.location.reload()} style={{ marginTop: '1rem' }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!exam) return <div className="exam-page"><div className="card">Loading...</div></div>;

  if (result) {
    return (
      <div className="exam-page">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h1>Thank you, {verifiedStudent?.fullName}!</h1>
          <p>Your exam has been submitted.</p>
          <div className="result-box">
            <h2>Score: {result.score} / {result.total}</h2>
            <p>Percentage: {result.percentage}%</p>
          </div>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="exam-page">
        <div className="card" style={{ maxWidth: 600, margin: '2rem auto' }}>
          <h1>{exam.title}</h1>
          <p>Total Questions: {exam.questions.length}</p>
          <p>Duration: {exam.durationMinutes} minutes</p>

          {alreadyTaken ? (
            <div style={{ padding: '1.5rem', background: '#fee2e2', borderRadius: 'var(--radius)', border: '1px solid var(--danger)', textAlign: 'center' }}>
              <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>You have already taken this exam</h2>
              <p style={{ marginBottom: '1rem' }}>You cannot take the same exam more than once.</p>
              <div className="result-box" style={{ background: '#fff', marginBottom: '1rem' }}>
                <h2>Your Previous Score</h2>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{alreadyTaken.score} / {alreadyTaken.total}</p>
                <p style={{ fontSize: '1.2rem', color: alreadyTaken.percentage >= 50 ? 'var(--success)' : 'var(--danger)' }}>{alreadyTaken.percentage}%</p>
              </div>
              <button className="btn btn-ghost" onClick={() => { setAlreadyTaken(null); setQrCode(''); }}>
                Try Different QR Code
              </button>
            </div>
          ) : !verifiedStudent ? (
            <>
              <div className="form-group">
                <label>Enter Your QR Code</label>
                <input
                  placeholder="Scan or type your QR code"
                  value={qrCode}
                  onChange={e => setQrCode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') verifyQr(); }}
                  autoFocus
                />
              </div>
              <button className="btn" onClick={verifyQr} disabled={verifying || !qrCode.trim()}>
                {verifying ? 'Verifying...' : 'Verify'}
              </button>
            </>
          ) : (
            <>
              <div className="verified-student" style={{ padding: '1rem', background: '#dcfce7', borderRadius: 'var(--radius)', marginBottom: '1rem', border: '1px solid #16a34a' }}>
                <p><strong>Student:</strong> {verifiedStudent.fullName}</p>
                <p><strong>Grade:</strong> {verifiedStudent.grade}</p>
              </div>
              <button className="btn" onClick={startExam}>
                Start Exam
              </button>
              <button className="btn btn-ghost" onClick={() => { setVerifiedStudent(null); setQrCode(''); }} style={{ marginLeft: '0.5rem' }}>
                Change Student
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const q = exam.questions[currentIndex];

  return (
    <div className="exam-page">
      <div className="card exam-active">
        <div className="exam-meta">
          <div>Question {currentIndex + 1} of {exam.questions.length}</div>
          <div className="timer">Time Left: {timeLeft}s</div>
        </div>
        <h2>{q.questionText}</h2>
        <div className="options-list">
          {q.options.map((opt, i) => (
            <button key={i} className="btn btn-ghost option-btn" onClick={() => handleAnswer(i)}>
              {opt}
            </button>
          ))}
        </div>
      </div>
      {submitting && <div className="submitting-overlay">Submitting...</div>}
    </div>
  );
}
