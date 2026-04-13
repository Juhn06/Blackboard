import { createBrowserRouter } from "react-router";
import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";
import BoardPage from "./pages/board";
import PlannerPage from "./pages/planner";
import MembersPage from "./pages/members";
import SettingsPage from "./pages/settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LoginPage,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/dashboard",
    Component: DashboardPage,
  },
  {
    path: "/board/:id",
    Component: BoardPage,
  },
  {
    path: "/planner",
    Component: PlannerPage,
  },
  {
    path: "/members",
    Component: MembersPage,
  },
  {
    path: "/settings",
    Component: SettingsPage,
  },
]);
