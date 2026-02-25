"use client";

import React from "react";
import { MessageCircle } from "lucide-react"; // Import MessageCircle

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import {
  Search,
  Plus,
  Phone,
  MoreVertical,
  ArrowLeft,
  Smile,
  Pin,
  Check,
  Trash2,
  X,
  Users,
  Send,
  Mail,
} from "lucide-react";
import { useStore, type Chat } from "@/lib/store";
import { t } from "@/lib/i18n";
import toast from "react-hot-toast";
import ChatRequestList from "@/components/chat/ChatRequestList";
import WalletAddress from "@/components/chat/WalletAddress";

function formatTime(ts: number, locale: "zh" | "en") {
  const now = Date.now();
  const diff = now - ts;
  const d = new Date(ts);
  if (diff < 86400000) return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  if (diff < 172800000) return t("chat.yesterday", locale);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const zhDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  if (diff < 604800000) return locale === "zh" ? zhDays[d.getDay()] : days[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
          style={{
            animation: "typing-dot 1.2s infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

// Emoji Picker
function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const emojis = [
    "😀", "😂", "🤣", "😊", "😍", "🤔", "😎", "🥳",
    "😅", "😆", "😉", "😋", "😘", "🤗", "😢", "😭",
    "👍", "👎", "👏", "🙌", "💪", "🤝", "🙏", "✌️",
    "🔥", "💯", "🚀", "🎉", "❤️", "💰", "💎", "🌙",
    "📈", "📉", "💹", "🪙", "⭐", "🏆", "🎯", "💡",
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 left-3 right-3 rounded-2xl bg-card border border-border shadow-lg p-3"
    >
      <div className="grid grid-cols-8 gap-1">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// Chat Detail View
function ChatDetail({ chat, onBack, locale }: { chat: Chat; onBack: () => void; locale: "zh" | "en" }) {
  const { sendMessage, sendPushMessage, sendGroupPushMessage, loadChatHistory, chatReady, walletAddress } = useStore();
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard overlap state: visual viewport resize fallback for when adjustResize doesn't fully work
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleViewportChange = () => {
      // visualViewport.height = actual visible area (excluding keyboard)
      // window.innerHeight = full viewport (decreases if adjustResize works; stays same if not)
      // overlap = the keyboard height not already handled by adjustResize
      const overlap = Math.max(0, window.innerHeight - vv.height);
      setKeyboardOverlap(overlap);
      if (overlap > 0) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    };

    vv.addEventListener("resize", handleViewportChange);
    return () => vv.removeEventListener("resize", handleViewportChange);
  }, []);

  // Swipe-back gesture state
  const x = useMotionValue(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isEdgeSwipe = useRef(false);
  const isSwiping = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages, scrollToBottom]);

  // Load message history when chat opens (only if no messages yet)
  useEffect(() => {
    if (!chatReady || chat.messages.length > 0) return
    loadChatHistory(chat.id)
  }, [chat.id, chatReady]);

  // Mount: slide in from right (mobile only)
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const w = window.innerWidth;
    x.set(w);
    animate(x, 0, { type: "tween", duration: 0.3, ease: [0.32, 0.72, 0, 1] });
  }, []);

  // Slide out then call onBack — used by back button and swipe threshold
  const animateAndBack = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) {
      onBack();
      return;
    }
    const w = window.innerWidth;
    animate(x, w, { type: "tween", duration: 0.25, ease: [0.32, 0.72, 0, 1] }).then(() => onBack());
  }, [x, onBack]);

  // Touch: detect left-edge swipe to trigger back
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (showEmoji) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isEdgeSwipe.current = touch.clientX <= 30;
    isSwiping.current = false;
  }, [showEmoji]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isEdgeSwipe.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);
    // Cancel if vertical movement dominates early
    if (!isSwiping.current) {
      if (deltaY > Math.abs(deltaX)) { isEdgeSwipe.current = false; return; }
      if (Math.abs(deltaX) > 5) isSwiping.current = true;
    }
    if (isSwiping.current && deltaX >= 0) x.set(deltaX);
  }, [x]);

  const handleTouchEnd = useCallback(() => {
    if (!isEdgeSwipe.current || !isSwiping.current) {
      isEdgeSwipe.current = false;
      isSwiping.current = false;
      return;
    }
    const currentX = x.get();
    const w = typeof window !== "undefined" ? window.innerWidth : 400;
    isEdgeSwipe.current = false;
    isSwiping.current = false;
    if (currentX > w * 0.35) {
      animate(x, w, { type: "tween", duration: 0.2, ease: "easeOut" }).then(() => onBack());
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 35 });
    }
  }, [x, onBack]);

  const handleSend = async () => {
    const rawValue = inputRef.current?.value ?? input;
    if (!rawValue.trim()) {
      toast(locale === 'zh' ? '请先输入消息内容' : 'Please enter a message first')
      return
    }
    const content = rawValue.trim();
    setInput("");
    setShowEmoji(false);

    if (chatReady && walletAddress) {
      // Send via Supabase Realtime
      try {
        if (chat.type === 'group') {
          await sendGroupPushMessage(chat.id, content);
        } else if (chat.walletAddress) {
          await sendPushMessage(chat.walletAddress, content);
        } else {
          sendMessage(chat.id, content);
        }
      } catch {
        toast.error(locale === "zh" ? "发送失败" : "Send failed");
        setInput(content);
      }
    } else {
      // Fallback local message (chat not ready)
      sendMessage(chat.id, content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      style={{ x, paddingBottom: keyboardOverlap > 0 ? keyboardOverlap : undefined }}
      className="absolute inset-0 lg:relative lg:inset-auto bg-background z-20 flex flex-col overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-border bg-card">
        <motion.button whileTap={{ scale: 0.9 }} onClick={animateAndBack} className="rounded-full p-1 hover:bg-muted transition-colors lg:hidden">
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: chat.avatarColor }}>
              {chat.type === 'group' ? <Users className="w-4 h-4" /> : chat.name[0]}
            </div>
            {chat.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--ogbo-green)] ring-2 ring-card" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{chat.name}</p>
            {chat.walletAddress ? (
              <WalletAddress address={chat.walletAddress} showCopyIcon={false} className="mt-0.5" />
            ) : (
              <p className="text-[10px] text-muted-foreground">
                {chat.type === "group" ? `${chat.members} ${t("chat.members", locale)}` : chat.online ? t("chat.online", locale) : t("chat.offline", locale)}
              </p>
            )}
          </div>
        </div>
        <button className="rounded-full p-1.5 hover:bg-muted transition-colors">
          <Phone className="w-4 h-4 text-muted-foreground" />
        </button>
        <button className="rounded-full p-1.5 hover:bg-muted transition-colors">
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chat.messages.map((msg) => {
          const isMe = msg.sender === "me";
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                isMe
                  ? "bg-[var(--ogbo-blue)] text-white rounded-br-md"
                  : "bg-card text-card-foreground border border-border rounded-bl-md"
              }`}>
                {chat.type === 'group' && !isMe && (
                  <p className="text-[10px] font-semibold mb-1 text-[var(--ogbo-blue)]/80">
                    {msg.sender.slice(-4).toLowerCase()}
                  </p>
                )}
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
                  {new Date(msg.timestamp).getHours().toString().padStart(2, "0")}:
                  {new Date(msg.timestamp).getMinutes().toString().padStart(2, "0")}
                  {isMe && msg.status === "read" && " ✓✓"}
                </p>
              </div>
            </motion.div>
          );
        })}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-card px-2 py-2 relative">
        <AnimatePresence>
          {showEmoji && <EmojiPicker onSelect={(emoji) => setInput((prev) => prev + emoji)} onClose={() => setShowEmoji(false)} />}
        </AnimatePresence>
        <div className="flex items-center gap-1">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowEmoji(!showEmoji)} className="rounded-full p-1.5 hover:bg-muted transition-colors flex-shrink-0">
            <Smile className="w-5 h-5 text-muted-foreground" />
          </motion.button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => {
              // Delay to let onChange fire first
              setTimeout(() => setIsComposing(false), 0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // Wait for keyboard animation (~300ms) then ensure input and message end are visible
              setTimeout(() => {
                inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 300);
            }}
            placeholder={t("chat.inputPlaceholder", locale)}
            className="flex-1 min-w-0 bg-muted rounded-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 transition-all"
          />
          {/* Send button: always visible regardless of input state */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            className="rounded-full p-1.5 bg-[var(--ogbo-blue)] text-white hover:bg-[var(--ogbo-blue-hover)] transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ChatPage({ searchOpen: searchOpenProp, onCloseSearch }: { searchOpen?: boolean; onCloseSearch?: () => void }) {
  const { chats, locale, markChatRead, pinChat, deleteChat, chatRequests } = useStore();
  const walletAddress = useStore((s) => s.walletAddress);
  const isConnectingChat = useStore((s) => s.isConnectingChat);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);

  // Reset selected chat when wallet switches (walletAddress changes)
  const prevWalletRef = useRef<string | null>(null);
  useEffect(() => {
    if (walletAddress !== prevWalletRef.current) {
      prevWalletRef.current = walletAddress;
      setSelectedChat(null);
    }
  }, [walletAddress]);

  const searchOpen = searchOpenProp ?? false;

  const sortedChats = [...chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.timestamp - a.timestamp;
  });

  const filteredChats = searchQuery
    ? sortedChats.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedChats;

  const activeChat = chats.find((c) => c.id === selectedChat);

  const handleOpenChat = (chatId: string) => {
    setSelectedChat(chatId);
    markChatRead(chatId);
  };

  return (
    <div className="relative h-full flex flex-col lg:flex-row">
      {/* Chat list panel */}
      <div className={`flex flex-col h-full lg:w-80 xl:w-96 lg:border-r lg:border-border lg:flex-shrink-0 ${selectedChat ? "hidden lg:flex" : "flex"}`}>
        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 52, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 pt-2 overflow-hidden"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("chat.searchPlaceholder", locale)}
                  className="w-full rounded-xl bg-muted pl-9 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 transition-all"
                />
                <button onClick={() => { if (onCloseSearch) onCloseSearch(); setSearchQuery(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-background transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Friend request entry card */}
        {chatRequests.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowRequests(true)}
            className="flex items-center gap-3 bg-card rounded-2xl p-3 border-l-4 border-l-[var(--ogbo-blue)] mx-4 mt-2 mb-1 hover:bg-muted/50 transition-colors cursor-pointer w-[calc(100%-2rem)]"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--ogbo-blue)]/10 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-[var(--ogbo-blue)]" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{t("chat.friendRequests", locale)}</span>
                <span className="bg-[var(--ogbo-blue)] text-white text-[10px] rounded-full px-1.5 py-0.5 font-medium">
                  {chatRequests.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {chatRequests[0]?.fromAddress ? `${chatRequests[0].fromAddress.slice(0, 6)}...` : ''}{chatRequests.length > 1 ? ` 等${chatRequests.length}人` : ''}
              </p>
            </div>
          </motion.button>
        )}

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            isConnectingChat ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="w-8 h-8 border-2 border-[var(--ogbo-blue)] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs opacity-60">{locale === "zh" ? "正在加载聊天…" : "Loading chats…"}</p>
              </div>
            ) : searchQuery ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Search className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">{locale === "zh" ? "无匹配结果" : "No matches found"}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">{locale === "zh" ? "暂无聊天" : "No conversations yet"}</p>
                <p className="text-xs mt-1 opacity-60">{locale === "zh" ? "点击 + 添加好友，开始聊天吧" : "Tap + to add friends and start chatting"}</p>
              </div>
            )
          ) : (
            filteredChats.map((chat) => (
              <div key={chat.id} className="relative overflow-hidden">
                {/* Swipe actions */}
                <AnimatePresence>
                  {swipedId === chat.id && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute right-0 top-0 bottom-0 flex items-center gap-0.5 z-10 pr-1"
                    >
                      <motion.button
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { pinChat(chat.id); setSwipedId(null); toast.success(locale === "zh" ? (chat.pinned ? "已取消置顶" : "已置顶") : (chat.pinned ? "Unpinned" : "Pinned")); }}
                        className="rounded-xl bg-[var(--ogbo-blue)] p-2.5 text-white"
                      >
                        <Pin className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { markChatRead(chat.id); setSwipedId(null); toast.success(locale === "zh" ? "已标记为已读" : "Marked as read"); }}
                        className="rounded-xl bg-[var(--ogbo-green)] p-2.5 text-white"
                      >
                        <Check className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { deleteChat(chat.id); setSwipedId(null); toast.success(locale === "zh" ? "已删除" : "Deleted"); }}
                        className="rounded-xl bg-[var(--ogbo-red)] p-2.5 text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (swipedId === chat.id) {
                      setSwipedId(null);
                    } else {
                      handleOpenChat(chat.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSwipedId(swipedId === chat.id ? null : chat.id);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors text-left ${
                    chat.pinned ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: chat.avatarColor }}
                    >
                      {chat.type === "group" ? <Users className="w-5 h-5" /> : chat.name[0]}
                    </div>
                    {chat.online && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[var(--ogbo-green)] ring-2 ring-background" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold truncate">{chat.name}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{formatTime(chat.timestamp, locale)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate pr-2">
                        {chat.typing ? t("chat.typing", locale) : chat.lastMessage}
                      </p>
                      {chat.unread > 0 && (
                        <motion.span
                          key={chat.unread}
                          initial={{ scale: 1.5 }}
                          animate={{ scale: 1 }}
                          className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-[var(--ogbo-blue)] text-white text-[10px] font-medium flex items-center justify-center px-1"
                        >
                          {chat.unread > 99 ? "99+" : chat.unread}
                        </motion.span>
                      )}
                    </div>
                  </div>
                </motion.button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Detail - overlay on mobile, inline on desktop */}
      <div className="hidden lg:flex flex-1 min-w-0">
        {activeChat ? (
          <div className="flex-1 relative">
            <ChatDetail
              chat={activeChat}
              onBack={() => setSelectedChat(null)}
              locale={locale}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium">{locale === "zh" ? "选择一个对话开始聊天" : "Select a conversation to start chatting"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Chat Detail - mobile overlay */}
      <div className="lg:hidden">
        <AnimatePresence>
          {activeChat && (
            <ChatDetail
              chat={activeChat}
              onBack={() => setSelectedChat(null)}
              locale={locale}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Friend Requests sub-page */}
      <AnimatePresence>
        {showRequests && (
          <ChatRequestList onBack={() => setShowRequests(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

