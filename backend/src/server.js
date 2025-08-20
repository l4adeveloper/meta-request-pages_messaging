// server.js (Updated with Chat APIs)
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// This is crucial for secure cookies to work behind a proxy like Render's
app.set('trust proxy', 1);

// Middleware
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(bodyParser.json());

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

// --- OAuth 2.0 & Core Endpoints (Giữ nguyên) ---

const FB_APP_ID = process.env.APP_ID;
const FB_APP_SECRET = process.env.APP_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.get("/auth/login", (req, res) => {
  const scope = "pages_show_list,pages_messaging,pages_read_engagement";
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&response_type=code`;
  res.redirect(authUrl);
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Authorization code not found.");
  try {
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${FB_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${FB_APP_SECRET}&code=${code}`;
    const tokenResponse = await axios.get(tokenUrl);
    const shortLivedToken = tokenResponse.data.access_token;

    const longLivedUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    const longLivedResponse = await axios.get(longLivedUrl);
    const longLivedToken = longLivedResponse.data.access_token;

    req.session.accessToken = longLivedToken;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Failed to save session.");
      }
      const frontendDashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
      res.redirect(frontendDashboardUrl);
    });
  } catch (error) {
    console.error("Error during auth callback:", error.response?.data || error.message);
    res.status(500).send("Authentication failed.");
  }
});

const requireAuth = (req, res, next) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

app.get("/permissions", requireAuth, async (req, res) => {
  const userToken = req.session.accessToken;
  const url = `https://graph.facebook.com/me/permissions?access_token=${userToken}`;
  try {
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/pages", requireAuth, async (req, res) => {
  const userToken = req.session.accessToken;
  const url = `https://graph.facebook.com/me/accounts?fields=name,access_token&access_token=${userToken}`;
  try {
    const response = await axios.get(url);
    req.session.pages = response.data.data;
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/disconnect", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Could not log out.");
    res.clearCookie("connect.sid");
    res.status(200).send("Disconnected");
  });
});

// --- Webhook Endpoint (Giữ nguyên) ---
app.post("/webhook", (req, res) => {
  console.log("Webhook received:", JSON.stringify(req.body, null, 2));
  // TODO: Xử lý sự kiện webhook real-time (ví dụ: dùng Socket.IO để đẩy tin nhắn mới về frontend)
  res.status(200).send("EVENT_RECEIVED");
});
app.get("/webhook", (req, res) => {
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

// Helper: Lấy Page Access Token từ session
const getPageAccessToken = (req, pageId) => {
  const page = req.session.pages?.find((p) => p.id === pageId);
  return page?.access_token;
};


// API 1: Lấy danh sách cuộc trò chuyện của một Page
app.get("/pages/:pageId/conversations", requireAuth, async (req, res) => {
  const { pageId } = req.params;
  const pageAccessToken = getPageAccessToken(req, pageId);

  if (!pageAccessToken) {
    return res.status(403).json({ error: "Page access token not found for this page." });
  }

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
app.get("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const { conversationId } = req.params;
  const { pageId } = req.query; // Frontend cần gửi pageId qua query param

  if (!pageId) {
    return res.status(400).json({ error: "pageId is required as a query parameter." });
  }
  
  const pageAccessToken = getPageAccessToken(req, pageId);
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
app.post("/send-message", requireAuth, async (req, res) => {
  const { pageId, psid, message } = req.body; // psid thay vì conversationId

  if (!pageId || !psid || !message) {
    return res.status(400).json({ error: "pageId, psid, and message are required." });
  }

  const pageAccessToken = getPageAccessToken(req, pageId);
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