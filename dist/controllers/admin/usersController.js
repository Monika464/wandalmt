import User from "../../models/user.js";
//DELETE USER
export const deleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        await User.deleteOne({ _id: userId });
        res.status(200).json({ message: "User deleted successfully" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
};
export const fetchUsers = async (req, res, next) => {
    try {
        const users = await User.find({ role: "user" });
        res.status(200).send(users);
    }
    catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ error: "Błąd serwera" });
    }
};
// PATCH /admin/users/:userId/status
export const updateUserStatus = async (req, res, next) => {
    try {
        const { userId } = req.params;
        let { active } = req.body;
        if (typeof active === "string") {
            active = active === "true";
        }
        if (typeof active !== "boolean") {
            // return res
            //   .status(400)
            //   .json({ message: "Pole 'active' musi być typu boolean" });
            return;
        }
        // findByIdAndUpdate zapisuje zmiany automatycznie
        const user = await User.findByIdAndUpdate(userId, { active }, { new: true } // zwróci zaktualizowany dokument
        );
        if (!user) {
            //return res.status(404).json({ message: "Użytkownik nie znaleziony" });
            return;
        }
        res.status(200).json({ message: "Status użytkownika zmieniony", user });
    }
    catch (error) {
        console.error("Błąd przy zmianie statusu użytkownika:", error);
        res.status(500).json({ message: "Błąd serwera" });
    }
};
