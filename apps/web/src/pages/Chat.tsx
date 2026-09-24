/**
 * ChatPage — Ultra Premium Apple-Style Messaging
 * Features deep frosted glass, iMessage-style fluid chat bubbles,
 * realtime typing indicators, and a responsive master-detail layout.
 */
import { useState, useEffect, useRef, useCallback, useMemo} from'react';
import { useQuery, useMutation, useQueryClient} from'@tanstack/react-query';
import { io, type Socket} from'socket.io-client';
 import { 
 GlassPageHeader, 
 GlassPageLoader, 
 GlassErrorState, 
 GlassEmptyState,
 GlassButton,
 GlassTextArea,
} from'@/components/ui';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useToast} from'@/components/ui/GlassToast';
import { chatApi} from'@/lib/api';
import { getErrorMessage} from'@/lib/errorMessages';
import type { ChatConversation, ChatMessage} from'@/lib/types';
 import { useAuth} from'@/auth/AuthContext';
 import { useI18n} from'@/i18n/I18nProvider';
 import type { TranslateFn} from'@/i18n/I18nProvider';

function useSocket() {
 const socketRef = useRef<Socket | null>(null);
 const getSocket = useCallback(() => {
 if (!socketRef.current) {
 socketRef.current = io('/chat', { withCredentials: true, transports: ['websocket']});
}
 return socketRef.current;
}, []);
 useEffect(() => {
 return () => { socketRef.current?.disconnect(); socketRef.current = null;};
}, []);
 return getSocket;
}

function formatTime(dateStr: string | null | undefined, t: TranslateFn): string {
 if (!dateStr) return'';
 const d = new Date(dateStr);
 const now = new Date();
 const diffMs = now.getTime() - d.getTime();
 const diffMin = Math.floor(diffMs / 60000);
 if (diffMin < 1) return t('chat.time.now');
 if (diffMin < 60) return t('chat.time.minutes', { n: diffMin });
 const diffH = Math.floor(diffMin / 60);
 if (diffH < 24) return t('chat.time.hours', { n: diffH });
 const diffD = Math.floor(diffH / 24);
 if (diffD < 7) return t('chat.time.days', { n: diffD });
 return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short'});
}

function getConversationTitle(conv: ChatConversation, currentUserId: string | undefined, t: TranslateFn): string {
 if (conv.title) return conv.title;
 const others = conv.participants?.filter((p: { userId: string; user?: { firstName?: string; lastName?: string}}) => p.userId !== currentUserId) ?? [];
 if (others.length === 1 && others[0].user) {
 return `${others[0].user.firstName} ${others[0].user.lastName}`;
 }
 if (others.length > 0) {
 return others.map((p: { userId: string; user?: { firstName?: string; lastName?: string}}) => p.user ? `${p.user.firstName}` : t('chat.someone')).join(',');
 }
 return t('chat.title');
}

function getParticipantInitials(conv: ChatConversation, currentUserId?: string): string {
 if (conv.title) return conv.title.slice(0, 2).toUpperCase();
 const others = conv.participants?.filter((p: { userId: string; user?: { firstName?: string; lastName?: string}}) => p.userId !== currentUserId) ?? [];
 if (others.length === 1 && others[0].user) {
 const u = others[0].user;
 return `${u.firstName?.[0] ??''}${u.lastName?.[0] ??''}`.toUpperCase() ||'??';
}
 return'??';
}

