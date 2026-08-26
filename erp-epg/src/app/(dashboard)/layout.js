import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";

export default function DashboardLayout({ children }) {
  return (
    <div className="grid min-h-dvh w-full grid-rows-[auto_1fr]">
      <Topbar />
      <div className="grid grid-cols-[248px_1fr]">
        <Sidebar />
        <main className="min-w-0 bg-crema px-7 py-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
