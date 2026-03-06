import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import AssociationsPage from "@/pages/associations";
import UnitsPage from "@/pages/units";
import PersonsPage from "@/pages/persons";
import OwnersPage from "@/pages/owners";
import OccupancyPage from "@/pages/occupancy";
import BoardPage from "@/pages/board";
import DocumentsPage from "@/pages/documents";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/associations" component={AssociationsPage} />
      <Route path="/units" component={UnitsPage} />
      <Route path="/persons" component={PersonsPage} />
      <Route path="/owners" component={OwnersPage} />
      <Route path="/occupancy" component={OccupancyPage} />
      <Route path="/board" component={BoardPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center gap-2 p-2 border-b h-12">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