export function ChatPage() {
 const { t} = useI18n();
 usePageTitle(t('chat.title'));
 const { user} = useAuth();
 const { push, toastNode} = useToast();
 const queryClient = useQueryClient();
 const getSocket = useSocket();

 const [activeConvId, setActiveConvId] = useState<string | null>(null);
 const [messageText, setMessageText] = useState('');
 const [showMobileThread, setShowMobileThread] = useState(false);
 const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});

 const conversationsQuery = useQuery({
 queryKey: ['chat','conversations'],
 queryFn: () => chatApi.listConversations() as Promise<ChatConversation[]>,
 refetchInterval: 10_000,
});

 const activeConversation = useMemo(() => {
 if (!activeConvId) return null;
 return (conversationsQuery.data as ChatConversation[] | undefined)?.find(c => c.id === activeConvId) ?? null;
}, [activeConvId, conversationsQuery.data]);

 const messagesQuery = useQuery({
 queryKey: ['chat','messages', activeConvId],
 queryFn: () => chatApi.getMessages(activeConvId!) as Promise<ChatMessage[]>,
 enabled: !!activeConvId,
 refetchInterval: 15_000,
});

 const sendMessageMutation = useMutation({
 mutationFn: (data: { conversationId: string; message: string}) =>
 chatApi.sendMessage(data),
 onSuccess: () => {
 setMessageText('');
 queryClient.invalidateQueries({ queryKey: ['chat','conversations']});
 queryClient.invalidateQueries({ queryKey: ['chat','messages', activeConvId]});
},
 onError: (e) => push('error', getErrorMessage(e)),
});

 const markReadMutation = useMutation({
 mutationFn: (convId: string) => chatApi.markRead(convId),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['chat','conversations']});
},
 // Without this the unread badge silently fails to clear and the user gets
 // no feedback that the request was rejected.
 onError: (e) => push('error', getErrorMessage(e)),
});

 const messagesEndRef = useRef<HTMLDivElement>(null);
 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior:'smooth'});
}, [messagesQuery.data]);

 useEffect(() => {
 if (!activeConvId) return;
 markReadMutation.mutate(activeConvId);
}, [activeConvId]);

 useEffect(() => {
 const socket = getSocket();
 const handleNewMessage = (msg: ChatMessage) => {
 if (msg.conversationId === activeConvId) {
 queryClient.invalidateQueries({ queryKey: ['chat','messages', activeConvId]});
}
 queryClient.invalidateQueries({ queryKey: ['chat','conversations']});
};
 const handleTyping = (data: { conversationId: string; userId: string; isTyping: boolean}) => {
 if (data.conversationId === activeConvId && data.userId !== user?.id) {
 setTypingUsers(prev => ({ ...prev, [data.userId]: data.isTyping}));
}
};
 const handleMessagesRead = (data: { conversationId: string}) => {
 if (data.conversationId === activeConvId) {
 queryClient.invalidateQueries({ queryKey: ['chat','messages', activeConvId]});
}
};
 socket.on('newMessage', handleNewMessage);
 socket.on('typing', handleTyping);
 socket.on('messagesRead', handleMessagesRead);
 return () => {
 socket.off('newMessage', handleNewMessage);
 socket.off('typing', handleTyping);
 socket.off('messagesRead', handleMessagesRead);
};
}, [activeConvId, getSocket, queryClient, user?.id]);

 const handleSelectConversation = useCallback((convId: string) => {
 const socket = getSocket();
 if (activeConvId) socket.emit('leaveConversation', { conversationId: activeConvId});
 setActiveConvId(convId);
 socket.emit('joinConversation', { conversationId: convId});
 setShowMobileThread(true);
 setTypingUsers({});
}, [activeConvId, getSocket]);

 const handleBack = useCallback(() => {
 setShowMobileThread(false);
}, []);

 const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const handleTyping = useCallback(() => {
 if (!activeConvId) return;
 const socket = getSocket();
 socket.emit('typing', { conversationId: activeConvId, isTyping: true});
 if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
 typingTimeoutRef.current = setTimeout(() => {
 socket.emit('typing', { conversationId: activeConvId, isTyping: false});
}, 3000);
}, [activeConvId, getSocket]);

 const handleSend = useCallback(() => {
 const text = messageText.trim();
 if (!text || !activeConvId) return;
 const socket = getSocket();
 socket.emit('sendMessage', { conversationId: activeConvId, message: text});
 sendMessageMutation.mutate({ conversationId: activeConvId, message: text});
 socket.emit('typing', { conversationId: activeConvId, isTyping: false});
}, [messageText, activeConvId, getSocket, sendMessageMutation]);


