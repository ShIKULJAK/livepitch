import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar />
      <div className="min-w-0 flex-1 pb-20 lg:ml-[250px] lg:pb-0">
        <Topbar />
        <main id="main-content" className="mx-auto w-full max-w-[1600px] space-y-4 p-4 lg:p-6">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

