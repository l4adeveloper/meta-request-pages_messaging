// controllers/meta.controller.js
const axios = require("axios");
const { users, otnTokens } = require("../db");

const FB_APP_ID = process.env.APP_ID;
const FB_APP_SECRET = process.env.APP_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Helper function
const getMetaTokenFromUser = (userId) => {
  const user = users.find((u) => u.id === userId);
  return user?.metaAccessToken;
};

// --- Controllers ---

exports.connect = (req, res) => {
  const userId = req.user.id;
  const state = userId;
  const scope =
    "pages_show_list,pages_messaging,pages_read_engagement,pages_utility_messaging,pages_manage_metadata"; // Thêm các quyền khác nếu cần
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&response_type=code&state=${state}`;
  res.json({ authUrl });
};

exports.callback = async (req, res) => {
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
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].metaAccessToken = longLivedToken;
      console.log(`Updated Meta token for user ${userId}`);
    }

    const frontendDashboardUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/dashboard`;
    res.redirect(frontendDashboardUrl);
  } catch (error) {
    console.error(
      "Error during Meta callback:",
      error.response?.data || error.message
    );
    res.status(500).send("Authentication with Meta failed.");
  }
};

exports.getStatus = (req, res) => {
  const metaToken = getMetaTokenFromUser(req.user.id);
  if (metaToken) {
    res.json({ isConnected: true });
  } else {
    res.json({ isConnected: false });
  }
};

exports.getPermissions = async (req, res) => {
  const metaToken = getMetaTokenFromUser(req.user.id);
  if (!metaToken)
    return res.status(403).json({ error: "Meta account not connected." });

  const url = `https://graph.facebook.com/me/permissions?access_token=${metaToken}`;
  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch permissions." });
  }
};

exports.getPages = async (req, res) => {
  const metaToken = getMetaTokenFromUser(req.user.id);
  if (!metaToken)
    return res.status(403).json({ error: "Meta account not connected." });

  const url = `https://graph.facebook.com/me/accounts?fields=name,access_token&access_token=${metaToken}`;
  try {
    const response = await axios.get(url);
    // Lưu page tokens vào CSDL liên kết với user.id nếu cần
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pages." });
  }
};

exports.disconnect = async (req, res) => {
  const userId = req.user.id;
  const userIndex = users.findIndex((u) => u.id === userId);

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
    console.error(
      "Failed to revoke Meta permissions, but proceeding to disconnect locally.",
      error.response?.data
    );
  }

  // Bước 2: Xóa token khỏi "database" của chúng ta
  users[userIndex].metaAccessToken = null;

  res.json({ success: true, message: "Successfully disconnected from Meta." });
};

exports.getConversations = async (req, res) => {
  const { pageId } = req.params;
  const pageAccessToken = req.headers["x-page-access-token"];
  // THÊM DÒNG NÀY ĐỂ DEBUG
  console.log("DEBUGGING - Page ID:", pageId);
  console.log("DEBUGGING - Page Access Token:", pageAccessToken);
  if (!pageAccessToken)
    return res.status(403).json({ error: "Meta account not connected." });
  console.log("DEP TRAI 1");
  const url = `https://graph.facebook.com/v19.0/${pageId}/conversations`;
  console.log("DEP TRAI 2");

  try {
    console.log("DEP TRAI 3");
    const response = await axios.get(url, {
      params: {
        fields: "participants,snippet,updated_time",
        access_token: pageAccessToken,
      },
    });

    // Đơn giản hóa dữ liệu trả về cho frontend
    console.log("response.data: ", response.data);
    const formattedConversations = response.data.data.map((conv) => {
      const user = conv.participants.data.find((p) => p.id !== pageId);
      return {
        id: conv.id, // Conversation ID
        name: user ? user.name : "Unknown User",
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
};

exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const { pageId } = req.query; // Frontend cần gửi pageId qua query param

  if (!pageId) {
    return res
      .status(400)
      .json({ error: "pageId is required as a query parameter." });
  }

  const pageAccessToken = req.headers["x-page-access-token"];
  if (!pageAccessToken) {
    return res.status(403).json({ error: "Page access token not found." });
  }

  const url = `https://graph.facebook.com/v19.0/${conversationId}/messages`;
  try {
    const response = await axios.get(url, {
      params: {
        fields: "message,from,created_time",
        access_token: pageAccessToken,
      },
    });

    const formattedMessages = response.data.data
      .map((msg) => ({
        id: msg.id,
        text: msg.message,
        sender: msg.from.id === pageId ? "me" : "user", // Xác định người gửi
        createdTime: msg.created_time,
      }))
      .reverse(); // Đảo ngược để tin nhắn mới nhất ở dưới cùng

    res.json(formattedMessages);
  } catch (error) {
    console.error("Error fetching messages:", error.response?.data);
    res.status(500).json({ error: "Failed to fetch messages." });
  }
};

exports.sendMessage = async (req, res) => {
  const { pageId, psid, message } = req.body; // psid thay vì conversationId

  if (!pageId || !psid || !message) {
    return res
      .status(400)
      .json({ error: "pageId, psid, and message are required." });
  }

  const pageAccessToken = req.headers["x-page-access-token"];
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
    res.status(500).json({
      error: error.response?.data?.error || "Failed to send message.",
    });
  }
};

exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK_VERIFIED");
    res.status(200).send(challenge);
  } else {
    console.log(token);
    console.log(VERIFY_TOKEN);
    res.sendStatus(403);
  }
};

