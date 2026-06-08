import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Badge from '../../components/ui/Badge.jsx';
import api from '../../services/api.js';

export default function ExamResults() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examRes, resultsRes] = await Promise.all([
          api.get(`/exams/${examId}`),
          api.get(`/exams/${examId}/results`)
        ]);
        setExam(examRes.data);
        setResults(resultsRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [examId]);

  if (loading) return <div className="exam-results-page"><div className="card">Loading...</div></div>;

  const totalSubmissions = results.length;
  const avgScore = totalSubmissions > 0 ? (results.reduce((sum, r) => sum + r.percentageScore, 0) / totalSubmissions).toFixed(1) : 0;
  const highest = totalSubmissions > 0 ? Math.max(...results.map(r => r.percentageScore)) : 0;
  const lowest = totalSubmissions > 0 ? Math.min(...results.map(r => r.percentageScore)) : 0;
  const passCount = results.filter(r => r.percentageScore >= 50).length;
  const flaggedCount = results.filter(r => r.flagged).length;

  const ranges = [
    { label: '90-100%', min: 90, max: 100, count: 0 },
    { label: '80-89%', min: 80, max: 89, count: 0 },
    { label: '70-79%', min: 70, max: 79, count: 0 },
    { label: '60-69%', min: 60, max: 69, count: 0 },
    { label: '50-59%', min: 50, max: 59, count: 0 },
    { label: 'Below 50%', min: 0, max: 49, count: 0 },
  ];
  results.forEach(r => {
    const range = ranges.find(range => r.percentageScore >= range.min && r.percentageScore <= range.max);
    if (range) range.count++;
  });

  const pieData = [
    { name: 'Passed', value: passCount },
    { name: 'Failed', value: totalSubmissions - passCount }
  ];
  const COLORS = ['#10b981', '#ef4444'];

  const filteredResults = results.filter(r =>
    (r.studentName || '').toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ['Student Name', 'Score', 'Total', 'Percentage', 'Flagged', 'Submitted At'];
    const rows = results.map(r => [
      r.studentName || '-',
      r.score,
      r.totalQuestions,
      r.percentageScore + '%',
      r.flagged ? 'Yes' : 'No',
      new Date(r.submittedAt).toLocaleString()
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam-results-${exam?.title || 'export'}.csv`;
    a.click();
  };

  const StatCard = ({ label, value, color, icon }) => (
    <div className="card stat-card" style={{ borderLeftColor: color, padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        </div>
        <div style={{ fontSize: '1.5rem' }}>{icon}</div>
      </div>
    </div>
  );

  return (
    <div className="exam-results-page">
      <div className="page-header">
        <div>
          <h1>Exam Results</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>{exam?.title} — Grade {exam?.grade}</p>
        </div>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/teacher/exams')}>← Back to Exams</button>
          <button className="btn" onClick={exportCSV}>📥 Export CSV</button>
        </div>
      </div>

      <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Submissions" value={totalSubmissions} color="#4f46e5" icon="👥" />
        <StatCard label="Average" value={`${avgScore}%`} color="#3b82f6" icon="📊" />
        <StatCard label="Highest" value={`${highest}%`} color="#10b981" icon="🏆" />
        <StatCard label="Lowest" value={`${lowest}%`} color="#f59e0b" icon="📉" />
        <StatCard label="Pass Rate" value={`${totalSubmissions > 0 ? Math.round((passCount / totalSubmissions) * 100) : 0}%`} color="#8b5cf6" icon="✅" />
        <StatCard label="Flagged" value={flaggedCount} color="#ef4444" icon="⚠️" />
      </div>

      {totalSubmissions > 0 && (
        <div className="dashboard-charts" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 600 }}>Score Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ranges} barRadius={[6, 6, 0, 0]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="count" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 600 }}>Pass vs Fail</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie 
                  data={pieData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={90} 
                  innerRadius={55}
                  paddingAngle={5}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Student Results</h3>
          <input
            placeholder="Search student..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 250 }}
          />
        </div>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Student</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No results found</td></tr>
              ) : (
                filteredResults.map((r, idx) => (
                  <tr key={r._id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: '50%', 
                          background: r.percentageScore >= 50 ? '#d1fae5' : '#fee2e2', 
                          color: r.percentageScore >= 50 ? '#065f46' : '#991b1b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}>
                          {r.percentageScore}%
                        </div>
                        <strong>{r.studentName || '-'}</strong>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.score} / {r.totalQuestions}</td>
                    <td style={{ width: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '100%',
                          maxWidth: 100,
                          height: 6,
                          background: '#e2e8f0',
                          borderRadius: 3,
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${r.percentageScore}%`,
                            height: '100%',
                            background: r.percentageScore >= 50 ? '#10b981' : '#ef4444',
                            borderRadius: 3,
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: r.percentageScore >= 50 ? '#059669' : '#dc2626' }}>{r.percentageScore}%</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{new Date(r.submittedAt).toLocaleString()}</td>
                    <td>
                      {r.percentageScore >= 50 ? (
                        <Badge variant="success">Passed</Badge>
                      ) : (
                        <Badge variant="danger">Failed</Badge>
                      )}
                    </td>
                    <td>
                      {r.flagged ? (
                        <Badge variant="danger">⚠️ Flagged</Badge>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>—</span>
                      )}
                      {r.flagReasons?.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                          {r.flagReasons.join(', ')}
                        </div>
                      )}
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
