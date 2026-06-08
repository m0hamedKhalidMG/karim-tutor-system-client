import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

export default function TeacherLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { to: '/teacher/dashboard', label: 'Dashboard' },
    { to: '/teacher/grades', label: 'Grades' },
    { to: '/teacher/groups', label: 'Groups' },
    { to: '/teacher/students', label: 'Students' },
    { to: '/teacher/attendance', label: 'Attendance' },
    { to: '/teacher/attendance/history', label: 'History' },
    { to: '/teacher/payments', label: 'Payments' },
    { to: '/teacher/schedule', label: 'Schedule' },
    { to: '/teacher/exams', label: 'Exams' },
    { to: '/teacher/notifications', label: 'Notifications' },
  ];

  const handleLogout = async () => {
    await api.post('/auth/logout');
    navigate('/login');
  };

  const isActive = (to) => {
    if (to === '/teacher/attendance') {
      return location.pathname === '/teacher/attendance';
    }
    return location.pathname.startsWith(to);
  };

  return (
    <div className="teacher-layout">
      <button 
        className="mobile-menu-btn" 
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{ fontSize: '1.5rem' }}
      >
        ☰
      </button>
      
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">Karim Tutor</div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={isActive(item.to) ? 'active' : ''}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button className="sidebar-logout" onClick={handleLogout}>🚪 Logout</button>
      </aside>
      
      {mobileOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 40,
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}
      
      <main className="teacher-main">{children}</main>
    </div>
  );
}
