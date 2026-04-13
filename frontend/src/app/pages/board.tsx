import {
  useState,
  useEffect,
  useRef,
  ReactElement,
  JSXElementConstructor,
  ReactNode,
  ReactPortal,
} from "react";
import { useParams, useNavigate } from "react-router";
import {
  boardsAPI,
  listsAPI,
  cardsAPI,
  commentsAPI,
  boardNotesAPI,
  userAPI,
} from "../services/api";
import {
  Star,
  Share2,
  MoreHorizontal,
  Plus,
  X,
  Calendar,
  Send,
  Clock,
  NotepadText,
  Inbox,
  ListChecks,
  Users,
  Tags,
  Settings,
  History,
  Trash2,
} from "lucide-react";
import { DndContext, DragOverlay, closestCenter, useSensor, useSensors, PointerSensor, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";

interface DraggableCardContainerProps {
  cardId: number;
  listId: number;
  children: React.ReactNode;
}

interface DraggableListContainerProps {
  listId: number;
  children: React.ReactNode;
}

interface DroppableCardLaneProps {
  listId: number;
  children: React.ReactNode;
}

interface BoardMember {
  id: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

interface CardMember {
  id: number;
  name?: string | null;
  email?: string | null;
}

interface CardComment {
  id: number;
  card_id: number;
  user_id: number;
  content: string;
  created_at?: string | null;
  user_name?: string | null;
  user_email?: string | null;
}

interface BoardMessage {
  id: number;
  board_id: number;
  user_id: number;
  content: string;
  created_at?: string | null;
}

interface BoardActivity {
  id: number;
  board_id?: number | null;
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
  action: string;
  details?: string | null;
  created_at?: string | null;
}

const isBoardAdminRole = (role?: string | null) => {
  const normalizedRole = (role || "member").toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "owner";
};

function DraggableCardContainer({ cardId, listId, children }: DraggableCardContainerProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${cardId}`,
    data: {
      type: "card",
      cardId: Number(cardId),
      listId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function DraggableListContainer({ listId, children }: DraggableListContainerProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `list-${listId}`,
    data: {
      type: "list",
      listId: Number(listId),
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// DroppableListContainer removed — use simple wrapper divs for droppable areas to avoid runtime reference issues

function DroppableCardLane({ listId, children }: DroppableCardLaneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `list-drop-${listId}`,
    data: {
      type: "list-drop",
      listId: Number(listId),
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[40px] rounded-md transition-colors ${
        isOver ? "bg-blue-50/60" : ""
      }`}
    >
      {children}
    </div>
  );
}

