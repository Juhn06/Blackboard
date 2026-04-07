import { createBrowserRouter } from "react-router";
import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";
import BoardPage from "./pages/board";
import PlannerPage from "./pages/planner";

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
]);
