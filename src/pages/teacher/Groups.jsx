import React, { useEffect, useState } from 'react';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import api from '../../services/api.js';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', grade: '', description: '' });
  const [gradesList, setGradesList] = useState([]);

  useEffect(() => {
    api.get('/grades').then(res => setGradesList(res.data.data || []));
  }, []);

  const fetchGroups = async () => {
    const res = await api.get('/groups');
    setGroups(res.data);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (editing) {
      await api.put(`/groups/${editing}`, form);
    } else {
      await api.post('/groups', form);
    }
    setShowModal(false);
    setEditing(null);
    setForm({ name: '', grade: gradesList[0]?.name || '', description: '' });
    fetchGroups();
  };

  const handleEdit = (group) => {
    setEditing(group._id);
    setForm({ name: group.name, grade: group.grade, description: group.description || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this group?')) return;
    await api.delete(`/groups/${id}`);
    fetchGroups();
  };

  return (
    <div className="groups-page">
      <div className="page-header">
        <h1>Groups</h1>
        <button className="btn" onClick={() => { setEditing(null); setForm({ name: '', grade: gradesList[0]?.name || '', description: '' }); setShowModal(true); }}>Add New Group</button>
      </div>
      <div className="card">
        <DataTable
          columns={[
            { header: 'Name', accessor: 'name' },
            { header: 'Grade', accessor: 'grade' },
            { header: 'Description', accessor: 'description' },
            { header: 'Actions', render: (row) => (
              <div className="row-actions">
                <button className="btn btn-ghost" onClick={() => handleEdit(row)}>Edit</button>
                <button className="btn btn-danger" onClick={() => handleDelete(row._id)}>Delete</button>
              </div>
            ) }
          ]}
          data={groups}
        />
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Group' : 'Add New Group'}>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Group Name</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grade 7 - Group A" />
          </div>
          <div className="form-group">
            <label>Grade</label>
            <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
              {gradesList.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn" type="submit">Save</button>
        </form>
      </Modal>
    </div>
  );
}
