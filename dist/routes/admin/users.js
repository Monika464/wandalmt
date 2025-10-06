import express from "express";
import { adminAuth } from "../../middleware/auth.js";
import { deleteUser, fetchUsers, updateUserStatus, } from "../../controllers/admin/usersController.js";
const router = express.Router();
router.delete("/delete-user/:userId", adminAuth, deleteUser);
router.get("/users", adminAuth, fetchUsers);
router.patch("/users/:userId/status", adminAuth, updateUserStatus);
export default router;
