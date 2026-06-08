import React, { useEffect, useState } from 'react';
import { useToast } from '../../components/ui/Toast.jsx';
import api from '../../services/api.js';

export default function Grades() {
  const { addToast } = useToast();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', order: 0 });

  const fetchGrades = async () => {
    setLoading(true);
    try {
      const res = await api.get('/grades/all');
      setGrades(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrades();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/grades/${editingId}`, form);
        addToast('Grade updated', 'success');
      } else {
        await api.post('/grades', form);
        addToast('Grade created', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', order: 0 });
      fetchGrades();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save grade', 'error');
    }
  };

  const handleEdit = (grade) => {
    setForm({ name: grade.name, order: grade.order });
    setEditingId(grade._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure? This will deactivate the grade.')) return;
    try {
      await api.delete(`/grades/${id}`);
      addToast('Grade deactivated', 'success');
      fetchGrades();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  return (
    <div className="grades-page">
      <div className="page-header">
        <h1>Grades</h1>
        <button className="btn" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', order: 0 }); }}>
          {showForm ? 'Cancel' : '+ Add Grade'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{editingId ? 'Edit Grade' : 'Add New Grade'}</h3>
          <form onSubmit={handleSubmit} className="form-row" style={{ gap: '0.75rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
              <label>Grade Name</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grade 10" />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Sort Order</label>
              <input type="number" value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })} />
            </div>
            <button className="btn" type="submit">{editingId ? 'Update' : 'Create'}</button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>All Grades <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 400 }}>({grades.length})</span></h3>
        </div>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" /></div>
        ) : grades.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No grades found. Create your first grade.</div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr><th>Name</th><th>Order</th><th>Status</th><th style={{ width: 140 }}>Actions</th></tr>
              </thead>
              <tbody>
                {grades.map(g => (
                  <tr key={g._id}>
                    <td><strong>{g.name}</strong></td>
                    <td>{g.order}</td>
                    <td><span className={`badge badge-${g.isActive ? 'success' : 'danger'}`}>{g.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => handleEdit(g)}>Edit</button>
                        <button className="btn btn-ghost" style={{ fontSize: '0.8rem', color: '#ef4444' }} onClick={() => handleDelete(g._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
