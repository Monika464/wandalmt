import { Request, Response, NextFunction } from "express";

import User from "../../models/user.js";

//DELETE USER
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    await User.deleteOne({ _id: userId });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

export const fetchUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const users = await User.find({ role: "user" });
    res.status(200).send(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ error: "Server error" });
  }
};

// PATCH /admin/users/:userId/status
export const updateUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId } = req.params;
    let { active } = req.body;

    if (typeof active === "string") {
      active = active === "true";
    }

    if (typeof active !== "boolean") {
      res
        .status(400)
        .json({ message: "Field 'active' must be of type boolean" });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { active },
      { new: true },
    );

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ message: "User status updated", user });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Server error" });
  }
};