const typingNames = useMemo(() => {
 if (!activeConversation || !user) return [];
 return Object.entries(typingUsers)
 .filter(([id, isTyping]) => isTyping && id !== user.id)
 .map(([id]) => {
 const p = activeConversation.participants?.find((pp: { userId: string; user?: { firstName?: string; lastName?: string}}) => pp.userId === id);
 return p?.user ? `${p.user.firstName}` : t('chat.someone');
 });
 }, [typingUsers, activeConversation, user, t]);

 const conversations = (conversationsQuery.data as ChatConversation[] | undefined) ?? [];
 const messages = (messagesQuery.data as ChatMessage[] | undefined) ?? [];

 if (conversationsQuery.isLoading) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('chat.title')}subtitle={t('chat.loadingInbox')}/>
 <div className="mt-8 rounded-[2.5rem] p-16 flex items-center justify-center glass-card">
 <GlassPageLoader label={t('chat.fetching')}/>
 </div>
 </div>
 );
 }

 if (conversationsQuery.isError) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('chat.title')}subtitle={t('chat.connectionError')}/>
 <div className="mt-8 rounded-[2.5rem] p-12 glass-card">
 <GlassErrorState message={getErrorMessage(conversationsQuery.error)} onRetry={() => conversationsQuery.refetch()} />
 </div>
 </div>
 );
}

 return (
 <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
 {/* Soft Apple-style Background Ambient Orbs */}
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden="true">
 <div className="absolute top-[0%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-400/10 blur-[120px]"/>
 <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-cyan-400/5 blur-[100px]"/>
 </div>

 <div className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
 <GlassPageHeader title={t('chat.title')}subtitle={t('chat.subtitle')}/>

 <div className="flex gap-6 h-[75vh] min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
 
 {/* ── Left Panel: Conversation List ──────────────────────────────── */}
 <div className={`w-full md:w-[340px] lg:w-[380px] shrink-0 flex flex-col rounded-[2.5rem] glass-card overflow-hidden relative ${showMobileThread ?'hidden md:flex' :'flex'}`}>
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden="true"/>
 
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between relative z-10">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)] flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
 </div>
 {t('chat.inbox')}
 </h2>
 </div>

 <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 relative z-10">
 {conversations.length === 0 ? (
 <div className="h-full flex items-center justify-center p-6">
 <GlassEmptyState title={t('chat.inboxZero')}message={t('chat.inboxZeroHint')}/>
 </div>
 ) : (
 conversations.map((conv) => {
 const isActive = conv.id === activeConvId;
 const title = getConversationTitle(conv, user?.id, t);
 const initials = getParticipantInitials(conv, user?.id);
 const lastMsg = conv.messages?.[0]?.content;
 const unread = conv.unreadCount ?? 0;

 return (
 <button
 key={conv.id}
 type="button"
 onClick={() => handleSelectConversation(conv.id)}
 className={`w-full p-3 rounded-2xl flex items-center gap-4 transition-all duration-300 ${
 isActive 
 ?'bg-[var(--bg-card)] shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
 :'hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)]'
}`}
 >
 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shrink-0 text-[0.8rem]">
 {initials}
 </div>
 <div className="flex-1 min-w-0 text-left">
 <div className="flex items-center justify-between gap-2 mb-1">
 <span className="text-[0.95rem] font-bold text-[var(--text-primary)] truncate">
 {title}
 </span>
 {conv.lastMessageAt && (
 <span className="text-[0.7rem] font-bold text-[var(--text-muted)] shrink-0 uppercase tracking-widest">
 {formatTime(conv.lastMessageAt, t)}
 </span>
 )}
 </div>
 <div className="flex items-center justify-between gap-2">
 <span className={`text-[0.85rem] truncate ${unread > 0 ?'font-bold text-[var(--text-primary)]' :'font-medium text-[var(--text-muted)]'}`}>
 {lastMsg || t('chat.newConversation')}
 </span>
 {unread > 0 && (
 <span className="px-2 py-0.5 rounded-full bg-brand-500 text-white text-[0.65rem] font-black shadow-sm shrink-0">
 {unread > 99 ?'99+' : unread}
 </span>
 )}
 </div>
 </div>
 </button>
 );
})
 )}
 </div>
 </div>

 {/* ── Right Panel: Message Thread ────────────────────────────────── */}
 <div className={`flex-1 flex flex-col rounded-[2.5rem] glass-card overflow-hidden relative ${!showMobileThread && activeConvId ?'hidden md:flex' : showMobileThread ?'flex' :'hidden md:flex'}`}>
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden="true"/>
 
 {!activeConvId ? (
 <div className="flex-1 flex items-center justify-center p-8 relative z-10">
 <GlassEmptyState
 title={t('chat.selectConversation')}
 message={t('chat.selectConversationHint')}
 />
 </div>
 ) : (
 <>
 {/* Thread Header */}
 <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center gap-4 relative z-10">
 <button
 type="button"
 onClick={handleBack}
 className="md:hidden w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] dark:hover:bg-[var(--bg-card)] transition-colors shadow-sm"
 aria-label={t('chat.backToInbox')}
 >
 <svg className="w-5 h-5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round">
 <path d="M15 18l-6-6 6-6"/>
 </svg>
 </button>
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-sm shrink-0 text-[0.8rem]">
 {activeConversation ? getParticipantInitials(activeConversation, user?.id) :'??'}
 </div>
 <div className="flex flex-col">
 <h3 className="text-[1.05rem] font-bold text-[var(--text-primary)] leading-tight">
 {activeConversation ? getConversationTitle(activeConversation, user?.id, t) :''}
 </h3>
 <div className="h-4 flex items-center">
 {typingNames.length > 0 ? (
 <p className="text-[0.75rem] font-bold text-brand-500 animate-pulse flex items-center gap-1.5">
 {typingNames.length === 1 ? t('chat.typingOne', { names: typingNames.join(',') }) : t('chat.typingOther', { names: typingNames.join(',') })}
 <span className="flex space-x-0.5 ml-1">
 <span className="w-1 h-1 bg-brand-500 rounded-full animate-bounce"style={{ animationDelay:'0ms'}} />
 <span className="w-1 h-1 bg-brand-500 rounded-full animate-bounce"style={{ animationDelay:'150ms'}} />
 <span className="w-1 h-1 bg-brand-500 rounded-full animate-bounce"style={{ animationDelay:'300ms'}} />
 </span>
 </p>
 ) : (
 <p className="text-[0.75rem] font-bold text-emerald-500 flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
 {t('chat.active')}
 </p>
 )}
 </div>
 </div>
 </div>

 {/* Messages Area */}
 <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 relative z-10">
 {messagesQuery.isLoading ? (
 <div className="h-full flex items-center justify-center">
 <GlassPageLoader label={t('chat.loadingHistory')}/>
 </div>
 ) : messages.length === 0 ? (
 <div className="h-full flex flex-col items-center justify-center opacity-70">
 <div className="w-16 h-16 mb-4 rounded-full bg-[var(--state-hover)] flex items-center justify-center">
 <svg className="w-8 h-8 text-[var(--text-muted)]"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
 </div>
 <p className="text-[0.95rem] font-bold text-[var(--text-muted)]">{t('chat.startConversation')}</p>
 </div>
 ) : (
 messages.map((msg) => {
 const isOwn = msg.senderId === user?.id;
 return (
 <div key={msg.id} className={`flex ${isOwn ?'justify-end' :'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
 <div className={`max-w-[75%] md:max-w-[65%] flex flex-col ${isOwn ?'items-end' :'items-start'}`}>
 {!isOwn && msg.sender && (
 <span className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1 ml-1">
 {msg.sender.firstName} {msg.sender.lastName}
 </span>
 )}
 <div
 className={`px-5 py-3 text-[0.95rem] leading-relaxed shadow-sm ${
 isOwn
 ?'bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-2xl rounded-br-sm'
 :'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-2xl rounded-bl-sm'
}`}
 >
 {msg.content}
 </div>
 <div className={`flex items-center gap-1 mt-1 ${isOwn ?'mr-1' :'ml-1'}`}>
 <span className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">
 {formatTime(msg.createdAt, t)}
 </span>
 {isOwn && msg.isRead && (
 <svg className="w-3.5 h-3.5 text-brand-500"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="3"strokeLinecap="round"strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
 )}
 </div>
 </div>
 </div>
 );
})
 )}
 <div ref={messagesEndRef} className="h-1"/>
 </div>

 {/* Message Input Area */}
 <div className="p-4 bg-[var(--bg-card)] border-t border-[var(--border-subtle)] relative z-10">
 <div className="relative flex items-end gap-3 max-w-4xl mx-auto">
 <GlassTextArea
 value={messageText}
 onChange={(e) => {
 setMessageText(e.target.value);
 handleTyping();
}}
 onKeyDown={(e) => {
 if (e.key ==='Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSend();
}
}}
 placeholder={t('chat.placeholder')}
 className="w-full !min-h-[3.25rem] max-h-32 resize-none !rounded-[1.5rem] !px-5 !py-3.5 custom-scrollbar shadow-sm"
 rows={1}
 style={{ minHeight:'3.25rem'}}
 aria-label={t('chat.placeholder')}
 />
 <GlassButton
 type="button"
 variant="primary"
 onClick={handleSend}
 disabled={!messageText.trim() || sendMessageMutation.isPending}
 loading={sendMessageMutation.isPending}
 className="h-[3.25rem] w-[3.25rem] !p-0 shrink-0 rounded-full"
 aria-label={t('chat.sendMessage')}
 icon={!sendMessageMutation.isPending ? <svg className="w-5 h-5 ml-0.5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><line x1="22"y1="2"x2="11"y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> : undefined}
 >
 </GlassButton>
 </div>
 </div>
 </>
 )}
 </div>

 </div>
 </div>
 {toastNode}
 </div>
 );
}

export default ChatPage;