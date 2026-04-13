import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { userAPI, workspacesAPI } from "../services/api";
import { Workspace } from "../../types/workspace";
import {
  Calendar,
  LayoutGrid,
  LogOut,
  Search,
  Settings,
  Users,
} from "lucide-react";

interface WorkspaceMember {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  roles: string[];
  primary_role: string;
}

const getWorkspaceIdFromSearch = (search: string): string => {
  const params = new URLSearchParams(search);
  return params.get("workspace") ?? "";
};

export default function MembersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await userAPI.me();
        setCurrentUser(user);
      } catch (error) {
        navigate("/login");
      }
    };

    loadUser();
  }, [navigate]);

  const loadWorkspaceMembers = async (workspaceId: string) => {
    setMembersLoading(true);
    try {
      const membersData: WorkspaceMember[] =
        await workspacesAPI.getWorkspaceMembers(workspaceId);
      setWorkspaceMembers(membersData);
    } catch (error) {
      console.error("Failed to load workspace members:", error);
      setWorkspaceMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    const loadWorkspaces = async () => {
      if (!currentUser) return;

      try {
        const workspacesData: Workspace[] = await workspacesAPI.getWorkspaces();
        setWorkspaces(workspacesData);

        if (workspacesData.length === 0) {
          setActiveWorkspaceId("");
          setWorkspaceMembers([]);
        }
      } catch (error) {
        console.error("Failed to load workspaces:", error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaces();
  }, [currentUser]);

  useEffect(() => {
    if (workspaces.length === 0) return;

    const queryWorkspaceId = getWorkspaceIdFromSearch(location.search);
    const hasQueryWorkspace = workspaces.some(
      (ws) => String(ws.id) === queryWorkspaceId,
    );
    const selectedWorkspaceId = hasQueryWorkspace
      ? queryWorkspaceId
      : String(workspaces[0].id);

    if (!hasQueryWorkspace) {
      navigate(`/members?workspace=${selectedWorkspaceId}`, { replace: true });
    }

    if (selectedWorkspaceId === activeWorkspaceId) return;

    setActiveWorkspaceId(selectedWorkspaceId);
    void loadWorkspaceMembers(selectedWorkspaceId);
  }, [workspaces, location.search, activeWorkspaceId, navigate]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) return;

    setActiveWorkspaceId(workspaceId);
    navigate(`/members?workspace=${workspaceId}`);
    await loadWorkspaceMembers(workspaceId);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const activeWorkspace =
    workspaces.find((ws) => String(ws.id) === activeWorkspaceId) ?? null;

  const filteredMembers = workspaceMembers.filter((member) => {
    const keyword = searchQuery.toLowerCase().trim();
    if (!keyword) return true;

    const roleText = member.roles.join(" ").toLowerCase();
    return (
      member.name?.toLowerCase().includes(keyword) ||
      member.email?.toLowerCase().includes(keyword) ||
      roleText.includes(keyword)
    );
  });

  if (!currentUser) return null;
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-purple-50">
        <p className="text-gray-700">Dang tai thanh vien...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 p-4 z-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2">
              <img src="/images/logo.png" alt="logo" className="w-28 h-20" />
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition text-gray-600 hover:bg-gray-100"
            >
              <LayoutGrid size={20} />
              <span>Bang</span>
            </button>
            <button
              onClick={() => navigate("/planner")}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition text-gray-600 hover:bg-gray-100"
            >
              <Calendar size={20} />
              <span>Trinh lap ke hoach</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition bg-[#0055bc42] text-[#051836]">
              <Users size={20} />
              <span>Thanh vien</span>
            </button>
          </nav>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Khong gian lam viec
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-400 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                {activeWorkspace?.name ? activeWorkspace.name.charAt(0) : "W"}
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                {activeWorkspace?.name ?? "Chua co khong gian lam viec"}
              </span>
            </div>
            {workspaces.length > 1 && (
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {workspaces
                  .filter((ws) => String(ws.id) !== activeWorkspaceId)
                  .map((ws) => {
                    const workspaceId = String(ws.id);
                    return (
                      <button
                        key={workspaceId}
                        onClick={() => handleSelectWorkspace(workspaceId)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition text-gray-600 hover:bg-gray-100"
                      >
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-blue-400 rounded-md flex items-center justify-center text-white font-semibold text-xs">
                          {ws.name?.charAt(0)?.toUpperCase() ?? "W"}
                        </div>
                        <span className="text-sm flex-1 truncate">{ws.name}</span>
                      </button>
                    );
                  })}
              </div>
            )}
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition text-sm">
              <Settings size={16} />
              <span>Cai dat</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 min-h-screen">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tim thanh vien theo ten, email, vai tro..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition text-red-600 border border-red-200 hover:bg-red-50"
            >
              <LogOut size={18} />
              <span>Dang xuat</span>
            </button>
          </div>
        </header>

        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Thanh vien</h1>
            <p className="text-gray-600">
              {activeWorkspace
                ? `Danh sach thanh vien tham gia "${activeWorkspace.name}"`
                : "Chua co khong gian lam viec"}
            </p>
          </div>

          {membersLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-gray-600">Dang tai danh sach thanh vien...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-gray-600">
                Khong tim thay thanh vien nao trong workspace nay.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center font-semibold text-lg">
                      {member.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        {member.name || "Unknown user"}
                      </p>
                      <p className="text-sm text-gray-600 truncate">{member.email}</p>
                      {member.phone && (
                        <p className="text-sm text-gray-500 truncate">{member.phone}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {member.roles.map((role) => (
                          <span
                            key={`${member.id}-${role}`}
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              role === "owner"
                                ? "bg-blue-100 text-blue-700"
                                : role === "admin"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
