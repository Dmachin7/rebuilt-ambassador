import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI, messagesAPI } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Button, Select, Spinner } from '../../components/ui/index.jsx';
import { formatTime, formatDate } from '../../utils/formatters.js';
import { Send, MessageSquare } from 'lucide-react';

export default function AdminMessages() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(eventId || '');
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    eventsAPI.list().then(setEvents);
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    setLoading(true);
    messagesAPI.list(selectedEventId).then(setMessages).finally(() => setLoading(false));
    const interval = setInterval(() => {
      messagesAPI.list(selectedEventId).then(setMessages);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedEventId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMsg.trim() || !selectedEventId) return;
    setSending(true);
    try {
      const msg = await messagesAPI.send(selectedEventId, newMsg);
      setMessages((prev) => [...prev, msg]);
      setNewMsg('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Event Messaging</h1>
        <p className="text-sm text-slate-500">Communicate with ambassadors by event</p>
      </div>

      {/* Event selector */}
      <div className="max-w-sm">
        <Select
          value={selectedEventId}
          onChange={(e) => { setSelectedEventId(e.target.value); navigate(`/admin/messages/${e.target.value}`); }}
        >
          <option value="">— Select an event —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title} ({new Date(e.date).toLocaleDateString()})</option>
          ))}
        </Select>
      </div>

      {selectedEventId ? (
        <Card className="flex flex-col" style={{ height: '60vh' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-mint-500" />
              <span className="font-medium text-sm text-slate-800">{selectedEvent?.title}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : messages.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-8">No messages yet. Start the conversation!</div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.sender.id === user?.id;
                const showDate = i === 0 || formatDate(messages[i - 1].createdAt) !== formatDate(msg.createdAt);
                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className="text-center">
                        <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{formatDate(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!isMe && (
                        <div className="w-7 h-7 bg-mint-100 rounded-full flex items-center justify-center text-xs font-medium text-mint-700 shrink-0 mt-1">
                          {msg.sender.firstName[0]}{msg.sender.lastName[0]}
                        </div>
                      )}
                      <div className={`max-w-xs lg:max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        {!isMe && (
                          <span className="text-xs text-slate-500">
                            {msg.sender.firstName} {msg.sender.lastName}
                            {msg.sender.role === 'ADMIN' && <span className="ml-1 text-mint-600">(Admin)</span>}
                          </span>
                        )}
                        <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-mint-300 text-slate-800 rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                          {msg.content}
                        </div>
                        <span className="text-xs text-slate-400">{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
            <textarea
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send)"
              className="flex-1 input-field resize-none h-10 text-sm py-2"
              rows={1}
            />
            <Button onClick={handleSend} disabled={sending || !newMsg.trim()} size="sm">
              <Send size={15} />
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <MessageSquare size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Select an event to view its message thread</p>
        </Card>
      )}
    </div>
  );
}
