import { Router } from "express";
import User from "../user/model.users.ts";
import bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment variables");
}

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const NewUser = new User({ username, email, password });
    await NewUser.save();
    res.status(200).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(403).json({ message: "User already exists" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "user not found" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(403).json({ error: "Invalid credentials" });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(200).json({
      message: "User login successfully",
      token,
    });
  } catch (err) {
    res.status(503).json("server error");
  }
});

router.post("/forget", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "user not found" });
    user.password = password;
    user.markModified("password");
    await user.save();
    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
