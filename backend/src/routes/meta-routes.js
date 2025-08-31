// routes/meta.routes.js
const express = require("express");
const router = express.Router();
const metaController = require("../controllers/meta-controller");
const verifyToken = require("../middleware/verifyToken");

// Meta Connection Flow
router.get("/connect", verifyToken, metaController.connect);
router.get("/callback", metaController.callback);
router.post("/disconnect", verifyToken, metaController.disconnect);

// Meta Data & Status
router.get("/status", verifyToken, metaController.getStatus);
router.get("/permissions", verifyToken, metaController.getPermissions);
router.get("/pages", verifyToken, metaController.getPages);

// Chat APIs
router.get(
  "/pages/:pageId/conversations",
  verifyToken,
  metaController.getConversations
);
router.get(
  "/conversations/:conversationId/messages",
  verifyToken,
  metaController.getMessages
);
router.post("/send-message", verifyToken, metaController.sendMessage);

// Webhook
router.get("/webhook", metaController.verifyWebhook);
router.post("/webhook", metaController.handleWebhook);

// routes/meta.routes.js
router.post(
  "/pages/:pageId/subscribe",
  verifyToken,
  metaController.subscribePage
);

// OTN Tokens
router.post("/offer-otn", verifyToken, metaController.offerOtn);
router.post("/send-otn", verifyToken, metaController.sendOtn);

module.exports = router;
