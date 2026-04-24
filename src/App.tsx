import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { RulesPage } from "./pages/RulesPage";
import { ResultsPage } from "./pages/ResultsPage";
import { ProfilingPage } from "./pages/ProfilingPage";
import { ProfilingHistoryPage } from "./pages/ProfilingHistoryPage";
import { SchedulerPage } from "./pages/SchedulerPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<ConnectionsPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/scheduler" element={<SchedulerPage />} />
            <Route path="/profiling" element={<ProfilingPage />} />
            <Route path="/profiling/history" element={<ProfilingHistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
