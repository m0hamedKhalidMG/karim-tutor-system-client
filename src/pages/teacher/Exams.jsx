import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';
import api from '../../services/api.js';

export default function Exams() {
  const [exams, setExams] = useState([]);
  const navigate = useNavigate();

  const fetchExams = async () => {
    const res = await api.get('/exams');
    setExams(res.data);
  };

  useEffect(() => { fetchExams(); }, []);

  const toggleActive = async (id, current) => {
    if (current) {
      await api.put(`/exams/${id}/deactivate`);
    } else {
      await api.put(`/exams/${id}/activate`);
    }
    fetchExams();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exam?')) return;
    await api.delete(`/exams/${id}`);
    fetchExams();
  };

  const copyExamLink = (id) => {
    const link = `${window.location.origin}/exam/${id}`;
    navigator.clipboard.writeText(link);
    alert('Exam link copied to clipboard!\nShare this link with students.\n\n' + link);
  };

  const openResults = (id) => {
    navigate(`/teacher/exams/${id}/results`);
  };

  return (
    <div className="exams-page">
      <div className="page-header">
        <h1>Exams</h1>
        <button className="btn" onClick={() => navigate('/teacher/exams/new')}>Create New Exam</button>
      </div>
      <div className="card">
        <DataTable
          columns={[
            { header: 'Title', accessor: 'title' },
            { header: 'Grade', accessor: 'grade' },
            { header: 'Questions', render: (row) => row.questions?.length || 0 },
            { header: 'Status', render: (row) => <Badge variant={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Published' : 'Draft'}</Badge> },
            { header: 'Scheduled', render: (row) => row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString() : '-' },
            { header: 'Actions', render: (row) => (
              <div className="row-actions">
                <button className="btn btn-ghost" onClick={() => navigate(`/teacher/exams/${row._id}/edit`)}>Edit</button>
                <button className="btn btn-ghost" onClick={() => toggleActive(row._id, row.isActive)}>{row.isActive ? 'Unpublish' : 'Publish'}</button>
                {row.isActive && (
                  <button className="btn btn-ghost" onClick={() => copyExamLink(row._id)}>Copy Link</button>
                )}
                <button className="btn btn-ghost" onClick={() => openResults(row._id)}>Results</button>
                <button className="btn btn-danger" onClick={() => handleDelete(row._id)}>Delete</button>
              </div>
            ) }
          ]}
          data={exams}
        />
      </div>
    </div>
  );
}
