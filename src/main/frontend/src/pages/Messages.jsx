import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import * as messageService from '../services/messageService';
import { MessageCircle, Send } from 'lucide-react';

export const Messages = () => {
    const { user } = useContext(AuthContext);
    const [partners, setPartners] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await messageService.getConversationPartners();
                setPartners(data);
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        fetch();
    }, []);

    const openConversation = async (partnerId) => {
        setSelectedUser(partnerId);
        try {
            const msgs = await messageService.getConversation(partnerId);
            setMessages(msgs);
            await messageService.markMessagesAsRead(partnerId);
        } catch (e) { console.error(e); }
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedUser) return;
        try {
            const msg = await messageService.sendMessage(selectedUser, newMessage);
            setMessages(m => [...m, msg]);
            setNewMessage('');
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="flex justify-center mt-4"><div className="spinner"></div></div>;

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem',
                background: 'linear-gradient(135deg, #f8fafc, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <MessageCircle size={28} style={{ display: 'inline', verticalAlign: 'middle' }} /> Messages
            </h1>

            <div className="flex" style={{ gap: '1rem', height: '500px' }}>
                {/* Partners list */}
                <div className="glass-panel" style={{ width: '280px', overflow: 'auto', padding: '0.5rem', flexShrink: 0 }}>
                    {partners.length === 0 ? (
                        <p className="text-secondary text-center" style={{ padding: '2rem', fontSize: '0.85rem' }}>No conversations yet</p>
                    ) : (
                        partners.map((p, i) => (
                            <div key={i} onClick={() => openConversation(p.id || p)} style={{
                                padding: '0.8rem', cursor: 'pointer', borderRadius: '8px',
                                background: selectedUser === (p.id || p) ? 'rgba(99,102,241,0.15)' : 'transparent',
                                marginBottom: '0.25rem', transition: 'background 0.2s'
                            }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.fullName || `User #${p.id || p}`}</div>
                                <div className="text-secondary" style={{ fontSize: '0.78rem' }}>{p.email || ''}</div>
                            </div>
                        ))
                    )}
                </div>

                {/* Chat area */}
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {!selectedUser ? (
                        <div className="flex items-center justify-center" style={{ flex: 1 }}>
                            <p className="text-secondary">Select a conversation to start messaging</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
                                {messages.map(msg => (
                                    <div key={msg.id} style={{
                                        display: 'flex',
                                        justifyContent: msg.sender?.id === user?.id ? 'flex-end' : 'flex-start',
                                        marginBottom: '0.75rem'
                                    }}>
                                        <div style={{
                                            maxWidth: '70%', padding: '0.6rem 1rem', borderRadius: '12px',
                                            background: msg.sender?.id === user?.id
                                                ? 'linear-gradient(135deg, var(--accent-color), #4f46e5)'
                                                : 'rgba(255,255,255,0.08)',
                                            fontSize: '0.9rem'
                                        }}>
                                            {msg.content}
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.25rem' }}>
                                                {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <div className="flex gap-2">
                                    <input className="form-input" value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                                        placeholder="Type a message..." style={{ flex: 1 }} />
                                    <button className="btn btn-primary" onClick={handleSend}><Send size={16} /></button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
