import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { LandingPage } from './features/landing/LandingPage'
import { RequireStudent } from './routes/RequireStudent'
import { RequireTeacher } from './routes/RequireTeacher'
import { StudentLoginPage } from './features/student/StudentLoginPage'
import { PortfolioPage } from './features/student/PortfolioPage'
import { NewSubmissionPage } from './features/student/NewSubmissionPage'
import { TeacherLoginPage } from './features/teacher/TeacherLoginPage'
import { StudentManagePage } from './features/teacher/StudentManagePage'
import { StudentDetailPage } from './features/teacher/StudentDetailPage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/student/login" element={<StudentLoginPage />} />
        <Route
          path="/student"
          element={
            <RequireStudent>
              <PortfolioPage />
            </RequireStudent>
          }
        />
        <Route
          path="/student/new"
          element={
            <RequireStudent>
              <NewSubmissionPage />
            </RequireStudent>
          }
        />
        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route
          path="/teacher/students"
          element={
            <RequireTeacher>
              <StudentManagePage />
            </RequireTeacher>
          }
        />
        <Route
          path="/teacher/students/:code"
          element={
            <RequireTeacher>
              <StudentDetailPage />
            </RequireTeacher>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
