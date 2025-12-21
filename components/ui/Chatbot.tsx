"use client";
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from './LanguageProvider';
import { usePathname } from 'next/navigation';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I am Veema. How can I help you manage your finances today?' }
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingIdRef = useRef(0);
  const { t } = useLanguage();
  const pathname = usePathname();

  // Only show on user dashboard or admin panel
  const isVisible = pathname?.startsWith('/user') || pathname?.startsWith('/admin');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  if (!isVisible) return null;

  const send = async () => {
    if (!input.trim() || pending) return;
    const msg = input.trim();
    setInput('');
    setPending(true);
    setMessages(prev => [...prev, { role: 'user', content: msg }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: messages }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const reply = String(data.reply ?? '');
      if (!reply.trim()) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not generate a reply.' }]);
      } else {
        typingIdRef.current += 1;
        const currentId = typingIdRef.current;
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        const fullText = reply;
        const length = fullText.length;
        const chunkSize = 6;
        let index = 0;

        const step = () => {
          if (typingIdRef.current !== currentId) return;
          index = Math.min(index + chunkSize, length);
          const nextText = fullText.slice(0, index);
          setMessages(prev => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === 'assistant') {
                updated[i] = { ...updated[i], content: nextText };
                break;
              }
            }
            return updated;
          });
          if (index < length) {
            setTimeout(step, 16);
          }
        };

        step();
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am having trouble connecting right now.' }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {/* Toggle Button (Floating Bottom Right) */}
      <button 
        className="btn primary"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24, // Changed to Right
          zIndex: 1000,
          borderRadius: 30,
          padding: '12px 20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        <span style={{ fontSize: 20 }}>🤖</span>
        {isOpen ? 'Close Veema' : 'Chat with Veema'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            bottom: 80,
            right: 24, // Changed to Right
            width: 380, // Slightly wider
            height: 600, // Taller
            maxHeight: '80vh',
            maxWidth: 'calc(100vw - 48px)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{ 
            padding: '16px', 
            borderBottom: '1px solid var(--border)', 
            background: 'var(--bg)', 
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <span>{t('chat.header')}</span>
            </div>
            <button className="btn ghost" onClick={() => setIsOpen(false)} style={{ padding: 4 }}>✕</button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div 
                key={i} 
                style={{ 
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background: m.role === 'user' ? 'var(--primary)' : 'var(--bg)',
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                  padding: '10px 14px',
                  borderRadius: 12,
                  maxWidth: '85%',
                  fontSize: 14,
                  lineHeight: 1.5,
                  border: m.role === 'assistant' ? '1px solid var(--border)' : 'none'
                }}
              >
                {m.role === 'assistant' ? (
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            ))}
            {pending && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>Veema is analyzing...</div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', gap: 8 }}>
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={t('chat.placeholder')}
              style={{ flex: 1, borderRadius: 20 }}
            />
            <button className="btn primary" onClick={send} disabled={pending} style={{ borderRadius: 20, padding: '0 16px' }}>➤</button>
          </div>
        </div>
      )}
    </>
  );
}
