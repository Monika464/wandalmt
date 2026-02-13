// backend/models/Progress.js - UPROSZCZONY
import mongoose, { Schema, model } from "mongoose";
const progressSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    chapterId: {
        type: String,
        required: true,
    },
    completed: {
        type: Boolean,
        default: false,
    },
    lastWatched: {
        type: Date,
        default: Date.now,
    },
    completedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Indeks - każdy rozdział może być ukończony tylko raz na użytkownika
progressSchema.index({ userId: 1, productId: 1, chapterId: 1 }, { unique: true });
const Progress = model("Progress", progressSchema);
export default Progress;
