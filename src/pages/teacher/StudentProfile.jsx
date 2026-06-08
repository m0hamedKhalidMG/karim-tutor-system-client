import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { formatMonth } from '../../utils/formatMonth.js';
import api from '../../services/api.js';

export default function StudentProfile() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [payments, setPayments] = useState([]);
  const [results, setResults] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tab, setTab] = useState('attendance');
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: '', grade: '', groupId: '', phone: '', parentPhone: '', qrCode: '' });
  const [saving, setSaving] = useState(false);
  const [gradesList, setGradesList] = useState([]);

  useEffect(() => {
    api.get('/grades').then(res => setGradesList(res.data.data || []));
  }, []);

  const fetchData = async () => {
    const [s, a, p, r, g] = await Promise.all([
      api.get(`/teacher/students/${id}`),
      api.get(`/teacher/students/${id}/attendance`),
      api.get(`/teacher/students/${id}/payments`),
      api.get(`/teacher/students/${id}/results`),
      api.get('/groups')
    ]);
    setStudent(s.data.data);
    setAttendance(a.data.data);
    setPayments(p.data.data);
    setResults(r.data.data);
    setGroups(g.data);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const openEdit = () => {
    if (!student) return;
    setEditForm({
      fullName: student.fullName || '',
      grade: student.grade || '7',
      groupId: student.groupId?._id || student.groupId || '',
      phone: student.phone || '',
      parentPhone: student.parentPhone || '',
      qrCode: student.qrCode || ''
    });
    setShowEdit(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...editForm };
    if (!payload.groupId) delete payload.groupId;
    try {
      await api.put(`/teacher/students/${id}`, payload);
      setShowEdit(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePay = async (payId, current) => {
    if (current) {
      await api.put(`/payments/${payId}/unpay`);
    } else {
      await api.put(`/payments/${payId}/pay`);
    }
    const p = await api.get(`/teacher/students/${id}/payments`);
    setPayments(p.data.data);
  };

  if (!student) return <div>Loading...</div>;

  const portalLink = `${window.location.origin}/parent/${student.parentAccessToken}`;
  const availableGroups = groups.filter(g => {
    const groupGrade = String(g.grade || '').replace(/^Grade\s*/, '');
    const selectedGrade = String(editForm.grade || '').replace(/^Grade\s*/, '');
    return groupGrade === selectedGrade;
  });

  return (
    <div className="student-profile-page">
      <div className="page-header">
        <h1>{student.fullName}</h1>
        <button className="btn" onClick={openEdit}>Edit Student</button>
      </div>

      <div className="card info-card">
        <div className="info-grid">
          <div><strong>Grade:</strong> {student.grade}</div>
          <div><strong>Group:</strong> {student.groupId?.name || 'Not assigned'}</div>
          <div><strong>Phone:</strong> {student.phone || '-'}</div>
          <div><strong>Parent Phone:</strong> {student.parentPhone || '-'}</div>
          <div><strong>QR Code:</strong> {student.qrCode}</div>
          <div className="portal-link">
            <strong>Parent Portal:</strong>{' '}
            <a href={portalLink} target="_blank" rel="noreferrer">{portalLink}</a>
            <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(portalLink)}>Copy</button>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Attendance</button>
        <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>Payments</button>
        <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>Exam Results</button>
      </div>

      {tab === 'attendance' && (
        <div className="card">
          <table>
            <thead><tr><th>Date</th><th>Status</th><th>Method</th></tr></thead>
            <tbody>
              {attendance.map(a => (
                <tr key={a._id}>
                  <td>{new Date(a.date).toLocaleDateString()}</td>
                  <td><Badge variant={a.status === 'present' ? 'success' : 'danger'}>{a.status}</Badge></td>
                  <td>{a.markedVia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card">
          <table>
            <thead><tr><th>Month</th><th>Amount (EGP)</th><th>Status</th><th>Paid Date</th><th>Actions</th></tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id}>
                  <td>{formatMonth(p.month)}</td>
                  <td>{p.amount}</td>
                  <td><Badge variant={p.isPaid ? 'success' : 'warning'}>{p.isPaid ? 'Paid' : 'Unpaid'}</Badge></td>
                  <td>{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '-'}</td>
                  <td>
                    <button className="btn btn-ghost" onClick={() => handleTogglePay(p._id, p.isPaid)}>
                      {p.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'results' && (
        <div className="card">
          <table>
            <thead><tr><th>Exam</th><th>Score</th><th>Percentage</th><th>Date</th><th>Flagged</th></tr></thead>
            <tbody>
              {results.map(r => (
                <tr key={r._id}>
                  <td>{r.examId?.title || '-'}</td>
                  <td>{r.score} / {r.totalQuestions}</td>
                  <td>{r.percentageScore}%</td>
                  <td>{new Date(r.submittedAt).toLocaleDateString()}</td>
                  <td>{r.flagged ? <Badge variant="danger">Yes</Badge> : <Badge variant="neutral">No</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Student">
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Full Name</label>
            <input required value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Grade</label>
            <select value={editForm.grade} onChange={e => setEditForm({ ...editForm, grade: e.target.value })}>
              {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Group</label>
            <select value={editForm.groupId} onChange={e => setEditForm({ ...editForm, groupId: e.target.value })}>
              <option value="">No Group</option>
              {availableGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Parent Phone</label>
            <input value={editForm.parentPhone} onChange={e => setEditForm({ ...editForm, parentPhone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>QR Code</label>
            <input required value={editForm.qrCode} onChange={e => setEditForm({ ...editForm, qrCode: e.target.value })} />
          </div>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </Modal>
    </div>
  );
}
