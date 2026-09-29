import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import { useParams } from 'react-router-dom';

export default function MainLayout () {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { conversationId } = useParams();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-surface-dark">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeConversationId={conversationId}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet context={{ openSidebar: () => setSidebarOpen(true), conversationId }} />
      </div>
    </div>
  );
}
