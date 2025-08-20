// server.js (Updated)
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session"); // Thêm session
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT ||5000;
app.set('trust proxy', 1); 
// Middleware

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(bodyParser.json());
// Cấu hình Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === "production", // chỉ bật secure khi deploy
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" }, // Chuyển thành true nếu dùng HTTPS
  })
);



// ===================================
// ===== PHẦN OAUTH 2.0 (MỚI) =====
// ===================================

const FB_APP_ID = process.env.APP_ID;
const FB_APP_SECRET = process.env.APP_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Endpoint 1: Bắt đầu đăng nhập, chuyển hướng người dùng sang Meta
app.get("/auth/login", (req, res) => {
  const scope = "pages_show_list,pages_messaging,pages_read_engagement";
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&response_type=code`;
  res.redirect(authUrl);
});

// Endpoint 2: Meta gọi lại sau khi người dùng đồng ý
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code not found.");
  }

  try {
    // Đổi code lấy short-lived user access token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${FB_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${FB_APP_SECRET}&code=${code}`;
    const tokenResponse = await axios.get(tokenUrl);
    const shortLivedToken = tokenResponse.data.access_token;

    // Đổi short-lived token lấy long-lived token
    const longLivedUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    const longLivedResponse = await axios.get(longLivedUrl);
    const longLivedToken = longLivedResponse.data.access_token;

    // Lưu long-lived token vào session
    req.session.accessToken = longLivedToken;
    console.log("User logged in, token stored in session.");

    // Chuyển hướng về trang Dashboard của frontend
    const frontendDashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard`;
    res.redirect(frontendDashboardUrl);
  } catch (error) {
    console.error(
      "Error during auth callback:",
      error.response?.data || error.message
    );
    res.status(500).send("Authentication failed.");
  }
});

// Middleware kiểm tra đã đăng nhập chưa
const requireAuth = (req, res, next) => {
  // console.log("Đang authorize:");
  // console.log("REQ SESSION:", req.session);
  if (!req.session.accessToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

// Endpoint 3: Lấy danh sách quyền đã được cấp
app.get("/permissions", requireAuth, async (req, res) => {
  // ===== THÊM 3 DÒNG NÀY VÀO =====
  /* console.log("=====================");
   console.log("SESSION ID KHI GỌI /permissions:", req.sessionID);
  console.log("ACCESS TOKEN TRONG SESSION:", req.session.accessToken);*/
  // ================================
  const userToken = req.session.accessToken;
  const url = `https://graph.facebook.com/me/permissions?access_token=${userToken}`;
  try {
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint 4: Lấy danh sách Page người dùng quản lý
app.get("/pages", requireAuth, async (req, res) => {
  const userToken = req.session.accessToken;
  // Yêu cầu lấy cả page access token cho từng trang
  const url = `https://graph.facebook.com/me/accounts?fields=name,access_token&access_token=${userToken}`;
  try {
    const response = await axios.get(url);
    // Lưu danh sách page và token của chúng vào session để dùng sau
    console.log ("RESPONSE DATA", response.data);
    req.session.pages = response.data.data;
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint 5: Ngắt kết nối
app.post("/disconnect", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out.");
    }
    res.clearCookie("connect.sid"); // Tên cookie mặc định của express-session
    res.status(200).send("Disconnected");
  });
});

// ===================================
// ===== CÁC ENDPOINT CŨ (CẬP NHẬT) =====
// ===================================

let psidList = [];

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

app.post("/webhook", (req, res) => {
  console.log("!!! POST WEBHOOK ĐÃ ĐƯỢC GỌI TỚI !!!"); 
  const body = req.body;
    console.log(JSON.stringify(body, null, 2)); // In ra toàn bộ nội dung webhook

  if (body.object === "page") {
    body.entry.forEach(function (entry) {
      const messaging = entry.messaging;
      messaging.forEach((event) => {
        if (event.sender && event.sender.id) {
          const psid = event.sender.id;
          if (!psidList.includes(psid)) psidList.push(psid);
          console.log(
            "Received message from PSID:",
            psid,
            "Text:",
            event.message?.text
          );
        }
      });
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Cập nhật API gửi tin nhắn để dùng Page Access Token từ session
app.post("/send-message", requireAuth, async (req, res) => {
  const { pageId, message } = req.body;

  // Lấy đúng page access token của trang đã chọn, được lưu trong session
  const page = req.session.pages?.find((p) => p.id === pageId);
  console.log ("DEP TRAI 0")
  if (!page) {
    return res.status(404).send("Page not found or not connected.");
  }
  const pageAccessToken = page.access_token;

  // Demo: Gửi tin nhắn đến PSID mới nhất đã nhắn tin cho trang
  const psid = psidList.length > 0 ? psidList[psidList.length - 1] : null;
  console.log ("DEP TRAI 1")
  if (!psid) {
    return res
      .status(400)
      .send(
        "No user (PSID) to send message to. Please send a message to your page first."
      );
  }
  console.log ("DEP TRAI 2")

  const msgUrl = `https://graph.facebook.com/v19.0/me/messages`; // Dùng "me" vì đã có page access token
  const msgBody = {
    messaging_type: "MESSAGE_TAG",
    tag: "CONFIRMED_EVENT_UPDATE", // Tag này cho phép gửi tin ngoài 24h
    recipient: { id: psid },
    message: { text: message },
  };

  try {
    console.log("XAU TRAI")
    await axios.post(msgUrl, msgBody, {
      params: { access_token: pageAccessToken },
    });
    res.json({ success: true, message: `Message sent to PSID: ${psid}` });
  } catch (error) {
    console.error("Error sending message:", error.response?.data.error);
    res
      .status(500)
      .send(error.response?.data.error || { message: "Error sending message" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
})