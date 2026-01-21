import Link from 'next/link';
import { FileText, Settings, LayoutDashboard, BookOpen } from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 hidden md:block">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
                        <FileText className="w-8 h-8" />
                        Naraworks
                    </h1>
                </div>
                <nav className="mt-6 px-4 space-y-2">
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="font-medium">Dashboard</span>
                    </Link>
                    <Link href="/knowledge" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">
                        <BookOpen className="w-5 h-5" />
                        <span className="font-medium">Knowledge</span>
                    </Link>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-left">
                        <Settings className="w-5 h-5" />
                        <span className="font-medium">Settings</span>
                    </button>
                </nav>
                <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
                    <div className="flex items-center gap-3 px-4 py-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            U
                        </div>
                        <div className="text-sm">
                            <p className="font-medium text-gray-900">User</p>
                            <p className="text-gray-500">Free Plan</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