export default function BoardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Use numeric boardId for comparisons with API responses
  const boardId = Number(id);
  console.log("ðŸ” Current board ID:", boardId, "from route param:", id);

  const [board, setBoard] = useState<any>(null);
  const [lists, setLists] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [boardMenuError, setBoardMenuError] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMemberInput, setShareMemberInput] = useState("");
  const [shareError, setShareError] = useState("");
  const [sharingMember, setSharingMember] = useState(false);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [loadingBoardMembers, setLoadingBoardMembers] = useState(false);
  const [removingBoardMemberId, setRemovingBoardMemberId] = useState<number | null>(null);
  const [boardNameDraft, setBoardNameDraft] = useState("");
  const [boardDescriptionDraft, setBoardDescriptionDraft] = useState("");
  const [boardBackgroundDraft, setBoardBackgroundDraft] = useState("");
  const [savingBoardDescription, setSavingBoardDescription] = useState(false);
  const [savingBoardSettings, setSavingBoardSettings] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const [boardActivities, setBoardActivities] = useState<BoardActivity[]>([]);
  const [loadingBoardActivities, setLoadingBoardActivities] = useState(false);
  const [cardMembers, setCardMembers] = useState<CardMember[]>([]);
  const [cardMembersByCardId, setCardMembersByCardId] = useState<Record<number, CardMember[]>>({});
  const cardMembersByCardIdRef = useRef<Record<number, CardMember[]>>({});
  const cardMembersLoadingIdsRef = useRef<Set<number>>(new Set());
  const [loadingCardMembers, setLoadingCardMembers] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#F87171");
  const [boardLabels, setBoardLabels] = useState<{ name: string; color: string; value: string }[]>([]);
  const [cardComments, setCardComments] = useState<CardComment[]>([]);
  const [newCommentContent, setNewCommentContent] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    cardMembersByCardIdRef.current = cardMembersByCardId;
  }, [cardMembersByCardId]);

  const normalizeCardMembers = (members: any): CardMember[] => {
    if (!Array.isArray(members)) {
      return [];
    }

    return members
      .map((member: any) => ({
        id: Number(member?.id),
        name: typeof member?.name === "string" ? member.name : null,
        email: typeof member?.email === "string" ? member.email : null,
      }))
      .filter((member) => Number.isFinite(member.id));
  };

  const getMemberInitial = (member: CardMember) => {
    const label = String(member.name || member.email || "U").trim();
    return label.charAt(0).toUpperCase() || "U";
  };

  const getCardMemberPreview = (cardId: number, maxVisible: number = 3) => {
    const members = cardMembersByCardId[Number(cardId)] || [];
    const visible = members.slice(0, maxVisible);
    const extraCount = Math.max(0, members.length - maxVisible);
    return { visible, extraCount };
  };

  const loadCardMemberPreviews = async (cardsData: any[]) => {
    const cardIds = Array.from(
      new Set(
        cardsData
          .map((card: any) => Number(card?.id))
          .filter((cardId: number) => Number.isFinite(cardId)),
      ),
    );
    const cardIdSet = new Set(cardIds);

    setCardMembersByCardId((prev) => {
      const next: Record<number, CardMember[]> = {};
      for (const [rawCardId, members] of Object.entries(prev)) {
        const cardId = Number(rawCardId);
        if (cardIdSet.has(cardId)) {
          next[cardId] = members;
        }
      }
      return next;
    });

    const missingIds = cardIds.filter(
      (cardId) =>
        !cardMembersByCardIdRef.current[cardId] &&
        !cardMembersLoadingIdsRef.current.has(cardId),
    );
    if (missingIds.length === 0) {
      return;
    }

    missingIds.forEach((cardId) => cardMembersLoadingIdsRef.current.add(cardId));

    const memberEntries = await Promise.all(
      missingIds.map(async (cardId) => {
        try {
          const members = await cardsAPI.getCardMembers(String(cardId));
          return [cardId, normalizeCardMembers(members)] as const;
        } catch (error) {
          console.error(`Failed to load card members for card ${cardId}:`, error);
          return [cardId, []] as const;
        } finally {
          cardMembersLoadingIdsRef.current.delete(cardId);
        }
      }),
    );

    setCardMembersByCardId((prev) => {
      const next = { ...prev };
      for (const [cardId, members] of memberEntries) {
        if (cardIdSet.has(cardId)) {
          next[cardId] = members;
        }
      }
      return next;
    });
  };

  const loadListsAndCards = async (
    targetBoardId: number,
    silent: boolean = false,
  ) => {
    try {
      const listsData = await listsAPI.getListsByBoard(targetBoardId.toString());
      console.log("✅ Lists loaded from API:", listsData);
      console.log("ðŸ“‹ First list structure:", listsData[0]);
      setLists(listsData);
      console.log("ðŸ“‹ Lists state updated with", listsData.length, "lists");

      const cardsByList = await Promise.all(
        listsData.map((list: any) =>
          cardsAPI.getCardsByList(list.id.toString()),
        ),
      );
      const allCards: any[] = cardsByList.flat();
      console.log("✅ Cards loaded from API:", allCards.length, "total cards");
      console.log("ðŸƒ First card structure:", allCards[0]);
      setCards(allCards);
      void loadCardMemberPreviews(allCards);
    } catch (error) {
      console.error("Failed to load lists/cards:", error);
      if (!silent) {
        alert(
          error instanceof Error
            ? error.message
            : "Không tải được dữ liệu board.",
        );
      }
    }
  };

  const loadCardMembers = async (cardId: number, showLoading: boolean = true) => {
    if (showLoading) setLoadingCardMembers(true);
    try {
      const members = await cardsAPI.getCardMembers(String(cardId));
      const normalizedMembers = normalizeCardMembers(members);
      setCardMembers(normalizedMembers);
      setCardMembersByCardId((prev) => ({
        ...prev,
        [Number(cardId)]: normalizedMembers,
      }));
    } catch (error) {
      console.error("Failed to load card members:", error);
      if (showLoading) alert(error instanceof Error ? error.message : "Không tải được danh sách thành viên cho thẻ.");
    } finally {
      if (showLoading) setLoadingCardMembers(false);
    }
  };

  const handleAddCardMember = async (cardId: number, userId?: number, email?: string) => {
    try {
      const payload: any = {};
      if (userId) payload.user_id = userId;
      if (email) payload.email = email;
      const added = await cardsAPI.addCardMember(String(cardId), payload);
      // reload members
      await loadCardMembers(cardId, false);
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to add card member:", error);
      alert(error instanceof Error ? error.message : "Không thêm được thành viên cho thẻ.");
    }
  };

  const handleRemoveCardMember = async (cardId: number, userId: number) => {
    if (!confirm("Bạn có chắc muốn gỡ thành viên khỏi thẻ này?")) return;
    try {
      await cardsAPI.removeCardMember(String(cardId), userId);
      await loadCardMembers(cardId, false);
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to remove card member:", error);
      alert(error instanceof Error ? error.message : "Không thể xóa thành viên.");
    }
  };

  // Labels (frontend-managed, persisted via cardsAPI.updateCard)
  const handleCreateLabel = async (cardId: number) => {
    if (!newLabelName.trim()) return alert("Vui lòng nhập tên label");
    const label = newLabelName.trim();
    const color = newLabelColor || "#F87171";
    const labels = Array.isArray(selectedCardData.labels) ? [...selectedCardData.labels] : [];
    // store as `${label}::${color}`
    const value = `${label}::${color}`;
    if (labels.includes(value)) return alert("Label đã tồn tại");
    const newLabels = [...labels, value];
    try {
      console.log("Creating label", value, "for card", selectedCardId);
      const updated = await cardsAPI.updateCard(String(selectedCardId), { labels: newLabels });
      console.log("API updateCard result for labels:", updated);
      setSelectedCard((prev: any) => ({ ...prev, labels: newLabels }));
      setCards((prev) => prev.map((c) => (Number(c.id) === Number(selectedCardId) ? { ...c, labels: newLabels } : c)));
      // add to boardLabels if not exists
      setBoardLabels((prev) => {
        if (prev.find((b) => b.value === value)) return prev;
        return [...prev, { name: label, color, value }];
      });
      setNewLabelName("");
      setCreatingLabel(false);
      console.log("Label created locally, boardLabels now:", boardLabels);
    } catch (error) {
      console.error("Failed to create label:", error);
      alert(error instanceof Error ? error.message : "Không tạo được nhãn.");
    }
  };

  const handleDeleteLabelFromSystem = async (labelValue: string) => {
    if (!confirm("Bạn có chắc muốn xóa nhãn này khỏi toàn bộ board?")) return;
    try {
      // For every card that contains this label, remove it
      const cardsToUpdate = cards.filter((c: any) => Array.isArray(c.labels) && c.labels.includes(labelValue));
      await Promise.all(
        cardsToUpdate.map((c: any) => {
          const nextLabels = (c.labels || []).filter((l: string) => l !== labelValue);
          return cardsAPI.updateCard(String(c.id), { labels: nextLabels });
        }),
      );

      // Update local state
      setCards((prev) => prev.map((c) => ({ ...c, labels: Array.isArray(c.labels) ? c.labels.filter((l: string) => l !== labelValue) : c.labels })));
      setBoardLabels((prev) => prev.filter((b) => b.value !== labelValue));
      // If selected card had it, update selectedCard too
      setSelectedCard((prev: any) => {
        if (!prev) return prev;
        return { ...prev, labels: Array.isArray(prev.labels) ? prev.labels.filter((l: string) => l !== labelValue) : prev.labels };
      });
    } catch (error) {
      console.error("Failed to delete label from system:", error);
      alert(error instanceof Error ? error.message : "Không xóa được nhãn toàn bộ");
    }
  };

  // Build boardLabels from all cards whenever cards change
  useEffect(() => {
    const map = new Map<string, { name: string; color: string; value: string }>();
    cards.forEach((c: any) => {
      if (!Array.isArray(c.labels)) return;
      c.labels.forEach((lv: string) => {
        const [n, col] = String(lv).split("::");
        if (!map.has(lv)) map.set(lv, { name: n || lv, color: col || "#ddd", value: lv });
      });
    });
    setBoardLabels(Array.from(map.values()));
    console.log("Rebuilt boardLabels from cards:", Array.from(map.values()));
  }, [cards]);

  const handleToggleCardLabel = async (labelValue: string) => {
    if (!selectedCardId) return;
    const current = Array.isArray(selectedCardData.labels) ? [...selectedCardData.labels] : [];
    let nextLabels: string[];
    if (current.includes(labelValue)) {
      nextLabels = current.filter((l) => l !== labelValue);
    } else {
      nextLabels = [...current, labelValue];
    }
    try {
      await cardsAPI.updateCard(String(selectedCardId), { labels: nextLabels });
      setSelectedCard((prev: any) => ({ ...prev, labels: nextLabels }));
      setCards((prev) => prev.map((c) => (Number(c.id) === Number(selectedCardId) ? { ...c, labels: nextLabels } : c)));
    } catch (error) {
      console.error("Failed to toggle label:", error);
      alert(error instanceof Error ? error.message : "Không cập nhật label được.");
    }
  };

  const handleRemoveLabel = async (cardId: number, labelValue: string) => {
    const labels = Array.isArray(selectedCardData.labels) ? selectedCardData.labels.filter((l: string) => l !== labelValue) : [];
    try {
      await cardsAPI.updateCard(String(cardId), { labels });
      setSelectedCard((prev: any) => ({ ...prev, labels }));
      setCards((prev) => prev.map((c) => (Number(c.id) === Number(cardId) ? { ...c, labels } : c)));
    } catch (error) {
      console.error("Failed to remove label:", error);
      alert(error instanceof Error ? error.message : "Không xóa được nhãn.");
    }
  };

  const loadBoardMembers = async (
    targetBoardId: number,
    showLoading: boolean = true,
  ) => {
    if (showLoading) {
      setLoadingBoardMembers(true);
    }

    try {
      const members: BoardMember[] = await boardsAPI.getBoardMembers(
        targetBoardId.toString(),
      );
      setBoardMembers(members);
    } catch (error) {
      console.error("Failed to load board members:", error);
      if (showLoading) {
        alert(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách thành viên board.",
        );
      }
    } finally {
      if (showLoading) {
        setLoadingBoardMembers(false);
      }
    }
  };

  const loadBoardActivities = async (
    targetBoardId: number,
    showLoading: boolean = true,
  ) => {
    if (showLoading) {
      setLoadingBoardActivities(true);
    }

    try {
      const activities: BoardActivity[] = await boardsAPI.getBoardActivities(
        targetBoardId.toString(),
      );
      setBoardActivities(activities || []);
    } catch (error) {
      console.error("Failed to load board activities:", error);
      if (showLoading) {
        setBoardActivities([]);
      }
    } finally {
      if (showLoading) {
        setLoadingBoardActivities(false);
      }
    }
  };

  const loadBoardNotes = async (
    targetBoardId: number,
    showLoading: boolean = true,
  ) => {
    if (showLoading) {
      setLoadingMessages(true);
    }

    try {
      const notesData: BoardMessage[] = await boardNotesAPI.getNotesByBoard(
        targetBoardId.toString(),
      );
      const normalized = Array.isArray(notesData) ? notesData : [];
      normalized.sort(
        (left, right) =>
          (parseServerDate(left.created_at)?.getTime() ?? 0) -
          (parseServerDate(right.created_at)?.getTime() ?? 0),
      );
      setMessages(normalized);
    } catch (error) {
      console.error("Failed to load board notes:", error);
      if (showLoading) {
        setMessages([]);
      }
    } finally {
      if (showLoading) {
        setLoadingMessages(false);
      }
    }
  };

  const loadCardComments = async (
    cardId: number,
    showLoading: boolean = true,
  ) => {
    if (showLoading) {
      setLoadingComments(true);
    }

    try {
      const commentsData: CardComment[] = await commentsAPI.getCommentsByCard(
        cardId.toString(),
      );
      setCardComments(commentsData);
    } catch (error) {
      console.error("Failed to load comments:", error);
      if (showLoading) {
        setCardComments([]);
      }
    } finally {
      if (showLoading) {
        setLoadingComments(false);
      }
    }
  };

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const me = await userAPI.me();
        setCurrentUser(me);
      } catch (error) {
        console.error("Failed to load current user:", error);
      }
    };

    void loadCurrentUser();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!id || Number.isNaN(boardId)) return;

      setLoading(true);
      try {
        const boardData = await boardsAPI.getBoard(boardId);
        setBoard(boardData);
        await Promise.all([
          loadListsAndCards(boardId),
          loadBoardNotes(boardId),
        ]);
        void loadBoardMembers(boardId, false);
      } catch (error) {
        console.error("Failed to load board data:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [id, boardId]);

  useEffect(() => {
    if (!board) {
      return;
    }

    setBoardNameDraft(String(board.name ?? ""));
    setBoardDescriptionDraft(String(board.description ?? ""));
    setBoardBackgroundDraft(String(board.background ?? ""));
  }, [board]);

  // Polling effect moved below (needs to run after `showCardModal` is declared)

  // State cho messages (lưu ở backend qua board-notes API)
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [activeDragCardId, setActiveDragCardId] = useState<number | null>(null);
  const [activeDragListId, setActiveDragListId] = useState<number | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);
  const [openListMenuId, setOpenListMenuId] = useState<number | null>(null);
  const [processingListAction, setProcessingListAction] = useState<number | null>(null);
  const [newCardForm, setNewCardForm] = useState({
    list_id: "",
    title: "",
    description: "",
    due_datetime: "",
    completed: false,
  });
  // const [creatingList, setCreatingList] = useState(false);

  // State cho toggle panels
  const [showNotes, setShowNotes] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showBoard, setShowBoard] = useState(true);
  const [cardDetailTitle, setCardDetailTitle] = useState("");
  const [cardDetailDescription, setCardDetailDescription] = useState("");
  // Local editable fields for card modal (not saved until user clicks Save)
  const [cardDetailDueDatetime, setCardDetailDueDatetime] = useState("");
  const [cardDetailCompleted, setCardDetailCompleted] = useState(false);

  const selectedCardId = selectedCard
    ? Number(selectedCard?.id ?? selectedCard)
    : null;
  const selectedCardData =
    selectedCardId === null
      ? null
      : cards.find((card) => Number(card.id) === selectedCardId) ?? selectedCard;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  // Lưu vào localStorage khi thay đổi
  useEffect(() => {
    localStorage.setItem("blackboard_lists", JSON.stringify(lists));
  }, [lists]);

  useEffect(() => {
    localStorage.setItem("blackboard_cards", JSON.stringify(cards));
  }, [cards]);

  useEffect(() => {
    if (!showCardModal || !selectedCardId) {
      setCardComments([]);
      setNewCommentContent("");
      return;
    }

    void loadCardComments(selectedCardId);
    void loadCardMembers(selectedCardId);

    const intervalId = window.setInterval(() => {
      void loadCardComments(selectedCardId, false);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [showCardModal, selectedCardId]);

  // Polling to refresh lists/cards; pause polling while card modal is open
  useEffect(() => {
    if (!id || Number.isNaN(boardId)) return;
    if (showCardModal) return; // pause background refresh when user is editing a card

    const intervalId = window.setInterval(() => {
      void loadListsAndCards(boardId, true);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [id, boardId, showCardModal]);

  useEffect(() => {
    if (!id || Number.isNaN(boardId)) return;
    if (!showNotes) return;

    const intervalId = window.setInterval(() => {
      void loadBoardNotes(boardId, false);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [id, boardId, showNotes]);

  useEffect(() => {
    if (!showCardModal || !selectedCardData) {
      setCardDetailTitle("");
      setCardDetailDescription("");
      setCardDetailDueDatetime("");
      setCardDetailCompleted(false);
      return;
    }

    // Initialize local editable fields from selected card data when modal opens
    setCardDetailTitle(String(selectedCardData.title ?? ""));
    setCardDetailDescription(String(selectedCardData.description ?? ""));
    setCardDetailDueDatetime(toDateTimeLocalValue(selectedCardData) || "");
    setCardDetailCompleted(Boolean(selectedCardData.completed));
  }, [showCardModal, selectedCardId]);

  useEffect(() => {
    if (!showCardModal || !selectedCardId || Number.isNaN(boardId)) {
      return;
    }

    if (boardMembers.length === 0) {
      void loadBoardMembers(boardId, false);
    }
  }, [showCardModal, selectedCardId, boardId, boardMembers.length]);

  useEffect(() => {
    if (!showBoardMenu || Number.isNaN(boardId)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadBoardActivities(boardId, false);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [showBoardMenu, boardId]);

  const closeCardModal = () => {
    setSelectedCard(null);
    setShowCardModal(false);
    setCardComments([]);
    setNewCommentContent("");
    setLoadingComments(false);
  };

  const currentUserId = Number(currentUser?.id);
  const boardOwnerId = Number(board?.created_by);

  const boardAdminIds = new Set<number>();
  if (Number.isFinite(boardOwnerId)) {
    boardAdminIds.add(boardOwnerId);
  }
  boardMembers.forEach((member) => {
    const memberId = Number(member.id);
    if (Number.isFinite(memberId) && isBoardAdminRole(member.role)) {
      boardAdminIds.add(memberId);
    }
  });

  const isCurrentUserBoardAdmin =
    Number.isFinite(currentUserId) &&
    (currentUserId === boardOwnerId ||
      boardMembers.some(
        (member) =>
          Number(member.id) === currentUserId && isBoardAdminRole(member.role),
      ));

  const canManageBoardMembers = Boolean(isCurrentUserBoardAdmin);

  const canRemoveBoardMember = (member: BoardMember) => {
    if (!canManageBoardMembers) {
      return false;
    }

    const memberId = Number(member.id);
    if (!Number.isFinite(memberId)) {
      return false;
    }

    if (memberId === boardOwnerId) {
      return false;
    }

    if (boardAdminIds.has(memberId) && boardAdminIds.size <= 1) {
      return false;
    }

    return true;
  };

  const boardBackgroundOptions = [
    "linear-gradient(135deg, #EADDEF 0%, #A087FD 100%)",
    "linear-gradient(135deg, #FDCBF2 0%, #2044FA 100%)",
    "linear-gradient(135deg, #776EFE 0%, #0D0AA5 100%)",
    "linear-gradient(135deg, #0133FE 0%, #00003C 100%)",
    "linear-gradient(135deg, #FFFDEE 0%, #E2ED2B 100%)",
    "linear-gradient(135deg, #E0FBCF 0%, #076554 100%)",
    "linear-gradient(135deg, #E2EF26 0%, #0E332C 100%)",
    "linear-gradient(135deg, #0B6353 0%, #082B1E 100%)",
  ];

  const handleOpenBoardMenu = () => {
    if (!id || Number.isNaN(boardId)) {
      return;
    }

    setShowBoardMenu(true);
    setBoardMenuError("");
    setShareError("");
    setShareMemberInput("");
    void loadBoardMembers(boardId);
    void loadBoardActivities(boardId);
  };

  const handleCloseBoardMenu = () => {
    setShowBoardMenu(false);
    setBoardMenuError("");
    setShareError("");
  };

  const handleRemoveBoardMember = async (memberId: number) => {
    if (!isCurrentUserBoardAdmin) {
      const message = "Chỉ admin mới được xóa thành viên.";
      setBoardMenuError(message);
      setShareError(message);
      return;
    }

    const targetMember = boardMembers.find(
      (member) => Number(member.id) === Number(memberId),
    );
    if (targetMember && !canRemoveBoardMember(targetMember)) {
      const message = "Không thể xóa admin cuối cùng hoặc chủ sở hữu board.";
      setBoardMenuError(message);
      setShareError(message);
      return;
    }
    if (!confirm("Bạn có chắc muốn xóa thành viên này khỏi board?")) {
      return;
    }

    setRemovingBoardMemberId(memberId);
    setBoardMenuError("");
    try {
      await boardsAPI.removeBoardMember({
        board_id: boardId,
        user_id: memberId,
      });
      await loadBoardMembers(boardId, false);
      await loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to remove board member:", error);
      setBoardMenuError(
        error instanceof Error
          ? error.message
          : "Không thể xóa thành viên khỏi board.",
      );
    } finally {
      setRemovingBoardMemberId(null);
    }
  };

  const handleSaveBoardDescription = async () => {
    setSavingBoardDescription(true);
    setBoardMenuError("");

    try {
      const updatedBoard = await boardsAPI.updateBoard(String(boardId), {
        description: boardDescriptionDraft.trim() || null,
      });
      setBoard((prev: any) => ({ ...prev, ...updatedBoard }));
      await loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to update board description:", error);
      setBoardMenuError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật mô tả board.",
      );
    } finally {
      setSavingBoardDescription(false);
    }
  };

  const handleSaveBoardSettings = async () => {
    const normalizedName = boardNameDraft.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      setBoardMenuError("Tên board không được để trống.");
      return;
    }

    const payload: Record<string, string> = {};
    if (normalizedName !== String(board?.name ?? "")) {
      payload.name = normalizedName;
    }
    if (boardBackgroundDraft !== String(board?.background ?? "")) {
      payload.background = boardBackgroundDraft;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setSavingBoardSettings(true);
    setBoardMenuError("");
    try {
      const updatedBoard = await boardsAPI.updateBoard(String(boardId), payload);
      setBoard((prev: any) => ({ ...prev, ...updatedBoard }));
      await loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to update board settings:", error);
      setBoardMenuError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật cài đặt board.",
      );
    } finally {
      setSavingBoardSettings(false);
    }
  };

  const handleDeleteBoard = async () => {
    if (!isCurrentUserBoardAdmin) {
      setBoardMenuError("Chỉ admin mới được xóa board.");
      return;
    }

    if (!confirm("Bạn có chắc muốn xóa board này? Dữ liệu sẽ mất vĩnh viễn.")) {
      return;
    }

    setDeletingBoard(true);
    setBoardMenuError("");
    try {
      await boardsAPI.deleteBoard(String(boardId));
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to delete board:", error);
      setBoardMenuError(
        error instanceof Error ? error.message : "Không thể xóa board.",
      );
    } finally {
      setDeletingBoard(false);
    }
  };

  const handleOpenShareModal = async () => {
    if (!id || Number.isNaN(boardId)) {
      return;
    }

    setShowShareModal(true);
    setShareMemberInput("");
    setShareError("");
    await loadBoardMembers(boardId);
  };

  const handleAddBoardMember = async () => {
    if (!isCurrentUserBoardAdmin) {
      setShareError("Chỉ admin mới được thêm thành viên.");
      return;
    }

    const normalizedInput = shareMemberInput.trim();
    if (!normalizedInput) {
      setShareError("Vui lòng nhập email hoặc user ID.");
      return;
    }

    const payload: {
      board_id: number;
      user_id?: number;
      email?: string;
      role: "member";
    } = {
      board_id: boardId,
      role: "member",
    };

    if (/^\d+$/.test(normalizedInput)) {
      payload.user_id = Number(normalizedInput);
    } else {
      payload.email = normalizedInput.toLowerCase();
    }

    setSharingMember(true);
    setShareError("");
    try {
      await boardsAPI.addBoardMember(payload);
      setShareMemberInput("");
      await loadBoardMembers(boardId);
      await loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to add board member:", error);
      setShareError(
        error instanceof Error
          ? error.message
          : "Không thể thêm thành viên vào board.",
      );
    } finally {
      setSharingMember(false);
    }
  };

  const handleSendCardComment = async () => {
    if (!selectedCardId) {
      return;
    }

    const normalizedContent = newCommentContent.trim();
    if (!normalizedContent) {
      return;
    }

    setSendingComment(true);
    try {
      await commentsAPI.createComment({
        card_id: selectedCardId,
        content: normalizedContent,
      });
      setNewCommentContent("");
      await loadCardComments(selectedCardId, false);
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to create comment:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Không gửi được bình luận. Vui lòng thử lại.",
      );
    } finally {
      setSendingComment(false);
    }
  };
  const parseServerDate = (value?: string | null) => {
    if (!value) {
      return null;
    }

    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
    const normalized = hasTimezone ? value : `${value}Z`;
    const parsedDate = new Date(normalized);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }
    return parsedDate;
  };

  const formatCommentTime = (value?: string | null) => {
    const parsedDate = parseServerDate(value);
    if (!parsedDate) {
      return "";
    }

    return parsedDate.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  };

  const formatBoardActivityAction = (action: string) => {
    const dictionary: Record<string, string> = {
      board_created: "Tạo board",
      board_updated: "Cập nhật board",
      board_deleted: "Xóa board",
      member_added: "Thêm thành viên board",
      member_removed: "Xóa thành viên board",
      member_role_updated: "Cập nhật quyền thành viên",
      list_created: "Tạo danh sách",
      list_updated: "Cập nhật danh sách",
      list_deleted: "Xóa danh sách",
      card_created: "Tạo thẻ",
      card_updated: "Cập nhật thẻ",
      card_deleted: "Xóa thẻ",
      comment_added: "Bình luận thẻ",
      card_member_added: "Thêm thành viên vào thẻ",
      card_member_removed: "Gỡ thành viên khỏi thẻ",
    };
    dictionary.board_renamed = "Đổi tên board";
    dictionary.board_background_changed = "Doi background board";
    dictionary.card_deadline_updated = "Sua deadline the";
    return dictionary[action] || action.replaceAll("_", " ");
  };

  const formatBoardActivityTime = (value?: string | null) => {
    const parsedDate = parseServerDate(value);
    if (!parsedDate) {
      return "";
    }

    return parsedDate.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatBoardActivityActor = (activity: BoardActivity) => {
    if (
      currentUser &&
      activity.user_id !== null &&
      activity.user_id !== undefined &&
      Number(activity.user_id) === Number(currentUser.id)
    ) {
      return "Bạn";
    }
    if (activity.user_name && activity.user_name.trim()) {
      return activity.user_name;
    }
    if (activity.user_email && activity.user_email.trim()) {
      return activity.user_email;
    }
    return "Hệ thống";
  };

  const boardLists = lists
    .filter((l: { board_id?: number; boardId?: string }) => {
      // FIX: API returns board_id (number), compare with numeric boardId
      const listBoardId = l.board_id ?? l.boardId;
      const numericBoardId = Number(boardId);
      const match = listBoardId === numericBoardId;

      if (!match && lists.length > 0) {
        console.warn(
          `⚠️  List filter mismatch - list.board_id: ${listBoardId}, current boardId: ${numericBoardId}`,
        );
      }
      return match;
    })
    .sort(
      (a: { position: number }, b: { position: number }) =>
        a.position - b.position,
    );
  const selectedCardListTitle = selectedCardData
    ? lists.find(
        (listItem: { id: number }) =>
          Number(listItem.id) ===
          Number(selectedCardData.list_id ?? selectedCardData.listId),
      )?.title ?? "Unknown list"
    : "";
  const selectedCardLabels: string[] =
    selectedCardData && Array.isArray(selectedCardData.labels)
      ? selectedCardData.labels
      : [];
  const activeDragCardData = cards.find(
    (card) => Number(card.id) === Number(activeDragCardId),
  );
  const activeDragListData = boardLists.find(
    (listItem: any) => Number(listItem.id) === Number(activeDragListId),
  );
  const sortableListItems = boardLists.map((listItem: any) => `list-${listItem.id}`);
  const pad2 = (num: number) => String(num).padStart(2, "0");

  // Helper to normalize list id on a card object
  const getCardListId = (card: any) => {
    if (!card) return null;
    // Accept different field names returned by API: list_id, listId, list
    const v = card.list_id ?? card.listId ?? card.list ?? null;
    return v === null || v === undefined ? null : Number(v);
  };

  const normalizeTimeValue = (value?: string | null) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return `${pad2(hours)}:${pad2(minutes)}`;
  };

  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  const splitDueDateTime = (card: any) => {
    const rawDueDate = card?.due_date ?? card?.dueDate ?? null;
    const rawDueTime = card?.due_time ?? card?.dueTime ?? null;
    const normalizedRawTime = normalizeTimeValue(rawDueTime);

    if (typeof rawDueDate === "string" && rawDueDate.includes("T")) {
      const parsedDate = new Date(rawDueDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        return {
          date: toDateKey(parsedDate),
          time:
            normalizedRawTime ||
            `${pad2(parsedDate.getHours())}:${pad2(parsedDate.getMinutes())}`,
        };
      }

      const [datePart, timePart] = rawDueDate.split("T");
      return {
        date: datePart || null,
        time: normalizedRawTime || normalizeTimeValue(timePart),
      };
    }

    if (typeof rawDueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDueDate)) {
      return {
        date: rawDueDate,
        time: normalizedRawTime,
      };
    }

    if (typeof rawDueDate === "string" && rawDueDate) {
      const parsedDate = new Date(rawDueDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        return {
          date: toDateKey(parsedDate),
          time:
            normalizedRawTime ||
            `${pad2(parsedDate.getHours())}:${pad2(parsedDate.getMinutes())}`,
        };
      }
    }

    return {
      date: null,
      time: normalizedRawTime,
    };
  };

  const timeToMinutes = (time?: string | null) => {
    const normalized = normalizeTimeValue(time);
    if (!normalized) return null;
    const [hours, minutes] = normalized.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const getCardDueDateTime = (card: any) => {
    const { date, time } = splitDueDateTime(card);
    if (!date) return null;
    const dueTime = normalizeTimeValue(time) || "23:59";
    const parsed = new Date(`${date}T${dueTime}:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const getCardDeadlineState = (card: any) => {
    if (card?.completed) {
      return {
        type: "completed",
        label: "Hoàn thành",
        className: "bg-emerald-100 text-emerald-700",
      };
    }

    const dueDateTime = getCardDueDateTime(card);
    if (!dueDateTime) return null;

    const diffMs = dueDateTime.getTime() - Date.now();
    if (diffMs < 0) {
      return {
        type: "overdue",
        label: "Quá hạn",
        className: "bg-red-100 text-red-700",
      };
    }

    if (diffMs <= 2 * 60 * 60 * 1000) {
      return {
        type: "upcoming",
        label: "Sắp đến hạn",
        className: "bg-amber-100 text-amber-700",
      };
    }

    return null;
  };

  const toDateTimeLocalValue = (card: any) => {
    const { date, time } = splitDueDateTime(card);
    if (!date) return "";
    return `${date}T${time || "00:00"}`;
  };

  const splitDateTimeLocal = (value: string) => {
    if (!value) {
      return { due_date: null, due_time: null };
    }

    const [dueDatePart, dueTimePart] = value.split("T");
    return {
      due_date: dueDatePart || null,
      due_time: dueTimePart ? dueTimePart.slice(0, 5) : null,
    };
  };

  const toIsoDateTime = (value: string) => {
    if (!value) return null;
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return parsedDate.toISOString();
  };

  const getDueDateLabel = (card: any) => {
    const { date } = splitDueDateTime(card);
    if (!date) return null;

    return new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN");
  };

  const getDueTimeLabel = (card: any) => {
    const { time } = splitDueDateTime(card);
    return time;
  };

  // Return badge info for due date (label + color) or null if no due date
  const getDueBadgeInfo = (card: any) => {
    const { date, time } = splitDueDateTime(card);
    if (!date) return null;

    const dueDateTime = getCardDueDateTime(card);
    if (!dueDateTime) return null;

    const diffMs = dueDateTime.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const labelDate = new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN");

    // overdue
    if (diffMs < 0 && !card?.completed) {
      return {
        label: `${labelDate}${time ? ` ${time}` : ""}`,
        color: "#ef4444", // red-500
      };
    }

    // near due (<=2 days)
    if (diffDays <= 2 && !card?.completed) {
      return {
        label: `${labelDate}${time ? ` ${time}` : ""}`,
        color: "#f59e0b", // amber-500
      };
    }

    // not near and not overdue -> don't highlight (show normal text)
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-purple-50">
        <p className="text-gray-700">Đang tải bảng...</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Không tìm thấy bảng
          </h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Quay lại Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* const getCardsForList = (listId: string | number) => {
    const normalizedListId = Number(listId);
    return cards
      `ðŸƒ getCardsForList(${listId}): found ${filtered.length} cards`,
    );
    return filtered;
  }; */


  // Hàm thêm list mới
  const getCardsForList = (listId: string | number) => {
    const normalizedListId = Number(listId);
    return cards
      .filter((card) => getCardListId(card) === normalizedListId)
      .sort(
        (a, b) =>
          Number(a.position ?? 0) - Number(b.position ?? 0) ||
          Number(a.id) - Number(b.id),
      );
  };

  const reorderCardsForDrag = (
    sourceCardsState: any[],
    cardId: number,
    fromListId: number,
    toListId: number,
    newPosition: number,
  ) => {
    const movingCard = sourceCardsState.find((card) => Number(card.id) === cardId);
    if (!movingCard) {
      return sourceCardsState;
    }

    const sourceWithoutMoving = sourceCardsState.filter(
      (card) => Number(card.id) !== cardId,
    );

    const sourceListCards = sourceWithoutMoving
      .filter((card) => getCardListId(card) === fromListId)
      .sort(
        (a, b) =>
          Number(a.position ?? 0) - Number(b.position ?? 0) ||
          Number(a.id) - Number(b.id),
      );

    const normalizedPosition = Math.max(0, newPosition);
    const updatedById = new Map<number, any>();

    if (fromListId === toListId) {
      const boundedPosition = Math.min(normalizedPosition, sourceListCards.length);
      const reordered = [...sourceListCards];
      reordered.splice(boundedPosition, 0, {
        ...movingCard,
        list_id: toListId,
        listId: toListId,
      });

      reordered.forEach((card, index) => {
        updatedById.set(Number(card.id), {
          ...card,
          list_id: toListId,
          listId: toListId,
          position: index,
        });
      });
    } else {
      const targetListCards = sourceWithoutMoving
        .filter((card) => getCardListId(card) === toListId)
        .sort(
          (a, b) =>
            Number(a.position ?? 0) - Number(b.position ?? 0) ||
            Number(a.id) - Number(b.id),
        );

      const boundedPosition = Math.min(normalizedPosition, targetListCards.length);
      const updatedTargetCards = [...targetListCards];
      updatedTargetCards.splice(boundedPosition, 0, {
        ...movingCard,
        list_id: toListId,
        listId: toListId,
      });

      sourceListCards.forEach((card, index) => {
        updatedById.set(Number(card.id), {
          ...card,
          list_id: fromListId,
          listId: fromListId,
          position: index,
        });
      });

      updatedTargetCards.forEach((card, index) => {
        updatedById.set(Number(card.id), {
          ...card,
          list_id: toListId,
          listId: toListId,
          position: index,
        });
      });
    }

    return sourceCardsState.map((card) => {
      const updated = updatedById.get(Number(card.id));
      return updated ?? card;
    });
  };

  const reorderListsForDrag = (
    sourceListsState: any[],
    movingListId: number,
    targetListId: number,
  ) => {
    const ordered = [...sourceListsState]
      .filter((listItem: any) => Number(listItem.board_id ?? listItem.boardId) === Number(boardId))
      .sort(
        (a: any, b: any) =>
          Number(a.position ?? 0) - Number(b.position ?? 0) ||
          Number(a.id) - Number(b.id),
      );

    const fromIndex = ordered.findIndex((listItem: any) => Number(listItem.id) === movingListId);
    const toIndex = ordered.findIndex((listItem: any) => Number(listItem.id) === targetListId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return sourceListsState;
    }

    const reordered = [...ordered];
    const [movingList] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movingList);

    const nextPositionById = new Map<number, number>();
    reordered.forEach((listItem: any, index: number) => {
      nextPositionById.set(Number(listItem.id), index);
    });

    return sourceListsState.map((listItem: any) => {
      const nextPosition = nextPositionById.get(Number(listItem.id));
      if (nextPosition === undefined) {
        return listItem;
      }
      return { ...listItem, position: nextPosition };
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as
      | { type?: string; cardId?: number; listId?: number }
      | undefined;

    if (activeData?.type === "card" && activeData.cardId) {
      setActiveDragCardId(Number(activeData.cardId));
      return;
    }

    if (activeData?.type === "list" && activeData.listId) {
      setActiveDragListId(Number(activeData.listId));
    }
  };

  const handleDragCancel = () => {
    setActiveDragCardId(null);
    setActiveDragListId(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragCardId(null);
    setActiveDragListId(null);

    if (!over) {
      return;
    }

    const activeData = active.data.current as
      | { type?: string; cardId?: number; listId?: number }
      | undefined;
    const overData = over.data.current as
      | { type?: string; cardId?: number; listId?: number }
      | undefined;

    if (activeData?.type === "list" && activeData.listId) {
      const movingListId = Number(activeData.listId);
      const targetListId = overData?.listId
        ? Number(overData.listId)
        : Number(String(over.id).replace("list-", ""));

      if (!targetListId || targetListId === movingListId) {
        return;
      }

      const originalLists = lists;
      const nextLists = reorderListsForDrag(originalLists, movingListId, targetListId);
      setLists(nextLists);

      const changedLists = nextLists.filter((nextList: any) => {
        const previousList = originalLists.find(
          (listItem: any) => Number(listItem.id) === Number(nextList.id),
        );
        if (!previousList) {
          return false;
        }
        return Number(previousList.position ?? 0) !== Number(nextList.position ?? 0);
      });

      if (changedLists.length === 0) {
        return;
      }

      try {
        await Promise.all(
          changedLists.map((listItem: any) =>
            listsAPI.updateList(String(listItem.id), {
              position: Number(listItem.position ?? 0),
            }),
          ),
        );
        void loadBoardActivities(boardId, false);
      } catch (error) {
        console.error("Failed to move list:", error);
        setLists(originalLists);
        alert(
          error instanceof Error
            ? error.message
            : "Không di chuyển được danh sách. Vui lòng thử lại.",
        );
      }
      return;
    }

    if (activeData?.type !== "card" || !activeData.cardId || !activeData.listId) {
      return;
    }

    const cardId = Number(activeData.cardId);
    const fromListId = Number(activeData.listId);

    if (!overData) {
      return;
    }

    let toListId = fromListId;
    let newPosition = 0;

    if (overData.type === "card" && overData.listId && overData.cardId) {
      if (Number(overData.cardId) === cardId) {
        return;
      }

      toListId = Number(overData.listId);
      const destinationCards = getCardsForList(toListId).filter(
        (card) => Number(card.id) !== cardId,
      );
      const overIndex = destinationCards.findIndex(
        (card) => Number(card.id) === Number(overData.cardId),
      );
      newPosition = overIndex >= 0 ? overIndex : destinationCards.length;
    } else if (overData.type === "list-drop" && overData.listId) {
      toListId = Number(overData.listId);
      const destinationCards = getCardsForList(toListId).filter(
        (card) => Number(card.id) !== cardId,
      );
      newPosition = destinationCards.length;
    } else if (overData.type === "list" && overData.listId) {
      toListId = Number(overData.listId);
      const destinationCards = getCardsForList(toListId).filter(
        (card) => Number(card.id) !== cardId,
      );
      newPosition = destinationCards.length;
    } else {
      return;
    }

    const originalCards = cards;
    const currentCardInState = originalCards.find(
      (card) => Number(card.id) === cardId,
    );
    if (!currentCardInState) {
      return;
    }

    const currentListId = getCardListId(currentCardInState);
    const currentPosition = Number(currentCardInState.position ?? 0);
    if (currentListId === toListId && currentPosition === newPosition) {
      return;
    }

    const nextCards = reorderCardsForDrag(
      originalCards,
      cardId,
      fromListId,
      toListId,
      newPosition,
    );
    setCards(nextCards);

    try {
      await cardsAPI.updateCard(String(cardId), {
        list_id: toListId,
        position: newPosition,
      });
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to move card:", error);
      setCards(originalCards);
      await loadListsAndCards(boardId, true);
      alert(
        error instanceof Error
          ? error.message
          : "Không di chuyển được thẻ. Vui lòng thử lại.",
      );
    }
  };

  const handleAddList = async () => {
    const normalizedListTitle = newListTitle.trim();
    if (!normalizedListTitle) {
      alert("Vui lòng nhập tiêu đề danh sách");
      return;
    }

    if (!board) {
      alert("Bảng chưa tải. Vui lòng thử lại.");
      return;
    }

    const duplicateList = boardLists.some(
      (list: any) =>
        String(list.title ?? "")
          .trim()
          .toLowerCase() === normalizedListTitle.toLowerCase(),
    );
    if (duplicateList) {
      alert("Tên danh sách đã tồn tại");
      return;
    }

    setCreatingList(true);
    try {
      const newList = await listsAPI.createList({
        title: normalizedListTitle,
        board_id: Number(board.id),
      });

      // DEBUG: Log API response to verify structure
      console.log("✅ API Response:", newList);
      console.log("Expected board_id:", Number(board.id));
      console.log("Received board_id:", newList.board_id);

      // Update lists state with new list using functional update
      setLists((prevLists) => {
        const updated = [...prevLists, newList];
        console.log("ðŸ“‹ Updated lists state:", updated);
        return updated;
      });

      // Reset form and close add list UI AFTER state is updated
      setNewListTitle("");
      setShowAddList(false);
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("❌ Failed to create list:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi tạo danh sách. Vui lòng thử lại.",
      );
    } finally {
      setCreatingList(false);
    }
  };

  // Hàm thêm card mới
  const handleRenameList = async (listId: number) => {
    const targetList = boardLists.find(
      (listItem: any) => Number(listItem.id) === Number(listId),
    );
    if (!targetList) {
      return;
    }

    const draftName = window.prompt(
      "Nhập tên danh sách mới",
      String(targetList.title ?? ""),
    );
    if (draftName === null) {
      return;
    }

    const normalizedName = draftName.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      alert("Tên danh sách không được để trống");
      return;
    }

    const duplicateList = boardLists.some(
      (listItem: any) =>
        Number(listItem.id) !== Number(listId) &&
        String(listItem.title ?? "").trim().toLowerCase() ===
          normalizedName.toLowerCase(),
    );
    if (duplicateList) {
      alert("Tên danh sách đã tồn tại");
      return;
    }

    setProcessingListAction(listId);
    try {
      const updatedList = await listsAPI.updateList(String(listId), {
        title: normalizedName,
      });
      setLists((prevLists) =>
        prevLists.map((listItem: any) =>
          Number(listItem.id) === Number(listId)
            ? { ...listItem, ...(updatedList || {}), title: normalizedName }
            : listItem,
        ),
      );
      setOpenListMenuId(null);
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to rename list:", error);
      alert(
        error instanceof Error ? error.message : "Không đổi tên danh sách được.",
      );
    } finally {
      setProcessingListAction(null);
    }
  };

  const handleMoveList = async (listId: number, direction: -1 | 1) => {
    const orderedLists = [...boardLists];
    const currentIndex = orderedLists.findIndex(
      (listItem: any) => Number(listItem.id) === Number(listId),
    );
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= orderedLists.length) {
      return;
    }

    const currentList = orderedLists[currentIndex];
    const targetList = orderedLists[targetIndex];
    const currentPosition = Number(currentList.position ?? currentIndex);
    const targetPosition = Number(targetList.position ?? targetIndex);

    setProcessingListAction(listId);
    setLists((prevLists) =>
      prevLists.map((listItem: any) => {
        if (Number(listItem.id) === Number(currentList.id)) {
          return { ...listItem, position: targetPosition };
        }
        if (Number(listItem.id) === Number(targetList.id)) {
          return { ...listItem, position: currentPosition };
        }
        return listItem;
      }),
    );

    try {
      await Promise.all([
        listsAPI.updateList(String(currentList.id), { position: targetPosition }),
        listsAPI.updateList(String(targetList.id), { position: currentPosition }),
      ]);
      setOpenListMenuId(null);
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to reorder list:", error);
      await loadListsAndCards(boardId, true);
      alert(
        error instanceof Error
          ? error.message
          : "Không sắp xếp danh sách được.",
      );
    } finally {
      setProcessingListAction(null);
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (!isCurrentUserBoardAdmin) {
      alert("Chỉ admin mới được xóa danh sách.");
      return;
    }

    const targetList = boardLists.find(
      (listItem: any) => Number(listItem.id) === Number(listId),
    );
    if (!targetList) {
      return;
    }

    if (!confirm(`Bạn có chắc muốn xóa danh sách "${targetList.title}" không?`)) {
      return;
    }

    setProcessingListAction(listId);
    try {
      await listsAPI.deleteList(String(listId));
      setLists((prevLists) =>
        prevLists.filter((listItem: any) => Number(listItem.id) !== Number(listId)),
      );
      setCards((prevCards) =>
        prevCards.filter((cardItem: any) => getCardListId(cardItem) !== Number(listId)),
      );
      setOpenListMenuId(null);
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to delete list:", error);
      alert(error instanceof Error ? error.message : "Không xóa danh sách được.");
    } finally {
      setProcessingListAction(null);
    }
  };

  const handleAddCard = async (listId: string) => {
    console.log("ðŸƒ handleAddCard called with listId:", listId);
    console.log("ðŸƒ newCardTitle:", newCardTitle);

    const normalizedCardTitle = newCardTitle.trim();
    if (!normalizedCardTitle) {
      console.log("ðŸƒ Title is empty, returning");
      alert("Vui lòng nhập tiêu đề thẻ");
      return;
    }

    const duplicateCard = cards.some((card: any) => {
      const sameList = Number(card.list_id ?? card.listId) === Number(listId);
      const sameTitle =
        String(card.title ?? "").trim().toLowerCase() ===
        normalizedCardTitle.toLowerCase();
      return sameList && sameTitle;
    });
    if (duplicateCard) {
      alert("Tên thẻ đã tồn tại");
      return;
    }

    try {
      console.log("ðŸƒ Calling API with:", {
        title: normalizedCardTitle,
        list_id: parseInt(listId),
      });

      const newCard = await cardsAPI.createCard({
        title: normalizedCardTitle,
        list_id: parseInt(listId),
      });

      console.log("ðŸƒ API response:", newCard);

      // Update cards state with new card using functional update
      setCards((prevCards) => {
        const updated = [...prevCards, newCard];
        console.log("ðŸƒ Cards state updated, new length:", updated.length);
        return updated;
      });

      // Reset form and close add card UI
      setNewCardTitle("");
      setAddingCardToList(null);
      void loadBoardActivities(boardId, false);
      console.log("ðŸƒ Form reset and UI closed");
    } catch (error) {
      console.error("❌ Failed to create card:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi tạo thẻ. Vui lòng thử lại.",
      );
    }
  };

  // Hàm xác định màu card theo trạng thái - SỬA LOGIC
  const openCreateCardModal = (listId: string) => {
    setNewCardForm({
      list_id: String(listId),
      title: "",
      description: "",
      due_datetime: "",
      completed: false,
    });
    setShowCreateCardModal(true);
  };

  const handleCreateCardFromModal = async () => {
    const normalizedCardTitle = newCardForm.title.trim();
    if (!normalizedCardTitle) {
      alert("Vui lòng nhập tiêu đề thẻ");
      return;
    }

    if (!newCardForm.list_id) {
      alert("Vui lòng chọn danh sách");
      return;
    }

    const duplicateCard = cards.some((card: any) => {
      const sameList =
        Number(card.list_id ?? card.listId) === Number(newCardForm.list_id);
      const sameTitle =
        String(card.title ?? "").trim().toLowerCase() ===
        normalizedCardTitle.toLowerCase();
      return sameList && sameTitle;
    });
    if (duplicateCard) {
      alert("Tên thẻ đã tồn tại");
      return;
    }

    const dueParts = splitDateTimeLocal(newCardForm.due_datetime);
    const cardPayload: any = {
      title: normalizedCardTitle,
      list_id: Number(newCardForm.list_id),
      description: newCardForm.description.trim() || undefined,
      completed: newCardForm.completed,
      due_date: dueParts.due_date,
      due_time: dueParts.due_time,
    };

    setCreatingCard(true);
    try {
      const newCard = await cardsAPI.createCard(cardPayload);
      setCards((prevCards) => [...prevCards, { ...cardPayload, ...newCard }]);
      setShowCreateCardModal(false);
      setNewCardForm({
        list_id: "",
        title: "",
        description: "",
        due_datetime: "",
        completed: false,
      });
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("Failed to create card:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi tạo thẻ. Vui lòng thử lại.",
      );
    } finally {
      setCreatingCard(false);
    }
  };

  const getCardStyles = (card: any) => {
    // Priority: completed > overdue > near-due > default
    if (card.completed) {
      return "bg-green-100 border-green-300";
    }

    const dueDateTime = getCardDueDateTime(card);
    if (dueDateTime) {
      const diffMs = dueDateTime.getTime() - Date.now();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs < 0) {
        // overdue
        return "bg-red-100 border-red-300";
      }

      if (diffDays <= 2) {
        // near due
        return "bg-yellow-100 border-yellow-300";
      }
    }

    return "bg-white border-gray-200";
  };

  // Hàm cập nhật card
  const handleUpdateCard = async (cardId: number, updates: any) => {
    const payload: Record<string, any> = {};

    if (typeof updates.title === "string") {
      payload.title = updates.title;
    }
    if (typeof updates.description === "string") {
      payload.description = updates.description;
    }
    if ("due_date" in updates) {
      payload.due_date = updates.due_date ?? null;
    }
    if ("completed" in updates) {
      payload.completed = Boolean(updates.completed);
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    try {
      const updatedCard = await cardsAPI.updateCard(cardId.toString(), payload);

      // Update cards state with updated card using functional update
      setCards((prevCards) =>
        prevCards.map((card) =>
          card.id === cardId
            ? { ...card, ...payload, ...(updatedCard || {}) }
            : card,
        ),
      );

      setSelectedCard((prevSelectedCard: any) => {
        if (!prevSelectedCard) {
          return prevSelectedCard;
        }

        const previousId = Number(prevSelectedCard?.id ?? prevSelectedCard);
        if (previousId !== cardId) {
          return prevSelectedCard;
        }

        const previousCardObject =
          typeof prevSelectedCard === "object" && prevSelectedCard !== null
            ? prevSelectedCard
            : { id: cardId };

        return {
          ...previousCardObject,
          ...payload,
          ...(updatedCard || {}),
        };
      });

      console.log("✅ Card updated:", updatedCard);
      void loadBoardActivities(boardId, false);
    } catch (error) {
      console.error("❌ Failed to update card:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Có lỗi xảy ra khi cập nhật thẻ. Vui lòng thử lại.",
      );
    }
  };

  // Save edits made in the card detail modal. Edits are kept locally until the user
  // explicitly clicks "Lưu" (Save). Clicking Close will discard local edits.
  const handleSaveCardEdits = async () => {
    if (!selectedCardId || !selectedCardData) return;

    const updates: Record<string, any> = {};

    const normalizedTitle = cardDetailTitle.trim();
    if (!normalizedTitle) {
      alert("Vui lòng nhập tiêu đề thẻ");
      return;
    }

    if (normalizedTitle !== String(selectedCardData.title ?? "")) {
      updates.title = normalizedTitle;
    }

    if (cardDetailDescription !== String(selectedCardData.description ?? "")) {
      updates.description = cardDetailDescription;
    }

    const newIso = toIsoDateTime(cardDetailDueDatetime);
    const existingIso = selectedCardData?.due_date
      ? new Date(selectedCardData.due_date).toISOString()
      : null;
    if ((newIso ?? null) !== (existingIso ?? null)) {
      updates.due_date = newIso;
    }

    if (cardDetailCompleted !== Boolean(selectedCardData.completed)) {
      updates.completed = cardDetailCompleted;
    }

    try {
      if (Object.keys(updates).length > 0) {
        await handleUpdateCard(selectedCardId, updates);
      }
      closeCardModal();
    } catch (err) {
      console.error("Failed to save card edits:", err);
      alert(err instanceof Error ? err.message : "Lưu thẻ thất bại");
    }
  };

  const resolveBoardMessageAuthor = (message: BoardMessage) => {
    if (Number(message.user_id) === Number(currentUser?.id)) {
      return currentUser?.name || currentUser?.email || "Bạn";
    }

    const member = boardMembers.find(
      (boardMember) => Number(boardMember.id) === Number(message.user_id),
    );
    return (
      member?.name ||
      member?.email ||
      `Người dùng #${Number(message.user_id)}`
    );
  };

  const formatBoardMessageTime = (createdAt?: string | null) => {
    const parsedDate = parseServerDate(createdAt);
    if (!parsedDate) return "--:--";
    return parsedDate.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Hàm thêm message
  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || sendingMessage || Number.isNaN(boardId)) return;

    setSendingMessage(true);
    try {
      const createdMessage: BoardMessage = await boardNotesAPI.createNote({
        board_id: boardId,
        content,
      });
      setMessages((prev) => {
        const merged = [...prev, createdMessage];
        merged.sort(
          (left, right) =>
            (parseServerDate(left.created_at)?.getTime() ?? 0) -
            (parseServerDate(right.created_at)?.getTime() ?? 0),
        );
        return merged;
      });
      setNewMessage("");
      void loadBoardNotes(boardId, false);
    } catch (error) {
      console.error("Failed to send board message:", error);
      alert(error instanceof Error ? error.message : "Không gửi được tin nhắn.");
    } finally {
      setSendingMessage(false);
    }
  };

  // Lấy cards cho timeline theo giờ
  const todayDate = new Date();
  const todayKey = toDateKey(todayDate);
  const todayLabel = todayDate.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const isCardAssignedToCurrentUser = (card: any) => {
    if (!Number.isFinite(currentUserId)) {
      return false;
    }

    const numericCardId = Number(card?.id);
    const members = Number.isFinite(numericCardId)
      ? cardMembersByCardId[numericCardId] || []
      : [];
    const isCardMember = members.some(
      (member) => Number(member.id) === Number(currentUserId),
    );

    const assigneeId = Number(card?.assignee_id ?? card?.assigneeId);
    const isLegacyAssignee =
      Number.isFinite(assigneeId) && assigneeId === Number(currentUserId);

    return isCardMember || isLegacyAssignee;
  };

  const todayTimelineCards = cards
    .filter((card: any) => {
      const { date, time } = splitDueDateTime(card);
      return (
        date === todayKey &&
        !!normalizeTimeValue(time) &&
        isCardAssignedToCurrentUser(card)
      );
    })
    .sort((a: any, b: any) => {
      const aMinutes = timeToMinutes(getDueTimeLabel(a)) ?? Number.MAX_SAFE_INTEGER;
      const bMinutes = timeToMinutes(getDueTimeLabel(b)) ?? Number.MAX_SAFE_INTEGER;
      if (aMinutes !== bMinutes) {
        return aMinutes - bMinutes;
      }
      return Number(a.id) - Number(b.id);
    });

  const getCardsForTimeSlot = (hour: string) => {
    const hourPrefix = hour.slice(0, 2);
    return todayTimelineCards.filter((card: any) => {
      const dueTime = normalizeTimeValue(getDueTimeLabel(card));
      return !!dueTime && dueTime.slice(0, 2) === hourPrefix;
    });
  };

  // Timeline hours
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i + 8; // 8:00 đến 23:00
    return `${(hour - 8).toString().padStart(2, "0")}:00`;
  });
  const timelineSlotsWithCards = timeSlots.filter(
    (slot) => getCardsForTimeSlot(slot).length > 0,
  );

  return (
    <div
      className="h-screen w-full flex flex-col"
      style={{ background: board.background }}
    >
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/20 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-white/80 hover:text-white transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-white">{board.name}</h1>
            <button className="p-2 hover:bg-white/10 rounded transition">
              <Star size={20} className="text-white" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenShareModal}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition"
            >
              <Share2 size={18} />
              <span className="font-medium">Chia sẻ</span>
            </button>

            <button
              onClick={handleOpenBoardMenu}
              className="p-2 hover:bg-white/10 rounded transition"
              title="Mở menu quản lý board"
            >
              <MoreHorizontal size={20} className="text-white" />
            </button>
          </div>
        </div>
      </header>

      {showBoardMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={handleCloseBoardMenu}
        >
          <aside
            className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-gray-700" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Menu quản lý board
                </h2>
              </div>
              <button
                onClick={handleCloseBoardMenu}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {boardMenuError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {boardMenuError}
                </div>
              )}

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Share2 size={16} className="text-gray-600" />
                  Chia sẻ & Thành viên
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareMemberInput}
                    onChange={(e) => setShareMemberInput(e.target.value)}
                    placeholder="Email hoặc user ID"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!canManageBoardMembers || sharingMember}
                  />
                  <button
                    onClick={handleAddBoardMember}
                    disabled={sharingMember || !canManageBoardMembers}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sharingMember ? "Đang thêm..." : "Thêm"}
                  </button>
                </div>
                {shareError && (
                  <p className="text-sm text-red-600">{shareError}</p>
                )}
                {!canManageBoardMembers && (
                  <p className="text-xs text-gray-500">
                    Chỉ admin mới được thêm hoặc xóa thành viên.
                  </p>
                )}

                {loadingBoardMembers ? (
                  <p className="text-sm text-gray-500">Đang tải thành viên...</p>
                ) : boardMembers.length === 0 ? (
                  <p className="text-sm text-gray-500">Board chưa có thành viên.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {boardMembers.map((member) => {
                      const role = (member.role || "member").toLowerCase();
                      const canRemove = canRemoveBoardMember(member);
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {member.name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-600 truncate">
                              {member.email || "No email"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700 uppercase">
                              {role}
                            </span>
                            {canRemove && (
                              <button
                                onClick={() => void handleRemoveBoardMember(member.id)}
                                disabled={removingBoardMemberId === member.id}
                                className="px-2 py-1 text-xs text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                              >
                                {removingBoardMemberId === member.id ? "..." : "Xóa"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <NotepadText size={16} className="text-gray-600" />
                  Mô tả board
                </h3>
                <textarea
                  value={boardDescriptionDraft}
                  onChange={(e) => setBoardDescriptionDraft(e.target.value)}
                  placeholder="Nhập mục đích và phạm vi công việc của board..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={handleSaveBoardDescription}
                  disabled={savingBoardDescription}
                  className="px-4 py-2 bg-[#051836] text-white rounded-lg text-sm font-medium hover:bg-[#051836cc] disabled:opacity-50"
                >
                  {savingBoardDescription ? "Đang lưu..." : "Lưu mô tả"}
                </button>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Settings size={16} className="text-gray-600" />
                  Cài đặt board
                </h3>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tên board</label>
                  <input
                    type="text"
                    value={boardNameDraft}
                    onChange={(e) => setBoardNameDraft(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Giao diện nền</label>
                  <div className="grid grid-cols-4 gap-2">
                    {boardBackgroundOptions.map((backgroundValue) => (
                      <button
                        key={backgroundValue}
                        type="button"
                        onClick={() => setBoardBackgroundDraft(backgroundValue)}
                        className={`h-10 rounded-md border ${
                          boardBackgroundDraft === backgroundValue
                            ? "border-blue-600 ring-2 ring-blue-300"
                            : "border-gray-200"
                        }`}
                        style={{ background: backgroundValue }}
                        title="Chọn nền board"
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveBoardSettings}
                    disabled={savingBoardSettings}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingBoardSettings ? "Đang cập nhật..." : "Lưu cài đặt"}
                  </button>
                  <button
                    onClick={handleDeleteBoard}
                    disabled={deletingBoard}
                    className="ml-auto inline-flex items-center gap-1 px-3 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {deletingBoard ? "Đang xóa..." : "Xóa board"}
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <History size={16} className="text-gray-600" />
                    Theo dõi hoạt động
                  </h3>
                  <button
                    onClick={() => void loadBoardActivities(boardId)}
                    className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Làm mới
                  </button>
                </div>
                {loadingBoardActivities ? (
                  <p className="text-sm text-gray-500">Đang tải hoạt động...</p>
                ) : boardActivities.length === 0 ? (
                  <p className="text-sm text-gray-500">Chưa có hoạt động nào.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {boardActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="p-2.5 rounded-lg border border-gray-200 bg-white"
                      >
                        <p className="text-sm font-medium text-gray-800">
                          {formatBoardActivityAction(activity.action)}
                        </p>
                        {activity.details && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            {activity.details}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-500 mt-1">
                          Bởi {formatBoardActivityActor(activity)}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {formatBoardActivityTime(activity.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}

      {/* Main 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* PANEL TRÁI - GHI CHÚ & CHAT */}
        {showNotes && (
          <div className="w-72 bg-gray-100/70 backdrop-blur border-r border-white/20 flex flex-col rounded-none">
            {/* Header */}
            <div className="p-4 border-b border-white/20">
              <h2 className="font-bold text-gray-800">Ghi chú & Trao đổi</h2>
              <p className="text-xs text-gray-600 mt-1">
                Thảo luận về bảng này
              </p>
            </div>

            {/* Messages list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {loadingMessages ? (
                <p className="text-sm text-gray-500">Đang tải tin nhắn...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Chưa có trao đổi nào trong bảng này.
                </p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className="bg-white/80 backdrop-blur rounded-lg p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800">
                        {resolveBoardMessageAuthor(message)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatBoardMessageTime(message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-white/20 bg-white/10">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder="Nhập tin nhắn..."
                className="w-full px-3 py-2 bg-white/80 backdrop-blur border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                rows={3}
                disabled={sendingMessage}
              />
              <button
                onClick={() => void handleSendMessage()}
                disabled={sendingMessage || !newMessage.trim()}
                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                <span className="text-sm font-medium">
                  {sendingMessage ? "Đang gửi..." : "Gửi"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* PANEL GIỮA - TIMELINE THEO GIỜ */}
        {showTimeline && (
          <div className="w-80 bg-gray-100/60 backdrop-blur border-r border-white/20 flex flex-col rounded-none">
            {/* Header */}
            <div className="p-4 border-b border-white/20">
              <h2 className="font-bold text-gray-800">Hôm nay</h2>
              <p className="text-xs text-gray-600 mt-1">Công việc theo giờ</p>
            </div>

            {/* Timeline scroll with custom scrollbar */}
            <div
              className="flex-1 overflow-y-auto p-4 pr-2 space-y-2 scrollbar-thin"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#cbd5e1 transparent",
              }}
            >
              <style>{`
                .scrollbar-thin::-webkit-scrollbar {
                  width: 6px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                  background: transparent;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                  background: #cbd5e1;
                  border-radius: 999px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                  background: #94a3b8;
                }
              `}</style>
              {timelineSlotsWithCards.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white/70 p-3 text-sm text-gray-600">
                  {todayLabel}: chưa có công việc nào của bạn có deadline theo giờ.
                </div>
              )}
              {timelineSlotsWithCards.map((timeSlot) => {
                const slotCards = getCardsForTimeSlot(timeSlot);

                return (
                  <div key={timeSlot} className="relative">
                    {/* Time label */}
                    <div className="flex items-center gap-3 mb-2">
                      <Clock size={14} className="text-gray-700" />
                      <span className="text-sm font-semibold text-gray-800">
                        {timeSlot}
                      </span>
                      <div className="flex-1 h-px bg-gray-400/30" />
                    </div>

                    {/* Cards in this time slot */}
                    <div className="ml-7 space-y-2 mb-3">
                        {slotCards.map((card: any) => {
                          const cardStyles = getCardStyles(card);
                          const dueTimeLabel = getDueTimeLabel(card);
                          const deadlineState = getCardDeadlineState(card);
                          const cardMemberPreview = getCardMemberPreview(Number(card.id), 2);

                          const cardLabelsArr: { name: string; color: string; value: string }[] = Array.isArray(card.labels)
                            ? card.labels.map((lv: string) => {
                                const [n, col] = String(lv).split("::");
                                return { name: n || lv, color: col || "#ddd", value: lv };
                              })
                            : [];

                         return (
                           <button
                             key={card.id}
                             onClick={() => {
                               setSelectedCard(card);
                               setShowCardModal(true);
                             }}
                             className={`w-full text-left rounded-lg border p-2.5 shadow-sm hover:shadow-md transition ${cardStyles}`}
                           >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-sm font-medium text-gray-800 leading-snug">
                                  {card.title}
                                </p>
                                {cardMemberPreview.visible.length > 0 && (
                                  <div className="flex -space-x-1 shrink-0">
                                    {cardMemberPreview.visible.map((member) => (
                                      <span
                                        key={`timeline-card-${card.id}-member-${member.id}`}
                                        title={member.name || member.email || `User ${member.id}`}
                                        className="w-5 h-5 rounded-full border border-white bg-[#051836] text-white text-[10px] font-semibold flex items-center justify-center"
                                      >
                                        {getMemberInitial(member)}
                                      </span>
                                    ))}
                                    {cardMemberPreview.extraCount > 0 && (
                                      <span className="w-5 h-5 rounded-full border border-white bg-gray-200 text-gray-700 text-[10px] font-semibold flex items-center justify-center">
                                        +{cardMemberPreview.extraCount}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                             {/* show small label bars above time in timeline card */}
                             {cardLabelsArr.length > 0 && (
                               <div className="mb-1 flex flex-col gap-1">
                                 {cardLabelsArr.map((cl) => (
                                   <div key={cl.value} className="inline-block rounded text-white text-xs px-2 py-0.5" style={{ background: cl.color }}>
                                     {cl.name}
                                   </div>
                                 ))}
                               </div>
                             )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {dueTimeLabel ? (
                                    <span className="text-xs text-gray-600">{dueTimeLabel}</span>
                                  ) : null}
                                  {deadlineState ? (
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded ${deadlineState.className}`}
                                    >
                                      {deadlineState.label}
                                    </span>
                                  ) : null}
                               {/* {card.labels.length > 0 && (
                                 <div className="flex gap-1">
                                   {card.labels
                                     .slice(0, 2)
                                     .map((label: string) => (
                                       <span
                                         key={label}
                                         className={`${labelColors[label] || "bg-gray-400"} text-white text-xs px-1.5 py-0.5 rounded`}
                                       >
                                         {label}
                                       </span>
                                     ))}
                                 </div>
                               )} */}
                             </div>
                           </button>
                         );
                       })}

                      {/* Empty slot */}
                      {false && (
                        <div className="text-xs text-gray-500 italic py-2">
                          Chưa có công việc
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PANEL PHẢI - BOARD LISTS */}
        {showBoard && (
          <div
            className="flex-1 overflow-x-auto bg-transparent scrollbar-thin"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#cbd5e1 transparent",
            }}
          >
            <div className="p-6" onClick={() => setOpenListMenuId(null)}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
                onDragEnd={(event) => {
                  void handleDragEnd(event);
                }}
              >
              <div
                className="flex gap-4 pb-6"
                style={{ minWidth: "fit-content" }}
              >
                {/* Lists */}
                <SortableContext
                  items={sortableListItems}
                  strategy={horizontalListSortingStrategy}
                >
                {boardLists.map((list: List, listIndex: number) => {
                  const listNumericId = Number(list.id);
                  const listCards = getCardsForList(listNumericId);
                  const sortableItems = listCards.map(
                    (card: any) => `card-${card.id}`,
                  );

                  return (
                    <DraggableListContainer key={`list-${list.id}`} listId={listNumericId}>
                    <div className="w-72 flex-shrink-0">
                      <div className="bg-gray-100 rounded-xl p-4 shadow-sm">
                        {/* List header */}
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-800">
                            {list.title}
                          </h3>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenListMenuId((prev) =>
                                  prev === listNumericId ? null : listNumericId,
                                );
                              }}
                              className="p-1 hover:bg-gray-200 rounded transition"
                              title="Tác vụ danh sách"
                            >
                              <MoreHorizontal
                                size={18}
                                className="text-gray-600"
                              />
                            </button>
                            {openListMenuId === listNumericId && (
                              <div
                                className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-30 p-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => void handleRenameList(listNumericId)}
                                  disabled={processingListAction !== null}
                                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 disabled:opacity-50"
                                >
                                  Đổi tên
                                </button>
                                <button
                                  onClick={() => void handleMoveList(listNumericId, -1)}
                                  disabled={processingListAction !== null || listIndex === 0}
                                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 disabled:opacity-50"
                                >
                                  Di chuyển trái
                                </button>
                                <button
                                  onClick={() => void handleMoveList(listNumericId, 1)}
                                  disabled={processingListAction !== null || listIndex === boardLists.length - 1}
                                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 disabled:opacity-50"
                                >
                                  Di chuyển phải
                                </button>
                                {isCurrentUserBoardAdmin && (
                                  <button
                                    onClick={() => void handleDeleteList(listNumericId)}
                                    disabled={processingListAction !== null}
                                    className="w-full text-left px-3 py-2 text-sm rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Xóa danh sách
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Cards */}
                        <DroppableCardLane listId={listNumericId}>
                          <SortableContext
                            items={sortableItems}
                            strategy={verticalListSortingStrategy}
                          >
                            {listCards.map((card: any) => {
                            const cardStyles = getCardStyles(card);
                            const dueDateLabel = getDueDateLabel(card);
                            const dueTimeLabel = getDueTimeLabel(card);
                            const dueBadge = getDueBadgeInfo(card);
                            const cardMemberPreview = getCardMemberPreview(Number(card.id), 3);
                            const cardLabelsArr: { name: string; color: string; value: string }[] = Array.isArray(card.labels)
                              ? card.labels.map((lv: string) => {
                                  const [n, col] = String(lv).split("::");
                                  return { name: n || lv, color: col || "#ddd", value: lv };
                                })
                              : [];

                            return (
                              <DraggableCardContainer
                                key={`card-${card.id}`}
                                cardId={Number(card.id)}
                                listId={listNumericId}
                              >
                                <button
                                onClick={() => {
                                  setSelectedCard(card);
                                  setShowCardModal(true);
                                }}
                                className={`w-full rounded-lg border p-3 shadow-sm hover:shadow-md transition text-left group ${cardStyles}`}
                              >
                                {cardLabelsArr.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {cardLabelsArr.map((label) => (
                                      <span
                                        key={label.value}
                                        className="text-white text-[11px] px-2 py-0.5 rounded"
                                        style={{ background: label.color }}
                                      >
                                        {label.name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Title */}
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <p className="text-gray-800 font-medium leading-snug">
                                    {card.title}
                                  </p>
                                  {cardMemberPreview.visible.length > 0 && (
                                    <div className="flex -space-x-1 shrink-0">
                                      {cardMemberPreview.visible.map((member) => (
                                        <span
                                          key={`board-card-${card.id}-member-${member.id}`}
                                          title={member.name || member.email || `User ${member.id}`}
                                          className="w-6 h-6 rounded-full border border-white bg-[#051836] text-white text-[10px] font-semibold flex items-center justify-center"
                                        >
                                          {getMemberInitial(member)}
                                        </span>
                                      ))}
                                      {cardMemberPreview.extraCount > 0 && (
                                        <span className="w-6 h-6 rounded-full border border-white bg-gray-200 text-gray-700 text-[10px] font-semibold flex items-center justify-center">
                                          +{cardMemberPreview.extraCount}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {dueBadge ? (
                                      <div className="flex items-center gap-1 text-xs" style={{ color: '#fff' }}>
                                        <span className="px-2 py-0.5 rounded" style={{ background: dueBadge.color }}>{dueBadge.label}</span>
                                      </div>
                                    ) : (
                                      <>
                                        {dueDateLabel && (
                                          <div className="flex items-center gap-1 text-xs text-gray-600">
                                            <Calendar size={14} />
                                            <span>{dueDateLabel}</span>
                                          </div>
                                        )}
                                        {dueTimeLabel && (
                                          <div className="flex items-center gap-1 text-xs text-gray-600">
                                            <Clock size={14} />
                                            <span>{dueTimeLabel}</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                                </button>
                              </DraggableCardContainer>
                            );
                            })}
                          </SortableContext>

                          {listCards.length === 0 && (
                            <div className="text-xs text-gray-500 italic py-2">
                                  Chưa có thẻ
                            </div>
                          )}
                        </DroppableCardLane>

                        {/* Add card button */}
                        {false ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={newCardTitle}
                              onChange={(e) => setNewCardTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddCard(list.id);
                                if (e.key === "Escape") {
                                  setAddingCardToList(null);
                                  setNewCardTitle("");
                                }
                              }}
                              placeholder="Nhập tiêu đề thẻ..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddCard(list.id)}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                              >
                                Thêm
                              </button>
                              <button
                                onClick={() => {
                                  setAddingCardToList(null);
                                  setNewCardTitle("");
                                }}
                                className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg text-sm transition"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => openCreateCardModal(list.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                          >
                            <Plus size={18} />
                            <span className="font-medium">Thêm thẻ</span>
                          </button>
                        )}
                      </div>
                    </div>
                    </DraggableListContainer>
                  );
                })}
                </SortableContext>

                {/* Add list button */}
                <div className="w-72 flex-shrink-0">
                  {showAddList ? (
                    <div className="bg-gray-100 rounded-xl p-4 shadow-sm">
                      <input
                        type="text"
                        value={newListTitle}
                        onChange={(e) => setNewListTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !creatingList) {
                            e.preventDefault();
                            handleAddList();
                          }
                          if (e.key === "Escape") {
                            setShowAddList(false);
                            setNewListTitle("");
                          }
                        }}
                        placeholder="Nhập tiêu đề danh sách..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                        autoFocus
                        disabled={creatingList}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddList}
                          disabled={creatingList}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {creatingList ? "Đang tạo..." : "Thêm danh sách"}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddList(false);
                            setNewListTitle("");
                          }}
                          disabled={creatingList}
                          className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddList(true)}
                      className="w-full bg-white/30 hover:bg-white/40 backdrop-blur-sm rounded-xl p-4 flex items-center gap-2 text-white font-medium transition"
                    >
                      <Plus size={20} />
                      <span>Thêm danh sách</span>
                    </button>
                  )}
                </div>

                <DragOverlay>
                  {activeDragCardData ? (
                    <div
                      className={`w-72 rounded-lg border p-3 shadow-xl ${
                        getCardStyles(activeDragCardData)
                      }`}
                    >
                      <p className="text-gray-800 font-medium">
                        {activeDragCardData.title}
                      </p>
                    </div>
                  ) : activeDragListData ? (
                    <div className="w-72 rounded-xl border border-gray-200 bg-gray-100 p-4 shadow-xl">
                      <p className="font-semibold text-gray-800 truncate">
                        {activeDragListData.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Đang di chuyển danh sách</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </div>
              </DndContext>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-white/80 backdrop-blur-md shadow-lg rounded-full px-3 py-2 flex gap-2 border border-gray-200">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              showNotes
                ? "bg-blue-500 text-white shadow-md"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <span>
              <Inbox />
            </span>
            <span>Ghi chú</span>
          </button>

          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              showTimeline
                ? "bg-blue-500 text-white shadow-md"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <span>
              <Calendar />
            </span>
            <span>Timeline</span>
          </button>

          <button
            onClick={() => setShowBoard(!showBoard)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              showBoard
                ? "bg-blue-500 text-white shadow-md"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <span>
              <ListChecks />
            </span>
            <span>Board</span>
          </button>
        </div>
      </div>

      {/* Share board modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowShareModal(false);
            setShareError("");
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Chia sẻ board</h2>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setShareError("");
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email hoặc User ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareMemberInput}
                    onChange={(e) => setShareMemberInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !sharingMember) {
                        e.preventDefault();
                        void handleAddBoardMember();
                      }
                    }}
                    placeholder="vd: user@gmail.com hoặc 12"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={!canManageBoardMembers || sharingMember}
                  />
                  <button
                    onClick={handleAddBoardMember}
                    disabled={sharingMember || !canManageBoardMembers}
                    className="px-4 py-2.5 bg-[#051836] text-white rounded-lg font-medium hover:bg-[#051836cc] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sharingMember ? "Đang thêm..." : "Thêm"}
                  </button>
                </div>
                {shareError && (
                  <p className="mt-2 text-sm text-red-600">{shareError}</p>
                )}
                {!canManageBoardMembers && (
                  <p className="mt-2 text-xs text-gray-500">
                    Chỉ admin mới được thêm hoặc xóa thành viên.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Thành viên board
                </h3>
                {loadingBoardMembers ? (
                  <p className="text-sm text-gray-600">Đang tải thành viên...</p>
                ) : boardMembers.length === 0 ? (
                  <p className="text-sm text-gray-600">Board chưa có thành viên.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {boardMembers.map((member) => {
                      const role = (member.role || "member").toLowerCase();
                      const canRemove = canRemoveBoardMember(member);
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">
                              {member.name || "Unknown user"}
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                              {member.email}
                            </p>
                          </div>
                          <div className="ml-3 flex items-center gap-2">
                            <span
                              className={`px-2 py-1 text-xs rounded-full uppercase tracking-wide ${
                                role === "admin"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {role}
                            </span>
                            {canRemove && (
                              <button
                                onClick={() => void handleRemoveBoardMember(member.id)}
                                disabled={removingBoardMemberId === member.id}
                                className="w-7 h-7 rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Xóa thành viên"
                              >
                                {removingBoardMemberId === member.id ? "..." : "✕"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setShareError("");
                }}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create card modal */}
      {showCreateCardModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!creatingCard) {
              setShowCreateCardModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Tạo thẻ mới</h2>
              <button
                onClick={() => {
                  if (!creatingCard) {
                    setShowCreateCardModal(false);
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                disabled={creatingCard}
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Danh sách</label>
                <select
                  value={newCardForm.list_id}
                  onChange={(e) =>
                    setNewCardForm((prev) => ({
                      ...prev,
                      list_id: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Chọn danh sách</option>
                  {boardLists.map((list: List) => (
                    <option key={list.id} value={String(list.id)}>
                      {list.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Tiêu đề thẻ *
                </label>
                <input
                  type="text"
                  value={newCardForm.title}
                  onChange={(e) =>
                    setNewCardForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Nhập tiêu đề thẻ..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Mô tả</label>
                <textarea
                  value={newCardForm.description}
                  onChange={(e) =>
                    setNewCardForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Thêm mô tả chi tiết hơn..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Hạn hoàn thành
                </label>
                <input
                  type="datetime-local"
                  value={newCardForm.due_datetime}
                  onChange={(e) =>
                    setNewCardForm((prev) => ({
                      ...prev,
                      due_datetime: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newCardForm.completed}
                  onChange={(e) =>
                    setNewCardForm((prev) => ({
                      ...prev,
                      completed: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Hoàn thành</span>
              </label>

              <div className="pt-3 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowCreateCardModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                  disabled={creatingCard}
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreateCardFromModal}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition disabled:opacity-50"
                  disabled={creatingCard}
                >
                  {creatingCard ? "Đang lưu..." : "Lưu thẻ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card detail modal */}
      {showCardModal && selectedCardData && selectedCardId && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeCardModal}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg mt-1">
                      <svg
                        className="w-5 h-5 text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-800 mb-2">
                        {selectedCardData.title}
                      </h2>
                      <p className="text-sm text-gray-600">
                        trong danh sách{" "}
                        <span className="font-medium">
                          {selectedCardListTitle}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeCardModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              {/* Modal content */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-10 gap-6">
                {/* Labels */}
                {/* {selectedCardData.labels.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Nhãn
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCardData.labels.map((label: string) => (
                      <span
                        key={label}
                        className={`${labelColors[label] || "bg-gray-400"} text-white text-sm px-3 py-1.5 rounded-lg font-medium`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )} */}

                <section className="lg:col-span-7 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Title
                  </h3>
                  <input
                    value={cardDetailTitle}
                    onChange={(e) => setCardDetailTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập tiêu đề card"
                  />
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      className="w-5 h-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h7"
                      />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-700">
                      Mô tả
                    </h3>
                  </div>
                  <textarea
                    value={cardDetailDescription}
                    onChange={(e) => setCardDetailDescription(e.target.value)}
                    placeholder="Thêm mô tả chi tiết hơn..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={5}
                  />
                </div>

                {false && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={20} className="text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-700">
                      Hạn hoàn thành
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">
                          Hạn hoàn thành
                        </label>
                        <input
                          type="datetime-local"
                          value={toDateTimeLocalValue(selectedCardData)}
                          onChange={(e) => {
                            handleUpdateCard(selectedCardId, {
                              due_date: toIsoDateTime(e.target.value),
                            });
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedCardData.completed}
                        onChange={(e) =>
                          handleUpdateCard(selectedCardId, {
                            completed: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Hoàn thành</span>
                    </label>
                  </div>
                </div>
                )}

                {/* Comments */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <svg
                      className="w-5 h-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-700">
                      Bình luận
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {loadingComments ? (
                        <p className="text-sm text-gray-600">Đang tải bình luận...</p>
                      ) : cardComments.length === 0 ? (
                        <p className="text-sm text-gray-600">
                          Chưa có bình luận nào cho thẻ này.
                        </p>
                      ) : (
                        cardComments.map((comment) => (
                          <div
                            key={comment.id}
                            className="p-3 rounded-lg bg-gray-50 border border-gray-200"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {comment.user_name || comment.user_email || "Unknown"}
                              </p>
                              <span className="text-xs text-gray-500 shrink-0">
                                {formatCommentTime(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-semibold text-sm">
                        {currentUser?.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={newCommentContent}
                          onChange={(e) => setNewCommentContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !e.shiftKey &&
                              (e.ctrlKey || e.metaKey)
                            ) {
                              e.preventDefault();
                              void handleSendCardComment();
                            }
                          }}
                          placeholder="Viết bình luận... (Ctrl/Cmd + Enter để gửi)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                          rows={2}
                          disabled={sendingComment}
                        />
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={handleSendCardComment}
                            disabled={sendingComment || !newCommentContent.trim()}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#051836] text-white rounded-lg font-medium hover:bg-[#051836cc] transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send size={16} />
                            {sendingComment ? "Đang gửi..." : "Gửi bình luận"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </section>

                <aside className="lg:col-span-3 space-y-4">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={16} className="text-gray-600" />
                      <h3 className="text-sm font-semibold text-gray-700">
                        Members
                      </h3>
                      <div className="ml-auto relative">
                        <button
                          onClick={() => setShowMemberDropdown((s) => !s)}
                          className="px-2 py-1 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
                          title="Thêm thành viên cho thẻ"
                        >
                          +
                        </button>
                        {showMemberDropdown && (
                          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded shadow-lg z-50 p-2">
                            <div className="text-xs text-gray-600 mb-2">Chọn thành viên để thêm</div>
                            <div className="max-h-40 overflow-y-auto">
                              {boardMembers.map((m) => (
                                <div key={m.id} className="flex items-center justify-between p-1 hover:bg-gray-50 rounded">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-semibold text-white">
                                      {m.name ? m.name.charAt(0).toUpperCase() : (m.email || "U").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-sm">{m.name || m.email}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        void handleAddCardMember(Number(selectedCardId), Number(m.id));
                                        setShowMemberDropdown(false);
                                      }}
                                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
                                    >
                                      Thêm
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {boardMembers.length === 0 && <div className="text-xs text-gray-500">Không có thành viên trong workspace</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Avatars */}
                      <div className="flex -space-x-2">
                        {cardMembers.length === 0 && (
                          <div className="text-sm text-gray-500">Chưa có thành viên trên thẻ.</div>
                        )}
                        {cardMembers.map((m) => (
                          <div key={m.id} className="relative">
                            <div title={m.name || m.email} className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-semibold text-sm">
                              {(m.name || m.email || "U").charAt(0).toUpperCase()
                              }
                            </div>
                            <button
                              onClick={() => void handleRemoveCardMember(Number(selectedCardId), Number(m.id))}
                              className="absolute -top-1 -right-1 bg-white rounded-full text-xs p-0.5 border border-gray-200"
                              title="Gỡ thành viên"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Tags size={16} className="text-gray-600" />
                      <h3 className="text-sm font-semibold text-gray-700">Labels</h3>
                      <button onClick={() => setCreatingLabel((s) => !s)} className="ml-auto px-2 py-1 text-sm bg-gray-100 rounded-md hover:bg-gray-200">Tạo label</button>
                    </div>
                    {selectedCardLabels.length === 0 ? (
                      <p className="text-sm text-gray-500">Chưa có label.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedCardLabels.map((labelVal: string) => {
                          const [name, color] = String(labelVal).split("::");
                          return (
                            <span key={labelVal} className="flex items-center gap-2 px-2 py-1 text-xs rounded-md border border-gray-200" style={{ background: color || "#eee" }}>
                              <span className="font-medium text-white">{name}</span>
                              <button onClick={() => void handleRemoveLabel(Number(selectedCardId), labelVal)} className="ml-1 text-white/80">×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {creatingLabel && (
                      <div className="mt-3 space-y-2">
                        <input value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} placeholder="Tên label" className="w-full px-3 py-2 border border-gray-300 rounded" />
                        <div className="flex items-center gap-2">
                          <input type="color" value={newLabelColor} onChange={(e) => setNewLabelColor(e.target.value)} />
                          <button onClick={() => void handleCreateLabel(Number(selectedCardId))} className="px-3 py-1 bg-blue-600 text-white rounded">Tạo</button>
                          <button onClick={() => setCreatingLabel(false)} className="px-3 py-1 bg-gray-200 rounded">Hủy</button>
                        </div>
                      </div>
                    )}

                    {/* Existing board labels: click to toggle assign/unassign on this card */}
                    {boardLabels.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-600 mb-2">Nhãn có sẵn</div>
                        <div className="flex flex-wrap gap-2">
                          {boardLabels.map((b) => {
                            const assigned = Array.isArray(selectedCardData.labels) && selectedCardData.labels.includes(b.value);
                            return (
                              <div key={b.value} className="flex items-center gap-2">
                                <button
                                  onClick={() => void handleToggleCardLabel(b.value)}
                                  className={`px-2 py-1 text-xs rounded-md flex items-center gap-2 ${assigned ? 'ring-2 ring-offset-1' : ''}`}
                                  style={{ background: b.color, color: '#fff' }}
                                  title={assigned ? 'Bỏ gán nhãn' : 'Gán nhãn cho thẻ'}
                                >
                                  <span className="font-medium truncate">{b.name}</span>
                                </button>
                                <button
                                  onClick={() => void handleDeleteLabelFromSystem(b.value)}
                                  className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded"
                                  title="Xóa nhãn khỏi toàn bộ board"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-600" />
                      <h3 className="text-sm font-semibold text-gray-700">Due date</h3>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={cardDetailDueDatetime}
                        onChange={(e) => setCardDetailDueDatetime(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {/* Deleted separate 'Xóa' button: deadline changes are saved via Lưu */}
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cardDetailCompleted}
                        onChange={(e) => setCardDetailCompleted(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Hoan thanh</span>
                    </label>
                  </div>
                </aside>

                {/* Actions */}
                <div className="lg:col-span-10 pt-4 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={handleSaveCardEdits}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition"
                  >
                    Lưu
                  </button>
                  <button
                    onClick={closeCardModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                  >
                    Đóng
                  </button>
                  {isCurrentUserBoardAdmin && (
                    <button
                      onClick={async () => {
                        if (!selectedCardId) return;
                        if (!confirm("Bạn có chắc muốn xóa thẻ này?")) return;
                        try {
                          setDeletingCard(true);
                          await cardsAPI.deleteCard(String(selectedCardId));
                          // remove from local state
                          setCards((prevCards) =>
                            prevCards.filter(
                              (card) => Number(card.id) !== Number(selectedCardId),
                            ),
                          );
                          void loadBoardActivities(boardId, false);
                          closeCardModal();
                        } catch (error) {
                          console.error("Failed to delete card:", error);
                          alert(error instanceof Error ? error.message : "Xóa thẻ thất bại");
                        } finally {
                          setDeletingCard(false);
                        }
                      }}
                      disabled={deletingCard}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingCard ? "Đang xóa..." : "Xóa thẻ"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}



