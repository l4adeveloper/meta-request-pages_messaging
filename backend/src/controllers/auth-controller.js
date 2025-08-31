const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { users, otnTokens } = require("../db");

const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (users.find((user) => user.email === email)) {
      return res.status(400).json({ error: "Email already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      metaAccessToken: null,
    };
    users.push(newUser);
    res.status(201).json({ message: "User created successfully." });
  } catch (error) {
    res.status(500).json({ error: "Server error." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = users.find((user) => user.email === email);
    if (!user) return res.status(400).json({ error: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ error: "Invalid credentials." });

    const payload = { id: user.id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Server error." });
  }
};

module.exports = {
  register,
  login,
};
