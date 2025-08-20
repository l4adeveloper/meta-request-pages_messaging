// server.js (Updated with Chat APIs)
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// This is crucial for secure cookies to work behind a proxy like Render's
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(bodyParser.json());
const defaultUserHash = '$2b$10$Cx7EeyTaPcsKfoSZ8daSvOlixUVhhIY1C5DzgvIdJZUHuFs2JVkW.'; 
let users = [
    {
        id: 'default-user-1',
        email: 'aipencilclass@gmail.com',
        password: defaultUserHash,
        metaAccessToken: null
    }
];
// API 1: Đăng ký tài khoản mới cho website
app.post("/auth/register", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (users.find(user => user.email === email)) {
            return res.status(400).json({ error: "Email already exists." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now().toString(), email, password: hashedPassword, metaAccessToken: null }; // Thêm metaAccessToken: null
        users.push(newUser);
        res.status(201).json({ message: "User created successfully." });
    } catch (error) {
        res.status(500).json({ error: "Server error." });
    }
});

// API 2: Đăng nhập và nhận về JWT
app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.find(user => user.email === email);
        if (!user) return res.status(400).json({ error: "Invalid credentials." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials." });

        const payload = { id: user.id, email: user.email };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: "Server error." });
    }
});

// Middleware để xác thực JWT ("Bảo vệ")
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Token is required." });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // req.user sẽ chứa {id, email}
        next();
    } catch (err) {
        return res.status(403).json({ error: "Invalid Token." });
    }
};

// --- OAuth 2.0 & Core Endpoints (Giữ nguyên) ---

const FB_APP_ID = process.env.APP_ID;
const FB_APP_SECRET = process.env.APP_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;



app.get("/meta/connect", verifyToken, (req, res) => {
    const userId = req.user.id; // Lấy ID người dùng từ JWT đã được xác thực
    const state = userId; // Dùng userId làm tham số state để biết ai đang kết nối
    const scope = "pages_show_list,pages_messaging,pages_read_engagement";
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&response_type=code&state=${state}`;
    res.redirect(authUrl);
});

app.get("/meta/callback", async (req, res) => {
    const { code, state } = req.query;
    const userId = state; // Lấy lại userId từ state mà Facebook trả về

    if (!code) return res.status(400).send("Authorization code not found.");
    if (!userId) return res.status(400).send("User state not found.");

    try {
        const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${FB_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${FB_APP_SECRET}&code=${code}`;
        const tokenResponse = await axios.get(tokenUrl);
        const shortLivedToken = tokenResponse.data.access_token;

        const longLivedUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
        const longLivedResponse = await axios.get(longLivedUrl);
        const longLivedToken = longLivedResponse.data.access_token;

        // Tìm người dùng trong "database" và lưu metaAccessToken
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            users[userIndex].metaAccessToken = longLivedToken;
            console.log(`Updated Meta token for user ${userId}`);
        }

        const frontendDashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
        res.redirect(frontendDashboardUrl);
    } catch (error) {
        console.error("Error during Meta callback:", error.response?.data || error.message);
        res.status(500).send("Authentication with Meta failed.");
    }
});

// Helper: Tìm người dùng và lấy Meta Access Token (User Token)
const getMetaTokenFromUser = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.metaAccessToken;
};

// API mới: Kiểm tra trạng thái kết nối Meta
app.get("/meta/status", verifyToken, (req, res) => {
    const metaToken = getMetaTokenFromUser(req.user.id);
    if (metaToken) {
        res.json({ isConnected: true });
    } else {
        res.json({ isConnected: false });
    }
});


app.get("/meta/permissions", verifyToken, async (req, res) => {
    const metaToken = getMetaTokenFromUser(req.user.id);
    if (!metaToken) return res.status(403).json({ error: "Meta account not connected." });

    const url = `https://graph.facebook.com/me/permissions?access_token=${metaToken}`;
    try {
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch permissions." });
    }
});

app.get("/meta/pages", verifyToken, async (req, res) => {
    const metaToken = getMetaTokenFromUser(req.user.id);
    if (!metaToken) return res.status(403).json({ error: "Meta account not connected." });

    const url = `https://graph.facebook.com/me/accounts?fields=name,access_token&access_token=${metaToken}`;
    try {
        const response = await axios.get(url);
        // Lưu page tokens vào CSDL liên kết với user.id nếu cần
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pages." });
    }
});


// Thêm vào file server.js

