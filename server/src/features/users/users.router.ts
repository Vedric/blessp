import { Router } from 'express';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { HashService } from '../../core/security/hash.service';
import { authenticate } from '../../core/middleware/authenticate';

const usersRepository = new UsersRepository();
const hashService = new HashService();
const usersService = new UsersService(usersRepository, hashService);
const usersController = new UsersController(usersService);

const router = Router();

router.use(authenticate);

router.get('/profile', usersController.getProfile);
router.patch('/profile', usersController.updateProfile);
router.post('/change-password', usersController.changePassword);
router.delete('/account', usersController.deleteAccount);
router.get('/email-preferences', usersController.getEmailPreferences);
router.patch('/email-preferences', usersController.updateEmailPreferences);

export { router as usersRouter };
