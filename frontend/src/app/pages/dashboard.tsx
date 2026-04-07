import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { boardsAPI, userAPI, workspacesAPI } from "../services/api";
import {
  Search,
  Plus,
  LayoutGrid,
  FileText,
  Home,
  Settings,
  Users,
  Calendar,
  LogOut,
  User,
  X,
} from "lucide-react";
import { Workspace } from "../../types/workspace";

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [workspace, setWorkspace] = useState<any>(null);
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user từ localStorage
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await userAPI.me();
        setCurrentUser(user);
      } catch (err) {
        navigate("/login");
      }
    };

    loadUser();
  }, [navigate]);

  // Load workspaces và boards từ API
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;

      try {
        const workspacesData = await workspacesAPI.getWorkspaces();
        if (workspacesData.length > 0) {
          setWorkspace(workspacesData[0]);
          const boardsData = await boardsAPI.getBoardsByWorkspace(
            workspacesData[0].id,
          );
          setBoards(boardsData);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  // State cho modal tạo board
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [selectedBackground, setSelectedBackground] = useState(
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  );
  const [selectedWorkspace, setSelectedWorkspace] = useState("ws1");

  // State cho dropdown avatar
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Lọc boards theo search query
  const filteredBoards = boards.filter((board: any) =>
    board.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Màu nền có sẵn
  const backgroundColors = [
    "linear-gradient(135deg, #EADDEF 0%, #A087FD 100%)",
    "linear-gradient(135deg, #FDCBF2 0%, #2044FA 100%)",
    "linear-gradient(135deg, #776EFE 0%, #0D0AA5 100%)",
    "linear-gradient(135deg, #0133FE 0%, #00003C 100%)",
    "linear-gradient(135deg, #FFFDEE 0%, #E2ED2B 100%)",
    "linear-gradient(135deg, #E0FBCF 0%, #076554 100%)",
    "linear-gradient(135deg, #E2EF26 0%, #0E332C 100%)",
    "linear-gradient(135deg, #0B6353 0%, #082B1E 100%)",
  ];

  // Hàm tạo board mới
  const handleCreateBoard = async () => {
    if (!newBoardName.trim() || !workspace) return;

    try {
      const newBoard = await boardsAPI.createBoard({
        name: newBoardName,
        workspace_id: workspace.id,
        background: selectedBackground,
      });

      setBoards([...boards, newBoard]);
      setNewBoardName("");
      setShowCreateBoardModal(false);
    } catch (error) {
      console.error("Failed to create board:", error);
    }
  };

  // Hàm logout
  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (!currentUser) return null;
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-purple-50">
        <p className="text-gray-700">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 p-4 z-10">
        <div className="mb-8">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2">
              {/* <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg> */}
              <img src="/images/logo.png" alt="logo" className="w-28 h-20" />
            </div>
            {/* <span className="text-xl font-bold text-gray-800">BlackBoard</span> */}
          </div>

          {/* Menu */}
          <nav className="space-y-2">
            <button
              onClick={() => navigate("/dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition ${
                location.pathname === "/dashboard"
                  ? "bg-[#0055bc42] text-[#051836]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <LayoutGrid size={20} />
              <span>Bảng</span>
            </button>
            <button
              onClick={() => navigate("/planner")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition ${
                location.pathname === "/planner"
                  ? "bg-purple-100 text-purple-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Calendar size={20} />
              <span>Trình lập kế hoạch</span>
            </button>
            {/* <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition">
              <FileText size={20} />
              <span>Mẫu</span>
            </button> */}
            {/* <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition">
              <Home size={20} />
              <span>Trang chủ</span>
            </button> */}
          </nav>
        </div>

        {/* Workspace */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
            Không gian làm việc
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-400 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                {workspace?.name ? workspace.name.charAt(0) : "W"}
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                {workspace?.name ?? "Chưa có không gian làm việc"}
              </span>
            </div>
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition text-sm"
              disabled={!workspace}
            >
              <Users size={16} />
              <span>Thành viên</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition text-sm">
              <Settings size={16} />
              <span>Cài đặt</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Search */}
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
                  placeholder="Tìm kiếm bảng, thẻ..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4 ml-6">
              <button
                onClick={() => setShowCreateBoardModal(true)}
                disabled={!workspace}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition ${workspace ? "bg-[#051836] text-white hover:shadow-lg" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
              >
                <Plus size={20} />
                <span>Tạo mới</span>
              </button>

              {/* User avatar with dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-200 hover:border-purple-400 transition"
                >
                  <img
                    src={currentUser.avatar ?? "/images/default-avatar.png"}
                    alt={currentUser.name ?? "User"}
                    className="w-full h-full object-cover"
                  />
                </button>

                {/* Dropdown menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            currentUser.avatar ?? "/images/default-avatar.png"
                          }
                          alt={currentUser.name ?? "User"}
                          className="w-12 h-12 rounded-full"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">
                            {currentUser.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {currentUser.email}
                          </p>
                          {currentUser.phone && (
                            <p className="text-sm text-gray-600">
                              {currentUser.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowProfileModal(true);
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition text-left"
                      >
                        <User size={18} />
                        <span>Xem thông tin cá nhân</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition text-left"
                      >
                        <LogOut size={18} />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Boards grid */}
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Bảng của bạn
            </h1>
            <p className="text-gray-600">
              Quản lý và theo dõi các dự án của bạn
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Board cards */}
            {filteredBoards.map((board: any) => (
              <button
                key={board.id}
                onClick={() => navigate(`/board/${board.id}`)}
                className="group h-32 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                style={{ background: board.background }}
              >
                <div className="h-full p-5 flex items-start">
                  <h3 className="text-lg font-semibold text-white group-hover:scale-105 transition-transform">
                    {board.name}
                  </h3>
                </div>
              </button>
            ))}

            {/* Create new board */}
            <button
              onClick={() => setShowCreateBoardModal(true)}
              className="h-32 rounded-xl bg-gray-100 hover:bg-gray-200 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:border-gray-400"
            >
              <Plus size={24} className="text-gray-500" />
              <span className="text-gray-600 font-medium">Tạo bảng mới</span>
            </button>
          </div>

          {/* No results message */}
          {searchQuery && filteredBoards.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                Không tìm thấy bảng nào phù hợp với "{searchQuery}"
              </p>
            </div>
          )}

          {/* Recent activity */}
          {/* <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Hoạt động gần đây
            </h2>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="space-y-4">
                {[
                  {
                    user: users[0],
                    action: "đã thêm thẻ",
                    target: "Thiết kế giao diện trang chủ",
                    board: "Dự án Website",
                    time: "2 giờ trước",
                  },
                  {
                    user: users[1],
                    action: "đã hoàn thành",
                    target: "Code review module đăng nhập",
                    board: "Dự án Website",
                    time: "4 giờ trước",
                  },
                  {
                    user: users[2],
                    action: "đã bình luận trong",
                    target: "Tích hợp thanh toán",
                    board: "Dự án Website",
                    time: "5 giờ trước",
                  },
                ].map((activity, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0"
                  >
                    <img
                      src={activity.user.avatar}
                      alt={activity.user.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">
                          {activity.user.name}
                        </span>{" "}
                        <span className="text-gray-600">{activity.action}</span>{" "}
                        <span className="font-medium">{activity.target}</span>{" "}
                        <span className="text-gray-500">
                          trong {activity.board}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div> */}
        </div>
      </main>

      {/* Modal tạo board mới */}
      {showCreateBoardModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateBoardModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Tạo bảng mới</h2>
              <button
                onClick={() => setShowCreateBoardModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Tên bảng */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên bảng
                </label>
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="Ví dụ: Dự án mới"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              {/* Chọn màu nền */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Màu nền
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {backgroundColors.map((bg) => (
                    <button
                      key={bg}
                      onClick={() => setSelectedBackground(bg)}
                      className={`h-16 rounded-lg transition ${
                        selectedBackground === bg
                          ? "ring-4 ring-purple-500"
                          : "hover:scale-105"
                      }`}
                      style={{ background: bg }}
                    />
                  ))}
                </div>
              </div>

              {/* Chọn workspace */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Không gian làm việc
                </label>
                <select
                  value={selectedWorkspace}
                  onChange={(e) => setSelectedWorkspace(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {workspace.map((ws: Workspace) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleCreateBoard}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition"
              >
                Tạo bảng
              </button>
              <button
                onClick={() => setShowCreateBoardModal(false)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal thông tin cá nhân */}
      {showProfileModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Thông tin cá nhân
              </h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Avatar */}
              <div className="flex justify-center">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-24 h-24 rounded-full border-4 border-purple-200"
                />
              </div>

              {/* Thông tin */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên
                  </label>
                  <input
                    type="text"
                    value={currentUser.name}
                    readOnly
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={currentUser.email}
                    readOnly
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>

                {currentUser.phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      value={currentUser.phone}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  );
}
