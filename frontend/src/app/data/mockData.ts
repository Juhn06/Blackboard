// Mock data cho BlackBoard

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  password?: string;
  phone?: string;
}

// Mock users cho login
export const mockUsers = [
  {
    id: "1",
    name: "Admin",
    email: "admin@gmail.com",
    password: "123456",
    phone: "0123456789",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
  },
  {
    id: "2",
    name: "Member",
    email: "member@gmail.com",
    password: "123456",
    phone: "0987654321",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
  },
];

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
}

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  background: string;
}

export interface List {
  id: string;
  boardId: string;
  title: string;
  position: number;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  description?: string;
  dueDate?: string;
  labels: string[];
  completed: boolean;
  assignee?: string;
}

export const currentUser: User = {
  id: "1",
  email: "user@blackboard.com",
  name: "Nguyễn Văn A",
  avatar:
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
};

export const users: User[] = [
  currentUser,
  {
    id: "2",
    email: "member2@blackboard.com",
    name: "Trần Thị B",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
  },
  {
    id: "3",
    email: "member3@blackboard.com",
    name: "Lê Văn C",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
  },
];

export const workspaces: Workspace[] = [
  {
    id: "ws1",
    name: "Không gian làm việc của tôi",
    ownerId: "1",
  },
];

export const boards: Board[] = [
  {
    id: "board1",
    workspaceId: "ws1",
    name: "Dự án Website",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  {
    id: "board2",
    workspaceId: "ws1",
    name: "Marketing Q1",
    background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  },
  {
    id: "board3",
    workspaceId: "ws1",
    name: "Phát triển App",
    background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  },
  {
    id: "board4",
    workspaceId: "ws1",
    name: "Quản lý nội dung",
    background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  },
];

export const lists: List[] = [
  {
    id: "list1",
    boardId: "board1",
    title: "Cần làm",
    position: 1,
  },
  {
    id: "list2",
    boardId: "board1",
    title: "Đang thực hiện",
    position: 2,
  },
  {
    id: "list3",
    boardId: "board1",
    title: "Đang review",
    position: 3,
  },
  {
    id: "list4",
    boardId: "board1",
    title: "Hoàn thành",
    position: 4,
  },
];

export const cards: Card[] = [
  {
    id: "card1",
    listId: "list1",
    title: "Thiết kế giao diện trang chủ",
    description: "Tạo mockup và wireframe cho trang chủ",
    dueDate: "2026-04-10",
    labels: ["Thiết kế", "Ưu tiên cao"],
    completed: false,
    assignee: "1",
  },
  {
    id: "card2",
    listId: "list1",
    title: "Nghiên cứu đối thủ cạnh tranh",
    labels: ["Nghiên cứu"],
    completed: false,
    assignee: "2",
  },
  {
    id: "card3",
    listId: "list2",
    title: "Xây dựng API Backend",
    description: "Phát triển REST API cho hệ thống",
    dueDate: "2026-04-08",
    labels: ["Backend", "Ưu tiên cao"],
    completed: false,
    assignee: "1",
  },
  {
    id: "card4",
    listId: "list2",
    title: "Tích hợp thanh toán",
    labels: ["Backend"],
    completed: false,
    assignee: "3",
  },
  {
    id: "card5",
    listId: "list3",
    title: "Code review module đăng nhập",
    description: "Review và test module authentication",
    dueDate: "2026-04-05",
    labels: ["Review"],
    completed: false,
    assignee: "2",
  },
  {
    id: "card6",
    listId: "list4",
    title: "Setup môi trường development",
    labels: ["DevOps"],
    completed: true,
    assignee: "1",
  },
  {
    id: "card7",
    listId: "list4",
    title: "Tạo database schema",
    labels: ["Backend"],
    completed: true,
    assignee: "3",
  },
];