app.post("/meta/disconnect", verifyToken, async (req, res) => {
    const userId = req.user.id;
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: "User not found." });
    }

    const metaToken = users[userIndex].metaAccessToken;

    // Nếu người dùng chưa kết nối Meta thì không cần làm gì cả
    if (!metaToken) {
        return res.json({ message: "Account is not connected to Meta." });
    }

    try {
        // Bước 1: Yêu cầu Meta thu hồi quyền
        const url = `https://graph.facebook.com/me/permissions?access_token=${metaToken}`;
        await axios.delete(url);
        console.log(`Successfully revoked Meta permissions for user ${userId}`);

    } catch (error) {
        // Kể cả khi gọi API Meta thất bại, chúng ta vẫn nên xóa token phía mình
        console.error("Failed to revoke Meta permissions, but proceeding to disconnect locally.", error.response?.data);
    }

    // Bước 2: Xóa token khỏi "database" của chúng ta
    users[userIndex].metaAccessToken = null;

    res.json({ success: true, message: "Successfully disconnected from Meta." });
});

// --- Webhook Endpoint (Giữ nguyên) ---
app.post("/meta/webhook", (req, res) => {
  console.log("Webhook received:", JSON.stringify(req.body, null, 2));
  // TODO: Xử lý sự kiện webhook real-time (ví dụ: dùng Socket.IO để đẩy tin nhắn mới về frontend)
  res.status(200).send("EVENT_RECEIVED");
});
app.get("/meta/webhook", (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });


// ===================================
// ===== CÁC API MỚI CHO GIAO DIỆN CHAT =====
// ===================================

// API 1: Lấy danh sách cuộc trò chuyện của một Page
app.get("/meta/pages/:pageId/conversations", verifyToken, async (req, res) => {
  const { pageId } = req.params;
  const pageAccessToken = req.headers['x-page-access-token'];
    if (!pageAccessToken) return res.status(403).json({ error: "Meta account not connected." });

  const url = `https://graph.facebook.com/v19.0/${pageId}/conversations`;
  try {
    const response = await axios.get(url, {
      params: {
        fields: 'participants,snippet,updated_time',
        access_token: pageAccessToken,
      },
    });

    // Đơn giản hóa dữ liệu trả về cho frontend
    const formattedConversations = response.data.data.map(conv => {
      const user = conv.participants.data.find(p => p.id !== pageId);
      return {
        id: conv.id, // Conversation ID
        name: user ? user.name : 'Unknown User',
        psid: user ? user.id : null, // Page-Scoped ID, rất quan trọng để gửi tin nhắn
        lastMessage: conv.snippet,
        updatedTime: conv.updated_time,
      };
    });

    res.json(formattedConversations);
  } catch (error) {
    console.error("Error fetching conversations:", error.response?.data);
    res.status(500).json({ error: "Failed to fetch conversations." });
  }
});


// API 2: Lấy lịch sử tin nhắn của một cuộc trò chuyện
app.get("/meta/conversations/:conversationId/messages", verifyToken, async (req, res) => {
  const { conversationId } = req.params;
  const { pageId } = req.query; // Frontend cần gửi pageId qua query param

  if (!pageId) {
    return res.status(400).json({ error: "pageId is required as a query parameter." });
  }
  
  const pageAccessToken = req.headers['x-page-access-token'];
  if (!pageAccessToken) {
    return res.status(403).json({ error: "Page access token not found." });
  }

  const url = `https://graph.facebook.com/v19.0/${conversationId}/messages`;
  try {
    const response = await axios.get(url, {
      params: {
        fields: 'message,from,created_time',
        access_token: pageAccessToken,
      },
    });

    const formattedMessages = response.data.data.map(msg => ({
      id: msg.id,
      text: msg.message,
      sender: msg.from.id === pageId ? 'me' : 'user', // Xác định người gửi
      createdTime: msg.created_time,
    })).reverse(); // Đảo ngược để tin nhắn mới nhất ở dưới cùng

    res.json(formattedMessages);
  } catch (error) {
    console.error("Error fetching messages:", error.response?.data);
    res.status(500).json({ error: "Failed to fetch messages." });
  }
});


// API 3: Cập nhật API gửi tin nhắn
app.post("/meta/send-message", verifyToken, async (req, res) => {
  const { pageId, psid, message } = req.body; // psid thay vì conversationId

  if (!pageId || !psid || !message) {
    return res.status(400).json({ error: "pageId, psid, and message are required." });
  }

  const pageAccessToken = req.headers['x-page-access-token'];
  if (!pageAccessToken) {
    return res.status(403).json({ error: "Page access token not found." });
  }

  const url = `https://graph.facebook.com/v19.0/me/messages`;
  const body = {
    recipient: { id: psid },
    message: { text: message },
    messaging_type: "RESPONSE",
  };

  try {
    await axios.post(url, body, { params: { access_token: pageAccessToken } });
    res.json({ success: true, message: "Message sent successfully." });
  } catch (error) {
    console.error("Error sending message:", error.response?.data?.error);
    res.status(500).json({ error: error.response?.data?.error || "Failed to send message." });
  }
});


app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});