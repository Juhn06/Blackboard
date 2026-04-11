import {
  useState,
  useEffect,
  ReactElement,
  JSXElementConstructor,
  ReactNode,
  ReactPortal,
} from "react";
import { useParams, useNavigate } from "react-router";
import { boardsAPI, listsAPI, cardsAPI } from "../services/api";
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
  ListChecks,
  Inbox,
} from "lucide-react";
import { List } from "../../types/list";

export default function BoardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Use numeric boardId for comparisons with API responses
  const boardId = Number(id);
  console.log("🔍 Current board ID:", boardId, "from route param:", id);

  const [board, setBoard] = useState<any>(null);
  const [lists, setLists] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data từ API
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;

      try {
        // Load board info
        const boardData = await boardsAPI.getBoard(boardId);
        setBoard(boardData);

        const listsData = await listsAPI.getListsByBoard(boardId.toString());
        console.log("✅ Lists loaded from API:", listsData);
        console.log("📋 First list structure:", listsData[0]);
        setLists(listsData);
        console.log("📋 Lists state updated with", listsData.length, "lists");

        // Load cards cho tất cả lists
        const allCards: any[] = [];
        for (const list of listsData) {
          const cardsData = await cardsAPI.getCardsByList(list.id.toString());
          console.log(
            `🃏 Loaded ${cardsData.length} cards for list ${list.id}`,
          );
          allCards.push(...cardsData);
        }
        console.log(
          "✅ Cards loaded from API:",
          allCards.length,
          "total cards",
        );
        console.log("🃏 First card structure:", allCards[0]);
        setCards(allCards);
      } catch (error) {
        console.error("Failed to load board data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // State cho messages
  const [messages, setMessages] = useState([
    {
      id: 1,
      user: "Admin",
      text: "Chào mừng đến với bảng này!",
      time: new Date("2026-04-03T09:00:00"),
    },
    {
      id: 2,
      user: "Nguyễn Văn A",
      text: "Hôm nay chúng ta cần hoàn thành sprint planning",
      time: new Date("2026-04-03T09:15:00"),
    },
    {
      id: 3,
      user: "Trần Thị B",
      text: "Đã update design mới nhất vào Figma",
      time: new Date("2026-04-03T10:30:00"),
    },
  ]);

  const [newMessage, setNewMessage] = useState("");
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  // const [creatingList, setCreatingList] = useState(false);

  // State cho toggle panels
  const [showNotes, setShowNotes] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showBoard, setShowBoard] = useState(true);

  // Lưu vào localStorage khi thay đổi
  useEffect(() => {
    localStorage.setItem("blackboard_lists", JSON.stringify(lists));
  }, [lists]);

  useEffect(() => {
    localStorage.setItem("blackboard_cards", JSON.stringify(cards));
  }, [cards]);

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
  const selectedCardData = cards.find((c) => c.id === selectedCard);

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

  const getCardsForList = (listId: string) => {
    const filtered = cards.filter((card) => card.list_id === Number(listId));
    console.log(
      `🃏 getCardsForList(${listId}): found ${filtered.length} cards`,
    );
    return filtered;
  };

  const getUserById = (userId?: string) => {
    return users.find((u) => u.id === userId);
  };

  // Hàm thêm list mới
  const handleAddList = async () => {
    if (!newListTitle.trim()) {
      alert("Vui lòng nhập tiêu đề danh sách");
      return;
    }

    if (!board) {
      alert("Bảng chưa tải. Vui lòng thử lại.");
      return;
    }

    setCreatingList(true);
    try {
      const newList = await listsAPI.createList({
        title: newListTitle.trim(),
        board_id: Number(board.id),
      });

      // DEBUG: Log API response to verify structure
      console.log("✅ API Response:", newList);
      console.log("Expected board_id:", Number(board.id));
      console.log("Received board_id:", newList.board_id);

      // Update lists state with new list using functional update
      setLists((prevLists) => {
        const updated = [...prevLists, newList];
        console.log("📋 Updated lists state:", updated);
        return updated;
      });

      // Reset form and close add list UI AFTER state is updated
      setNewListTitle("");
      setShowAddList(false);
    } catch (error) {
      console.error("❌ Failed to create list:", error);
      alert("Có lỗi xảy ra khi tạo danh sách. Vui lòng thử lại.");
    } finally {
      setCreatingList(false);
    }
  };

  // Hàm thêm card mới
  const handleAddCard = async (listId: string) => {
    console.log("🃏 handleAddCard called with listId:", listId);
    console.log("🃏 newCardTitle:", newCardTitle);

    if (!newCardTitle.trim()) {
      console.log("🃏 Title is empty, returning");
      alert("Vui lòng nhập tiêu đề thẻ");
      return;
    }

    try {
      console.log("🃏 Calling API with:", {
        title: newCardTitle.trim(),
        list_id: parseInt(listId),
      });

      const newCard = await cardsAPI.createCard({
        title: newCardTitle.trim(),
        list_id: parseInt(listId),
      });

      console.log("🃏 API response:", newCard);

      // Update cards state with new card using functional update
      setCards((prevCards) => {
        const updated = [...prevCards, newCard];
        console.log("🃏 Cards state updated, new length:", updated.length);
        return updated;
      });

      // Reset form and close add card UI
      setNewCardTitle("");
      setAddingCardToList(null);
      console.log("🃏 Form reset and UI closed");
    } catch (error) {
      console.error("❌ Failed to create card:", error);
      alert("Có lỗi xảy ra khi tạo thẻ. Vui lòng thử lại.");
    }
  };

  // Hàm xác định màu card theo trạng thái - SỬA LOGIC
  const getCardStyles = (card: any) => {
    // Priority: completed > dueSoon > pending
    if (card.completed) {
      return "bg-green-100 border-green-300";
    }

    if (card.dueDate) {
      // FIX: Parse date đúng cách để tránh timezone issue
      const dueDate = new Date(card.dueDate + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Còn 1 ngày hoặc quá hạn
      if (diffDays <= 1) {
        return "bg-red-100 border-red-300";
      }
    }

    return "bg-yellow-100 border-yellow-300";
  };

  // Hàm cập nhật card
  const handleUpdateCard = async (cardId: number, updates: any) => {
    try {
      const updatedCard = await cardsAPI.updateCard(cardId.toString(), updates);

      // Update cards state with updated card using functional update
      setCards((prevCards) =>
        prevCards.map((card) =>
          card.id === cardId ? { ...card, ...updatedCard } : card,
        ),
      );

      console.log("✅ Card updated:", updatedCard);
    } catch (error) {
      console.error("❌ Failed to update card:", error);
      alert("Có lỗi xảy ra khi cập nhật thẻ. Vui lòng thử lại.");
    }
  };

  // Hàm thêm message
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      user: "Nguyễn Văn A",
      text: newMessage,
      time: new Date(),
    };

    setMessages([...messages, message]);
    setNewMessage("");
  };

  // Lấy cards cho timeline theo giờ
  const getCardsForTimeSlot = (hour: string) => {
    return cards.filter((c: any) => c.dueTime && c.dueTime.startsWith(hour));
  };

  // Timeline hours
  const timeSlots = Array.from({ length: 16 }, (_, i) => {
    const hour = i + 8; // 8:00 đến 23:00
    return `${hour.toString().padStart(2, "0")}:00`;
  });

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
            <button className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition">
              <Share2 size={18} />
              <span className="font-medium">Chia sẻ</span>
            </button>

            <button className="p-2 hover:bg-white/10 rounded transition">
              <MoreHorizontal size={20} className="text-white" />
            </button>
          </div>
        </div>
      </header>

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
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="bg-white/80 backdrop-blur rounded-lg p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-800">
                      {message.user}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.time).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{message.text}</p>
                </div>
              ))}
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-white/20 bg-white/10">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Nhập tin nhắn..."
                className="w-full px-3 py-2 bg-white/80 backdrop-blur border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                rows={3}
              />
              <button
                onClick={handleSendMessage}
                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Send size={16} />
                <span className="text-sm font-medium">Gửi</span>
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
              {timeSlots.map((timeSlot) => {
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
                        return (
                          <button
                            key={card.id}
                            onClick={() => setSelectedCard(card.id)}
                            className={`w-full text-left rounded-lg border p-2.5 shadow-sm hover:shadow-md transition ${cardStyles}`}
                          >
                            <p className="text-sm font-medium text-gray-800 mb-1">
                              {card.title}
                            </p>
                            <div className="flex items-center gap-2">
                              {card.due_time && (
                                <span className="text-xs text-gray-600">
                                  {card.due_time}
                                </span>
                              )}
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
                      {slotCards.length === 0 && (
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
            <div className="p-6">
              <div
                className="flex gap-4 pb-6"
                style={{ minWidth: "fit-content" }}
              >
                {/* Lists */}
                {boardLists.map((list: List) => {
                  const listCards = getCardsForList(list.id);

                  return (
                    <div key={list.id} className="w-72 flex-shrink-0">
                      <div className="bg-gray-100 rounded-xl p-4 shadow-sm">
                        {/* List header */}
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-800">
                            {list.title}
                          </h3>
                          <button className="p-1 hover:bg-gray-200 rounded transition">
                            <MoreHorizontal
                              size={18}
                              className="text-gray-600"
                            />
                          </button>
                        </div>

                        {/* Cards */}
                        <div className="space-y-2 mb-3">
                          {listCards.map((card: any) => {
                            const cardStyles = getCardStyles(card);

                            return (
                              <button
                                key={String(card.id)}
                                onClick={() => setSelectedCard(card.id)}
                                onDoubleClick={() => {
                                  console.log(
                                    "🃏 Double-clicked card:",
                                    card.id,
                                  );
                                  setSelectedCard(card.id);
                                  setShowCardModal(true);
                                  console.log(
                                    "🃏 Set selectedCard to:",
                                    card.id,
                                    "showCardModal to: true",
                                  );
                                }}
                                className={`w-full rounded-lg border p-3 shadow-sm hover:shadow-md transition text-left group ${cardStyles}`}
                              >
                                {/* Labels
                                  {card.labels.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {card.labels.map((label) => (
                                        <span
                                          key={label}
                                          className={`${labelColors[label] || "bg-gray-400"} text-white text-xs px-2 py-1 rounded`}
                                        >
                                          {label}
                                        </span>
                                      ))}
                                    </div>
                                  )} */}

                                {/* Title */}
                                <p className="text-gray-800 font-medium mb-2">
                                  {card.title}
                                </p>

                                {/* Footer */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {card.dueDate && (
                                      <div className="flex items-center gap-1 text-xs text-gray-600">
                                        <Calendar size={14} />
                                        <span>
                                          {new Date(
                                            card.dueDate + "T00:00:00",
                                          ).toLocaleDateString("vi-VN")}
                                        </span>
                                      </div>
                                    )}
                                    {card.dueTime && (
                                      <div className="flex items-center gap-1 text-xs text-gray-600">
                                        <Clock size={14} />
                                        <span>{card.dueTime}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Add card button */}
                        {addingCardToList === list.id ? (
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
                            onClick={() => setAddingCardToList(list.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                          >
                            <Plus size={18} />
                            <span className="font-medium">Thêm thẻ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

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
              </div>
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

      {/* Card detail modal */}
      {showCardModal && selectedCard && selectedCardData && (
        <>
          {console.log(
            "🃏 Rendering modal for card:",
            selectedCard,
            selectedCardData,
          )}
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setSelectedCard(null);
              setShowCardModal(false);
            }}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
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
                          {
                            lists.find(
                              (l: { id: any }) =>
                                l.id === selectedCardData.listId,
                            )?.title
                          }
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCard(null);
                    setShowCardModal(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              {/* Modal content */}
              <div className="p-6 space-y-6">
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
                    value={selectedCardData.description || ""}
                    onChange={(e) =>
                      handleUpdateCard(selectedCard, {
                        description: e.target.value,
                      })
                    }
                    placeholder="Thêm mô tả chi tiết hơn..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={4}
                  />
                </div>

                {/* Due date and time */}
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
                          value={
                            selectedCardData.due_date
                              ? new Date(selectedCardData.due_date)
                                  .toISOString()
                                  .slice(0, 16)
                              : ""
                          }
                          onChange={(e) =>
                            handleUpdateCard(selectedCard, {
                              due_date: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedCardData.completed}
                        onChange={(e) =>
                          handleUpdateCard(selectedCard, {
                            completed: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Hoàn thành</span>
                    </label>
                  </div>
                </div>

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
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-semibold text-sm">
                        {users[0]?.name?.charAt(0).toUpperCase() ?? "U"}
                      </div>
                      <textarea
                        placeholder="Viết bình luận..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedCard(null);
                      setShowCardModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Bạn có chắc muốn xóa thẻ này?")) {
                        setCards(cards.filter((c) => c.id !== selectedCard));
                        setSelectedCard(null);
                        setShowCardModal(false);
                      }
                    }}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition"
                  >
                    Xóa thẻ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
