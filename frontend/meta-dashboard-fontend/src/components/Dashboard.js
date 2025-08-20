import React, { useState, useEffect } from "react";

function Dashboard() {
  const [permissions, setPermissions] = useState([]);
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);

  const fetchPermissions = () => {
    fetch("https://localhost:5000/permissions", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        setPermissions(data.data || []);
        setConnected((data.data || []).some(p => p.permission === "pages_messaging" && p.status === "granted"));
      });
  };

  const fetchPages = () => {
    fetch("https://localhost:5000/pages", { credentials: "include" })
      .then(res => res.json())
      .then(data => setPages(data.data || []));
  };

  useEffect(() => {
    fetchPermissions();
    fetchPages();
  }, []);

  const handleConnectMeta = () => {
    window.location.href = "https://localhost:5000/auth/login";
  };

  const handleDisconnect = () => {
    fetch("https://localhost:5000/disconnect", { method: "POST", credentials: "include" })
      .then(() => {
        setConnected(false);
        setPermissions([]);
        setPages([]);
        alert("Disconnected");
      });
  };

  const handleSendMessage = () => {
    if (!selectedPage) return alert("Chọn Page trước!");
    fetch("https://localhost:5000/send-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pageId: selectedPage, message })
    })
      .then(res => res.json())
      .then(() => alert("Message sent"))
      .catch(() => alert("Error sending message"));
  };

  return (
    <div style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#3b5998" }}>Dashboard - Connect Meta</h1>

      {!connected ? (
        <button
          onClick={handleConnectMeta}
          style={{ backgroundColor: "#1877f2", color: "white", padding: "10px 20px", border: "none", borderRadius: 5, cursor: "pointer", marginBottom: 20 }}
        >
          Connect Meta Account
        </button>
      ) : (
        <button
          onClick={handleDisconnect}
          style={{ backgroundColor: "#dc3545", color: "white", padding: "10px 20px", border: "none", borderRadius: 5, cursor: "pointer", marginBottom: 20 }}
        >
          Disconnect Meta Account
        </button>
      )}

      <h2>Permissions</h2>
      <ul>
        {permissions.map(p => (
          <li key={p.permission}>
            {p.permission}: <span style={{ color: p.status === "granted" ? "green" : "red" }}>{p.status}</span>
          </li>
        ))}
      </ul>

      <h2>Pages</h2>
      <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)} style={{ padding: 5, width: 250 }}>
        <option value="">-- Chọn Page --</option>
        {pages.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <div style={{ marginTop: 15 }}>
        <input
          type="text"
          placeholder="Nhập tin nhắn demo"
          value={message}
          onChange={e => setMessage(e.target.value)}
          style={{ padding: 5, width: 300 }}
        />
        <button
          onClick={handleSendMessage}
          style={{ marginLeft: 10, padding: "5px 15px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 5, cursor: "pointer" }}
        >
          Gửi Message Demo
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
