import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../../components/ui/Toast.jsx';
import { useSendCooldown } from '../../hooks/useSendCooldown.js';
import { egyptTimeString, egyptDateString } from '../../utils/timezone.js';
import api from '../../services/api.js';

export default function AttendanceScanner() {
  const { addToast } = useToast();
  const [today, setToday] = useState([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, total: 0, rate: 0 });
  const [scanResult, setScanResult] = useState(null);
  const [buffer, setBuffer] = useState('');
  const bufferRef = useRef('');
  const scannerInputRef = useRef(null);
  const [students, setStudents] = useState([]);
  const [manualStudent, setManualStudent] = useState('');
  const [manualDate, setManualDate] = useState(() => {
    const d = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const [m, day, y] = d.split('-');
    return `${y}-${m}-${day}`;
  });
  const [manualStatus, setManualStatus] = useState('present');
  const [manualQrCode, setManualQrCode] = useState('');
  const manualQrRef = useRef(null);
  const isManualTypingRef = useRef(false);
  const scanAreaRef = useRef(null);
  const [recentScans, setRecentScans] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showManualQr, setShowManualQr] = useState(false);
  const [showManualMark, setShowManualMark] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { isSending: sendingWa, cooldownRemaining, startSendDelay, isCooldownActive } = useSendCooldown(10);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessions, setSessions] = useState([]);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchToday = useCallback(async () => {
    try {
      const res = await api.get('/attendance/today');
      setToday(res.data.data || []);
      setStats(res.data.stats || { present: 0, absent: 0, total: 0, rate: 0 });
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/attendance/current-sessions');
      setSessions(res.data.data || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchToday();
    fetchSessions();
    const interval = setInterval(() => { fetchToday(); fetchSessions(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchToday, fetchSessions]);

  useEffect(() => {
    const fetchStudents = async () => {
      const res = await api.get('/teacher/students');
      setStudents(res.data.data || []);
    };
    fetchStudents();
  }, []);

  const handleScan = useCallback(async (qrCode) => {
    try {
      const res = await api.post('/attendance/scan', { qrCode });
      setScanResult(res.data);
      setRecentScans(prev => [res.data].concat(prev).slice(0, 5));
      fetchToday();
      setTimeout(() => setScanResult(null), 3500);
    } catch (err) {
      const errData = err.response?.data || { success: false, message: 'Scan failed' };
      setScanResult(errData);
      setRecentScans(prev => [errData].concat(prev).slice(0, 5));
      setTimeout(() => setScanResult(null), 3500);
    }
  }, [fetchToday]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName?.toLowerCase();
      const isTyping = (tag === 'input' || tag === 'textarea' || tag === 'select') && e.target !== scannerInputRef.current;
      if (isTyping) return;

      if (e.key === 'Enter') {
        if (bufferRef.current.trim()) {
          handleScan(bufferRef.current.trim());
          bufferRef.current = '';
          setBuffer('');
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current = bufferRef.current + e.key;
        setBuffer(bufferRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleScan]);

  useEffect(() => {
    scannerInputRef.current?.focus();
  }, []);

  const focusScanner = () => {
    scannerInputRef.current?.focus();
  };

  const handleManualQr = async () => {
    if (!manualQrCode.trim()) return;
    await handleScan(manualQrCode.trim());
    setManualQrCode('');
  };

  const handleAutoMarkAbsent = async () => {
    if (!window.confirm('This will mark all students with past sessions today as ABSENT if they have not scanned. Continue?')) return;
    try {
      await api.post('/attendance/auto-mark-absent');
      fetchToday();
      addToast('Auto-mark absent completed', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Auto-mark failed', 'error');
    }
  };

  const handleManual = async () => {
    try {
      await api.post('/attendance/manual', { studentId: manualStudent, date: manualDate, status: manualStatus });
      addToast('Attendance marked manually', 'success');
      fetchToday();
      setManualStudent('');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to mark attendance', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this attendance record?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/attendance/today/${id}`);
      addToast('Record removed', 'success');
      fetchToday();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to remove', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSendWhatsApp = async (studentId, studentName, parentPhone) => {
    if (!parentPhone) {
      addToast('No parent phone on file', 'error');
      return;
    }
    if (isCooldownActive) {
      addToast(`Please wait ${cooldownRemaining} seconds before sending again`, 'error');
      return;
    }
    await startSendDelay(async () => {
      const res = await api.post('/notifications/send', {
        studentIds: [studentId],
        trigger: 'manual'
      });
      const result = res.data.data.results[0];
      if (result.status === 'sent') {
        addToast(`WhatsApp sent to ${studentName}'s parent`, 'success');
      } else {
        addToast(`Failed: ${result.error || 'Unknown error'}`, 'error');
      }
    });
  };

  const absentToday = today.filter(r => r.status === 'absent');

  const StatCard = ({ label, value, color, sub }) => (
    <div className="card stat-card" style={{ borderLeftColor: color }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );

  const resultType = scanResult ? (scanResult.success ? (scanResult.alreadyMarked ? 'warning' : 'success') : 'danger') : null;

  const openSessions = sessions.filter(s => s.status === 'open');
  const upcomingSessions = sessions.filter(s => s.status === 'upcoming');
  const endedSessions = sessions.filter(s => s.status === 'ended');

  const clockTime = egyptTimeString(currentTime, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const clockDate = egyptDateString(currentTime, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const getSessionStatusStyle = (status) => {
    if (status === 'open') return { background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' };
    if (status === 'upcoming') return { background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' };
    return { background: '#f3f4f6', color: '#4b5563', borderColor: '#e5e7eb' };
  };

  return (
    <div className="attendance-page">
      <div className="page-header">
        <h1>Attendance Scanner</h1>
        <button className="btn btn-ghost" onClick={handleAutoMarkAbsent} style={{ fontSize: '0.85rem' }}>
          Auto-Mark Absent
        </button>
      </div>

      {/* Clock & Sessions Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace', letterSpacing: '0.05em', lineHeight: 1 }}>
            {clockTime}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{clockDate}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {sessions.length === 0 ? (
            <span className="badge badge-neutral">No sessions scheduled for today</span>
          ) : (
            sessions.map(s => (
              <div key={s._id} style={{
                padding: '0.5rem 0.875rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid',
                ...getSessionStatusStyle(s.status)
              }}>
                {s.status === 'open' ? (
                  <>🟢 {s.sessionTime} — {s.remainingMinutes}m left</>
                ) : s.status === 'upcoming' ? (
                  <>🔵 {s.sessionTime} — Upcoming</>
                ) : (
                  <>⚪ {s.sessionTime} — Ended</>
                )}
                <span style={{ opacity: 0.7, marginLeft: '0.35rem' }}>(Grade {s.grade}{s.group ? `, ${s.group.name}` : ''})</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Present" value={stats.present} color="#10b981" />
        <StatCard label="Absent" value={stats.absent} color="#ef4444" />
        <StatCard label="Total" value={stats.total} color="#4f46e5" />
        <StatCard label="Attendance Rate" value={`${stats.rate}%`} color="#f59e0b" />
      </div>

      {/* Scanner Area */}
      <div ref={scanAreaRef} className="scanner-area card" onClick={focusScanner}>
        {scanResult ? (
          <div className={`scan-result ${resultType}`}>
            <div className="scan-icon">{scanResult.success ? (scanResult.alreadyMarked ? '⚠️' : '✅') : '❌'}</div>
            <h2>{scanResult.success ? (scanResult.alreadyMarked ? 'Already Marked' : 'Present') : 'Scan Rejected'}</h2>
            {scanResult.student && (
              <div className="scan-student">
                <div className="scan-avatar">
                  {scanResult.student.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="scan-name">{scanResult.student.fullName}</div>
                  <div className="scan-grade">Grade {scanResult.student.grade}</div>
                </div>
              </div>
            )}
            {scanResult.message && <p className="scan-msg">{scanResult.message}</p>}
          </div>
        ) : (
          <div className="scan-waiting">
            <div className="scanner-pulse">
              <div className="pulse-ring" />
              <div className="pulse-ring" />
              <div className="pulse-ring" />
              <div className="pulse-icon">📷</div>
            </div>
            <h2>Waiting for scan...</h2>
            <p>Scan a student QR code to mark attendance</p>
            {openSessions.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.8)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                🟢 {openSessions.length} session{openSessions.length > 1 ? 's' : ''} open for scanning
              </div>
            )}
            {openSessions.length === 0 && sessions.length > 0 && endedSessions.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.8)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                🔴 All sessions have ended — scans are closed
              </div>
            )}
            {buffer && <div className="scan-buffer">{buffer}</div>}
          </div>
        )}
      </div>

      <input
        ref={scannerInputRef}
        onFocus={() => {}}
        onBlur={() => setTimeout(() => {
          if (!isManualTypingRef.current) scannerInputRef.current?.focus();
        }, 50)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        tabIndex={-1}
      />

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Recent Scans</div>
          <div className="recent-scans">
            {recentScans.map((s, i) => (
              <div key={i} className={`recent-chip ${s.success ? (s.alreadyMarked ? 'warning' : 'success') : 'danger'}`}>
                <span className="chip-icon">{s.success ? (s.alreadyMarked ? '⚠️' : '✅') : '❌'}</span>
                <span className="chip-name">{s.student?.fullName || 'Unknown'}</span>
                <span className="chip-meta">{s.success ? (s.alreadyMarked ? 'Already marked' : 'Present') : (s.message || 'Rejected')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Sections */}
      <div className="attendance-manuals">
        <div className="card manual-section" style={{ marginBottom: '1rem' }}>
          <button className="manual-toggle" onClick={() => setShowManualQr(!showManualQr)}>
            <span>📝 Manual QR Entry</span>
            <span className="toggle-chevron" style={{ transform: showManualQr ? 'rotate(180deg)' : 'none' }}>▼</span>
          </button>
          {showManualQr && (
            <div className="manual-body" style={{ padding: '0 1.25rem 1.25rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>Use this if the scanner is not reading QR codes properly.</p>
              <div className="form-row" style={{ gap: '0.75rem' }}>
                <input
                  ref={manualQrRef}
                  placeholder="Type QR code manually"
                  value={manualQrCode}
                  onChange={e => setManualQrCode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleManualQr(); }}
                  onFocus={() => { isManualTypingRef.current = true; }}
                  onBlur={() => { isManualTypingRef.current = false; }}
                  style={{ flex: 1 }}
                />
                <button className="btn" onClick={handleManualQr} disabled={!manualQrCode.trim()}>Mark Attendance</button>
              </div>
            </div>
          )}
        </div>

        <div className="card manual-section" style={{ marginBottom: '1.5rem' }}>
          <button className="manual-toggle" onClick={() => setShowManualMark(!showManualMark)}>
            <span>👤 Manual Mark (Select Student)</span>
            <span className="toggle-chevron" style={{ transform: showManualMark ? 'rotate(180deg)' : 'none' }}>▼</span>
          </button>
          {showManualMark && (
            <div className="manual-body" style={{ padding: '0 1.25rem 1.25rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>Manually record attendance for a specific student and date.</p>
              <div className="form-row" style={{ gap: '0.75rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                  <label>Student</label>
                  <select value={manualStudent} onChange={e => setManualStudent(e.target.value)} onFocus={() => { isManualTypingRef.current = true; }} onBlur={() => { isManualTypingRef.current = false; }}>
                    <option value="">Select student</option>
                    {students.map(s => <option key={s._id} value={s._id}>{s.fullName}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Date</label>
                  <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} onFocus={() => { isManualTypingRef.current = true; }} onBlur={() => { isManualTypingRef.current = false; }} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Status</label>
                  <select value={manualStatus} onChange={e => setManualStatus(e.target.value)} onFocus={() => { isManualTypingRef.current = true; }} onBlur={() => { isManualTypingRef.current = false; }}>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
                <button className="btn" onClick={handleManual} disabled={!manualStudent}>Mark</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            Today's Attendance
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 400, marginLeft: '0.5rem' }}>({today.length})</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {absentToday.length > 0 && (
              <button
                className="btn"
                style={{ padding: '0.4rem 0.875rem', fontSize: '0.8rem', background: '#25D366', borderColor: '#25D366', color: '#fff', minWidth: 200 }}
                onClick={() => handleSendWhatsApp(absentToday[0].studentId?._id, absentToday[0].studentId?.fullName, absentToday[0].studentId?.parentPhone)}
                disabled={isCooldownActive}
              >
                {isCooldownActive ? `⏳ Wait ${cooldownRemaining}s` : '📱 Send WhatsApp to Absent'}
              </button>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last refresh: {egyptTimeString(lastRefresh)}
            </span>
          </div>
        </div>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Grade</th>
                <th>Status</th>
                <th>Method</th>
                <th>Time</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {today.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                    No attendance records yet today
                  </td>
                </tr>
              ) : (
                today.map(r => (
                  <tr key={r._id} style={{ opacity: deletingId === r._id ? 0.5 : 1 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff',
                          color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.75rem'
                        }}>
                          {r.studentId?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <strong>{r.studentId?.fullName || 'Unknown'}</strong>
                      </div>
                    </td>
                    <td><span className="badge badge-neutral">Grade {r.studentId?.grade}</span></td>
                    <td>
                      <span className={`badge badge-${r.status === 'present' ? 'success' : 'danger'}`}>
                        {r.status === 'present' ? 'Present' : 'Absent'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${r.markedVia === 'qr' ? 'info' : 'neutral'}`}>
                        {r.markedVia === 'qr' ? 'QR Scan' : 'Manual'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {egyptTimeString(r.createdAt, { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <div className="row-actions" style={{ gap: '0.35rem' }}>
                        {r.status === 'absent' && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.35rem', fontSize: '0.8rem', color: '#25D366', minWidth: 40 }}
                            onClick={() => handleSendWhatsApp(r.studentId?._id, r.studentId?.fullName, r.studentId?.parentPhone)}
                            disabled={isCooldownActive}
                            title="Send WhatsApp to parent"
                          >
                            {isCooldownActive ? `⏳${cooldownRemaining}` : '📱'}
                          </button>
                        )}
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '0.35rem', fontSize: '0.8rem', color: '#ef4444' }}
                          onClick={() => handleDelete(r._id)}
                          disabled={deletingId === r._id}
                          title="Remove record"
                        >
                          {deletingId === r._id ? '⏳' : '🗑️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
