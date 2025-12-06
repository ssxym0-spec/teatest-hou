import { Router } from 'express';
import { login, register, changePassword } from '../controllers/authController';
import { requireLogin } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/change-password', requireLogin, changePassword);

export default router;


