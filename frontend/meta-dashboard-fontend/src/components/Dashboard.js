// src/components/Dashboard.js (Updated with new UI)
import React, { useState, useEffect } from "react";

// --- Styling ---
// Tất cả CSS được viết trực tiếp ở đây để dễ dàng tùy chỉnh
const styles = {
  container: {
    display: "flex",
    height: "100vh",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f0f2f5",
  },
  sidebar: {
    width: "300px",
    borderRight: "1px solid #ddd",
    display: "flex",
    flexDirection: "column",
  },
  sidebarHeader: {
    padding: "10px",
    borderBottom: "1px solid #ddd",
    backgroundColor: "white",
  },
  pageSelector: {
    width: "100%",
    padding: "8px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "1px solid #ccc",
  },
  conversationList: {
    flex: 1,
    overflowY: "auto",
  },
  conversationItem: {
    padding: "15px",
    borderBottom: "1px solid #eee",
    cursor: "pointer",
    backgroundColor: "white",
  },
  conversationItemActive: {
    backgroundColor: "#e6f3ff",
  },
  conversationName: {
    fontWeight: "bold",
  },
  lastMessage: {
    color: "#666",
    fontSize: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  chatWindow: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  chatHeader: {
    padding: "15px",
    borderBottom: "1px solid #ddd",
    fontWeight: "bold",
    backgroundColor: "#f5f5f5",
  },
  messageArea: {
    flex: 1,
    padding: "20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },
  messageBubble: {
    maxWidth: "60%",
    padding: "10px 15px",
    borderRadius: "20px",
    marginBottom: "10px",
  },
  myMessage: {
    backgroundColor: "#0084ff",
    color: "white",
    alignSelf: "flex-end",
  },
  theirMessage: {
    backgroundColor: "#e4e6eb",
    color: "black",
    alignSelf: "flex-start",
  },
  messageInputContainer: {
    display: "flex",
    padding: "10px",
    borderTop: "1px solid #ddd",
    backgroundColor: "white",
  },
  messageInput: {
    flex: 1,
    padding: "10px",
    fontSize: "16px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    marginRight: "10px",
  },
  sendButton: {
    padding: "10px 20px",
    borderRadius: "20px",
    border: "none",
    backgroundColor: "#0084ff",
    color: "white",
    cursor: "pointer",
    fontSize: "16px",
  },
  placeholder: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    color: "#888",
    fontSize: "20px",
  },
};

// --- Mock Data ---
// Dữ liệu giả để hiển thị. Bạn sẽ thay thế bằng API thật.
const mockConversations = [
  {
    id: "conv1",
    name: "Nguyễn Văn A",
    lastMessage: "Chào bạn, tôi cần tư vấn sản phẩm...",
  },
  {
    id: "conv2",
    name: "Trần Thị B",
    lastMessage: "Shop ơi, cho mình hỏi về chính sách...",
  },
  { id: "conv3", name: "Lê Văn C", lastMessage: "Cảm ơn shop nhiều nhé!" },
];

const mockMessages = {
  conv1: [
    {
      id: "msg1",
      text: "Chào bạn, tôi cần tư vấn sản phẩm A.",
      sender: "user",
    },
    {
      id: "msg2",
      text: "Chào bạn, sản phẩm A đang có sẵn ạ. Bạn cần chúng tôi hỗ trợ gì thêm?",
      sender: "me",
    },
  ],
  conv2: [
    {
      id: "msg3",
      text: "Shop ơi, cho mình hỏi về chính sách bảo hành.",
      sender: "user",
    },
  ],
  conv3: [],
};

function Dashboard() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");

  // State mới cho giao diện chat
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // Lấy danh sách Pages (giữ nguyên)
  useEffect(() => {
    // TODO: Thay thế bằng API thật
    fetch("https://backend-meta-request-pages-messaging.onrender.com/pages", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setPages(data.data || []));
  }, []);

  // Lấy danh sách cuộc trò chuyện khi chọn một Page
  useEffect(() => {
    if (selectedPage) {
      console.log(`Fetching conversations for page: ${selectedPage}`);
      // TODO: Thay thế bằng API thật để lấy danh sách cuộc trò chuyện
      fetch(
        `https://backend-meta-request-pages-messaging.onrender.com/pages/${selectedPage}/conversations`,
        { credentials: "include" }
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.error("Error fetching conversations:", data.error);
            setConversations([]);
          } else setConversations(data);
        })
        .catch((error) =>
          console.error("Error fetching conversations:", error)
        );
    } else {
      setConversations([]);
    }
  }, [selectedPage]);

  // Lấy tin nhắn khi chọn một cuộc trò chuyện
  useEffect(() => {
    if (selectedConversation) {
      console.log(
        `Fetching messages for conversation: ${selectedConversation.id}`
      );
      // TODO: Thay thế bằng API thật để lấy lịch sử tin nhắn
      const url = `https://backend-meta-request-pages-messaging.onrender.com/conversations/${selectedConversation.id}/messages?pageId=${selectedPage}`;
      fetch(url, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.error("Error fetching messages:", data.error);
            setMessages([]);
          } else setMessages(data);
        })
        .catch((error) => console.error("Error fetching messages:", error));
    } else {
      setMessages([]);
    }
  }, [selectedConversation]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const messageToSend = {
      id: Date.now(), // ID tạm thời
      text: newMessage,
      sender: "me",
    };

    setMessages([...messages, messageToSend]);
    setNewMessage("");

    // TODO: Gọi API thật để gửi tin nhắn
    fetch(
      "https://backend-meta-request-pages-messaging.onrender.com/send-message",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pageId: selectedPage,
          psid: selectedConversation.psid,
          message: newMessage,
        }),
      }
    );
  };

  return (
    <div style={styles.container}>
      {/* Cột Trái: Danh sách cuộc trò chuyện */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <select
            style={styles.pageSelector}
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value)}
          >
            <option value="">-- Chọn Page --</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.conversationList}>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              style={{
                ...styles.conversationItem,
                ...(selectedConversation?.id === conv.id &&
                  styles.conversationItemActive),
              }}
              onClick={() => setSelectedConversation(conv)}
            >
              <div style={styles.conversationName}>{conv.name}</div>
              <div style={styles.lastMessage}>{conv.lastMessage}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cột Phải: Cửa sổ chat */}
      <div style={styles.chatWindow}>
        {selectedConversation ? (
          <>
            <div style={styles.chatHeader}>{selectedConversation.name}</div>
            <div style={styles.messageArea}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageBubble,
                    ...(msg.sender === "me"
                      ? styles.myMessage
                      : styles.theirMessage),
                  }}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <div style={styles.messageInputContainer}>
              <input
                type="text"
                style={styles.messageInput}
                placeholder="Nhập tin nhắn..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <button style={styles.sendButton} onClick={handleSendMessage}>
                Gửi
              </button>
            </div>
          </>
        ) : (
          <div style={styles.placeholder}>
            Vui lòng chọn một cuộc trò chuyện để bắt đầu
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

// import React, { useState, useEffect } from "react";

// const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// function Dashboard() {
//   const [permissions, setPermissions] = useState([]);
//   const [pages, setPages] = useState([]);
//   const [selectedPage, setSelectedPage] = useState("");
//   const [message, setMessage] = useState("");
//   const [connected, setConnected] = useState(false);

//   const getApiUrl = (path) => `${API_URL}${path}`;

//   const fetchPermissions = () => {
//     fetch(getApiUrl("/permissions"), { credentials: "include" })
//       .then(res => res.json())
//       .then(data => {
//         if (data.error) return alert(data.error);
//         setPermissions(data.data || []);
//         setConnected((data.data || []).some(p => p.permission === "pages_messaging" && p.status === "granted"));
//       });
//   };

//   const fetchPages = () => {
//     fetch(getApiUrl("/pages"), { credentials: "include" })
//       .then(res => res.json())
//       .then(data => setPages(data.data || []));
//   };

//   useEffect(() => {
//     fetchPermissions();
//     fetchPages();
//   }, []);

//   const handleConnectMeta = () => {
//     window.location.href = getApiUrl("/auth/login");
//   };

//   const handleDisconnect = () => {
//     fetch(getApiUrl("/disconnect"), { method: "POST", credentials: "include" })
//       .then(() => {
//         setConnected(false);
//         setPermissions([]);
//         setPages([]);
//         alert("Disconnected");
//       });
//   };

//   const handleSendMessage = () => {
//     if (!selectedPage) return alert("Chọn Page trước!");
//     fetch(getApiUrl("/send-message"), {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       credentials: "include",
//       body: JSON.stringify({ pageId: selectedPage, message })
//     })
//       .then(res => res.json())
//       .then(() => {console.log ("ĐÃ GỬI TIN NHẮN");alert("Messagea sent")})
//       .catch(() => alert("Error sendinga message"));
//   };

//   return (
//     <div style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
//       <h1 style={{ color: "#3b5998" }}>Dashboard - Connect Meta</h1>

//       {!connected ? (
//         <button
//           onClick={handleConnectMeta}
//           style={{ backgroundColor: "#1877f2", color: "white", padding: "10px 20px", border: "none", borderRadius: 5, cursor: "pointer", marginBottom: 20 }}
//         >
//           Connect Meta Account
//         </button>
//       ) : (
//         <button
//           onClick={handleDisconnect}
//           style={{ backgroundColor: "#dc3545", color: "white", padding: "10px 20px", border: "none", borderRadius: 5, cursor: "pointer", marginBottom: 20 }}
//         >
//           Disconnect Meta Account
//         </button>
//       )}

//       <h2>Permissions</h2>
//       <ul>
//         {permissions.map(p => (
//           <li key={p.permission}>
//             {p.permission}: <span style={{ color: p.status === "granted" ? "green" : "red" }}>{p.status}</span>
//           </li>
//         ))}
//       </ul>

//       <h2>Pages</h2>
//       <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)} style={{ padding: 5, width: 250 }}>
//         <option value="">-- Chọn Page --</option>
//         {pages.map(p => (
//           <option key={p.id} value={p.id}>{p.name}</option>
//         ))}
//       </select>

//       <div style={{ marginTop: 15 }}>
//         <input
//           type="text"
//           placeholder="Nhập tin nhắn demo"
//           value={message}
//           onChange={e => setMessage(e.target.value)}
//           style={{ padding: 5, width: 300 }}
//         />
//         <button
//           onClick={handleSendMessage}
//           style={{ marginLeft: 10, padding: "5px 15px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 5, cursor: "pointer" }}
//         >
//           Gửi Message Demo
//         </button>
//       </div>
//     </div>
//   );
// }

// export default Dashboard;
