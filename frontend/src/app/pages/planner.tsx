import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { cards as initialCards, lists, boards } from "../data/mockData";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";

export default function PlannerPage() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 3)); // April 3, 2026

  // Load cards từ localStorage để đồng bộ với board
  const [cards, setCards] = useState(() => {
    const saved = localStorage.getItem("blackboard_cards");
    return saved ? JSON.parse(saved) : initialCards;
  });

  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Refresh cards khi localStorage thay đổi
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("blackboard_cards");
      if (saved) {
        setCards(JSON.parse(saved));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const selectedCardData = cards.find((c: any) => c.id === selectedCard);

  // Lấy các ngày trong tháng
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Thêm các ô trống cho những ngày trước ngày 1
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Thêm các ngày trong tháng
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
  });

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  // Lấy cards có deadline cho ngày cụ thể
  const getCardsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return cards.filter((card: any) => card.dueDate === dateStr);
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date(2026, 3, 3); // Current date in context
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Hàm xác định màu card theo trạng thái
  const getCardStyles = (card: any, date: Date) => {
    // Priority: completed > dueSoon > pending
    if (card.completed) {
      return "bg-green-100 border-green-300";
    }

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

    return "bg-yellow-100 border-yellow-300";
  };

  // Hàm cập nhật card
  const updateCard = (cardId: string, updates: any) => {
    const updatedCards = cards.map((c: any) =>
      c.id === cardId ? { ...c, ...updates } : c,
    );
    setCards(updatedCards);
    localStorage.setItem("blackboard_cards", JSON.stringify(updatedCards));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-600 hover:text-gray-800 transition"
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
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Trình lập kế hoạch
              </h1>
              <p className="text-sm text-gray-600">
                Xem tổng quan công việc theo thời gian
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentDate(new Date(2026, 3, 3))}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Hôm nay
            </button>
          </div>
        </div>
      </header>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar - Left side (2/3) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Calendar header */}
              <div className="bg-[#0054bc] text-white px-6 py-4 flex items-center justify-between">
                <button
                  onClick={previousMonth}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-bold capitalize">{monthName}</h2>
                <button
                  onClick={nextMonth}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Calendar grid */}
              <div className="p-6">
                {/* Day names */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-semibold text-gray-600 py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-2">
                  {days.map((day, index) => {
                    const dayCards = day ? getCardsForDate(day) : [];
                    const today = isToday(day);

                    return (
                      <div
                        key={index}
                        className={`min-h-28 p-2 rounded-lg border ${
                          day
                            ? today
                              ? "bg-purple-50 border-purple-300"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                            : "bg-transparent border-transparent"
                        } transition`}
                      >
                        {day && (
                          <>
                            <div
                              className={`text-sm font-semibold mb-1 ${
                                today ? "text-purple-600" : "text-gray-700"
                              }`}
                            >
                              {day.getDate()}
                            </div>
                            <div className="space-y-1">
                              {dayCards.map((card: any) => {
                                const list = lists.find(
                                  (l) => l.id === card.listId,
                                );
                                const board = boards.find(
                                  (b) => b.id === list?.boardId,
                                );
                                const cardStyles = getCardStyles(card, day);

                                return (
                                  <div
                                    key={card.id}
                                    onClick={() => setSelectedCard(card.id)}
                                    className={`${cardStyles} border text-xs px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition`}
                                    title={card.title}
                                  >
                                    <p className="font-medium text-gray-800 truncate">
                                      {card.title}
                                    </p>
                                    {/* {card.labels.length > 0 && (
                                      <div className="flex gap-1 mt-1">
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
                                    {card.dueTime && (
                                      <p className="text-xs text-gray-600 mt-1">
                                        {card.dueTime}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming tasks - Right side (1/3) */}
          <div className="space-y-6">
            {/* Today's tasks */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Công việc hôm nay
              </h3>
              <div className="space-y-3">
                {cards
                  .filter((card: any) => {
                    if (!card.dueDate) return false;
                    const cardDate = new Date(card.dueDate);
                    const today = new Date(2026, 3, 3);
                    return (
                      cardDate.getDate() === today.getDate() &&
                      cardDate.getMonth() === today.getMonth() &&
                      cardDate.getFullYear() === today.getFullYear()
                    );
                  })
                  .map((card: any) => {
                    const list = lists.find((l) => l.id === card.listId);
                    const board = boards.find((b) => b.id === list?.boardId);
                    const cardStyles = getCardStyles(card, new Date());

                    return (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCard(card.id)}
                        className={`w-full text-left p-3 border rounded-lg transition ${cardStyles}`}
                      >
                        {/* <div className="flex flex-wrap gap-1 mb-2">
                          {card.labels.slice(0, 2).map((label: string) => (
                            <span
                              key={label}
                              className={`${labelColors[label] || "bg-gray-400"} text-white text-xs px-2 py-0.5 rounded`}
                            >
                              {label}
                            </span>
                          ))}
                        </div> */}
                        <p className="font-medium text-gray-800 text-sm mb-1">
                          {card.title}
                        </p>
                        <p className="text-xs text-gray-600">{board?.name}</p>
                      </button>
                    );
                  })}
                {cards.filter((card: any) => {
                  if (!card.dueDate) return false;
                  const cardDate = new Date(card.dueDate);
                  const today = new Date(2026, 3, 3);
                  return (
                    cardDate.getDate() === today.getDate() &&
                    cardDate.getMonth() === today.getMonth() &&
                    cardDate.getFullYear() === today.getFullYear()
                  );
                }).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Không có công việc nào hôm nay
                  </p>
                )}
              </div>
            </div>

            {/* Upcoming tasks */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Sắp tới</h3>
              <div className="space-y-3">
                {cards
                  .filter((card: any) => {
                    if (!card.dueDate) return false;
                    const cardDate = new Date(card.dueDate);
                    const today = new Date(2026, 3, 3);
                    return cardDate > today;
                  })
                  .sort((a: any, b: any) => {
                    const dateA = new Date(a.dueDate!);
                    const dateB = new Date(b.dueDate!);
                    return dateA.getTime() - dateB.getTime();
                  })
                  .slice(0, 5)
                  .map((card: any) => {
                    const list = lists.find((l) => l.id === card.listId);
                    const board = boards.find((b) => b.id === list?.boardId);
                    const cardStyles = getCardStyles(
                      card,
                      new Date(card.dueDate),
                    );

                    return (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCard(card.id)}
                        className={`w-full text-left p-3 border rounded-lg transition ${cardStyles}`}
                      >
                        {/* <div className="flex flex-wrap gap-1 mb-2">
                          {card.labels.slice(0, 2).map((label: string) => (
                            <span
                              key={label}
                              className={`${labelColors[label] || "bg-gray-400"} text-white text-xs px-2 py-0.5 rounded`}
                            >
                              {label}
                            </span>
                          ))}
                        </div> */}
                        <p className="font-medium text-gray-800 text-sm mb-1">
                          {card.title}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-600">{board?.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(card.dueDate!).toLocaleDateString(
                              "vi-VN",
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Mini boards overview */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Bảng của bạn
              </h3>
              <div className="space-y-2">
                {boards.slice(0, 4).map((board) => {
                  const boardCards = cards.filter((card: any) => {
                    const list = lists.find((l) => l.id === card.listId);
                    return list?.boardId === board.id;
                  });
                  const completedCards = boardCards.filter(
                    (c: any) => c.completed,
                  ).length;

                  return (
                    <button
                      key={board.id}
                      onClick={() => navigate(`/board/${board.id}`)}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg"
                          style={{ background: board.background }}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 text-sm">
                            {board.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {completedCards}/{boardCards.length} hoàn thành
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card detail modal */}
      {selectedCard && selectedCardData && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCard(null)}
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
                          lists.find((l) => l.id === selectedCardData.listId)
                            ?.title
                        }
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Modal content */}
            <div className="p-6 space-y-6">
              {/* Labels */}
              {selectedCardData.labels &&
                selectedCardData.labels.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Nhãn
                    </h3>
                    {/* <div className="flex flex-wrap gap-2">
                      {selectedCardData.labels.map((label: string) => (
                        <span
                          key={label}
                          className={`${labelColors[label] || "bg-gray-400"} text-white text-sm px-3 py-1.5 rounded-lg font-medium`}
                        >
                          {label}
                        </span>
                      ))}
                    </div> */}
                  </div>
                )}

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
                  <h3 className="text-sm font-semibold text-gray-700">Mô tả</h3>
                </div>
                <textarea
                  value={selectedCardData.description || ""}
                  onChange={(e) =>
                    updateCard(selectedCard, { description: e.target.value })
                  }
                  placeholder="Thêm mô tả chi tiết hơn..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={4}
                />
              </div>

              {/* Due date */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarIcon size={20} className="text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    Hạn hoàn thành
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={selectedCardData.dueDate || ""}
                    onChange={(e) =>
                      updateCard(selectedCard, { dueDate: e.target.value })
                    }
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedCardData.completed}
                      onChange={(e) =>
                        updateCard(selectedCard, {
                          completed: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Hoàn thành</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setSelectedCard(null)}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    const list = lists.find(
                      (l) => l.id === selectedCardData.listId,
                    );
                    const board = boards.find((b) => b.id === list?.boardId);
                    if (board) {
                      navigate(`/board/${board.id}`);
                    }
                  }}
                  className="px-4 py-2 border border-purple-300 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition"
                >
                  Mở bảng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
