import { Router } from "express";
import * as jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

router.get("/", (_, res) => {
  res.json("users page");
});

router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const decoded = jwt.verify(token, JWT_SECRET!);
    const User = (await import("../user/model.users.ts")).default;
    const user = await User.findById(
      (decoded as { userId: string }).userId,
    ).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
