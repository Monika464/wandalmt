// models/Resource.ts
import mongoose, { Schema } from "mongoose";
const ChapterSchema = new Schema({
    number: { type: Number, default: 1, required: true },
    title: { type: String, required: true },
    description: { type: String },
    bunnyVideoId: {
        type: String,
        default: null,
        index: true,
    },
    videoId: { type: Schema.Types.ObjectId, ref: "Video", default: null },
});
const ResourceSchema = new Schema({
    title: { type: String, required: true },
    content: { type: String },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    chapters: [ChapterSchema],
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });
ResourceSchema.pre("save", function (next) {
    if (this.chapters && this.chapters.length > 0) {
        this.chapters.sort((a, b) => {
            const numA = a.number || 0;
            const numB = b.number || 0;
            return numA - numB;
        });
    }
    next();
});
ResourceSchema.virtual("sortedChapters").get(function () {
    if (!this.chapters)
        return [];
    return [...this.chapters].sort((a, b) => {
        const numA = a.number || 0;
        const numB = b.number || 0;
        return numA - numB;
    });
});
ResourceSchema.set("toJSON", {
    virtuals: true,
    transform: function (doc, ret) {
        // Ręcznie sortuj chapters w zwracanym obiekcie
        if (ret.chapters && Array.isArray(ret.chapters)) {
            ret.chapters.sort((a, b) => {
                const numA = a.number || 0;
                const numB = b.number || 0;
                return numA - numB;
            });
        }
        return ret;
    },
});
ResourceSchema.set("toObject", {
    virtuals: true,
    transform: function (doc, ret) {
        if (ret.chapters && Array.isArray(ret.chapters)) {
            ret.chapters.sort((a, b) => {
                const numA = a.number || 0;
                const numB = b.number || 0;
                return numA - numB;
            });
        }
        return ret;
    },
});
export default mongoose.model("Resource", ResourceSchema);
