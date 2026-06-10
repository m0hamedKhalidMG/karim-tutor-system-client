import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '../../components/ui/Toast.jsx';
import { useSendCooldown } from '../../hooks/useSendCooldown.js';
import { getGradeDisplayName } from '../../utils/gradeDisplay.js';
import api from '../../services/api.js';

const TABS = [
  { id: 'report', label: 'Absence Report' },
  { id: 'payment', label: 'Payment Late' },
  { id: 'send', label: 'Send Report' },
  { id: 'logs', label: 'Message Logs' }
];

const VIEW_MODES = [
  { id: 'date', label: 'Session Date', input: 'date' },
  { id: 'week', label: 'Week', input: 'week' },
  { id: 'month', label: 'Month', input: 'month' }
];



function getInputValue(mode) {
  const now = new Date();
  if (mode === 'date') return now.toISOString().slice(0, 10);
  if (mode === 'week') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
  return now.toISOString().slice(0, 7);
}

export default function Notifications() {
  const { addToast } = useToast();
  const [tab, setTab] = useState('report');
  const [viewMode, setViewMode] = useState('date');
  const [inputValue, setInputValue] = useState(getInputValue('date'));
  const [gradeFilter, setGradeFilter] = useState('');
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState([]);
  const [gradesList, setGradesList] = useState([]);
  const [report, setReport] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const { isSending: sending, cooldownRemaining, startSendDelay, isCooldownActive } = useSendCooldown(10);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const [paymentReport, setPaymentReport] = useState([]);
  const [paymentMonth, setPaymentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [logs, setLogs] = useState([]);
  const [logFilters, setLogFilters] = useState({ studentId: '', month: '', trigger: '', status: '' });
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [stats, setStats] = useState({ sentThisMonth: 0, failedThisMonth: 0, studentsNotified: 0, byTrigger: {} });
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState({ per_session: '', weekly: '', monthly: '' });
  const [rulesLoading, setRulesLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (viewMode === 'date') params.append('date', inputValue);
      else if (viewMode === 'week') params.append('week', inputValue);
      else params.append('month', inputValue);
      if (gradeFilter) params.append('grade', gradeFilter);
      if (groupId) params.append('groupId', groupId);
      const res = await api.get(`/notifications/absent-report?${params.toString()}`);
      setReport(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [viewMode, inputValue, gradeFilter, groupId]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (logFilters.month) params.append('month', logFilters.month);
      if (logFilters.trigger) params.append('trigger', logFilters.trigger);
      if (logFilters.status) params.append('status', logFilters.status);
      params.append('page', logPage);
      params.append('limit', 20);
      const res = await api.get(`/notifications/logs?${params.toString()}`);
      setLogs(res.data.data || []);
      setLogTotal(res.data.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [logFilters, logPage]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get(`/notifications/stats?month=${new Date().toISOString().slice(0, 7)}`);
      setStats(res.data.data || { sentThisMonth: 0, failedThisMonth: 0, studentsNotified: 0, byTrigger: {} });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchPaymentReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('month', paymentMonth);
      if (gradeFilter) params.append('grade', gradeFilter);
      if (groupId) params.append('groupId', groupId);
      const res = await api.get(`/notifications/payment-late-report?${params.toString()}`);
      setPaymentReport(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [paymentMonth, gradeFilter, groupId]);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await api.get('/notifications/rules');
      setRules(res.data.data || []);
      const byTrigger = {};
      (res.data.data || []).forEach(r => {
        byTrigger[r.trigger] = r.messageTemplate || '';
      });
      setTemplates({
        per_session: byTrigger.per_session || `السلام عليكم ورحمة الله،\nنود إعلامكم بأن ابنكم/ابنتكم {{studentName}} من {{grade}} لم يحضر حصة اليوم {{date}}.\nيرجى التواصل مع الأستاذ {{teacherName}} لمعرفة التفاصيل.\nشكراً لتعاونكم 🙏`,
        weekly: byTrigger.weekly || `السلام عليكم ورحمة الله،\nتقرير الحضور الأسبوعي لابنكم/ابنتكم {{studentName}} من {{grade}}:\nعدد الغيابات هذا الأسبوع: {{absenceCount}} من أصل {{totalSessions}} حصص.\nللاستفسار تواصلوا مع الأستاذ {{teacherName}}.\nشكراً 🙏`,
        monthly: byTrigger.monthly || `السلام عليكم ورحمة الله،\nتقرير الحضور الشهري لابنكم/ابنتكم {{studentName}} من {{grade}}:\nإجمالي الغيابات هذا الشهر: {{absenceCount}} من أصل {{totalSessions}} حصص.\nيرجى الاهتمام بانتظام الحضور للحفاظ على مستوى الطالب.\nمع تحيات الأستاذ {{teacherName}} 🎓`,
        exam_result: byTrigger.exam_result || `السلام عليكم ورحمة الله،\nنود إعلامكم بنتيجة امتحان {{examTitle}} لابنكم/ابنتكم {{studentName}} من {{grade}}.\nالدرجة: {{score}} من {{total}} ({{percentage}}%).\nمع تحيات الأستاذ {{teacherName}} 🎓`,
        payment_late: byTrigger.payment_late || `السلام عليكم ورحمة الله،\nنود تذكيركم بأن اشتراك ابنكم/ابنتكم {{studentName}} من {{grade}} عن شهر {{month}} لم يتم سداده بعد.\nالمبلغ المستحق: {{amount}} جنيه.\nيرجى السداد في أقرب وقت ممكن.\nمع تحيات الأستاذ {{teacherName}} 🎓`
      });
    } catch (e) {
      console.error(e);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get('/groups').then(res => setGroups(res.data || []));
    api.get('/grades').then(res => setGradesList(res.data.data || []));
  }, []);

  useEffect(() => {
    if (tab === 'report') fetchReport();
    else if (tab === 'payment') fetchPaymentReport();
    else if (tab === 'logs') fetchLogs();
    else fetchRules();
    fetchStats();
  }, [tab, fetchReport, fetchPaymentReport, fetchLogs, fetchRules, fetchStats]);

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    const all = report.filter(r => r.student.parentPhone).map(r => r.student._id);
    setSelectedIds(new Set(all));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleSend = async (studentIds) => {
    await startSendDelay(async () => {
      const payload = { studentIds };
      if (viewMode === 'date') payload.date = inputValue;
      else if (viewMode === 'week') payload.week = inputValue;
      else if (viewMode === 'month') payload.month = inputValue;
      const res = await api.post('/notifications/send', payload);
      setSendResults(res.data.data.results);
      setShowConfirm(false);
      setSelectedIds(new Set());
      addToast(`Sent ${res.data.data.results.filter(r => r.status === 'sent').length} messages`, 'success');
      fetchStats();
      fetchReport();
    });
  };

  const handleSaveRule = async (trigger) => {
    try {
      const existing = rules.find(r => r.trigger === trigger);
      const payload = { trigger, messageTemplate: templates[trigger], isActive: true };
      if (existing) {
        await api.put(`/notifications/rules/${existing._id}`, payload);
      } else {
        await api.post('/notifications/rules', payload);
      }
      addToast('Rule saved', 'success');
      fetchRules();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save rule', 'error');
    }
  };

  const handleBulkSend = async (trigger, selectedStudentIds = null) => {
    let body;
    if (trigger === 'weekly') {
      body = { week: inputValue, grade: gradeFilter || 'all' };
    } else if (trigger === 'payment_late') {
      body = { month: paymentMonth, grade: gradeFilter || 'all' };
      if (selectedStudentIds && selectedStudentIds.length > 0) {
        body.studentIds = selectedStudentIds;
      }
    } else {
      body = { month: inputValue, grade: gradeFilter || 'all' };
    }
    await startSendDelay(async () => {
      const res = await api.post(`/notifications/send-${trigger}`, body);
      const sent = res.data.data.sent ?? res.data.data.results?.filter(r => r.status === 'sent').length;
      const failed = res.data.data.failed ?? res.data.data.results?.filter(r => r.status === 'failed').length;
      addToast(`Sent: ${sent}, Failed: ${failed}`, 'success');
      fetchStats();
      if (tab === 'payment') fetchPaymentReport();
    });
  };

  const getAbsenceColor = (pct) => {
    if (pct < 20) return '#10b981';
    if (pct <= 50) return '#f59e0b';
    return '#ef4444';
  };

  const StatCard = ({ label, value, color }) => (
    <div className="card stat-card" style={{ borderLeftColor: color, padding: '1.25rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );

  return (
    <div className="notifications-page">
      <div className="page-header">
        <h1>Notifications</h1>
      </div>

      {/* Stats bar */}
      <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Sent This Month" value={stats.sentThisMonth} color="#10b981" />
        <StatCard label="Failed This Month" value={stats.failedThisMonth} color="#ef4444" />
        <StatCard label="Students Notified" value={stats.studentsNotified} color="#4f46e5" />
        <StatCard label="Manual" value={stats.byTrigger?.manual || 0} color="#f59e0b" />
        <StatCard label="Per Session" value={stats.byTrigger?.per_session || 0} color="#3b82f6" />
        <StatCard label="Weekly" value={stats.byTrigger?.weekly || 0} color="#8b5cf6" />
        <StatCard label="Monthly" value={stats.byTrigger?.monthly || 0} color="#06b6d4" />
        <StatCard label="Exam Result" value={stats.byTrigger?.exam_result || 0} color="#f97316" />
        <StatCard label="Payment Late" value={stats.byTrigger?.payment_late || 0} color="#db2777" />
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: '0.5rem', marginBottom: '1.5rem', display: 'flex', gap: '0.25rem' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn ${tab === t.id ? '' : 'btn-ghost'}`} onClick={() => setTab(t.id)} style={{ flex: 1, justifyContent: 'center' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Absence Report */}
      {tab === 'report' && (
        <>
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-row" style={{ gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                <label>View By</label>
                <select value={viewMode} onChange={e => { setViewMode(e.target.value); setInputValue(getInputValue(e.target.value)); }}>
                  {VIEW_MODES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
                <label>{VIEW_MODES.find(v => v.id === viewMode)?.label}</label>
                <input type={VIEW_MODES.find(v => v.id === viewMode)?.input} value={inputValue} onChange={e => setInputValue(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                <label>Grade</label>
                <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setGroupId(''); }}>
                  <option value="">All</option>
                  {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
                <label>Group</label>
                <select value={groupId} onChange={e => setGroupId(e.target.value)}>
                  <option value="">All Groups</option>
                  {groups.filter(g => {
                    if (!gradeFilter) return true;
                    const groupGrade = String(g.grade || '').replace(/^Grade\s*/, '');
                    const selectedGrade = String(gradeFilter || '').replace(/^Grade\s*/, '');
                    return groupGrade === selectedGrade;
                  }).map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                </select>
              </div>
              <button className="btn" onClick={fetchReport} disabled={loading} style={{ marginBottom: 0 }}>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff' }}>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>☑ {selectedIds.size} students selected</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" style={{ background: '#25D366', borderColor: '#25D366', minWidth: 220 }} onClick={() => setShowConfirm(true)} disabled={isCooldownActive}>
                  {isCooldownActive ? `⏳ Wait ${cooldownRemaining}s` : '📱 Send WhatsApp to Selected'}
                </button>
                <button className="btn btn-ghost" onClick={clearSelection}>Clear Selection</button>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                Absence Report <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 400 }}>({report.length})</span>
              </h3>
              <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={selectAll}>Select All</button>
            </div>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}><div style={{ display: 'inline-block', width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
            ) : report.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                <p>No absences found for this period.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                       <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === report.filter(r => r.student.parentPhone).length} onChange={e => e.target.checked ? selectAll() : clearSelection()} /></th>
                       <th>Student</th>
                       <th>Grade</th>
                       <th>Group</th>
                       <th>Parent Phone</th>
                       <th>Absences</th>
                      <th>Days Absent</th>
                      <th>Total Sessions</th>
                      <th>Absence %</th>
                      <th>Notified</th>
                      <th style={{ width: 140 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.map(r => {
                      const sid = r.student._id;
                      const hasPhone = !!r.student.parentPhone;
                      return (
                        <tr key={sid}>
                          <td><input type="checkbox" checked={selectedIds.has(sid)} onChange={() => toggleSelect(sid)} disabled={!hasPhone} /></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                                {r.student.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <strong>{r.student.fullName}</strong>
                            </div>
                          </td>
                          <td><span className="badge badge-neutral">{getGradeDisplayName(r.student.grade)}</span></td>
                          <td><span className="badge badge-neutral">{r.student.groupId?.name || '—'}</span></td>
                          <td>
                            {hasPhone ? (
                              <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{r.student.parentPhone}</span>
                            ) : (
                              <span style={{ color: '#f59e0b', fontSize: '0.8rem' }} title="No parent phone on file">⚠️ Missing</span>
                            )}
                          </td>
                          <td><span className="badge badge-danger">{r.absenceCount}</span></td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: 220 }}>
                              {(r.dates || []).slice(0, 5).map((d, i) => (
                                <span key={i} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{d}</span>
                              ))}
                              {(r.dates || []).length > 5 && <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>+{(r.dates || []).length - 5} more</span>}
                            </div>
                          </td>
                          <td>{r.totalSessions}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${r.absencePct}%`, height: '100%', background: getAbsenceColor(r.absencePct), borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: getAbsenceColor(r.absencePct), minWidth: 32 }}>{r.absencePct}%</span>
                            </div>
                          </td>
                          <td>{r.alreadyNotified ? <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✅</span> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                          <td>
                            <button
                              className="btn"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: '#25D366', borderColor: '#25D366', color: '#fff', minWidth: 90 }}
                              onClick={() => { setSelectedIds(new Set([sid])); setShowConfirm(true); }}
                              disabled={!hasPhone || isCooldownActive}
                            >
                              {isCooldownActive ? `⏳ ${cooldownRemaining}s` : '📱 Send'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: Payment Late Report */}
      {tab === 'payment' && (
        <>
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-row" style={{ gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
                <label>Month</label>
                <input type="month" value={paymentMonth} onChange={e => setPaymentMonth(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                <label>Grade</label>
                <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setGroupId(''); }}>
                  <option value="">All</option>
                  {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
                <label>Group</label>
                <select value={groupId} onChange={e => setGroupId(e.target.value)}>
                  <option value="">All Groups</option>
                  {groups.filter(g => {
                    if (!gradeFilter) return true;
                    const groupGrade = String(g.grade || '').replace(/^Grade\s*/, '');
                    const selectedGrade = String(gradeFilter || '').replace(/^Grade\s*/, '');
                    return groupGrade === selectedGrade;
                  }).map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                </select>
              </div>
              <button className="btn" onClick={fetchPaymentReport} disabled={loading} style={{ marginBottom: 0 }}>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff' }}>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>☑ {selectedIds.size} students selected</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" style={{ background: '#25D366', borderColor: '#25D366', minWidth: 220 }} onClick={() => { handleBulkSend('payment_late', Array.from(selectedIds)); setSelectedIds(new Set()); }} disabled={isCooldownActive}>
                  {isCooldownActive ? `⏳ Wait ${cooldownRemaining}s` : '📱 Send WhatsApp to Selected'}
                </button>
                <button className="btn btn-ghost" onClick={clearSelection}>Clear Selection</button>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                Unpaid Students <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 400 }}>({paymentReport.length})</span>
              </h3>
              <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => {
                const all = paymentReport.filter(r => r.student.parentPhone).map(r => r.student._id);
                setSelectedIds(new Set(all));
              }}>Select All</button>
            </div>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}><div style={{ display: 'inline-block', width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
            ) : paymentReport.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
                <p>No unpaid students found for this month.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === paymentReport.filter(r => r.student.parentPhone).length} onChange={e => { const all = paymentReport.filter(r => r.student.parentPhone).map(r => r.student._id); e.target.checked ? setSelectedIds(new Set(all)) : setSelectedIds(new Set()); }} /></th>
                      <th>Student</th>
                      <th>Grade</th>
                      <th>Group</th>
                      <th>Parent Phone</th>
                      <th>Amount Due</th>
                      <th>Notified</th>
                      <th style={{ width: 140 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentReport.map(r => {
                      const sid = r.student._id;
                      const hasPhone = !!r.student.parentPhone;
                      return (
                        <tr key={sid}>
                          <td><input type="checkbox" checked={selectedIds.has(sid)} onChange={() => toggleSelect(sid)} disabled={!hasPhone} /></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fce7f3', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                                {r.student.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <strong>{r.student.fullName}</strong>
                            </div>
                          </td>
                          <td><span className="badge badge-neutral">{getGradeDisplayName(r.student.grade)}</span></td>
                          <td><span className="badge badge-neutral">{r.student.groupId?.name || '—'}</span></td>
                          <td>
                            {hasPhone ? (
                              <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{r.student.parentPhone}</span>
                            ) : (
                              <span style={{ color: '#f59e0b', fontSize: '0.8rem' }} title="No parent phone on file">⚠️ Missing</span>
                            )}
                          </td>
                          <td><span className="badge badge-danger">{r.amount} EGP</span></td>
                          <td>{r.alreadyNotified ? <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✅</span> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                          <td>
                            <button
                              className="btn"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: '#25D366', borderColor: '#25D366', color: '#fff', minWidth: 90 }}
                              onClick={() => { handleBulkSend('payment_late', [sid]); }}
                              disabled={!hasPhone || isCooldownActive}
                            >
                              {isCooldownActive ? `⏳ ${cooldownRemaining}s` : '📱 Send'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 3: Send Report (Rules) */}
      {tab === 'send' && (
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {['per_session', 'weekly', 'monthly', 'exam_result', 'payment_late'].map(trigger => {
            const rule = rules.find(r => r.trigger === trigger);
            const isActive = rule?.isActive || false;
            const titles = { per_session: '📅 Per Session Alerts', weekly: '📆 Weekly Summary', monthly: '🗓️ Monthly Summary', exam_result: '📝 Exam Result Alerts', payment_late: '💰 Payment Late Alerts' };
            return (
              <div className="card" key={trigger} style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>{titles[trigger]}</h3>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isActive} onChange={async (e) => {
                      if (rule) {
                        await api.put(`/notifications/rules/${rule._id}`, { isActive: e.target.checked });
                        fetchRules();
                      }
                    }} />
                    <span style={{ fontWeight: 600 }}>Active</span>
                  </label>
                </div>
                <div className="form-group">
                  <label>Message Template (Arabic)</label>
                  <textarea
                    rows={6}
                    value={templates[trigger] || ''}
                    onChange={e => setTemplates(prev => ({ ...prev, [trigger]: e.target.value }))}
                    style={{ fontFamily: "'Cairo', sans-serif", direction: 'rtl', background: '#f0f9ff', fontSize: '0.9rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn" onClick={() => handleSaveRule(trigger)}>Save Settings</button>
                    {trigger !== 'per_session' && trigger !== 'exam_result' && (
                    <button className="btn btn-ghost" onClick={() => handleBulkSend(trigger)} disabled={isCooldownActive}>
                      {isCooldownActive ? `⏳ Wait ${cooldownRemaining}s` : 'Send Now'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: Logs */}
      {tab === 'logs' && (
        <>
          <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-row" style={{ gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                <label>Month</label>
                <input type="month" value={logFilters.month} onChange={e => setLogFilters({ ...logFilters, month: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                <label>Trigger</label>
                <select value={logFilters.trigger} onChange={e => setLogFilters({ ...logFilters, trigger: e.target.value })}>
                  <option value="">All</option>
                  <option value="manual">Manual</option>
                  <option value="per_session">Per Session</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="exam_result">Exam Result</option>
                  <option value="payment_late">Payment Late</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                <label>Status</label>
                <select value={logFilters.status} onChange={e => setLogFilters({ ...logFilters, status: e.target.value })}>
                  <option value="">All</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <button className="btn" onClick={fetchLogs} disabled={loading} style={{ marginBottom: 0 }}>Search</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}><div style={{ display: 'inline-block', width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
            ) : logs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No logs found.</div>
            ) : (
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Grade</th>
                      <th>Parent Phone</th>
                      <th>Message</th>
                      <th>Trigger</th>
                      <th>Sent At</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l._id}>
                        <td><strong>{l.studentId?.fullName || 'Unknown'}</strong></td>
                        <td><span className="badge badge-neutral">{getGradeDisplayName(l.studentId?.grade)}</span></td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{l.parentPhone}</td>
                        <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', fontFamily: "'Cairo', sans-serif" }} title={l.message}>{l.message}</td>
                        <td><span className="badge badge-info">{l.trigger}</span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{new Date(l.sentAt).toLocaleString()}</td>
                        <td>
                          <span className={`badge badge-${l.status === 'sent' ? 'success' : 'danger'}`}>
                            {l.status === 'sent' ? 'Sent' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {logTotal > 20 && (
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <button className="btn btn-ghost" disabled={logPage <= 1} onClick={() => setLogPage(logPage - 1)}>Previous</button>
                <span style={{ padding: '0.5rem 1rem', fontWeight: 600 }}>Page {logPage} of {Math.ceil(logTotal / 20)}</span>
                <button className="btn btn-ghost" disabled={logPage >= Math.ceil(logTotal / 20)} onClick={() => setLogPage(logPage + 1)}>Next</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: 600, width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>Confirm Send WhatsApp</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>You are about to send messages to {selectedIds.size} parent(s):</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {report.filter(r => selectedIds.has(r.student._id)).map(r => (
                <div key={r.student._id} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontWeight: 600 }}>{r.student.fullName}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{r.student.parentPhone}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)} disabled={sending}>Cancel</button>
              <button className="btn" style={{ background: '#25D366', borderColor: '#25D366', minWidth: 180 }} onClick={() => handleSend(Array.from(selectedIds))} disabled={isCooldownActive}>
                {isCooldownActive ? `⏳ Wait ${cooldownRemaining}s` : 'Confirm & Send All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {sendResults && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: 600, width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>Send Results</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sendResults.map((r, i) => (
                <div key={i} style={{ padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)', background: r.status === 'sent' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${r.status === 'sent' ? '#bbf7d0' : '#fecaca'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.phone || 'No phone'}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: r.status === 'sent' ? '#10b981' : '#ef4444' }}>{r.status === 'sent' ? '✅ Sent' : `❌ ${r.error || 'Failed'}`}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setSendResults(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
