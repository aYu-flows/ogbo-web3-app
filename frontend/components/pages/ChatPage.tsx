"use client";

import React from "react";
import { MessageCircle } from "lucide-react"; // Import MessageCircle

import { useState, useRef, useEffect, useCallback, useDeferredValue } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import {
  Search,
  Plus,
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
  BellOff,
  LogOut,
} from "lucide-react";
import { useStore, type Chat, type Message } from "@/lib/store";
import { setActiveChatId } from "@/lib/soundPlayer";
import { t } from "@/lib/i18n";
import toast from "react-hot-toast";
import MessageContextMenu from "@/components/chat/MessageContextMenu";
import ChatRequestList from "@/components/chat/ChatRequestList";
import WalletAddress from "@/components/chat/WalletAddress";
import UserAvatar from "@/components/UserAvatar";
import AvatarPreviewModal from "@/components/AvatarPreviewModal";
import ChatMediaPicker from "@/components/chat/ChatMediaPicker";
import ImagePreviewModal from "@/components/chat/ImagePreviewModal";
import ImageMessageBubble from "@/components/chat/ImageMessageBubble";
import FileMessageBubble from "@/components/chat/FileMessageBubble";
import VoiceMessagePlayer from "@/components/chat/VoiceMessagePlayer";
import VoiceRecordButton from "@/components/chat/VoiceRecordButton";
import { validateImageFile, validateFile, compressImage } from "@/lib/chat-media";
import { MutedError } from "@/lib/group-management";
import { useIMEInput } from "@/hooks/use-ime-input";
import GroupInfoPanel from "@/components/chat/GroupInfoPanel";
import GroupMemberList from "@/components/chat/GroupMemberList";
import GroupSettingsPanel from "@/components/chat/GroupSettingsPanel";
import GroupAnnouncementModal from "@/components/chat/GroupAnnouncementModal";
import GroupInviteModal from "@/components/chat/GroupInviteModal";
import GroupJoinRequestList from "@/components/chat/GroupJoinRequestList";
import InviteFriendsToGroupModal from "@/components/chat/InviteFriendsToGroupModal";
import MuteMemberModal from "@/components/chat/MuteMemberModal";
import TransferOwnerModal from "@/components/chat/TransferOwnerModal";
import { parseInviteToken } from "@/lib/group-qrcode";

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
  const { sendMessage, sendPushMessage, sendGroupPushMessage, loadChatHistory, chatReady, walletAddress, getDisplayName, getGroupDisplayName, getAvatarUrl, sendMediaMessage, retryMediaMessage, myMuteStatus, myGroupSettings, chats: allChats, deleteMessages } = useStore();
  const [hasText, setHasText] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  // Message deletion state
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; msgId: string }>({ visible: false, x: 0, y: 0, msgId: '' });
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });
  // Drag selection state
  const isDragSelecting = useRef(false);
  const dragStartIndex = useRef(-1);
  const msgListRef = useRef<HTMLDivElement>(null);
  // Group management panel states
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [groupMemberListOpen, setGroupMemberListOpen] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupAnnouncementOpen, setGroupAnnouncementOpen] = useState(false);
  const [groupInviteOpen, setGroupInviteOpen] = useState(false);
  const [groupJoinRequestsOpen, setGroupJoinRequestsOpen] = useState(false);
  const [inviteFriendsOpen, setInviteFriendsOpen] = useState(false);
  const [transferOwnerOpen, setTransferOwnerOpen] = useState(false);
  const groupDetail = useStore(s => s.activeGroupDetail[chat.id]) ?? null;
  const [muteMemberOpen, setMuteMemberOpen] = useState(false);
  const [muteMemberTarget, setMuteMemberTarget] = useState<string | null>(null);
  const [removedAlert, setRemovedAlert] = useState<'removed' | 'dissolved' | null>(null);
  const announcementShownRef = useRef<Map<string, string>>(new Map());
  const [muteCountdown, setMuteCountdown] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // File cache for retry functionality
  const fileCacheRef = useRef<Map<string, File>>(new Map());
  // Ref to the ChatDetail container — used to compute how much of keyboardHeight
  // actually overlaps this container (excluding BottomNav + system nav bar below it)
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard overlap state: driven by @capacitor/keyboard native events
  // Reliably detects keyboard height even with Capacitor 7 Edge-to-Edge mode
  // (Visual Viewport API does NOT work in Capacitor Edge-to-Edge WebView)
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handles: { remove: () => Promise<void> }[] = [];
    let mounted = true;

    Keyboard.addListener("keyboardWillShow", (info) => {
      if (!mounted) return;
      // keyboardHeight from Capacitor = distance from screen bottom to keyboard top,
      // which INCLUDES BottomNav + system nav bar below the ChatDetail container.
      // We subtract that space so paddingBottom = only the portion overlapping this container.
      const containerBottom = containerRef.current?.getBoundingClientRect().bottom ?? window.innerHeight;
      const spaceBelow = Math.max(0, window.innerHeight - containerBottom);
      const effectivePadding = Math.max(0, info.keyboardHeight - spaceBelow);
      setKeyboardOverlap(effectivePadding);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }).then((h) => { if (mounted) handles.push(h); else h.remove(); });

    Keyboard.addListener("keyboardDidHide", () => {
      if (!mounted) return;
      setKeyboardOverlap(0);
    }).then((h) => { if (mounted) handles.push(h); else h.remove(); });

    return () => {
      mounted = false;
      handles.forEach((h) => h.remove());
    };
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

  // 4F.3 + 4F.9: Mute status check with countdown timer
  const myMute = chat.type === 'group' ? myMuteStatus[chat.id] : null;
  const isMuteAll = chat.type === 'group' && groupDetail?.mute_all && walletAddress &&
    groupDetail.creator !== walletAddress.toLowerCase() &&
    !(groupDetail.admins || []).includes(walletAddress.toLowerCase());

  useEffect(() => {
    if (!myMute || !myMute.mute_until) {
      setMuteCountdown(null);
      return;
    }
    const updateCountdown = () => {
      const until = new Date(myMute.mute_until!).getTime();
      const now = Date.now();
      const diff = until - now;
      if (diff <= 0) {
        setMuteCountdown(null);
        // Clear expired mute from local state
        useStore.setState((s) => ({
          myMuteStatus: { ...s.myMuteStatus, [chat.id]: null }
        }));
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setMuteCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    updateCountdown();
    const iv = setInterval(updateCountdown, 60_000);
    return () => clearInterval(iv);
  }, [myMute, chat.id]);

  // Auto-load groupDetail when entering a group chat
  useEffect(() => {
    if (chat.type !== 'group') return;
    if (!groupDetail) {
      useStore.getState().openGroupManagement(chat.id);
    }
  }, [chat.id, chat.type, groupDetail]);

  // 4F.4: Check unread announcement on ChatDetail enter (once per chat per session)
  useEffect(() => {
    if (chat.type !== 'group' || !groupDetail?.announcement || !groupDetail.announcement_at) return;
    // Skip popup for the author who just published the announcement
    if (groupDetail.announcement_by && walletAddress && groupDetail.announcement_by === walletAddress.toLowerCase()) return;
    const currentAt = groupDetail.announcement_at;
    const previouslyShownAt = announcementShownRef.current.get(chat.id);
    // Only show if this announcement_at is genuinely newer than what we already showed
    if (previouslyShownAt && new Date(previouslyShownAt) >= new Date(currentAt)) return;
    const settings = myGroupSettings[chat.id];
    const lastRead = settings?.last_read_announcement_at;
    if (!lastRead || new Date(lastRead) < new Date(currentAt)) {
      announcementShownRef.current.set(chat.id, currentAt);
      setGroupAnnouncementOpen(true);
    }
  }, [chat.id, groupDetail?.announcement_at]);

  // 4F.8: Detect removal / dissolution
  useEffect(() => {
    if (chat.type !== 'group' || !walletAddress) return;
    const currentChat = allChats.find(c => c.id === chat.id);
    if (!currentChat) {
      setRemovedAlert('dissolved');
    }
  }, [allChats, chat.id, chat.type, walletAddress]);

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
    if (showEmoji || isSelectMode) return;
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

  // --- Media handlers ---
  const sendingRef = useRef(false);

  const handleImageSelect = useCallback((file: File) => {
    const err = validateImageFile(file);
    if (err) { toast.error(t(err, locale)); return; }
    setPreviewImage(file);
  }, [locale]);

  const handlePhotoCapture = handleImageSelect;

  const handleFileSelect = useCallback(async (file: File) => {
    if (sendingRef.current) return;
    const err = validateFile(file);
    if (err) { toast.error(t(err, locale)); return; }
    sendingRef.current = true;
    try {
      await sendMediaMessage(chat.id, file, 'file');
    } catch { toast.error(t('chat.uploadFailed', locale)); }
    finally { sendingRef.current = false; }
  }, [chat.id, sendMediaMessage, locale]);

  const handleImageSend = useCallback(async () => {
    if (!previewImage || sendingRef.current) return;
    const file = previewImage;
    setPreviewImage(null);
    sendingRef.current = true;
    try {
      const compressed = await compressImage(file);
      await sendMediaMessage(chat.id, compressed, 'image');
    } catch { toast.error(t('chat.uploadFailed', locale)); }
    finally { sendingRef.current = false; }
  }, [previewImage, chat.id, sendMediaMessage, locale]);

  const handleVoiceSend = useCallback(async (blob: Blob, duration: number) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
    try {
      await sendMediaMessage(chat.id, file, 'voice', duration);
    } catch { toast.error(t('chat.uploadFailed', locale)); }
    finally { sendingRef.current = false; }
  }, [chat.id, sendMediaMessage, locale]);

  const handleRetry = useCallback((msg: Message) => {
    const cachedFile = fileCacheRef.current.get(msg.id);
    if (!cachedFile || !msg.msgType) return;
    retryMediaMessage(chat.id, msg.id, cachedFile, msg.msgType as 'image' | 'file' | 'voice', msg.duration).catch(() => {
      toast.error(t('chat.uploadFailed', locale));
    });
  }, [chat.id, retryMediaMessage, locale]);

  const handleInput = useCallback(() => {
    const val = inputRef.current?.value ?? '';
    setHasText(val.trim().length > 0);
  }, []);

  // Native DOM input listener — reliable on all platforms including Android WebView
  // Bypasses React's synthetic event system to catch IME composition changes
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = () => {
      setHasText(el.value.trim().length > 0);
    };
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, []);

  const handleSend = async () => {
    const rawValue = inputRef.current?.value ?? '';
    if (!rawValue.trim()) {
      toast(locale === 'zh' ? '请先输入消息内容' : 'Please enter a message first')
      return
    }
    const content = rawValue.trim();
    if (inputRef.current) inputRef.current.value = '';
    setHasText(false);
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
      } catch (err) {
        if (err instanceof MutedError) {
          toast.error(t('group.error.muted', locale));
        } else {
          toast.error(locale === "zh" ? "发送失败" : "Send failed");
          if (inputRef.current) inputRef.current.value = content;
          setHasText(true);
        }
      }
    } else {
      // Fallback local message (chat not ready)
      sendMessage(chat.id, content);
    }
  };

  // ======== Message deletion handlers ========
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleMsgTouchStart = useCallback((e: React.TouchEvent, msgId: string) => {
    if (isSelectMode) return; // In select mode, touch = toggle select
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setContextMenu({ visible: true, x: touch.clientX, y: touch.clientY, msgId });
    }, 500);
  }, [isSelectMode, clearLongPress]);

  const handleMsgTouchMove = useCallback((e: React.TouchEvent) => {
    if (isSelectMode && isDragSelecting.current) {
      // Drag selection in multi-select mode
      const touch = e.touches[0];
      if (!msgListRef.current) return;
      const elements = msgListRef.current.querySelectorAll('[data-msg-index]');
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          const idx = parseInt(el.getAttribute('data-msg-index') || '-1');
          if (idx >= 0 && dragStartIndex.current >= 0) {
            const start = Math.min(dragStartIndex.current, idx);
            const end = Math.max(dragStartIndex.current, idx);
            setSelectedMsgIds(prev => {
              const next = new Set(prev);
              for (let i = start; i <= end; i++) {
                const m = chat.messages[i];
                if (m) next.add(m.id);
              }
              return next;
            });
          }
          break;
        }
      }
      return;
    }
    // Cancel long press if moved > 5px
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 5 || dy > 5) clearLongPress();
  }, [isSelectMode, clearLongPress, chat.messages]);

  const handleMsgTouchEnd = useCallback(() => {
    clearLongPress();
    isDragSelecting.current = false;
    dragStartIndex.current = -1;
  }, [clearLongPress]);

  const handleMsgContextMenu = useCallback((e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    if (isSelectMode) return;
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, msgId });
  }, [isSelectMode]);

  const handleDeleteSingle = useCallback(() => {
    const msgId = contextMenu.msgId;
    if (!msgId) return;
    // Close fullscreen image if deleting the viewed image
    const msg = chat.messages.find(m => m.id === msgId);
    if (msg?.fileUrl && fullscreenImage === msg.fileUrl) setFullscreenImage(null);
    deleteMessages(chat.id, [msgId]);
    setContextMenu({ visible: false, x: 0, y: 0, msgId: '' });
  }, [contextMenu.msgId, chat.id, chat.messages, deleteMessages, fullscreenImage]);

  const handleCopySingle = useCallback(async () => {
    const msgId = contextMenu.msgId;
    if (!msgId) return;
    const msg = chat.messages.find(m => m.id === msgId);
    const textToCopy = msg?.content || '';
    if (textToCopy) {
      const { copyToClipboard } = await import('@/lib/utils');
      try {
        await copyToClipboard(textToCopy);
        const rht = await import('react-hot-toast');
        rht.default.success(locale === 'zh' ? '已复制' : 'Copied');
      } catch {
        const rht = await import('react-hot-toast');
        rht.default.error(locale === 'zh' ? '复制失败' : 'Copy failed');
      }
    } else {
      // Media message with no text content
      const rht = await import('react-hot-toast');
      rht.default(locale === 'zh' ? '该消息无文字内容' : 'No text to copy');
    }
    setContextMenu({ visible: false, x: 0, y: 0, msgId: '' });
  }, [contextMenu.msgId, chat.messages, locale]);

  const handleEnterMultiSelect = useCallback(() => {
    const msgId = contextMenu.msgId;
    setContextMenu({ visible: false, x: 0, y: 0, msgId: '' });
    setIsSelectMode(true);
    setSelectedMsgIds(new Set(msgId ? [msgId] : []));
  }, [contextMenu.msgId]);

  const handleToggleSelect = useCallback((msgId: string) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  }, []);

  const handleBatchCopy = useCallback(async () => {
    if (selectedMsgIds.size === 0) return;
    const texts = chat.messages
      .filter(m => selectedMsgIds.has(m.id) && m.content)
      .map(m => m.content);
    if (texts.length === 0) return;
    const { copyToClipboard } = await import('@/lib/utils');
    try {
      await copyToClipboard(texts.join('\n'));
      const rht = await import('react-hot-toast');
      rht.default.success(locale === 'zh' ? '已复制' : 'Copied');
    } catch {
      const rht = await import('react-hot-toast');
      rht.default.error(locale === 'zh' ? '复制失败' : 'Copy failed');
    }
    setIsSelectMode(false);
    setSelectedMsgIds(new Set());
  }, [selectedMsgIds, chat.messages, locale]);

  const handleBatchDelete = useCallback(() => {
    if (selectedMsgIds.size === 0) return;
    // Close fullscreen image if any selected message is being viewed
    if (fullscreenImage) {
      const viewingDeleted = chat.messages.some(m => selectedMsgIds.has(m.id) && m.fileUrl === fullscreenImage);
      if (viewingDeleted) setFullscreenImage(null);
    }
    deleteMessages(chat.id, Array.from(selectedMsgIds));
    setIsSelectMode(false);
    setSelectedMsgIds(new Set());
  }, [selectedMsgIds, chat.id, chat.messages, deleteMessages, fullscreenImage]);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedMsgIds(new Set());
  }, []);

  // Drag select start in multi-select mode
  const handleDragSelectStart = useCallback((e: React.TouchEvent, msgIndex: number) => {
    if (!isSelectMode) return;
    isDragSelecting.current = true;
    dragStartIndex.current = msgIndex;
  }, [isSelectMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      ref={containerRef}
      style={{ x, paddingBottom: keyboardOverlap > 0 ? keyboardOverlap : undefined }}
      className="absolute inset-0 lg:relative lg:inset-auto bg-background z-20 flex flex-col overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-border bg-card">
        <motion.button whileTap={{ scale: 0.9 }} onClick={isSelectMode ? exitSelectMode : animateAndBack} className="rounded-full p-1 hover:bg-muted transition-colors lg:hidden">
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div
          className={`flex items-center gap-3 flex-1 min-w-0 ${chat.type === 'group' ? 'cursor-pointer' : ''}`}
          onClick={() => {
            if (chat.type === 'group') {
              setGroupInfoOpen(true);
              useStore.getState().openGroupManagement(chat.id);
            }
          }}
        >
          <div className="relative">
            {chat.type === 'group' ? (
              chat.groupAvatarUrl ? (
                <>
                  <img
                    src={chat.groupAvatarUrl}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                    onError={(e) => { const el = e.target as HTMLImageElement; el.onerror = null; el.style.display = 'none'; (el.nextElementSibling as HTMLElement)?.classList.remove('hidden'); }}
                  />
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold hidden" style={{ backgroundColor: chat.avatarColor }}>
                    <Users className="w-4 h-4" />
                  </div>
                </>
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: chat.avatarColor }}>
                  <Users className="w-4 h-4" />
                </div>
              )
            ) : chat.walletAddress ? (
              <UserAvatar address={chat.walletAddress} size="sm" className="!w-9 !h-9" onPreview={() => setPreviewAddress(chat.walletAddress!)} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: chat.avatarColor }}>
                {chat.name[0]}
              </div>
            )}
            {chat.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--ogbo-green)] ring-2 ring-card" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{chat.walletAddress ? getDisplayName(chat.walletAddress) : chat.name}</p>
            {chat.walletAddress ? (
              <WalletAddress address={chat.walletAddress} showCopyIcon={false} className="mt-0.5" />
            ) : (
              <p className="text-[10px] text-muted-foreground">
                {chat.type === "group" ? `${chat.members} ${t("chat.members", locale)}` : chat.online ? t("chat.online", locale) : t("chat.offline", locale)}
              </p>
            )}
          </div>
        </div>
        <button
          className="rounded-full p-1.5 hover:bg-muted transition-colors"
          onClick={() => {
            if (chat.type === 'group') {
              setGroupInfoOpen(true);
              useStore.getState().openGroupManagement(chat.id);
            }
          }}
        >
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div ref={msgListRef} className="flex-1 overflow-y-auto p-4 space-y-3" onScroll={() => { if (contextMenu.visible) setContextMenu(cm => ({ ...cm, visible: false })); }}>
        <AnimatePresence>
        {chat.messages.map((msg, msgIndex) => {
          const isMe = msg.sender === "me";
          const timeStr = `${new Date(msg.timestamp).getHours().toString().padStart(2, "0")}:${new Date(msg.timestamp).getMinutes().toString().padStart(2, "0")}`;
          const isUploading = msg.uploadProgress !== undefined && msg.status !== 'failed';
          const isSelected = selectedMsgIds.has(msg.id);

          // Render media bubble based on msgType
          const renderBubbleContent = () => {
            switch (msg.msgType) {
              case 'image':
                return (
                  <ImageMessageBubble
                    fileUrl={msg.fileUrl}
                    fileName={msg.fileName}
                    uploadProgress={msg.uploadProgress}
                    status={msg.status}
                    isMe={isMe}
                    onRetry={() => handleRetry(msg)}
                    onClick={() => !isSelectMode && msg.fileUrl && setFullscreenImage(msg.fileUrl)}
                  />
                );
              case 'file':
                return (
                  <FileMessageBubble
                    fileUrl={msg.fileUrl}
                    fileName={msg.fileName}
                    fileSize={msg.fileSize}
                    uploadProgress={msg.uploadProgress}
                    status={msg.status}
                    isMe={isMe}
                    onRetry={() => handleRetry(msg)}
                  />
                );
              case 'voice':
                return (
                  <VoiceMessagePlayer
                    fileUrl={msg.fileUrl}
                    duration={msg.duration}
                    isMe={isMe}
                    uploadProgress={msg.uploadProgress}
                    status={msg.status}
                    onRetry={() => handleRetry(msg)}
                  />
                );
              default:
                return <p className="text-sm leading-relaxed">{msg.content}</p>;
            }
          };

          const isMediaMsg = msg.msgType === 'image' || msg.msgType === 'file' || msg.msgType === 'voice';

          // Select mode checkbox
          const checkbox = isSelectMode ? (
            <button
              className="flex-shrink-0 flex items-center justify-center w-5 h-5 mr-1.5 ml-1.5"
              onClick={(e) => { e.stopPropagation(); handleToggleSelect(msg.id); }}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                isSelected ? 'bg-[var(--ogbo-blue)] border-[var(--ogbo-blue)]' : 'border-muted-foreground/40'
              }`}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          ) : null;

          return (
            <motion.div
              key={msg.id}
              data-msg-index={msgIndex}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center ${isMe ? "justify-end" : "justify-start"}`}
              onTouchStart={!isUploading ? (e) => {
                if (isSelectMode) { handleDragSelectStart(e, msgIndex); }
                else { handleMsgTouchStart(e, msg.id); }
              } : undefined}
              onTouchMove={!isUploading ? handleMsgTouchMove : undefined}
              onTouchEnd={!isUploading ? handleMsgTouchEnd : undefined}
              onContextMenu={!isUploading && !isSelectMode ? (e) => handleMsgContextMenu(e, msg.id) : undefined}
              onClick={isSelectMode ? () => handleToggleSelect(msg.id) : undefined}
            >
              {!isMe && checkbox}
              {chat.type === 'group' && !isMe ? (
                <div className="flex items-end gap-1.5">
                  <UserAvatar address={msg.sender} size="sm" className="!w-6 !h-6 flex-shrink-0" />
                  <div className={`max-w-[75%] rounded-2xl ${isMediaMsg ? 'p-1' : 'px-3.5 py-2.5'} bg-card text-card-foreground border border-border rounded-bl-md ${isSelected ? 'ring-2 ring-[var(--ogbo-blue)]/50' : ''}`}>
                    <p className={`text-[10px] font-semibold mb-1 text-[var(--ogbo-blue)]/80 ${isMediaMsg ? 'px-2.5 pt-1.5' : ''}`}>
                      {getGroupDisplayName(chat.id, msg.sender)}
                    </p>
                    {renderBubbleContent()}
                    <p className={`text-[10px] mt-1 text-muted-foreground ${isMediaMsg ? 'px-2.5 pb-1' : ''}`}>
                      {timeStr}
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`max-w-[75%] rounded-2xl ${isMediaMsg ? 'p-1' : 'px-3.5 py-2.5'} ${
                  isMe
                    ? "bg-[var(--ogbo-blue)] text-white rounded-br-md"
                    : "bg-card text-card-foreground border border-border rounded-bl-md"
                } ${isSelected ? 'ring-2 ring-[var(--ogbo-blue)]/50' : ''}`}>
                  {renderBubbleContent()}
                  <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"} ${isMediaMsg ? 'px-2.5 pb-1' : ''}`}>
                    {timeStr}
                    {isMe && msg.status === "read" && " ✓✓"}
                    {isMe && msg.status === "failed" && ` ${locale === 'zh' ? '发送失败' : 'Failed'}`}
                  </p>
                </div>
              )}
              {isMe && checkbox}
            </motion.div>
          );
        })}
        </AnimatePresence>
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Context menu */}
      <MessageContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        locale={locale}
        onDelete={handleDeleteSingle}
        onCopy={handleCopySingle}
        onMultiSelect={handleEnterMultiSelect}
        onClose={() => setContextMenu(cm => ({ ...cm, visible: false }))}
      />

      {/* Input bar or Multi-select toolbar */}
      {isSelectMode ? (
        <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between">
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={exitSelectMode}
          >
            {t('chat.msg.cancel', locale)}
          </button>
          <span className="text-sm text-muted-foreground">
            {t('chat.msg.selected', locale).replace('{n}', String(selectedMsgIds.size))}
          </span>
          <div className="flex items-center gap-3">
            <button
              className={`text-sm font-medium transition-colors ${
                selectedMsgIds.size > 0
                  ? 'text-[var(--ogbo-blue)] hover:text-[var(--ogbo-blue-hover)]'
                  : 'text-muted-foreground/40 cursor-not-allowed'
              }`}
              onClick={handleBatchCopy}
              disabled={selectedMsgIds.size === 0}
            >
              {t('chat.msg.copy', locale)}
            </button>
            <button
              className={`text-sm font-medium transition-colors ${
                selectedMsgIds.size > 0
                  ? 'text-red-500 hover:text-red-600'
                  : 'text-muted-foreground/40 cursor-not-allowed'
              }`}
              onClick={handleBatchDelete}
              disabled={selectedMsgIds.size === 0}
            >
              {t('chat.msg.delete', locale)}
            </button>
          </div>
        </div>
      ) : (
      <div className="border-t border-border bg-card px-2 py-2 relative">
        {(myMute || isMuteAll) ? (
          <div className="flex items-center justify-center py-2.5 text-sm text-muted-foreground">
            {isMuteAll
              ? t('group.muteAll', locale)
              : myMute?.mute_until
                ? `${t('group.error.muted', locale)}${muteCountdown ? ` (${muteCountdown})` : ''}`
                : t('group.error.muted', locale)}
          </div>
        ) : (
          <>
            <AnimatePresence>
              {showEmoji && <EmojiPicker onSelect={(emoji) => { if (inputRef.current) { inputRef.current.value += emoji; setHasText(true); } }} onClose={() => setShowEmoji(false)} />}
            </AnimatePresence>
            <div className="flex items-center gap-1">
              <ChatMediaPicker
                onImageSelect={handleImageSelect}
                onFileSelect={handleFileSelect}
                onPhotoCapture={handlePhotoCapture}
              />
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowEmoji(!showEmoji)} className="rounded-full p-1.5 hover:bg-muted transition-colors flex-shrink-0">
                <Smile className="w-5 h-5 text-muted-foreground" />
              </motion.button>
              <input
                ref={inputRef}
                onInput={handleInput}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => {
                  setIsComposing(false);
                  requestAnimationFrame(() => {
                    handleInput();
                  });
                }}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  setTimeout(() => {
                    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 300);
                }}
                placeholder={t("chat.inputPlaceholder", locale)}
                className="flex-1 min-w-0 bg-muted rounded-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 transition-all"
              />
              {hasText ? (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSend}
                  className="rounded-full p-1.5 bg-[var(--ogbo-blue)] text-white hover:bg-[var(--ogbo-blue-hover)] transition-colors flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              ) : (
                <VoiceRecordButton onSend={handleVoiceSend} />
              )}
            </div>
          </>
        )}
      </div>
      )}

      {/* Image Preview Modal */}
      <ImagePreviewModal
        file={previewImage}
        onSend={handleImageSend}
        onCancel={() => setPreviewImage(null)}
      />

      {/* Fullscreen image viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setFullscreenImage(null)}
          >
            <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2" onClick={() => setFullscreenImage(null)}>
              <X className="w-6 h-6" />
            </button>
            <img src={fullscreenImage} alt="" className="max-w-full max-h-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Preview Modal */}
      <AvatarPreviewModal
        avatarUrl={previewAddress ? getAvatarUrl(previewAddress) : null}
        displayName={previewAddress ? getDisplayName(previewAddress) : ''}
        open={!!previewAddress}
        onClose={() => setPreviewAddress(null)}
      />

      {/* Group Management Panels */}
      {chat.type === 'group' && (
        <>
          <GroupInfoPanel
            open={groupInfoOpen}
            onClose={() => setGroupInfoOpen(false)}
            groupId={chat.id}
            onOpenMemberList={() => setGroupMemberListOpen(true)}
            onOpenSettings={() => setGroupSettingsOpen(true)}
            onOpenAnnouncement={() => setGroupAnnouncementOpen(true)}
            onOpenInviteLink={() => setGroupInviteOpen(true)}
            onOpenJoinRequests={() => setGroupJoinRequestsOpen(true)}
            onOpenInviteFriends={() => setInviteFriendsOpen(true)}
            onOpenTransferOwner={() => setTransferOwnerOpen(true)}
          />
          <GroupMemberList
            open={groupMemberListOpen}
            onClose={() => setGroupMemberListOpen(false)}
            groupId={chat.id}
            groupDetail={groupDetail}
          />
          <GroupSettingsPanel
            open={groupSettingsOpen}
            onClose={() => setGroupSettingsOpen(false)}
            groupId={chat.id}
            groupDetail={groupDetail}
          />
          <GroupAnnouncementModal
            open={groupAnnouncementOpen}
            onClose={() => setGroupAnnouncementOpen(false)}
            groupId={chat.id}
            groupDetail={groupDetail}
            canEdit={!!groupDetail && !!walletAddress && (groupDetail.creator === walletAddress.toLowerCase() || groupDetail.admins.includes(walletAddress.toLowerCase()))}
            isUnread={!!groupDetail?.announcement_at && (!myGroupSettings[chat.id]?.last_read_announcement_at || new Date(myGroupSettings[chat.id].last_read_announcement_at!) < new Date(groupDetail.announcement_at))}
          />
          <GroupInviteModal
            open={groupInviteOpen}
            onClose={() => setGroupInviteOpen(false)}
            groupId={chat.id}
          />
          <GroupJoinRequestList
            open={groupJoinRequestsOpen}
            onClose={() => setGroupJoinRequestsOpen(false)}
            groupId={chat.id}
          />
          <InviteFriendsToGroupModal
            open={inviteFriendsOpen}
            onClose={() => setInviteFriendsOpen(false)}
            groupId={chat.id}
            existingMembers={groupDetail?.members || []}
          />
          <TransferOwnerModal
            open={transferOwnerOpen}
            onClose={() => setTransferOwnerOpen(false)}
            groupId={chat.id}
            members={groupDetail?.members || []}
            currentOwner={groupDetail?.creator || ''}
          />
        </>
      )}

      {/* 4F.8: Removed / Dissolved alert */}
      <AnimatePresence>
        {removedAlert && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-xs rounded-2xl bg-card border border-border shadow-xl p-6 text-center"
            >
              <p className="text-sm font-semibold mb-4">
                {removedAlert === 'removed'
                  ? t('group.removedFromGroup', locale)
                  : t('group.groupDissolved', locale)}
              </p>
              <button
                onClick={() => { setRemovedAlert(null); onBack(); }}
                className="rounded-xl bg-[var(--ogbo-blue)] text-white px-6 py-2 text-sm font-medium"
              >
                {t('common.confirm', locale)}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ChatPage({ searchOpen: searchOpenProp, onCloseSearch }: { searchOpen?: boolean; onCloseSearch?: () => void }) {
  const { chats, locale, markChatRead, pinChat, deleteChat, chatRequests, getDisplayName, getAvatarUrl, toggleGroupPin, leaveGroupAction, myGroupSettings } = useStore();
  const walletAddress = useStore((s) => s.walletAddress);
  const isConnectingChat = useStore((s) => s.isConnectingChat);
  const searchIME = useIMEInput("");
  const searchQuery = searchIME.value;
  const deferredSearchQuery = searchIME.deferredValue;
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);
  const [invitePreview, setInvitePreview] = useState<{ name: string; memberCount: number; avatarUrl?: string; token: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [inviteLinkInvalid, setInviteLinkInvalid] = useState(false);

  // Reset selected chat when wallet switches (walletAddress changes)
  const prevWalletRef = useRef<string | null>(null);
  useEffect(() => {
    if (walletAddress !== prevWalletRef.current) {
      prevWalletRef.current = walletAddress;
      setSelectedChat(null);
      setActiveChatId(null);
    }
  }, [walletAddress]);

  // Auto-deselect when the selected chat no longer exists (e.g. dissolved/left/kicked)
  useEffect(() => {
    if (selectedChat && !chats.some(c => c.id === selectedChat)) {
      setSelectedChat(null);
      setActiveChatId(null);
    }
  }, [chats, selectedChat]);

  // Detect invite link in search input and show group preview
  useEffect(() => {
    if (!deferredSearchQuery) {
      setInvitePreview(null);
      setInviteLinkInvalid(false);
      return;
    }
    const token = parseInviteToken(deferredSearchQuery);
    if (!token) {
      setInvitePreview(null);
      setInviteLinkInvalid(false);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    setInviteLinkInvalid(false);
    import('@/lib/group-management').then(({ fetchGroupPreviewByToken }) =>
      fetchGroupPreviewByToken(token)
    ).then((preview) => {
      if (cancelled) return;
      setLoadingPreview(false);
      if (preview) {
        setInvitePreview({ ...preview, token });
        setInviteLinkInvalid(false);
      } else {
        setInvitePreview(null);
        setInviteLinkInvalid(true);
      }
    }).catch(() => {
      if (!cancelled) { setLoadingPreview(false); setInvitePreview(null); setInviteLinkInvalid(true); }
    });
    return () => { cancelled = true; };
  }, [deferredSearchQuery]);

  const searchOpen = searchOpenProp ?? false;

  const sortedChats = [...chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.timestamp - a.timestamp;
  });

  const filteredChats = deferredSearchQuery
    ? sortedChats.filter(
        (c) =>
          c.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(deferredSearchQuery.toLowerCase())
      )
    : sortedChats;

  const activeChat = chats.find((c) => c.id === selectedChat);

  const handleOpenChat = (chatId: string) => {
    setSelectedChat(chatId);
    setActiveChatId(chatId);
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
                  {...searchIME.getInputProps()}
                  placeholder={t("chat.searchPlaceholder", locale)}
                  className="w-full rounded-xl bg-muted pl-9 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 transition-all"
                />
                <button onClick={() => { if (onCloseSearch) onCloseSearch(); searchIME.setValue(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-background transition-colors">
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
                {chatRequests[0]?.fromAddress ? getDisplayName(chatRequests[0].fromAddress) : ''}{chatRequests.length > 1 ? (locale === 'zh' ? ` 等${chatRequests.length}人` : ` +${chatRequests.length - 1} more`) : ''}
              </p>
            </div>
          </motion.button>
        )}

        {/* Invite link preview card */}
        {searchOpen && invitePreview && (
          <div className="mx-4 mt-2 mb-1 p-3 bg-muted/50 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--ogbo-blue)]/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-[var(--ogbo-blue)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{invitePreview.name}</p>
                <p className="text-xs text-muted-foreground">
                  {invitePreview.memberCount} {locale === 'zh' ? '成员' : 'members'}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    const result = await useStore.getState().joinGroupViaToken(invitePreview.token);
                    if (result.status === 'joined') {
                      toast.success(locale === 'zh' ? '已加入群聊' : 'Joined group');
                      searchIME.setValue('');
                      setInvitePreview(null);
                    } else if (result.status === 'pending') {
                      toast(locale === 'zh' ? '申请已提交' : 'Request submitted');
                    } else if (result.status === 'already_member') {
                      toast(locale === 'zh' ? '你已是群成员' : 'Already a member');
                    } else {
                      toast.error(locale === 'zh' ? '加入失败' : 'Failed to join');
                    }
                  } catch {
                    toast.error(locale === 'zh' ? '加入失败' : 'Failed to join');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-[var(--ogbo-blue)] text-white text-xs font-medium hover:bg-[var(--ogbo-blue-hover)] transition-colors flex-shrink-0"
              >
                {locale === 'zh' ? '加入' : 'Join'}
              </button>
            </div>
          </div>
        )}
        {searchOpen && loadingPreview && parseInviteToken(deferredSearchQuery) && (
          <div className="mx-4 mt-2 mb-1 flex justify-center py-3">
            <div className="w-5 h-5 border-2 border-[var(--ogbo-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {searchOpen && inviteLinkInvalid && !loadingPreview && (
          <div className="mx-4 mt-2 mb-1 p-3 bg-muted/50 rounded-xl border border-border text-center">
            <p className="text-sm text-muted-foreground">
              {locale === 'zh' ? '邀请链接无效或已过期' : 'Invite link is invalid or expired'}
            </p>
          </div>
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
                        onClick={async () => {
                          if (chat.type === 'group') {
                            await toggleGroupPin(chat.id);
                          } else {
                            pinChat(chat.id);
                          }
                          setSwipedId(null);
                          toast.success(locale === "zh" ? (chat.pinned ? "已取消置顶" : "已置顶") : (chat.pinned ? "Unpinned" : "Pinned"));
                        }}
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
                        onClick={async () => {
                          if (chat.type === 'group') {
                            await leaveGroupAction(chat.id);
                          } else {
                            deleteChat(chat.id);
                            toast.success(locale === "zh" ? "已删除" : "Deleted");
                          }
                          setSwipedId(null);
                        }}
                        className="rounded-xl bg-[var(--ogbo-red)] p-2.5 text-white"
                      >
                        {chat.type === 'group' ? <LogOut className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
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
                    {chat.type === "group" ? (
                      chat.groupAvatarUrl ? (
                        <>
                          <img
                            src={chat.groupAvatarUrl}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover"
                            onError={(e) => { const el = e.target as HTMLImageElement; el.onerror = null; el.style.display = 'none'; (el.nextElementSibling as HTMLElement)?.classList.remove('hidden'); }}
                          />
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold hidden"
                            style={{ backgroundColor: chat.avatarColor }}
                          >
                            <Users className="w-5 h-5" />
                          </div>
                        </>
                      ) : (
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                          style={{ backgroundColor: chat.avatarColor }}
                        >
                          <Users className="w-5 h-5" />
                        </div>
                      )
                    ) : chat.walletAddress ? (
                      <UserAvatar address={chat.walletAddress} size="lg" onPreview={() => setPreviewAddress(chat.walletAddress!)} />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: chat.avatarColor }}
                      >
                        {chat.name[0]}
                      </div>
                    )}
                    {chat.online && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[var(--ogbo-green)] ring-2 ring-background" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold truncate">{chat.walletAddress ? getDisplayName(chat.walletAddress) : chat.name}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{formatTime(chat.timestamp, locale)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate pr-2">
                        {chat.typing ? t("chat.typing", locale) : chat.lastMessage}
                      </p>
                      {chat.type === 'group' && myGroupSettings[chat.id]?.muted_notifications && (
                        <BellOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
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
              onBack={() => { setSelectedChat(null); setActiveChatId(null); }}
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
              onBack={() => { setSelectedChat(null); setActiveChatId(null); }}
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

      {/* Avatar Preview Modal (chat list) */}
      <AvatarPreviewModal
        avatarUrl={previewAddress ? getAvatarUrl(previewAddress) : null}
        displayName={previewAddress ? getDisplayName(previewAddress) : ''}
        open={!!previewAddress}
        onClose={() => setPreviewAddress(null)}
      />
    </div>
  );
}

