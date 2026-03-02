'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import NewBadge from '@/components/NewBadge';

// Sparkle icon (✦ style)
const SparkleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2 L13.5 9.5 L21 11 L13.5 12.5 L12 20 L10.5 12.5 L3 11 L10.5 9.5 Z" />
  </svg>
);

// Minimize icon
const MinimizeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// Maximize icon
const MaximizeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

// Restore icon
const RestoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="10" y1="14" x2="3" y2="21" />
    <line x1="21" y1="3" x2="14" y2="10" />
  </svg>
);

// Close icon
const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Send icon
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

// Typing indicator dots
const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <span
      className="w-2 h-2 rounded-full bg-cortex-accent opacity-60"
      style={{ animation: 'aiDot 1.2s ease-in-out infinite', animationDelay: '0ms' }}
    />
    <span
      className="w-2 h-2 rounded-full bg-cortex-accent opacity-60"
      style={{ animation: 'aiDot 1.2s ease-in-out infinite', animationDelay: '200ms' }}
    />
    <span
      className="w-2 h-2 rounded-full bg-cortex-accent opacity-60"
      style={{ animation: 'aiDot 1.2s ease-in-out infinite', animationDelay: '400ms' }}
    />
  </div>
);

// Format timestamp
function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function AICompanion() {
  const pathname = usePathname();

  // Panel state
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Messages state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const panelRef = useRef(null);

  // Scroll to bottom ref
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * 4 + 16; // 4 lines + padding
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
  }, []);

  // Dragging logic
  const onMouseDown = useCallback((e) => {
    if (isMaximized) return;
    if (e.target.closest('button')) return; // don't drag on buttons
    draggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    e.preventDefault();
  }, [isMaximized, position]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };
    const onMouseUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Open/close panel
  const openPanel = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  const closePanel = () => {
    setIsOpen(false);
    setIsMaximized(false);
    setPosition({ x: 0, y: 0 });
  };

  const minimize = () => {
    setIsOpen(false);
    setIsMaximized(false);
  };

  const toggleMaximize = () => {
    setIsMaximized(prev => !prev);
    if (!isMaximized) {
      setPosition({ x: 0, y: 0 });
    }
  };

  // Send message
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const res = await apiFetch('/api/lms/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, currentPage: pathname }),
      });

      const data = await res.json();

      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else if (data.reply) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() },
        ]);
      }

      // If panel is closed, increment unread badge
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'I ran into an issue processing your request. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Panel dimensions and position style
  const panelStyle = isMaximized
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        transform: 'none',
        borderRadius: 0,
        zIndex: 9999,
      }
    : {
        position: 'fixed',
        bottom: '80px',
        right: '24px',
        width: '360px',
        height: '520px',
        transform: `translate(${position.x}px, ${position.y}px)`,
        zIndex: 9998,
      };

  return (
    <>
      {/* Keyframe animations injected globally */}
      <style>{`
        @keyframes aiPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
        }
        @keyframes aiDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes aiSlideIn {
          from { opacity: 0; transform: translate(${position.x}px, calc(${position.y}px + 16px)) scale(0.95); }
          to { opacity: 1; transform: translate(${position.x}px, ${position.y}px) scale(1); }
        }
        .ai-panel-enter {
          animation: aiSlideIn 0.2s ease-out forwards;
        }
      `}</style>

      {/* Floating bubble button */}
      {!isOpen && (
        <button
          onClick={openPanel}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9997,
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'aiPulse 2.5s ease-in-out infinite',
          }}
          className="bg-cortex-accent text-white shadow-lg hover:opacity-90 transition-opacity"
          title="Open AI Assistant"
          aria-label="Open AI Assistant"
        >
          <SparkleIcon />
          <NewBadge description="New: AI Companion — ask anything about your training, courses, attendance, or progress. Powered by GPT-4o." />
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '18px',
                height: '18px',
                borderRadius: '9px',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          ref={panelRef}
          style={panelStyle}
          className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl overflow-hidden flex flex-col ai-panel-enter"
        >
          {/* Header */}
          <div
            onMouseDown={onMouseDown}
            style={{ cursor: isMaximized ? 'default' : 'grab' }}
            className="flex items-center justify-between bg-cortex-bg px-4 py-3 border-b border-cortex-border flex-shrink-0 select-none"
          >
            <div className="flex items-center gap-2">
              <span className="text-cortex-accent">
                <SparkleIcon />
              </span>
              <span className="text-cortex-text font-semibold text-sm">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Minimize */}
              <button
                onClick={minimize}
                className="w-6 h-6 flex items-center justify-center rounded text-cortex-muted hover:text-cortex-text hover:bg-cortex-border/50 transition"
                title="Minimize"
              >
                <MinimizeIcon />
              </button>
              {/* Maximize / Restore */}
              <button
                onClick={toggleMaximize}
                className="w-6 h-6 flex items-center justify-center rounded text-cortex-muted hover:text-cortex-text hover:bg-cortex-border/50 transition"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
              </button>
              {/* Close */}
              <button
                onClick={closePanel}
                className="w-6 h-6 flex items-center justify-center rounded text-cortex-muted hover:text-cortex-danger hover:bg-cortex-danger/10 transition"
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
                <div className="w-12 h-12 rounded-full bg-cortex-accent/15 flex items-center justify-center text-cortex-accent">
                  <SparkleIcon />
                </div>
                <div>
                  <p className="text-cortex-text font-medium text-sm">AI Assistant</p>
                  <p className="text-cortex-muted text-xs mt-1 max-w-[240px] leading-relaxed">
                    Ask me about your training sessions, courses, progress, attendance, or any LMS data.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-cortex-accent text-white rounded-2xl rounded-br-sm px-4 py-2.5'
                      : 'bg-cortex-bg border border-cortex-border text-cortex-text rounded-2xl rounded-bl-sm px-4 py-2.5'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  {msg.timestamp && (
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.role === 'user' ? 'text-white/60' : 'text-cortex-muted'
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Loading/typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-cortex-bg border border-cortex-border rounded-2xl rounded-bl-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-cortex-border p-3 bg-cortex-bg">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  resizeTextarea();
                }}
                onKeyDown={onKeyDown}
                placeholder="Ask about your training, courses, progress..."
                rows={1}
                disabled={isLoading}
                style={{ resize: 'none', minHeight: '36px' }}
                className="flex-1 bg-cortex-surface border border-cortex-border rounded-xl px-3 py-2 text-sm text-cortex-text placeholder-cortex-muted focus:outline-none focus:border-cortex-accent transition overflow-y-auto"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-cortex-accent text-white flex items-center justify-center hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                title="Send"
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-[10px] text-cortex-muted mt-1.5 text-center">
              Press Enter to send &middot; Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
