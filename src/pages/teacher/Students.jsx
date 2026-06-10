import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { formatMonth } from '../../utils/formatMonth.js';
import { getGradeDisplayName } from '../../utils/gradeDisplay.js';
import api from '../../services/api.js';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [gradeFilter, setGradeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [payments, setPayments] = useState({});
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ fullName: '', grade: '', groupId: '', phone: '', parentPhone: '', qrCode: '' });
  const [qrBuffer, setQrBuffer] = useState('');
  const qrBufferRef = useRef('');
  const qrInputRef = useRef(null);
  const navigate = useNavigate();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [gradesList, setGradesList] = useState([]);

  const fetchStudents = async () => {
    try {
      const params = new URLSearchParams();
      if (gradeFilter) params.append('grade', gradeFilter);
      if (search) params.append('search', search);
      const res = await api.get(`/teacher/students?${params.toString()}`);
      setStudents(res.data?.data || res.data || []);

      const payRes = await api.get(`/payments?month=${currentMonth}`);
      const paymentsArr = payRes.data?.data || payRes.data || [];
      const map = {};
      paymentsArr.forEach(p => {
        map[p.studentId?._id || p.studentId] = p.isPaid;
      });
      setPayments(map);

      const groupRes = await api.get('/groups');
      setGroups(groupRes.data?.data || groupRes.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [gradeFilter, search]);

  useEffect(() => {
    api.get('/grades').then(res => setGradesList(res.data.data || []));
  }, []);

  useEffect(() => {
    if (!showModal) return;
    qrBufferRef.current = '';
    setQrBuffer('');
    if (!form.grade && gradesList.length) {
      setForm(prev => ({ ...prev, grade: gradesList[0].name }));
    }
  }, [showModal]);

  useEffect(() => {
    setForm(prev => ({ ...prev, groupId: '' }));
  }, [form.grade]);

  const handleQrKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (qrBufferRef.current.trim()) {
        setForm(prev => ({ ...prev, qrCode: qrBufferRef.current.trim() }));
        qrBufferRef.current = '';
        setQrBuffer('');
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      qrBufferRef.current = qrBufferRef.current + e.key;
      setQrBuffer(qrBufferRef.current);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.groupId) delete payload.groupId;
    await api.post('/teacher/students', payload);
    setShowModal(false);
    setForm({ fullName: '', grade: gradesList[0]?.name || '', groupId: '', phone: '', parentPhone: '', qrCode: '' });
    fetchStudents();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this student?')) return;
    await api.delete(`/teacher/students/${id}`);
    fetchStudents();
  };

  const availableGroups = groups.filter(g => {
    const groupGrade = String(g.grade || '').trim();
    const selectedGrade = String(form.grade || '').trim();
    return groupGrade === selectedGrade;
  });

  return (
    <div className="students-page">
      <div className="page-header">
        <h1>Students</h1>
        <button className="btn" onClick={() => setShowModal(true)}>+ Add Student</button>
      </div>
      
      <div className="filters card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <input 
          placeholder="Search by name..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          style={{ maxWidth: 300 }}
        />
        <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All Grades</option>
          {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
        </select>
      </div>
      
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Grade</th>
                <th>Group</th>
                <th>Phone</th>
                <th>QR Code</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s._id} onClick={() => navigate(`/teacher/students/${s._id}`)} className="clickable">
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ 
                        width: 36, 
                        height: 36, 
                        borderRadius: '50%', 
                        background: '#e0e7ff', 
                        color: '#4f46e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.875rem'
                      }}>
                        {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <strong>{s.fullName}</strong>
                    </div>
                  </td>
                   <td><span className="badge badge-neutral">{getGradeDisplayName(s.grade)}</span></td>
                   <td>{s.groupId?.name || '-'}</td>
                  <td>{s.phone || '-'}</td>
                  <td><code style={{ background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: 4, fontSize: '0.8rem' }}>{s.qrCode}</code></td>
                  <td>
                    {payments[s._id] !== undefined ? (
                      payments[s._id] ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">Unpaid</Badge>
                    ) : <Badge variant="neutral">-</Badge>}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 4 }}>({formatMonth(currentMonth)})</span>
                  </td>
                  <td>
                    <div className="row-actions" onClick={e => e.stopPropagation()}>
                      <button className="btn btn-ghost" onClick={() => navigate(`/teacher/students/${s._id}`)}>View</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(s._id)}>Deactivate</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Student">
        <form onSubmit={handleAdd}>
          <div className="form-group"><label>Full Name</label><input required value={form.fullName} onChange={e => setForm(prev => ({ ...prev, fullName: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group">
              <label>Grade</label>
              <select value={form.grade} onChange={e => setForm(prev => ({ ...prev, grade: e.target.value }))}>
                {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Group</label>
              <select value={form.groupId} onChange={e => setForm(prev => ({ ...prev, groupId: e.target.value }))}>
                <option value="">No Group</option>
                {availableGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} /></div>
            <div className="form-group"><label>Parent Phone</label><input value={form.parentPhone} onChange={e => setForm(prev => ({ ...prev, parentPhone: e.target.value }))} /></div>
          </div>
          <div className="form-group" onClick={() => qrInputRef.current?.focus()}>
            <label>QR Code</label>
            <input ref={qrInputRef} onKeyDown={handleQrKeyDown} style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} autoFocus />
            <div className="qr-scan-box" style={{ padding: '0.6rem 0.75rem', border: '2px dashed var(--primary)', borderRadius: 'var(--radius-sm)', background: '#eef2ff', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', marginBottom: '0.5rem', textAlign: 'center' }}>
              {form.qrCode ? form.qrCode : qrBuffer ? `Scanning: ${qrBuffer}` : 'Click here then scan QR code'}
            </div>
            <input placeholder="Or type QR code manually" value={form.qrCode} onChange={e => setForm(prev => ({ ...prev, qrCode: e.target.value }))} />
          </div>
          <button className="btn" type="submit" disabled={!form.qrCode || !form.fullName}>Save</button>
        </form>
      </Modal>
    </div>
  );
}
