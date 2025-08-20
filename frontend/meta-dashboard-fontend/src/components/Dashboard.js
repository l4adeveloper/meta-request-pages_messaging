import React, { useState, useEffect } from "react";

// --- Styling (Giữ nguyên và bổ sung) ---
const styles = {
    container: {
        display: 'flex',
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f0f2f5',
    },
    sidebar: {
        width: '320px', // Tăng nhẹ chiều rộng để có thêm không gian
        borderRight: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
    },
    sidebarHeader: {
        padding: '15px',
        borderBottom: '1px solid #ddd',
    },
    pageSelector: {
        width: '100%',
        padding: '8px',
        fontSize: '16px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        marginTop: '10px',
    },
    connectButton: {
        width: '100%',
        padding: '12px',
        fontSize: '16px',
        backgroundColor: '#1877f2',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
    },
    disconnectButton: {
        width: '100%',
        padding: '8px',
        fontSize: '14px',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        marginBottom: '10px',
    },
    permissionsContainer: {
        padding: '10px 0 0 0',
        fontSize: '12px',
        color: '#555'
    },
    // Các styles còn lại giữ nguyên
    conversationList: { flex: 1, overflowY: 'auto' },
    conversationItem: { padding: '15px', borderBottom: '1px solid #eee', cursor: 'pointer' },
    conversationItemActive: { backgroundColor: '#e6f3ff' },
    conversationName: { fontWeight: 'bold' },
    lastMessage: { color: '#666', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    chatWindow: { flex: 1, display: 'flex', flexDirection: 'column' },
    chatHeader: { padding: '15px', borderBottom: '1px solid #ddd', fontWeight: 'bold', backgroundColor: '#f5f5f5' },
    messageArea: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    messageBubble: { maxWidth: '60%', padding: '10px 15px', borderRadius: '20px', marginBottom: '10px' },
    myMessage: { backgroundColor: '#0084ff', color: 'white', alignSelf: 'flex-end' },
    theirMessage: { backgroundColor: '#e4e6eb', color: 'black', alignSelf: 'flex-start' },
    messageInputContainer: { display: 'flex', padding: '10px', borderTop: '1px solid #ddd', backgroundColor: 'white' },
    messageInput: { flex: 1, padding: '10px', fontSize: '16px', borderRadius: '20px', border: '1px solid #ccc', marginRight: '10px' },
    sendButton: { padding: '10px 20px', borderRadius: '20px', border: 'none', backgroundColor: '#0084ff', color: 'white', cursor: 'pointer', fontSize: '16px' },
    placeholder: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888', fontSize: '20px' }
};


function Dashboard() {
    // --- State ---
    const [isConnected, setIsConnected] = useState(false); // ADDED: State quản lý kết nối
    const [permissions, setPermissions] = useState([]); // ADDED: State cho permissions
    const [pages, setPages] = useState([]);
    const [selectedPage, setSelectedPage] = useState('');
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');

    const API_BASE_URL = "https://backend-meta-request-pages-messaging.onrender.com";

    // --- Effects ---
    // MODIFIED: useEffect này giờ sẽ kiểm tra trạng thái đăng nhập ban đầu
    useEffect(() => {
        fetch(`${API_BASE_URL}/permissions`, { credentials: "include" })
            .then(res => {
                if (!res.ok) { // Nếu nhận lỗi (ví dụ: 401), coi như chưa đăng nhập
                    throw new Error('Not authenticated');
                }
                return res.json();
            })
            .then(data => {
                setPermissions(data.data || []);
                const hasMessagingPermission = (data.data || []).some(p => p.permission === "pages_messaging" && p.status === "granted");
                if (hasMessagingPermission) {
                    setIsConnected(true);
                    // Nếu đã kết nối, tự động fetch pages
                    fetchPages();
                } else {
                    setIsConnected(false);
                }
            })
            .catch(err => {
                console.log(err.message);
                setIsConnected(false);
            });
    }, []);

    // MODIFIED: Tách fetchPages ra thành một hàm riêng
    const fetchPages = () => {
        fetch(`${API_BASE_URL}/pages`, { credentials: "include" })
            .then(res => res.json())
            .then(data => {
                if (!data.error) setPages(data.data || []);
            })
            .catch(err => console.error("Fetch pages failed:", err));
    };

    // Effect lấy conversations khi chọn page (giữ nguyên)
    useEffect(() => {
        if (selectedPage && isConnected) {
            setSelectedConversation(null);
            setMessages([]);
            fetch(`${API_BASE_URL}/pages/${selectedPage}/conversations`, { credentials: "include" })
                .then(res => res.json())
                .then(data => setConversations(data.error ? [] : data))
                .catch(err => console.error("Fetch conversations failed:", err));
        } else {
            setConversations([]);
        }
    }, [selectedPage, isConnected]);

    // Effect lấy messages khi chọn conversation (giữ nguyên)
    useEffect(() => {
        if (selectedConversation && isConnected) {
            const url = `${API_BASE_URL}/conversations/${selectedConversation.id}/messages?pageId=${selectedPage}`;
            fetch(url, { credentials: "include" })
                .then(res => res.json())
                .then(data => setMessages(data.error ? [] : data))
                .catch(err => console.error("Fetch messages failed:", err));
        } else {
            setMessages([]);
        }
    }, [selectedConversation, isConnected]);


    // --- Handlers ---
    // ADDED: Các hàm xử lý connect và disconnect
    const handleConnectMeta = () => {
        window.location.href = `${API_BASE_URL}/auth/login`;
    };

    const handleDisconnect = () => {
        fetch(`${API_BASE_URL}/disconnect`, { method: "POST", credentials: "include" })
            .then(() => {
                // Reset toàn bộ state về trạng thái ban đầu
                setIsConnected(false);
                setPermissions([]);
                setPages([]);
                setSelectedPage('');
                setConversations([]);
                setSelectedConversation(null);
                setMessages([]);
            });
    };

    // Handler gửi tin nhắn (giữ nguyên)
    const handleSendMessage = () => {
        if (!newMessage.trim() || !selectedConversation) return;
        const tempId = Date.now();
        const messageToSend = { id: tempId, text: newMessage, sender: 'me' };
        setMessages(prevMessages => [...prevMessages, messageToSend]);
        setNewMessage('');
        fetch(`${API_BASE_URL}/send-message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ pageId: selectedPage, psid: selectedConversation.psid, message: newMessage })
        }).catch(err => console.error("Send message request failed:", err));
    };


    // --- Render ---
    return (
        <div style={styles.container}>
            <div style={styles.sidebar}>
                <div style={styles.sidebarHeader}>
                    {isConnected ? (
                        <>
                            <button style={styles.disconnectButton} onClick={handleDisconnect}>Disconnect Meta Account</button>
                            <div style={styles.permissionsContainer}>
                                <strong>Permissions:</strong>
                                <ul style={{ margin: '5px 0 0', paddingLeft: '20px' }}>
                                    {permissions.map(p => (
                                        <li key={p.permission}>
                                            {p.permission}: <span style={{ color: p.status === 'granted' ? 'green' : 'red' }}>{p.status}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <select
                                style={styles.pageSelector}
                                value={selectedPage}
                                onChange={e => setSelectedPage(e.target.value)}
                            >
                                <option value="">-- Chọn Page --</option>
                                {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </>
                    ) : (
                        <button style={styles.connectButton} onClick={handleConnectMeta}>Connect Meta Account</button>
                    )}
                </div>
                <div style={styles.conversationList}>
                    {conversations.map(conv => (
                        <div key={conv.id} style={{ ...styles.conversationItem, ...(selectedConversation?.id === conv.id && styles.conversationItemActive) }} onClick={() => setSelectedConversation(conv)}>
                            <div style={styles.conversationName}>{conv.name}</div>
                            <div style={styles.lastMessage}>{conv.lastMessage}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={styles.chatWindow}>
                {isConnected ? (
                    selectedConversation ? (
                        <>
                            <div style={styles.chatHeader}>{selectedConversation.name}</div>
                            <div style={styles.messageArea}>
                                {messages.map(msg => (
                                    <div key={msg.id} style={{ ...styles.messageBubble, ...(msg.sender === 'me' ? styles.myMessage : styles.theirMessage) }}>
                                        {msg.text}
                                    </div>
                                ))}
                            </div>
                            <div style={styles.messageInputContainer}>
                                <input type="text" style={styles.messageInput} placeholder="Nhập tin nhắn..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} />
                                <button style={styles.sendButton} onClick={handleSendMessage}>Gửi</button>
                            </div>
                        </>
                    ) : (
                        <div style={styles.placeholder}>Vui lòng chọn một cuộc trò chuyện để bắt đầu</div>
                    )
                ) : (
                     <div style={styles.placeholder}>Vui lòng kết nối với tài khoản Meta để sử dụng</div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;