import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalStudents: 0, presentToday: 0, unpaidThisMonth: 0, activeExams: 0 });
  const [attendanceData, setAttendanceData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [absentToday, setAbsentToday] = useState([]);
  const [unpaidStudents, setUnpaidStudents] = useState([]);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsRes, todayRes, paymentsRes, examsRes] = await Promise.all([
          api.get('/teacher/students'),
          api.get('/attendance/today'),
          api.get(`/payments?month=${currentMonth}`),
          api.get('/exams')
        ]);

        const students = studentsRes.data || [];
        const todayRecords = todayRes.data.data || [];
        const payments = paymentsRes.data.data || [];
        const exams = examsRes.data || [];

        const totalStudents = students.length;
        const presentToday = todayRecords.filter(r => r.status === 'present').length;
        const unpaidThisMonth = payments.filter(p => !p.isPaid).length;
        const activeExams = exams.filter(e => e.isActive).length;
        setStats({ totalStudents, presentToday, unpaidThisMonth, activeExams });

        const last7 = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          last7.push({ date: d.toISOString().slice(0, 10), present: 0, absent: 0 });
        }
        const histRes = await api.get(`/attendance/history?month=${currentMonth}`);
        const history = histRes.data.data || [];
        last7.forEach(day => {
          const recs = history.filter(h => new Date(h.date).toISOString().slice(0, 10) === day.date);
          day.present = recs.filter(r => r.status === 'present').length;
          day.absent = recs.filter(r => r.status === 'absent').length;
        });
        setAttendanceData(last7);

        const paid = payments.filter(p => p.isPaid).length;
        const unpaid = payments.filter(p => !p.isPaid).length;
        setPaymentData([
          { name: 'Paid', value: paid },
          { name: 'Unpaid', value: unpaid }
        ]);

        const presentStudentIds = new Set(todayRecords.map(r => r.studentId?._id || r.studentId));
        const absent = students.filter(s => !presentStudentIds.has(s._id));
        setAbsentToday(absent.map(s => ({ name: s.fullName, grade: s.grade, _id: s._id })));

        setUnpaidStudents(payments.filter(p => !p.isPaid).map(p => ({
          name: p.studentId?.fullName || 'Unknown',
          grade: p.studentId?.grade || '',
          month: p.month
        })));
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [currentMonth]);

  const COLORS = ['#10b981', '#f59e0b'];

  const StatCard = ({ label, value, icon, color }) => (
    <div className="card stat-card" style={{ borderLeftColor: color }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
        <div style={{ fontSize: '2rem', opacity: 0.8 }}>{icon}</div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>
      
      <div className="stats-row">
        <StatCard label="Total Students" value={stats.totalStudents} icon="👥" color="#4f46e5" />
        <StatCard label="Present Today" value={stats.presentToday} icon="✅" color="#10b981" />
        <StatCard label="Unpaid This Month" value={stats.unpaidThisMonth} icon="💰" color="#f59e0b" />
        <StatCard label="Active Exams" value={stats.activeExams} icon="📝" color="#ef4444" />
      </div>

      <div className="dashboard-charts">
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Attendance (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={attendanceData} barGap={0} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
              <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} name="Present" />
              <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Payments This Month</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie 
                data={paymentData} 
                dataKey="value" 
                nameKey="name" 
                cx="50%" 
                cy="50%" 
                outerRadius={100} 
                innerRadius={60}
                paddingAngle={4}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {paymentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dashboard-tables">
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Absent Today</h3>
          {absentToday.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No absent students today 🎉</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Name</th><th>Grade</th></tr>
                </thead>
                <tbody>
                  {absentToday.map((s, i) => (
                    <tr key={i} onClick={() => navigate(`/teacher/students/${s._id}`)} className="clickable">
                      <td><strong>{s.name}</strong></td>
                      <td><span className="badge badge-neutral">Grade {s.grade}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Unpaid Fees This Month</h3>
          {unpaidStudents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>All payments are up to date 🎉</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Name</th><th>Grade</th><th>Month</th></tr>
                </thead>
                <tbody>
                  {unpaidStudents.map((s, i) => (
                    <tr key={i}>
                      <td><strong>{s.name}</strong></td>
                      <td><span className="badge badge-neutral">Grade {s.grade}</span></td>
                      <td><span className="badge badge-warning">{s.month}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
