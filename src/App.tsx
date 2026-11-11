import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { SoundToggle } from '@/components/SoundToggle'
import { LandingPage } from '@/routes/LandingPage'
import { TeacherHomePage } from '@/routes/TeacherHomePage'
import { TeacherBankPage } from '@/routes/TeacherBankPage'
import { TeacherNewGamePage } from '@/routes/TeacherNewGamePage'
import { TeacherRoomPage } from '@/routes/TeacherRoomPage'
import { StudentJoinPage } from '@/routes/StudentJoinPage'
import { DevRealtimePage } from '@/routes/DevRealtimePage'
import { NotFoundPage } from '@/routes/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <SoundToggle />
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* 老師端 */}
        <Route path="/teacher" element={<TeacherHomePage />} />
        <Route path="/teacher/bank" element={<TeacherBankPage />} />
        <Route path="/teacher/new" element={<TeacherNewGamePage />} />
        <Route path="/teacher/room/:roomCode" element={<TeacherRoomPage />} />

        {/* 學生端 */}
        <Route path="/join" element={<StudentJoinPage />} />
        <Route path="/join/:roomCode" element={<StudentJoinPage />} />

        {/* 開發用 */}
        <Route path="/dev/realtime" element={<DevRealtimePage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
