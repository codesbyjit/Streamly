import { Router } from 'express';

const router = Router();

router.get("/", (_, res) => {
  res.json('users page');
});

export default router;