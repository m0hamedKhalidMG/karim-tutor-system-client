import React, { useEffect, useState, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from '../../components/ui/Modal.jsx';
import { formatMonth } from '../../utils/formatMonth.js';
import { getGradeDisplayName } from '../../utils/gradeDisplay.js';
import { useToast } from '../../components/ui/Toast.jsx';
import api from '../../services/api.js';

const formatEGP = (n) => (n || 0).toLocaleString('en-US') + ' EGP';

export default function Payments() {
  const { addToast } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [gradeFilter, setGradeFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ total: 0, paid: 0, unpaid: 0, collectionRate: 0, totalIncome: 0, expectedIncome: 0 });
  const [incomeData, setIncomeData] = useState([]);
  const [groups, setGroups] = useState([]);
  const [monthsList, setMonthsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [defaultAmount, setDefaultAmount] = useState(200);
  const [generateMonth, setGenerateMonth] = useState(new Date().toISOString().slice(0, 7));
  const [optimisticIds, setOptimisticIds] = useState(new Set());
  const [editedAmounts, setEditedAmounts] = useState({});
  const [gradesList, setGradesList] = useState([]);

  useEffect(() => {
    api.get('/grades').then(res => setGradesList(res.data.data || []));
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('month', month);
      if (gradeFilter) params.append('grade', gradeFilter);
      if (groupFilter) params.append('groupId', groupFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (search) params.append('search', search);

      const [pRes, sRes] = await Promise.all([
        api.get(`/payments?${params.toString()}`),
        api.get(`/payments/summary/${month}`)
      ]);
      setPayments(pRes.data.data || []);
      setSummary(sRes.data.data || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month, gradeFilter, groupFilter, statusFilter, search]);

  const fetchMeta = useCallback(async () => {
    try {
      const [gRes, mRes, iRes] = await Promise.all([
        api.get('/groups'),
        api.get('/payments/months/list'),
        api.get('/payments/income/all')
      ]);
      setGroups(gRes.data || []);
      setMonthsList(mRes.data.data || []);
      setIncomeData(iRes.data.data?.monthly || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    setEditedAmounts(prev => {
      const next = { ...prev };
      payments.forEach(p => {
        if (!(p._id in next)) {
          next[p._id] = p.amount || 0;
        }
      });
      return next;
    });
  }, [payments]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/payments/generate/${generateMonth}`, { amount: Number(defaultAmount) || 0 });
      const { created, skipped } = res.data.data;
      addToast(`Generated ${created} payments. Skipped ${skipped} existing.`, 'success');
      setShowGenerate(false);
      fetchPayments();
      fetchMeta();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to generate payments', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const markPaid = async (payment) => {
    const id = payment._id;
    // Optimistic update
    setOptimisticIds(prev => new Set(prev).add(id));
    setPayments(prev => prev.map(p => p._id === id ? { ...p, isPaid: true, paidAt: new Date().toISOString() } : p));

    try {
      await api.put(`/payments/${id}/pay`, { amount: payment.amount });
      addToast('Marked as paid', 'success');
      // Refresh summary
      const sRes = await api.get(`/payments/summary/${month}`);
      setSummary(sRes.data.data || {});
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to mark paid', 'error');
      // Revert
      fetchPayments();
    } finally {
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const markUnpaid = async (payment) => {
    const id = payment._id;
    setOptimisticIds(prev => new Set(prev).add(id));
    setPayments(prev => prev.map(p => p._id === id ? { ...p, isPaid: false, paidAt: null } : p));

    try {
      await api.put(`/payments/${id}/unpay`);
      addToast('Marked as unpaid', 'success');
      const sRes = await api.get(`/payments/summary/${month}`);
      setSummary(sRes.data.data || {});
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to mark unpaid', 'error');
      fetchPayments();
    } finally {
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const updateAmount = async (id, amount) => {
    try {
      await api.put(`/payments/${id}/amount`, { amount: Number(amount) });
      addToast('Amount updated', 'success');
      fetchPayments();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update amount', 'error');
    }
  };

  const filteredGroups = groups.filter(g => {
    if (!gradeFilter) return true;
    const groupGrade = String(g.grade || '').replace(/^Grade\s*/, '');
    const selectedGrade = String(gradeFilter || '').replace(/^Grade\s*/, '');
    return groupGrade === selectedGrade;
  });

  const StatCard = ({ label, value, color, sub }) => (
    <div className="card stat-card" style={{ borderLeftColor: color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          {sub && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>Payments</h1>
        <button className="btn" onClick={() => setShowGenerate(true)}>+ Generate Payments</button>
      </div>

      {/* Summary Cards */}
      <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Total Students" value={summary.total} color="#4f46e5" />
        <StatCard label="Paid" value={summary.paid} color="#10b981" sub={formatEGP(summary.totalIncome)} />
        <StatCard label="Unpaid" value={summary.unpaid} color="#ef4444" sub={formatEGP(summary.expectedIncome - summary.totalIncome)} />
        <StatCard label="Collection Rate" value={`${summary.collectionRate}%`} color="#f59e0b" />
        <StatCard label="Expected Income" value={formatEGP(summary.expectedIncome)} color="#8b5cf6" />
        <StatCard label="Collected" value={formatEGP(summary.totalIncome)} color="#3b82f6" />
      </div>

      {/* Income Chart */}
      {incomeData.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>Monthly Income History</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={incomeData}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tickFormatter={v => formatMonth(v)} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tickFormatter={v => v.toLocaleString()} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip formatter={(v) => formatEGP(v)} labelFormatter={(l) => formatMonth(l)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
              <Area type="monotone" dataKey="income" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div className="form-row" style={{ gap: '0.75rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)}>
              {monthsList.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
              <option value={new Date().toISOString().slice(0, 7)}>{formatMonth(new Date().toISOString().slice(0, 7))}</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label>Grade</label>
            <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setGroupFilter(''); }}>
              <option value="">All Grades</option>
              {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Group</label>
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
              <option value="">All Groups</option>
              {filteredGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label>Search</label>
            <input placeholder="Student name..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            Payment Records
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 400, marginLeft: '0.5rem' }}>({payments.length})</span>
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ display: 'inline-block', width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Loading payments...</p>
          </div>
        ) : payments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
            <p>No payment records found for this month.</p>
            <button className="btn btn-ghost" onClick={() => setShowGenerate(true)} style={{ marginTop: '1rem' }}>
              Generate Payments
            </button>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Grade</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Paid Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const isOptimistic = optimisticIds.has(p._id);
                  const student = p.studentId || {};
                  return (
                    <tr key={p._id} style={{ opacity: isOptimistic ? 0.6 : 1 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff',
                            color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.75rem'
                          }}>
                            {student.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <strong>{student.fullName || 'Unknown'}</strong>
                        </div>
                      </td>
                       <td><span className="badge badge-neutral">{getGradeDisplayName(student.grade)}</span></td>
                       <td>
                         <input
                           type="number"
                          value={editedAmounts[p._id] ?? (p.amount || 0)}
                          onChange={e => {
                            setEditedAmounts(prev => ({ ...prev, [p._id]: e.target.value }));
                          }}
                          onBlur={() => {
                            const val = Number(editedAmounts[p._id]);
                            if (!isNaN(val) && val !== p.amount) {
                              updateAmount(p._id, val);
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 100, textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
                        />
                      </td>
                      <td>
                        {p.isPaid ? (
                          <span className="badge badge-success">Paid</span>
                        ) : (
                          <span className="badge badge-warning">Unpaid</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '-'}
                      </td>
                      <td>
                        <div className="row-actions">
                          {!p.isPaid ? (
                            <button className="btn" style={{ padding: '0.4rem 0.875rem', fontSize: '0.8rem' }} onClick={() => markPaid(p)} disabled={isOptimistic}>
                              {isOptimistic ? '...' : 'Mark Paid'}
                            </button>
                          ) : (
                            <button className="btn btn-ghost" style={{ padding: '0.4rem 0.875rem', fontSize: '0.8rem' }} onClick={() => markUnpaid(p)} disabled={isOptimistic}>
                              {isOptimistic ? '...' : 'Unpay'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Modal */}
      <Modal isOpen={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Monthly Payments">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Create payment records for all active students. Existing records will be skipped.
        </p>
        <div className="form-group">
          <label>Month</label>
          <input type="month" value={generateMonth} onChange={e => setGenerateMonth(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Default Amount (EGP)</label>
          <input type="number" value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} min={0} />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setShowGenerate(false)}>Cancel</button>
          <button className="btn" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />
                Generating...
              </>
            ) : `Generate for ${formatMonth(generateMonth)}`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
