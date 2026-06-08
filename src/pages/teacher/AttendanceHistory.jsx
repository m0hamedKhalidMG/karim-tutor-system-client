import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '../../components/ui/Toast.jsx';
import { egyptDateString } from '../../utils/timezone.js';
import api from '../../services/api.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const todayMonth = () => new Date().toISOString().slice(0, 7);

export default function AttendanceHistory() {
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState('history'); // 'history' | 'roster' | 'analytics'
  const [studentId, setStudentId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [month, setMonth] = useState(todayMonth());
  const [date, setDate] = useState(todayStr());
  const [grade, setGrade] = useState('');
  const [groupId, setGroupId] = useState('');
  const [status, setStatus] = useState('');
  const [records, setRecords] = useState([]);
  const [roster, setRoster] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, notMarked: 0, total: 0 });
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [gradesList, setGradesList] = useState([]);

  useEffect(() => {
    api.get('/teacher/students').then(res => setStudents(res.data.data || []));
    api.get('/groups').then(res => setGroups(res.data || []));
    api.get('/grades').then(res => setGradesList(res.data.data || []));
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (studentId) params.append('studentId', studentId);
      if (month) params.append('month', month);
      if (status && status !== 'not-marked') params.append('status', status);
      if (groupId) params.append('groupId', groupId);
      const res = await api.get(`/attendance/history?${params.toString()}`);
      let data = res.data.data || [];
      // Client-side filter by student name
      if (searchName.trim()) {
        const q = searchName.trim().toLowerCase();
        data = data.filter(r => (r.studentId?.fullName || '').toLowerCase().includes(q));
      }
      setRecords(data);
      setStats({
        present: data.filter(r => r.status === 'present').length,
        absent: data.filter(r => r.status === 'absent').length,
        notMarked: 0,
        total: data.length
      });
    } catch (e) {
      console.error(e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [studentId, month, status, groupId, searchName]);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('date', date);
      if (grade) params.append('grade', grade);
      if (groupId) params.append('groupId', groupId);
      if (status) params.append('status', status);
      const res = await api.get(`/attendance/roster?${params.toString()}`);
      setRoster(res.data.data || []);
      setStats(res.data.stats || { present: 0, absent: 0, notMarked: 0, total: 0 });
    } catch (e) {
      console.error(e);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [date, grade, groupId, status]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('month', month);
      if (grade) params.append('grade', grade);
      if (groupId) params.append('groupId', groupId);
      const res = await api.get(`/attendance/analytics?${params.toString()}`);
      const data = res.data.data || [];
      setAnalytics(data);
      const totalScheduled = data.reduce((sum, s) => sum + s.scheduledCount, 0);
      const totalPresent = data.reduce((sum, s) => sum + s.present, 0);
      const totalAbsent = data.reduce((sum, s) => sum + s.absent, 0);
      const totalNotMarked = data.reduce((sum, s) => sum + s.notMarked, 0);
      setStats({
        present: totalPresent,
        absent: totalAbsent,
        notMarked: totalNotMarked,
        total: totalScheduled
      });
    } catch (e) {
      console.error(e);
      setAnalytics([]);
    } finally {
      setLoading(false);
    }
  }, [month, grade, groupId]);

  useEffect(() => {
    if (viewMode === 'history') fetchHistory();
    else if (viewMode === 'roster') fetchRoster();
    else fetchAnalytics();
  }, [viewMode, fetchHistory, fetchRoster, fetchAnalytics]);

  const handleMark = async (studentIdToMark, markStatus) => {
    setMarkingId(studentIdToMark);
    try {
      await api.post('/attendance/manual', { studentId: studentIdToMark, date, status: markStatus });
      addToast(`Marked as ${markStatus}`, 'success');
      fetchRoster();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to mark attendance', 'error');
    } finally {
      setMarkingId(null);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('Remove this attendance record?')) return;
    try {
      await api.delete(`/attendance/today/${recordId}`);
      addToast('Record removed', 'success');
      if (viewMode === 'history') fetchHistory();
      else if (viewMode === 'roster') fetchRoster();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to remove', 'error');
    }
  };

  const filteredGroups = groups.filter(g => {
    if (!grade) return true;
    const groupGrade = String(g.grade || '').replace(/^Grade\s*/, '');
    const selectedGrade = String(grade || '').replace(/^Grade\s*/, '');
    return groupGrade === selectedGrade;
  });

  const StatCard = ({ label, value, color, sub }) => (
    <div className="card stat-card" style={{ borderLeftColor: color }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );

  const StatusBadge = ({ status }) => {
    if (!status) return <span className="badge badge-neutral">Not Marked</span>;
    if (status === 'present') return <span className="badge badge-success">Present</span>;
    return <span className="badge badge-danger">Absent</span>;
  };

  const MethodBadge = ({ via }) => {
    if (!via) return null;
    return <span className={`badge badge-${via === 'qr' ? 'info' : 'neutral'}`}>{via === 'qr' ? 'QR Scan' : 'Manual'}</span>;
  };

  const RateBar = ({ rate }) => {
    let color = '#ef4444';
    if (rate >= 90) color = '#10b981';
    else if (rate >= 75) color = '#f59e0b';
    else if (rate >= 50) color = '#f97316';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${rate}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
        </div>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>{rate}%</span>
      </div>
    );
  };

  const getAvatar = (name) => (name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const dataCount = viewMode === 'history' ? records.length : viewMode === 'roster' ? roster.length : analytics.length;

  return (
    <div className="attendance-history-page">
      <div className="page-header">
        <h1>Attendance History</h1>
      </div>

      {/* View Mode Toggle */}
      <div className="card" style={{ padding: '0.5rem', marginBottom: '1.5rem', display: 'flex', gap: '0.25rem' }}>
        <button className={`btn ${viewMode === 'history' ? '' : 'btn-ghost'}`} onClick={() => setViewMode('history')} style={{ flex: 1, justifyContent: 'center' }}>
          📅 History
        </button>
        <button className={`btn ${viewMode === 'roster' ? '' : 'btn-ghost'}`} onClick={() => setViewMode('roster')} style={{ flex: 1, justifyContent: 'center' }}>
          📋 Roster
        </button>
        <button className={`btn ${viewMode === 'analytics' ? '' : 'btn-ghost'}`} onClick={() => setViewMode('analytics')} style={{ flex: 1, justifyContent: 'center' }}>
          📊 Analytics
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Present" value={stats.present} color="#10b981" />
        <StatCard label="Absent" value={stats.absent} color="#ef4444" />
        {(viewMode === 'roster' || viewMode === 'analytics') && <StatCard label="Not Marked" value={stats.notMarked} color="#6b7280" />}
        <StatCard label="Total" value={stats.total} color="#4f46e5" />
        <StatCard label="Attendance Rate" value={`${stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%`} color="#f59e0b" />
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div className="form-row" style={{ gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {viewMode === 'history' && (
            <>
              <div className="form-group" style={{ minWidth: 180, marginBottom: 0 }}>
                <label>Month</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
              </div>
              <div className="form-group" style={{ minWidth: 140, marginBottom: 0 }}>
                <label>Grade</label>
                <select value={grade} onChange={e => { setGrade(e.target.value); setGroupId(''); }}>
                  <option value="">All Grades</option>
                  {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 180, marginBottom: 0 }}>
                <label>Group</label>
                <select value={groupId} onChange={e => setGroupId(e.target.value)}>
                  <option value="">All Groups</option>
                  {filteredGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 200, marginBottom: 0 }}>
                <label>Student</label>
                <select value={studentId} onChange={e => { setStudentId(e.target.value); setSearchName(''); }}>
                  <option value="">All Students</option>
                  {students.map(s => <option key={s._id} value={s._id}>{s.fullName}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 200, marginBottom: 0, flex: 1 }}>
                <label>Search by Name</label>
                <input
                  type="text"
                  placeholder="Type student name..."
                  value={searchName}
                  onChange={e => { setSearchName(e.target.value); setStudentId(''); }}
                />
              </div>
            </>
          )}
          {viewMode === 'roster' && (
            <>
              <div className="form-group" style={{ minWidth: 160, marginBottom: 0 }}>
                <label>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ minWidth: 140, marginBottom: 0 }}>
                <label>Grade</label>
                <select value={grade} onChange={e => { setGrade(e.target.value); setGroupId(''); }}>
                  <option value="">All Grades</option>
                  {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 180, marginBottom: 0 }}>
                <label>Group</label>
                <select value={groupId} onChange={e => setGroupId(e.target.value)}>
                  <option value="">All Groups</option>
                  {filteredGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                </select>
              </div>
            </>
          )}
          {viewMode === 'analytics' && (
            <>
              <div className="form-group" style={{ minWidth: 180, marginBottom: 0 }}>
                <label>Month</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
              </div>
              <div className="form-group" style={{ minWidth: 140, marginBottom: 0 }}>
                <label>Grade</label>
                <select value={grade} onChange={e => { setGrade(e.target.value); setGroupId(''); }}>
                  <option value="">All Grades</option>
                  {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 180, marginBottom: 0 }}>
                <label>Group</label>
                <select value={groupId} onChange={e => setGroupId(e.target.value)}>
                  <option value="">All Groups</option>
                  {filteredGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                </select>
              </div>
            </>
          )}
          {viewMode !== 'analytics' && (
            <div className="form-group" style={{ minWidth: 160, marginBottom: 0 }}>
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                {viewMode === 'roster' && <option value="not-marked">Not Marked</option>}
              </select>
            </div>
          )}
          <button className="btn" onClick={() => {
            if (viewMode === 'history') fetchHistory();
            else if (viewMode === 'roster') fetchRoster();
            else fetchAnalytics();
          }} disabled={loading} style={{ marginBottom: 0 }}>
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Loading...
              </span>
            ) : 'Search'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            {viewMode === 'history' ? 'Attendance Records' : viewMode === 'roster' ? `Roster for ${egyptDateString(date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : `Student Attendance Analytics — ${egyptDateString(month + '-01', { month: 'long', year: 'numeric' })}`}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 400, marginLeft: '0.5rem' }}>({dataCount})</span>
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ display: 'inline-block', width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Loading...</p>
          </div>
        ) : dataCount === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <p>No records found for the selected filters.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  {viewMode === 'history' && <th>Date</th>}
                  <th>Student</th>
                  <th>Grade</th>
                  {viewMode === 'roster' && <th>Group</th>}
                  {viewMode === 'analytics' && <th>Sessions/Week</th>}
                  {viewMode === 'analytics' && <th>Scheduled</th>}
                  {viewMode === 'analytics' && <th>Present</th>}
                  {viewMode === 'analytics' && <th>Absent</th>}
                  {viewMode === 'analytics' && <th>Not Marked</th>}
                  <th>Status</th>
                  {viewMode !== 'analytics' && <th>Method</th>}
                  {viewMode === 'history' && <th>Time</th>}
                  {viewMode === 'roster' && <th style={{ width: 180 }}>Actions</th>}
                  {viewMode === 'analytics' && <th>Rate</th>}
                  {viewMode === 'history' && <th style={{ width: 60 }}></th>}
                </tr>
              </thead>
              <tbody>
                {viewMode === 'history' ? (
                  records.map(r => (
                    <tr key={r._id}>
                      <td>{egyptDateString(r.date)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff',
                            color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.75rem'
                          }}>
                            {getAvatar(r.studentId?.fullName)}
                          </div>
                          <strong>{r.studentId?.fullName || 'Unknown'}</strong>
                        </div>
                      </td>
                      <td><span className="badge badge-neutral">Grade {r.studentId?.grade}</span></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td><MethodBadge via={r.markedVia} /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <button className="btn btn-ghost" style={{ padding: '0.35rem', fontSize: '0.8rem', color: '#ef4444' }} onClick={() => handleDeleteRecord(r._id)} title="Remove record">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                ) : viewMode === 'roster' ? (
                  roster.map(r => (
                    <tr key={r.student._id} style={{ background: r.status === 'absent' ? '#fef2f2' : r.status === 'present' ? '#f0fdf4' : undefined }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff',
                            color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.75rem'
                          }}>
                            {getAvatar(r.student.fullName)}
                          </div>
                          <strong>{r.student.fullName}</strong>
                        </div>
                      </td>
                      <td><span className="badge badge-neutral">Grade {r.student.grade}</span></td>
                      <td><span className="badge badge-neutral">{r.student.groupId?.name || 'No Group'}</span></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td><MethodBadge via={r.markedVia} /></td>
                      <td>
                        <div className="row-actions" style={{ gap: '0.4rem' }}>
                          {r.status !== 'present' && (
                            <button className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleMark(r.student._id, 'present')} disabled={markingId === r.student._id}>
                              {markingId === r.student._id ? '...' : 'Present'}
                            </button>
                          )}
                          {r.status !== 'absent' && (
                            <button className="btn btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: '#ef4444', borderColor: '#fecaca' }} onClick={() => handleMark(r.student._id, 'absent')} disabled={markingId === r.student._id}>
                              {markingId === r.student._id ? '...' : 'Absent'}
                            </button>
                          )}
                          {r.status && (
                            <button className="btn btn-ghost" style={{ padding: '0.35rem', fontSize: '0.75rem', color: '#6b7280' }} onClick={() => handleDeleteRecord(r.recordId)} disabled={markingId === r.student._id} title="Clear">
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  analytics.map(a => (
                    <tr key={a.student._id} style={{ background: a.attendanceRate >= 90 ? '#f0fdf4' : a.attendanceRate < 50 ? '#fef2f2' : undefined }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff',
                            color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.75rem'
                          }}>
                            {getAvatar(a.student.fullName)}
                          </div>
                          <strong>{a.student.fullName}</strong>
                        </div>
                      </td>
                      <td><span className="badge badge-neutral">Grade {a.student.grade}</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{a.sessionsPerWeek}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{a.scheduledCount}</td>
                      <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{a.present}</td>
                      <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{a.absent}</td>
                      <td style={{ textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>{a.notMarked}</td>
                      <td>
                        <span className={`badge badge-${a.attendanceRate >= 90 ? 'success' : a.attendanceRate >= 75 ? 'warning' : 'danger'}`}>
                          {a.attendanceRate >= 90 ? 'Excellent' : a.attendanceRate >= 75 ? 'Good' : a.attendanceRate >= 50 ? 'Warning' : 'Critical'}
                        </span>
                      </td>
                      <td><RateBar rate={a.attendanceRate} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
