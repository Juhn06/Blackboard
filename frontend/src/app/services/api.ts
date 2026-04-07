const API_BASE_URL = "http://localhost:8000";

// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem("token");
};

// Helper function to make authenticated requests
const authFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<any> => {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
};

export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const data = await response.json();

    // QUAN TRỌNG: backend trả access_token
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return data;
  },

  register: async (name: string, email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      throw new Error("Registration failed");
    }

    const data = await response.json();

    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return data;
  },
};

// Boards API
export const boardsAPI = {
  getBoard: async (boardId: number) => {
    return authFetch(`/boards/${boardId}`);
  },

  getBoardsByWorkspace: async (workspaceId: string) => {
    return authFetch(`/boards/workspace/${workspaceId}`);
  },

  createBoard: async (boardData: {
    name: string;
    workspace_id: number;
    background: string;
  }) => {
    return authFetch("/boards/", {
      method: "POST",
      body: JSON.stringify(boardData),
    });
  },

  updateBoard: async (boardId: string, boardData: any) => {
    return authFetch(`/boards/${boardId}`, {
      method: "PUT",
      body: JSON.stringify(boardData),
    });
  },

  deleteBoard: async (boardId: string) => {
    return authFetch(`/boards/${boardId}`, {
      method: "DELETE",
    });
  },
};

// Lists API
export const listsAPI = {
  getListsByBoard: async (boardId: string) => {
    return authFetch(`/lists/board/${boardId}`);
  },

  createList: async (listData: {
    title: string;
    board_id: number;
    position: number;
  }) => {
    return authFetch("/lists/", {
      method: "POST",
      body: JSON.stringify(listData),
    });
  },

  updateList: async (listId: string, listData: any) => {
    return authFetch(`/lists/${listId}`, {
      method: "PUT",
      body: JSON.stringify(listData),
    });
  },

  deleteList: async (listId: string) => {
    return authFetch(`/lists/${listId}`, {
      method: "DELETE",
    });
  },
};

// Cards API
export const cardsAPI = {
  getCardsByList: async (listId: string) => {
    return authFetch(`/cards/list/${listId}`);
  },

  createCard: async (cardData: {
    title: string;
    list_id: number;
    description?: string;
    due_date?: string;
    labels?: string[];
    completed?: boolean;
    assignee?: string;
  }) => {
    return authFetch("/cards/", {
      method: "POST",
      body: JSON.stringify(cardData),
    });
  },

  updateCard: async (cardId: string, cardData: any) => {
    return authFetch(`/cards/${cardId}`, {
      method: "PUT",
      body: JSON.stringify(cardData),
    });
  },

  deleteCard: async (cardId: string) => {
    return authFetch(`/cards/${cardId}`, {
      method: "DELETE",
    });
  },
};

// Workspaces API
export const workspacesAPI = {
  getWorkspaces: async () => {
    return authFetch("/workspaces/");
  },

  createWorkspace: async (workspaceData: { name: string }) => {
    return authFetch("/workspaces/", {
      method: "POST",
      body: JSON.stringify(workspaceData),
    });
  },
};

// Comments API
export const commentsAPI = {
  getCommentsByCard: async (cardId: string) => {
    return authFetch(`/comments/card/${cardId}`);
  },

  createComment: async (commentData: { content: string; card_id: number }) => {
    return authFetch("/comments/", {
      method: "POST",
      body: JSON.stringify(commentData),
    });
  },
};

// Board Notes API
export const boardNotesAPI = {
  getNotesByBoard: async (boardId: string) => {
    return authFetch(`/board-notes/board/${boardId}`);
  },

  createNote: async (noteData: {
    title: string;
    content: string;
    board_id: number;
  }) => {
    return authFetch("/board-notes/", {
      method: "POST",
      body: JSON.stringify(noteData),
    });
  },
};

export const userAPI = {
  me: async () => {
    return authFetch("/auth/me");
  },
};
