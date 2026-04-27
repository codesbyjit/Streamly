import { Router } from 'express';

import userRouter from "../user/router.user.ts"
import authRouter from "../auth/router.auth.ts"

const router = Router();

router.get("/", (_, res) => {
  res.json('home page');
});

router.use("/user", userRouter)
router.use("/auth", authRouter)

export default router;