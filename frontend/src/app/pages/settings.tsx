import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Activity,
  Calendar,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Save,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { userAPI, workspacesAPI } from "../services/api";
import { Workspace } from "../../types/workspace";

interface WorkspaceMember {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: "ADMIN" | "MEMBER";
  role_key: "admin" | "member";
  is_owner: boolean;
  can_update_role: boolean;
  can_remove: boolean;
}

interface WorkspaceBoard {
  id: number;
  name: string;
  created_by: number;
  created_by_name?: string | null;
  created_by_email?: string | null;
  created_at?: string | null;
}

interface WorkspaceActivity {
  id: number;
  board_id?: number | null;
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
  action: string;
  details?: string | null;
  created_at?: string | null;
}

interface NoticeState {
  type: "success" | "error";
  message: string;
}

const getWorkspaceIdFromSearch = (search: string): string => {
  const params = new URLSearchParams(search);
  return params.get("workspace") ?? "";
};

const normalizeWorkspaceName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const formatActivityTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");

  const [workspaceDetail, setWorkspaceDetail] = useState<Workspace | null>(null);
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    description: "",
    icon: "",
  });
  const [initialWorkspaceForm, setInitialWorkspaceForm] = useState({
    name: "",
    description: "",
    icon: "",
  });
  const [workspaceNameError, setWorkspaceNameError] = useState("");
  const [savingWorkspaceInfo, setSavingWorkspaceInfo] = useState(false);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<number | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [memberInput, setMemberInput] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "member">(
    "member",
  );
  const [memberInputError, setMemberInputError] = useState("");

  const [boards, setBoards] = useState<WorkspaceBoard[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [deletingBoardId, setDeletingBoardId] = useState<number | null>(null);

  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const [showDeleteWorkspaceConfirm, setShowDeleteWorkspaceConfirm] =
    useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  const [notice, setNotice] = useState<NoticeState | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const canManageWorkspace = Boolean(workspaceDetail?.can_manage);

  const activeWorkspace =
    workspaces.find((workspace) => String(workspace.id) === activeWorkspaceId) ??
    null;

  const hasWorkspaceInfoChanges = useMemo(() => {
    const currentName = workspaceForm.name.trim().replace(/\s+/g, " ");
    const initialName = initialWorkspaceForm.name.trim().replace(/\s+/g, " ");
    const currentDescription = workspaceForm.description.trim();
    const initialDescription = initialWorkspaceForm.description.trim();
    const currentIcon = workspaceForm.icon.trim();
    const initialIcon = initialWorkspaceForm.icon.trim();

    return (
      currentName !== initialName ||
      currentDescription !== initialDescription ||
      currentIcon !== initialIcon
    );
  }, [workspaceForm, initialWorkspaceForm]);

  const isWorkspaceNameDuplicate = useMemo(() => {
    const normalizedName = normalizeWorkspaceName(workspaceForm.name);
    if (!normalizedName) return false;

    return workspaces.some((workspace) => {
      if (String(workspace.id) === activeWorkspaceId) return false;
      return normalizeWorkspaceName(workspace.name ?? "") === normalizedName;
    });
  }, [workspaces, workspaceForm.name, activeWorkspaceId]);

  useEffect(() => {
    const normalizedName = normalizeWorkspaceName(workspaceForm.name);
    if (!normalizedName) {
      setWorkspaceNameError("Tên workspace không được để trống");
      return;
    }

    if (isWorkspaceNameDuplicate) {
      setWorkspaceNameError("Tên workspace đã tồn tại");
      return;
    }

    setWorkspaceNameError("");
  }, [workspaceForm.name, isWorkspaceNameDuplicate]);

  const loadWorkspaceMembers = async (workspaceId: string) => {
    setMembersLoading(true);
    try {
      const data: WorkspaceMember[] = await workspacesAPI.getWorkspaceMembers(
        workspaceId,
      );
      setMembers(data);
    } catch (error) {
      setMembers([]);
      throw error;
    } finally {
      setMembersLoading(false);
    }
  };

  const loadWorkspaceBoards = async (
    workspaceId: string,
    workspaceCanManage: boolean,
  ) => {
    if (!workspaceCanManage) {
      setBoards([]);
      return;
    }

    setBoardsLoading(true);
    try {
      const data: WorkspaceBoard[] = await workspacesAPI.getWorkspaceBoards(
        workspaceId,
      );
      setBoards(data);
    } catch (error) {
      setBoards([]);
      throw error;
    } finally {
      setBoardsLoading(false);
    }
  };

  const loadWorkspaceActivities = async (workspaceId: string) => {
    setActivitiesLoading(true);
    try {
      const data: WorkspaceActivity[] =
        await workspacesAPI.getWorkspaceActivities(workspaceId);
      setActivities(data);
    } catch (error) {
      setActivities([]);
      throw error;
    } finally {
      setActivitiesLoading(false);
    }
  };

  const loadWorkspaceDetailAndSections = async (workspaceId: string) => {
    const detail: Workspace = await workspacesAPI.getWorkspace(workspaceId);
    setWorkspaceDetail(detail);

    const name = detail.name ?? "";
    const description = detail.description ?? "";
    const icon = detail.icon ?? "";

    const formState = { name, description, icon };
    setWorkspaceForm(formState);
    setInitialWorkspaceForm(formState);

    await Promise.all([
      loadWorkspaceMembers(workspaceId),
      loadWorkspaceBoards(workspaceId, Boolean(detail.can_manage)),
      loadWorkspaceActivities(workspaceId),
    ]);
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const me = await userAPI.me();
        setCurrentUser(me);
      } catch (error) {
        navigate("/login");
      }
    };

    void loadUser();
  }, [navigate]);

  useEffect(() => {
    const loadWorkspaces = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const data: Workspace[] = await workspacesAPI.getWorkspaces();
        setWorkspaces(data);

        if (data.length === 0) {
          setActiveWorkspaceId("");
          setWorkspaceDetail(null);
          setMembers([]);
          setBoards([]);
          setActivities([]);
          return;
        }

        const queryWorkspaceId = getWorkspaceIdFromSearch(location.search);
        const hasQueryWorkspace = data.some(
          (workspace) => String(workspace.id) === queryWorkspaceId,
        );
        const selectedWorkspaceId = hasQueryWorkspace
          ? queryWorkspaceId
          : String(data[0].id);

        if (!hasQueryWorkspace) {
          navigate(`/settings?workspace=${selectedWorkspaceId}`, { replace: true });
        }

        setActiveWorkspaceId(selectedWorkspaceId);
        await loadWorkspaceDetailAndSections(selectedWorkspaceId);
      } catch (error) {
        console.error("Failed to load workspaces:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadWorkspaces();
  }, [currentUser, location.search, navigate]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) return;

    setActiveWorkspaceId(workspaceId);
    navigate(`/settings?workspace=${workspaceId}`);
    try {
      await loadWorkspaceDetailAndSections(workspaceId);
    } catch (error) {
      const apiError = error as Error;
      setNotice({
        type: "error",
        message:
          apiError.message || "Không tải được dữ liệu cài đặt workspace này",
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleSaveWorkspaceInfo = async () => {
    if (!activeWorkspaceId || !canManageWorkspace) return;
    if (workspaceNameError) return;

    const cleanedName = workspaceForm.name.trim().replace(/\s+/g, " ");
    if (!cleanedName) {
      setWorkspaceNameError("Tên workspace không được để trống");
      return;
    }

    setSavingWorkspaceInfo(true);
    try {
      const payload = {
        name: cleanedName,
        description: workspaceForm.description.trim() || null,
        icon: workspaceForm.icon.trim() || null,
      };
      const updatedWorkspace: Workspace = await workspacesAPI.updateWorkspace(
        activeWorkspaceId,
        payload,
      );

      const nextForm = {
        name: updatedWorkspace.name ?? payload.name,
        description: updatedWorkspace.description ?? payload.description ?? "",
        icon: updatedWorkspace.icon ?? payload.icon ?? "",
      };
      setWorkspaceForm(nextForm);
      setInitialWorkspaceForm(nextForm);
      setWorkspaceDetail(updatedWorkspace);

      setWorkspaces((previous) =>
        previous.map((workspace) =>
          String(workspace.id) === activeWorkspaceId
            ? { ...workspace, ...updatedWorkspace }
            : workspace,
        ),
      );

      await loadWorkspaceActivities(activeWorkspaceId);
      setNotice({ type: "success", message: "Đã lưu thông tin workspace" });
    } catch (error) {
      const apiError = error as Error;
      setNotice({
        type: "error",
        message: apiError.message || "Lưu thông tin workspace thất bại",
      });
    } finally {
      setSavingWorkspaceInfo(false);
    }
  };

  const parseMemberInput = () => {
    const value = memberInput.trim();
    if (!value) {
      throw new Error("Nhập email hoặc user id");
    }

    if (value.includes("@")) {
      const normalizedEmail = value.toLowerCase();
      const isValidEmail = /^\S+@\S+\.\S+$/.test(normalizedEmail);
      if (!isValidEmail) {
        throw new Error("Email không hợp lệ");
      }

      const isDuplicate = members.some(
        (member) => member.email?.toLowerCase() === normalizedEmail,
      );
      if (isDuplicate) {
        throw new Error("Thành viên này đã có trong workspace");
      }

      return { email: normalizedEmail };
    }

    if (!/^\d+$/.test(value)) {
      throw new Error("User id phải là số hoặc nhập email");
    }

    const userId = Number(value);
    const isDuplicate = members.some((member) => member.id === userId);
    if (isDuplicate) {
      throw new Error("Thành viên này đã có trong workspace");
    }
    return { user_id: userId };
  };

  const handleAddMember = async () => {
    if (!activeWorkspaceId || !canManageWorkspace) return;
    setMemberInputError("");

    let payload: { user_id?: number; email?: string };
    try {
      payload = parseMemberInput();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dữ liệu nhập không hợp lệ";
      setMemberInputError(message);
      return;
    }

    setAddingMember(true);
    try {
      await workspacesAPI.addWorkspaceMember(activeWorkspaceId, {
        ...payload,
        role: newMemberRole,
      });
      setMemberInput("");
      await Promise.all([
        loadWorkspaceMembers(activeWorkspaceId),
        loadWorkspaceActivities(activeWorkspaceId),
      ]);
      setNotice({ type: "success", message: "Đã thêm thành viên vào workspace" });
    } catch (error) {
      const apiError = error as Error;
      setMemberInputError(apiError.message || "Thêm thành viên thất bại");
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateMemberRole = async (
    member: WorkspaceMember,
    role: "admin" | "member",
  ) => {
    if (!activeWorkspaceId || !canManageWorkspace) return;
    if (member.role_key === role) return;
    if (!member.can_update_role) return;

    setUpdatingMemberId(member.id);
    try {
      await workspacesAPI.updateWorkspaceMemberRole(activeWorkspaceId, member.id, {
        role,
      });
      await Promise.all([
        loadWorkspaceMembers(activeWorkspaceId),
        loadWorkspaceActivities(activeWorkspaceId),
      ]);
      setNotice({ type: "success", message: "Đã cập nhật vai trò thành viên" });
    } catch (error) {
      const apiError = error as Error;
      setNotice({
        type: "error",
        message: apiError.message || "Cập nhật vai trò thất bại",
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (!activeWorkspaceId || !canManageWorkspace) return;
    if (!member.can_remove) return;

    const shouldRemove = window.confirm(
      `Xóa thành viên ${member.name || member.email} khỏi workspace?`,
    );
    if (!shouldRemove) return;

    setRemovingMemberId(member.id);
    try {
      await workspacesAPI.removeWorkspaceMember(activeWorkspaceId, member.id);
      await Promise.all([
        loadWorkspaceMembers(activeWorkspaceId),
        loadWorkspaceActivities(activeWorkspaceId),
      ]);
      setNotice({ type: "success", message: "Đã xóa thành viên" });
    } catch (error) {
      const apiError = error as Error;
      setNotice({ type: "error", message: apiError.message || "Xóa thất bại" });
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleDeleteBoard = async (board: WorkspaceBoard) => {
    if (!activeWorkspaceId || !canManageWorkspace) return;
    const confirmed = window.confirm(`Xóa board "${board.name}"?`);
    if (!confirmed) return;

    setDeletingBoardId(board.id);
    try {
      await workspacesAPI.deleteWorkspaceBoard(activeWorkspaceId, board.id);
      await Promise.all([
        loadWorkspaceBoards(activeWorkspaceId, true),
        loadWorkspaceActivities(activeWorkspaceId),
      ]);
      setNotice({ type: "success", message: "Đã xóa board" });
    } catch (error) {
      const apiError = error as Error;
      setNotice({
        type: "error",
        message: apiError.message || "Không thể xóa board này",
      });
    } finally {
      setDeletingBoardId(null);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspaceId || !canManageWorkspace) return;
    setDeletingWorkspace(true);
    try {
      await workspacesAPI.deleteWorkspace(activeWorkspaceId);

      const remaining = workspaces.filter(
        (workspace) => String(workspace.id) !== activeWorkspaceId,
      );
      setWorkspaces(remaining);
      setShowDeleteWorkspaceConfirm(false);

      if (remaining.length > 0) {
        const fallbackWorkspaceId = String(remaining[0].id);
        navigate(`/settings?workspace=${fallbackWorkspaceId}`, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      const apiError = error as Error;
      setNotice({
        type: "error",
        message: apiError.message || "Không thể xóa workspace",
      });
    } finally {
      setDeletingWorkspace(false);
    }
  };

  if (!currentUser) return null;
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <p className="text-gray-700">Đang tải cài đặt workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 p-4 z-20">
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
              <span>Bảng</span>
            </button>
            <button
              onClick={() =>
                navigate(
                  activeWorkspaceId
                    ? `/planner?workspace=${activeWorkspaceId}`
                    : "/planner",
                )
              }
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition text-gray-600 hover:bg-gray-100"
            >
              <Calendar size={20} />
              <span>Trình lập kế hoạch</span>
            </button>
            <button
              onClick={() => {
                if (!activeWorkspaceId) return;
                navigate(`/members?workspace=${activeWorkspaceId}`);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition text-gray-600 hover:bg-gray-100"
            >
              <Users size={20} />
              <span>Thành viên</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition bg-[#0055bc42] text-[#051836]">
              <Settings size={20} />
              <span>Cài đặt</span>
            </button>
          </nav>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Không gian làm việc
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
              <div className="w-8 h-8 bg-[#051836] rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                {activeWorkspace?.icon?.trim()
                  ? activeWorkspace.icon.trim().charAt(0).toUpperCase()
                  : activeWorkspace?.name?.charAt(0)?.toUpperCase() || "W"}
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                {activeWorkspace?.name ?? "Chưa có workspace"}
              </span>
            </div>

            {workspaces.length > 1 && (
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {workspaces
                  .filter((workspace) => String(workspace.id) !== activeWorkspaceId)
                  .map((workspace) => {
                    const workspaceId = String(workspace.id);
                    return (
                      <button
                        key={workspaceId}
                        onClick={() => handleSelectWorkspace(workspaceId)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition text-gray-600 hover:bg-gray-100"
                      >
                        <div className="w-6 h-6 bg-[#051836] rounded-md flex items-center justify-center text-white font-semibold text-xs">
                          {workspace.icon?.trim()
                            ? workspace.icon.trim().charAt(0).toUpperCase()
                            : workspace.name?.charAt(0)?.toUpperCase() || "W"}
                        </div>
                        <span className="text-sm flex-1 truncate">
                          {workspace.name}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="ml-64 min-h-screen">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Cài đặt workspace
              </h1>
              <p className="text-sm text-gray-600">
                {workspaceDetail?.name || "Chọn workspace để quản lý"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-600 border border-red-200 hover:bg-red-50 transition"
            >
              <LogOut size={18} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>

        {notice && (
          <div className="fixed right-6 top-6 z-40">
            <div
              className={`px-4 py-2 rounded-lg shadow border text-sm ${
                notice.type === "success"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              {notice.message}
            </div>
          </div>
        )}

        <div className="p-8 space-y-8">
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  1. Thông tin workspace
                </h2>
                <p className="text-sm text-gray-600">
                  Chỉnh sửa tên, mô tả và icon workspace
                </p>
              </div>
              <button
                onClick={handleSaveWorkspaceInfo}
                disabled={
                  !canManageWorkspace ||
                  savingWorkspaceInfo ||
                  !hasWorkspaceInfoChanges ||
                  Boolean(workspaceNameError)
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#051836] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {savingWorkspaceInfo ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>

            {!canManageWorkspace && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Bạn đang ở vai trò MEMBER. Chỉ ADMIN mới được sửa thông tin workspace.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên workspace
                </label>
                <input
                  type="text"
                  value={workspaceForm.name}
                  onChange={(event) =>
                    setWorkspaceForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  disabled={!canManageWorkspace}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                    workspaceNameError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-blue-500"
                  } disabled:bg-gray-50`}
                />
                {workspaceNameError && (
                  <p className="mt-2 text-sm text-red-600">{workspaceNameError}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon / Avatar (tùy chọn)
                </label>
                <input
                  type="text"
                  value={workspaceForm.icon}
                  onChange={(event) =>
                    setWorkspaceForm((previous) => ({
                      ...previous,
                      icon: event.target.value,
                    }))
                  }
                  disabled={!canManageWorkspace}
                  placeholder="Ví dụ: B, DEV, PM"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mô tả workspace
                </label>
                <textarea
                  value={workspaceForm.description}
                  onChange={(event) =>
                    setWorkspaceForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  disabled={!canManageWorkspace}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-50"
                />
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <Users size={18} className="text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">
                2. Quản lý thành viên
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Thêm, đổi vai trò và xóa thành viên trong workspace
            </p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <div className="md:col-span-3">
                <input
                  type="text"
                  value={memberInput}
                  onChange={(event) => {
                    setMemberInput(event.target.value);
                    if (memberInputError) setMemberInputError("");
                  }}
                  disabled={!canManageWorkspace || addingMember}
                  placeholder="Nhập email hoặc user id"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                    memberInputError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-blue-500"
                  } disabled:bg-gray-50`}
                />
                {memberInputError && (
                  <p className="mt-2 text-sm text-red-600">{memberInputError}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <select
                  value={newMemberRole}
                  onChange={(event) =>
                    setNewMemberRole(event.target.value as "admin" | "member")
                  }
                  disabled={!canManageWorkspace || addingMember}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  <option value="member">MEMBER</option>
                  <option value="admin">ADMIN</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <button
                  onClick={handleAddMember}
                  disabled={!canManageWorkspace || addingMember}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#051836] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus size={16} />
                  {addingMember ? "Đang thêm..." : "Thêm"}
                </button>
              </div>
            </div>

            {membersLoading ? (
              <p className="text-sm text-gray-600">Đang tải danh sách thành viên...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-gray-600">Workspace chưa có thành viên.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-600">
                      <th className="px-4 py-3">Tên</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Vai trò</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-t border-gray-200">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {member.name || "Người dùng không xác định"}
                          </div>
                          {member.is_owner && (
                            <div className="text-xs text-blue-600">Chủ sở hữu workspace</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{member.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={member.role_key}
                            onChange={(event) =>
                              void handleUpdateMemberRole(
                                member,
                                event.target.value as "admin" | "member",
                              )
                            }
                            disabled={
                              !canManageWorkspace ||
                              !member.can_update_role ||
                              updatingMemberId === member.id
                            }
                            className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                          >
                            <option value="admin">ADMIN</option>
                            <option value="member">MEMBER</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => void handleRemoveMember(member)}
                            disabled={
                              !canManageWorkspace ||
                              !member.can_remove ||
                              removingMemberId === member.id
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={14} />
                            {removingMemberId === member.id ? "Đang xóa..." : "Xóa"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={18} className="text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">3. Phân quyền</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-900 mb-2">ADMIN</p>
                <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                  <li>Tạo / xóa board</li>
                  <li>Thêm / xóa member</li>
                  <li>Chỉnh sửa thông tin workspace</li>
                  <li>Xóa workspace</li>
                </ul>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-900 mb-2">MEMBER</p>
                <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                  <li>Chỉ thao tác trong board được tham gia</li>
                  <li>Không được xóa workspace</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban size={18} className="text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">
                4. Quản lý board
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Danh sách board trong workspace và thông tin người tạo
            </p>

            {!canManageWorkspace ? (
              <p className="text-sm text-gray-600">
                Chỉ ADMIN mới xem và xóa board ở mục cài đặt workspace.
              </p>
            ) : boardsLoading ? (
              <p className="text-sm text-gray-600">Đang tải danh sách board...</p>
            ) : boards.length === 0 ? (
              <p className="text-sm text-gray-600">Workspace chưa có board.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-600">
                      <th className="px-4 py-3">Board</th>
                      <th className="px-4 py-3">Người tạo</th>
                      <th className="px-4 py-3">Ngày tạo</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boards.map((board) => (
                      <tr key={board.id} className="border-t border-gray-200">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {board.name}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {board.created_by_name || board.created_by_email || "Không rõ"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatActivityTime(board.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => void handleDeleteBoard(board)}
                            disabled={deletingBoardId === board.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={14} />
                            {deletingBoardId === board.id ? "Đang xóa..." : "Xóa"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 size={18} className="text-red-600" />
              <h2 className="text-lg font-semibold text-red-700">
                5. Xóa workspace
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Chức năng nguy hiểm. Không thể khôi phục sau khi xóa.
            </p>
            <button
              onClick={() => setShowDeleteWorkspaceConfirm(true)}
              disabled={!canManageWorkspace}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} />
              Xóa workspace
            </button>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={18} className="text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">
                6. Hoạt động workspace
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Theo dõi ai tạo board, thêm member, sửa workspace
            </p>

            {activitiesLoading ? (
              <p className="text-sm text-gray-600">Đang tải lịch sử hoạt động...</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-gray-600">Chưa có hoạt động nào.</p>
            ) : (
              <div className="space-y-2">
                {activities.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-gray-200 rounded-lg px-4 py-3"
                  >
                    <p className="text-sm text-gray-900">
                      <span className="font-semibold">
                        {entry.user_name || entry.user_email || "Hệ thống"}
                      </span>{" "}
                      {entry.details || entry.action}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatActivityTime(entry.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {showDeleteWorkspaceConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => {
            if (deletingWorkspace) return;
            setShowDeleteWorkspaceConfirm(false);
          }}
        >
          <div
            className="max-w-md w-full bg-white rounded-lg shadow-xl border border-gray-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Bạn có chắc muốn xóa workspace?
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Toàn bộ board, member và activity của workspace này sẽ bị xóa.
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteWorkspaceConfirm(false)}
                disabled={deletingWorkspace}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleDeleteWorkspace()}
                disabled={deletingWorkspace}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deletingWorkspace ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
