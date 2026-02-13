import { Router } from "express";
import { userAuth } from "../middleware/auth.js";
import Progress from "../models/progress.js";
const router = Router();
// Pobierz postęp dla kursu
router.get("/:productId", userAuth, async (req, res) => {
    try {
        const progress = await Progress.find({
            userId: req.user.id,
            productId: req.params.productId,
            completed: true, // TYLKO ukończone rozdziały
        });
        res.json(progress);
        console.log("Fetched progress:", progress);
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});
// Oznacz rozdział jako ukończony
router.post("/:productId/:chapterId/complete", userAuth, async (req, res) => {
    try {
        const now = new Date();
        const progressData = {
            userId: req.user.id,
            productId: req.params.productId,
            chapterId: req.params.chapterId,
            completed: true,
            lastWatched: now,
            completedAt: now,
        };
        console.log("Received progress update:", progressData);
        const existingProgress = await Progress.findOne({
            userId: req.user.id,
            productId: req.params.productId,
            chapterId: req.params.chapterId,
        });
        let savedProgress;
        if (existingProgress) {
            savedProgress = await Progress.findByIdAndUpdate(existingProgress._id, {
                ...progressData,
                completed: true,
                lastWatched: now,
                completedAt: existingProgress.completedAt || now,
            }, { new: true });
        }
        else {
            savedProgress = await Progress.create(progressData);
        }
        res.json({ progress: savedProgress });
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});
// Usuń postęp dla rozdziału (oznacz jako nieukończony)
router.delete("/:productId/:chapterId", userAuth, async (req, res) => {
    try {
        await Progress.deleteOne({
            userId: req.user.id,
            productId: req.params.productId,
            chapterId: req.params.chapterId,
        });
        res.json({
            message: "Progress deleted",
            productId: req.params.productId,
            chapterId: req.params.chapterId,
        });
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});
// Usuń cały postęp dla kursu
router.delete("/:productId", userAuth, async (req, res) => {
    try {
        await Progress.deleteMany({
            userId: req.user.id,
            productId: req.params.productId,
        });
        res.json({
            message: "All progress deleted",
            productId: req.params.productId,
        });
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});
export default router;
