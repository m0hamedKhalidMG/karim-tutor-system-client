import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { egyptDateString } from '../../utils/timezone.js';
import { getGradeDisplayName } from '../../utils/gradeDisplay.js';
import api from '../../services/api.js';

const COLORS = { present: '#10b981', absent: '#ef4444', notMarked: '#e5e7eb' };

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const AR_DAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

function formatMonthAR(monthStr) {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  return `${AR_MONTHS[parseInt(month) - 1]} ${year}`;
}

function formatDateAR(date) {
  const d = new Date(date);
  const dayName = AR_DAYS[d.getDay()];
  const dayNum = d.getDate();
  const monthName = AR_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}، ${dayNum} ${monthName} ${year}`;
}

export default function ParentPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    api.get(`/parent/${token}`)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.message || 'الرابط غير صالح أو منتهي الصلاحية'));
  }, [token]);

  if (error) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem', maxWidth: 480, width: '100%' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>الرابط غير صالح</h2>
          <p style={{ color: 'var(--text-secondary)' }}>الرابط الذي استخدمته غير صالح أو منتهي الصلاحية. يرجى التواصل مع المدرس للحصول على رابط جديد.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'inline-block', width: 48, height: 48, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const { student, attendance, payments, examResults } = data;
  const totalSessions = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const notMarkedCount = Math.max(0, totalSessions - presentCount - absentCount);
  const attendancePct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentPayment = payments.find(p => p.month === currentMonth);

  const pieData = [
    { name: 'حاضر', value: presentCount, color: COLORS.present },
    { name: 'غائب', value: absentCount, color: COLORS.absent },
  ].filter(d => d.value > 0);

  const recentAttendance = attendance.slice(0, 10);

  const examChartData = examResults.slice(0, 10).reverse().map(r => ({
    name: r.examId?.title?.slice(0, 15) || 'امتحان',
    score: r.percentageScore || 0
  }));

  const getAvatar = (name) => (name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '0.75rem 1.25rem',
        border: 'none',
        background: activeTab === id ? 'var(--primary)' : 'transparent',
        color: activeTab === id ? '#fff' : 'var(--text-secondary)',
        borderRadius: 'var(--radius-sm)',
        fontWeight: 600,
        fontSize: '0.875rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        whiteSpace: 'nowrap'
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );

  const SectionCard = ({ title, children, style = {} }) => (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', ...style }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {title}
      </h3>
      {children}
    </div>
  );

  const StatCard = ({ label, value, color, sub }) => (
    <div className="card stat-card" style={{ borderRightColor: color, borderLeft: 'none', borderRight: '4px solid', padding: '1.25rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #3b82f6 100%)', color: '#fff', padding: '2.5rem 1.5rem', marginBottom: '2rem' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 800, border: '2px solid rgba(255,255,255,0.25)'
            }}>
              {getAvatar(student.fullName)}
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{student.fullName}</h1>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', color: '#dbeafe', fontWeight: 500 }}>
                الصف {getGradeDisplayName(student.grade)} {student.groupId?.name ? `• ${student.groupId.name}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 1.5rem' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: '#fff', padding: '0.4rem', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
          <TabButton id="overview" label="نظرة عامة" icon="🏠" />
          <TabButton id="attendance" label="الحضور" icon="📋" />
          <TabButton id="payments" label="المدفوعات" icon="💰" />
          <TabButton id="exams" label="الامتحانات" icon="📝" />
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Quick Stats */}
            <div className="stats-row" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <StatCard
                label="نسبة الحضور"
                value={`${attendancePct}%`}
                color="#4f46e5"
                sub={`${presentCount} من ${totalSessions} محاضرة`}
              />
              <StatCard
                label="حالة الدفع"
                value={currentPayment?.isPaid ? 'مدفوع ✅' : 'معلق ⏳'}
                color={currentPayment?.isPaid ? '#10b981' : '#f59e0b'}
                sub={currentPayment ? `${currentPayment.amount.toLocaleString('en-US')} جنيه` : 'لا يوجد سجل'}
              />
              <StatCard
                label="متوسط الدرجات"
                value={`${examResults.length > 0 ? Math.round(examResults.reduce((s, r) => s + (r.percentageScore || 0), 0) / examResults.length) : 0}%`}
                color="#3b82f6"
                sub={`${examResults.length} امتحان`}
              />
            </div>

            {/* Progress Bar for Attendance */}
            <SectionCard title="📊 تقدم الحضور">
              <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{
                  width: `${attendancePct}%`,
                  height: '100%',
                  background: attendancePct >= 75 ? '#10b981' : attendancePct >= 50 ? '#f59e0b' : '#ef4444',
                  borderRadius: 4,
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <span>نسبة الحضور: {attendancePct}%</span>
                <span>{presentCount} حاضر / {absentCount} غائب</span>
              </div>
            </SectionCard>

            {/* Recent Activity */}
            <div className="stats-row" style={{ marginBottom: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
              <SectionCard title="📋 آخر الحضور">
                {recentAttendance.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>لا توجد سجلات حضور بعد.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {recentAttendance.map(a => (
                      <div key={a._id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)',
                        background: a.status === 'present' ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${a.status === 'present' ? '#bbf7d0' : '#fecaca'}`
                      }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{formatDateAR(a.date)}</span>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: 'var(--radius-sm)',
                          background: a.status === 'present' ? '#10b981' : '#ef4444', color: '#fff'
                        }}>
                          {a.status === 'present' ? 'حاضر' : 'غائب'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="📝 آخر الامتحانات">
                {examResults.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>لا توجد نتائج امتحانات بعد.</p>
                ) : examChartData.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {examResults.slice(0, 5).map(r => (
                      <div key={r._id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)'
                      }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.examId?.title || 'امتحان'}</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: (r.percentageScore || 0) >= 60 ? '#10b981' : '#ef4444' }}>{r.percentageScore}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={examChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            </div>
          </>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <>
            <div className="stats-row" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <StatCard label="حاضر" value={presentCount} color="#10b981" />
              <StatCard label="غائب" value={absentCount} color="#ef4444" />
              <StatCard label="إجمالي السجلات" value={totalSessions} color="#4f46e5" />
            </div>

            <SectionCard title="📊 تفصيل الحضور">
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {pieData.length > 0 && (
                  <div style={{ width: 220, height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f0fdf4', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
                        <span style={{ fontWeight: 600 }}>حاضر</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>{presentCount}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                        <span style={{ fontWeight: 600 }}>غائب</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>{absentCount}</span>
                    </div>
                    {notMarkedCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e5e7eb' }} />
                          <span style={{ fontWeight: 600 }}>غير مسجل</span>
                        </div>
                        <span style={{ fontWeight: 700 }}>{notMarkedCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="📋 سجل الحضور الكامل">
              {attendance.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>لا توجد سجلات حضور بعد.</p>
              ) : (
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>اليوم</th>
                        <th>الحالة</th>
                        <th>الطريقة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map(a => {
                        const date = new Date(a.date);
                        return (
                          <tr key={a._id}>
                            <td>{egyptDateString(a.date, { locale: 'ar-EG' })}</td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{AR_DAYS[date.getDay()]}</td>
                            <td>
                              <span className={`badge badge-${a.status === 'present' ? 'success' : 'danger'}`}>
                                {a.status === 'present' ? 'حاضر' : 'غائب'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge badge-${a.markedVia === 'qr' ? 'info' : 'neutral'}`}>
                                {a.markedVia === 'qr' ? 'مسح QR' : 'يدوي'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <>
            <div className="stats-row" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <StatCard label="شهور مدفوعة" value={payments.filter(p => p.isPaid).length} color="#10b981" />
              <StatCard label="شهور معلقة" value={payments.filter(p => !p.isPaid).length} color="#f59e0b" />
              <StatCard label="إجمالي المدفوع" value={`${payments.filter(p => p.isPaid).reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString('en-US')} ج.م`} color="#4f46e5" />
            </div>

            <SectionCard title="💰 سجل المدفوعات">
              {payments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>لا توجد سجلات مدفوعات بعد.</p>
              ) : (
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>الشهر</th>
                        <th>المبلغ</th>
                        <th>الحالة</th>
                        <th>تاريخ الدفع</th>
                        <th>ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p._id} style={{ background: p.isPaid ? '#f0fdf4' : undefined }}>
                          <td><strong>{formatMonthAR(p.month)}</strong></td>
                          <td>{p.amount?.toLocaleString('en-US')} ج.م</td>
                          <td>
                            <span className={`badge badge-${p.isPaid ? 'success' : 'warning'}`}>
                              {p.isPaid ? 'مدفوع' : 'معلق'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{p.paidAt ? egyptDateString(p.paidAt, { locale: 'ar-EG' }) : '-'}</td>
                          <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{p.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}

        {/* EXAMS TAB */}
        {activeTab === 'exams' && (
          <>
            <div className="stats-row" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <StatCard label="الامتحانات" value={examResults.length} color="#4f46e5" />
              <StatCard label="المتوسط" value={`${examResults.length > 0 ? Math.round(examResults.reduce((s, r) => s + (r.percentageScore || 0), 0) / examResults.length) : 0}%`} color="#10b981" />
              <StatCard label="أعلى درجة" value={`${examResults.length > 0 ? Math.max(...examResults.map(r => r.percentageScore || 0)) : 0}%`} color="#f59e0b" />
            </div>

            {examChartData.length > 1 && (
              <SectionCard title="📈 تطور الدرجات">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={examChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                    <Bar dataKey="score" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            )}

            <SectionCard title="📝 نتائج الامتحانات">
              {examResults.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>لا توجد نتائج امتحانات بعد.</p>
              ) : (
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>الامتحان</th>
                        <th>الدرجة</th>
                        <th>النسبة</th>
                        <th>الحالة</th>
                        <th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examResults.map(r => (
                        <tr key={r._id} style={{ background: (r.percentageScore || 0) >= 60 ? '#f0fdf4' : '#fef2f2' }}>
                          <td><strong>{r.examId?.title || '-'}</strong></td>
                          <td>{r.score} / {r.totalQuestions}</td>
                          <td>
                            <span style={{ fontWeight: 700, color: (r.percentageScore || 0) >= 60 ? '#10b981' : '#ef4444' }}>
                              {r.percentageScore}%
                            </span>
                          </td>
                          <td>
                            {r.flagged ? (
                              <span className="badge badge-danger">مشتبه</span>
                            ) : (
                              <span className="badge badge-success">طبيعي</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{egyptDateString(r.submittedAt, { locale: 'ar-EG' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}
