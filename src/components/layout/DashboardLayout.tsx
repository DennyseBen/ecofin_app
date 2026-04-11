import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import FineChat from '../chat/FineChat'

export default function DashboardLayout() {
    return (
        <div className="app-shell flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <div className="flex-1 overflow-y-auto p-5 md:p-8">
                    <Outlet />
                </div>
                <FineChat />
            </main>
        </div>
    )
}
