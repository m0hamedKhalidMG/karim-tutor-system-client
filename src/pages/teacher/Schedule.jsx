import React, { useEffect, useState } from 'react';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import api from '../../services/api.js';

const ALL_DAYS = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];

export default function Schedule() {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ grade: '', groupId: '', bufferMinutes: 20 });
  // dayTimes: array of { day: 'Saturday', time: '16:00' }
  const [dayTimes, setDayTimes] = useState([]);
  const [gradesList, setGradesList] = useState([]);

  useEffect(() => {
    api.get('/grades').then(res => setGradesList(res.data.data || []));
  }, []);

  const fetchItems = async () => {
    const res = await api.get('/schedule');
    setItems(res.data);
  };

  const fetchGroups = async () => {
    const res = await api.get('/groups');
    setGroups(res.data);
  };

  useEffect(() => { fetchItems(); fetchGroups(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const payloadBase = { ...form };
    if (!payloadBase.groupId) delete payloadBase.groupId;

    if (editing) {
      const dt = dayTimes[0];
      await api.put(`/schedule/${editing}`, { ...payloadBase, dayOfWeek: dt.day, sessionTime: dt.time });
    } else {
      for (const dt of dayTimes) {
        await api.post('/schedule', { ...payloadBase, dayOfWeek: dt.day, sessionTime: dt.time });
      }
    }
    setShowModal(false);
    setEditing(null);
    setForm({ grade: gradesList[0]?.name || '', groupId: '', bufferMinutes: 20 });
    setDayTimes([]);
    fetchItems();
  };

  const addDay = () => {
    const used = new Set(dayTimes.map(d => d.day));
    const remaining = ALL_DAYS.filter(d => !used.has(d));
    if (remaining.length === 0) return;
    setDayTimes(prev => [...prev, { day: remaining[0], time: '16:00' }]);
  };

  const removeDay = (index) => {
    setDayTimes(prev => prev.filter((_, i) => i !== index));
  };

  const updateDay = (index, field, value) => {
    setDayTimes(prev => prev.map((dt, i) => i === index ? { ...dt, [field]: value } : dt));
  };

  const handleEdit = (item) => {
    setEditing(item._id);
    setForm({
      grade: item.grade,
      groupId: item.groupId?._id || item.groupId || '',
      bufferMinutes: item.bufferMinutes || 20
    });
    setDayTimes([{ day: item.dayOfWeek, time: item.sessionTime }]);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    await api.delete(`/schedule/${id}`);
    fetchItems();
  };

  const availableGroups = groups.filter(g => {
    const groupGrade = String(g.grade || '').replace(/^Grade\s*/, '');
    const selectedGrade = String(form.grade || '').replace(/^Grade\s*/, '');
    return groupGrade === selectedGrade;
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ grade: gradesList[0]?.name || '', groupId: '', bufferMinutes: 20 });
    setDayTimes([]);
    setShowModal(true);
  };

  const remainingDays = (index) => {
    const used = new Set(dayTimes.map((d, i) => i !== index ? d.day : null).filter(Boolean));
    return ALL_DAYS.filter(d => !used.has(d));
  };

  return (
    <div className="schedule-page">
      <div className="page-header">
        <h1>Schedule</h1>
        <button className="btn" onClick={openAdd}>Add Entry</button>
      </div>
      <div className="card">
        <DataTable
          columns={[
            { header: 'Grade', accessor: 'grade' },
            { header: 'Group', render: (row) => row.groupId?.name || 'All Students' },
            { header: 'Day', accessor: 'dayOfWeek' },
            { header: 'Time', accessor: 'sessionTime' },
            { header: 'Buffer (min)', render: (row) => row.bufferMinutes || 20 },
            { header: 'Actions', render: (row) => (
              <div className="row-actions">
                <button className="btn btn-ghost" onClick={() => handleEdit(row)}>Edit</button>
                <button className="btn btn-danger" onClick={() => handleDelete(row._id)}>Delete</button>
              </div>
            ) }
          ]}
          data={items}
        />
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Schedule' : 'Add Schedule'}>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Grade</label>
            <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
              {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Group (optional)</label>
            <select value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}>
              <option value="">All Students in Grade</option>
              {availableGroups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Days & Times</label>
            {dayTimes.map((dt, index) => (
              <div key={index} className="day-time-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                {editing ? (
                  <select value={dt.day} onChange={e => updateDay(index, 'day', e.target.value)} style={{ minWidth: 120 }}>
                    {ALL_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : (
                  <select value={dt.day} onChange={e => updateDay(index, 'day', e.target.value)} style={{ minWidth: 120 }}>
                    {remainingDays(index).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
                <input
                  type="time"
                  value={dt.time}
                  onChange={e => updateDay(index, 'time', e.target.value)}
                  style={{ minWidth: 120 }}
                  required
                />
                {!editing && dayTimes.length > 1 && (
                  <button type="button" className="btn btn-danger" onClick={() => removeDay(index)} style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>Remove</button>
                )}
              </div>
            ))}
            {!editing && (
              <button type="button" className="btn btn-ghost" onClick={addDay} disabled={dayTimes.length >= 7} style={{ marginTop: '0.25rem' }}>
                + Add Day
              </button>
            )}
          </div>

          <div className="form-group">
            <label>Auto-Absent Buffer (minutes)</label>
            <input type="number" value={form.bufferMinutes} onChange={e => setForm({ ...form, bufferMinutes: Number(e.target.value) })} min={0} required />
            <small style={{ color: 'var(--text-secondary)' }}>Mark absent automatically if student does not scan within this time after session starts</small>
          </div>
          <button className="btn" type="submit" disabled={dayTimes.length === 0}>
            {editing ? 'Save' : `Create ${dayTimes.length} Schedule Entries`}
          </button>
        </form>
      </Modal>
    </div>
  );
}
