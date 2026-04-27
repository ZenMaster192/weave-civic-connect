import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import CitizenDashboard from "./pages/citizen/Dashboard.tsx";
import RaiseIssue from "./pages/citizen/RaiseIssue.tsx";
import Activity from "./pages/citizen/Activity.tsx";
import VolunteerDashboard from "./pages/volunteer/Dashboard.tsx";
import Discover from "./pages/volunteer/Discover.tsx";
import Leaderboard from "./pages/volunteer/Leaderboard.tsx";
import NgoDashboard from "./pages/ngo/Dashboard.tsx";
import Members from "./pages/ngo/Members.tsx";
import Approvals from "./pages/ngo/Approvals.tsx";
import NgoActivity from "./pages/ngo/Activity.tsx";
import CitizenProfile  from "@/pages/citizen/ProfilePage.tsx";
import VolunteerProfile from "@/pages/volunteer/ProfilePage.tsx";
import NgoProfile from "@/pages/ngo/ProfilePage.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/:role" element={<Auth />} />

          <Route path="/citizen" element={<CitizenDashboard />} />
          <Route path="/citizen/raise" element={<RaiseIssue />} />
          <Route path="/citizen/activity" element={<Activity />} />

          <Route path="/volunteer" element={<VolunteerDashboard />} />
          <Route path="/volunteer/discover" element={<Discover />} />
          <Route path="/volunteer/leaderboard" element={<Leaderboard />} />

          <Route path="/ngo" element={<NgoDashboard />} />
          <Route path="/ngo/members" element={<Members />} />
          <Route path="/ngo/approvals" element={<Approvals />} />
          <Route path="/ngo/activity" element={<NgoActivity />} />

          <Route path="/citizen/profile"  element={<CitizenProfile />} />
          <Route path="/volunteer/profile" element={<VolunteerProfile />} />
          <Route path="/ngo/profile"       element={<NgoProfile />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
