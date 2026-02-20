import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsDialog } from './components/SettingsDialog';
import { ToolApprovalDialog } from './components/ToolApprovalDialog';
import { useEffect } from 'react';
import { useConfigStore } from './stores/config-store';
import { useSessionStore } from './stores/session-store';

export default function App() {
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const loadSessions = useSessionStore((s) => s.loadSessions);

  useEffect(() => {
    loadConfig();
    loadSessions();
  }, [loadConfig, loadSessions]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <ChatArea />
      <SettingsDialog />
      <ToolApprovalDialog />
    </div>
  );
}