exports.handleWebhook = (req, res) => {
  console.log("Webhook received: ", req.body);
  const body = req.body;
  // Dòng quan trọng nhất để debug
  console.log("--- RAW WEBHOOK RECEIVED ---");
  console.log(JSON.stringify(body, null, 2));
  if (body.object === "page") {
    body.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        // KIỂM TRA SỰ KIỆN OPT-IN MỚI
        if (event.optin && event.optin.type === "one_time_notif_req") {
          const psid = event.sender.id;
          const otnToken = event.optin.one_time_notif_token;

          // Lưu token vào bộ nhớ
          otnTokens[psid] = otnToken;
          console.log(`Received and stored OTN token for user ${psid}`);
        }

        // Xử lý tin nhắn đến (có thể thêm logic để đẩy qua socket ở đây)
        if (event.message) {
          console.log("Received a message from", event.sender.id);
        }
      });
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
};

//Xử lý OTN
exports.offerOtn = async (req, res) => {
  const { pageId, psid, title, payload } = req.body;
  const pageAccessToken = req.headers["x-page-access-token"];

  if (!pageAccessToken || !psid || !title || !payload) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const url = `https://graph.facebook.com/v19.0/me/messages`;
  const body = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "one_time_notif_req",
          title: title, // Ví dụ: "Báo cho tôi khi có hàng lại"
          payload: payload, // Ví dụ: "NOTIFY_PRODUCT_123"
        },
      },
    },
  };

  try {
    await axios.post(url, body, { params: { access_token: pageAccessToken } });
    res.json({ success: true, message: "OTN offer sent." });
  } catch (error) {
    console.error("Error sending OTN offer:", error.response?.data?.error);
    res.status(500).json({ error: "Failed to send OTN offer." });
  }
};

// controllers/meta.controller.js
exports.subscribePage = async (req, res) => {
  const { pageId } = req.params;
  const pageAccessToken = req.headers["x-page-access-token"];

  if (!pageAccessToken) {
    return res.status(403).json({ error: "Page Access Token is required." });
  }

  const url = `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`;

  try {
    await axios.post(url, null, {
      // Body có thể là null
      params: {
        subscribed_fields: "messages,messaging_optins,messaging_postbacks", // Các sự kiện bạn muốn nhận
        access_token: pageAccessToken,
      },
    });
    res.json({
      success: true,
      message: `Successfully subscribed page ${pageId} to webhook events.`,
    });
  } catch (error) {
    console.error(
      "Error subscribing page to webhooks:",
      error.response?.data?.error
    );
    const metaError = error.response?.data?.error;
    res
      .status(500)
      .json({ error: "Failed to subscribe page.", details: metaError });
  }
};

//Gửi thông báo OTN
exports.sendOtn = async (req, res) => {
  const { pageId, psid, message } = req.body;
  const pageAccessToken = req.headers["x-page-access-token"];

  // Lấy OTN token đã lưu
  const otnToken = otnTokens[psid];

  if (!otnToken) {
    return res
      .status(400)
      .json({ error: "No available OTN token for this user." });
  }

  const url = `https://graph.facebook.com/v19.0/me/messages`;
  const body = {
    recipient: { id: psid },
    message: { text: message },
    messaging_type: "MESSAGE_TAG",
    tag: "ONE_TIME_NOTIF", // Tag đặc biệt cho OTN
  };

  try {
    await axios.post(url, body, {
      params: { access_token: pageAccessToken, one_time_notif_token: otnToken },
    });

    // Xóa token sau khi đã sử dụng
    delete otnTokens[psid];

    res.json({ success: true, message: "OTN message sent." });
  } catch (error) {
    console.error("Error sending OTN message:", error.response?.data?.error);
    res.status(500).json({ error: "Failed to send OTN message." });
  }
};
