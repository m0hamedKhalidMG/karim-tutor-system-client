import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TeacherLayout from './components/layout/TeacherLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/teacher/Dashboard.jsx';
import Students from './pages/teacher/Students.jsx';
import StudentProfile from './pages/teacher/StudentProfile.jsx';
import AttendanceScanner from './pages/teacher/AttendanceScanner.jsx';
import AttendanceHistory from './pages/teacher/AttendanceHistory.jsx';
import Payments from './pages/teacher/Payments.jsx';
import Schedule from './pages/teacher/Schedule.jsx';
import Exams from './pages/teacher/Exams.jsx';
import ExamBuilder from './pages/teacher/ExamBuilder.jsx';
import ExamResults from './pages/teacher/ExamResults.jsx';
import Groups from './pages/teacher/Groups.jsx';
import Grades from './pages/teacher/Grades.jsx';
import Notifications from './pages/teacher/Notifications.jsx';
import ParentPortal from './pages/parent/ParentPortal.jsx';
import ExamPage from './pages/student/ExamPage.jsx';
import { useApi } from './hooks/useApi.js';

function ProtectedRoute({ children }) {
  const { data, loading } = useApi('/auth/me');
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!data?.loggedIn) return <Navigate to="/login" replace />;
  return <TeacherLayout>{children}</TeacherLayout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/parent/:token" element={<ParentPortal />} />
      <Route path="/exam/:examId" element={<ExamPage />} />
      <Route path="/teacher/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/teacher/grades" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
      <Route path="/teacher/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
      <Route path="/teacher/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
      <Route path="/teacher/students/:id" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
      <Route path="/teacher/attendance" element={<ProtectedRoute><AttendanceScanner /></ProtectedRoute>} />
      <Route path="/teacher/attendance/history" element={<ProtectedRoute><AttendanceHistory /></ProtectedRoute>} />
      <Route path="/teacher/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/teacher/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
      <Route path="/teacher/exams" element={<ProtectedRoute><Exams /></ProtectedRoute>} />
      <Route path="/teacher/exams/new" element={<ProtectedRoute><ExamBuilder /></ProtectedRoute>} />
      <Route path="/teacher/exams/:id/edit" element={<ProtectedRoute><ExamBuilder /></ProtectedRoute>} />
      <Route path="/teacher/exams/:examId/results" element={<ProtectedRoute><ExamResults /></ProtectedRoute>} />
      <Route path="/teacher/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
