import App from "./App.jsx";
import { DashboardProvider } from "./useDashboard.jsx";

export default function Dashboard() {
  return (
    <DashboardProvider>
      <App />
    </DashboardProvider>
  );
}
