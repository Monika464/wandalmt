import Resource from "../../models/resource.js";
// ADD Chapter
export const addChapter = async (req, res) => {
    const { id } = req.params;
    const { videoUrl, description, title } = req.body;
    console.log("Adding chapter to resource ID:", id);
    console.log("Chapter data:", { videoUrl, description, title });
    try {
        const resource = await Resource.findById(id);
        if (!resource) {
            res.status(404).json({ error: "Resource not found" });
            return;
        }
        if (!resource.chapters)
            resource.chapters = [];
        if (resource.chapters.length >= 100) {
            res
                .status(400)
                .json({ error: "Maximum number of chapters reached (100)" });
            return;
        }
        resource.chapters.push({ videoUrl, description, title });
        await resource.save();
        res
            .status(200)
            .json({ message: "Chapter added", chapters: resource.chapters });
    }
    catch (err) {
        res
            .status(500)
            .json({ error: err instanceof Error ? err.message : "Server error" });
        return;
    }
};
// EDIT Chapter
export const editChapter = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        // if (!resource) return res.status(404).json({ error: "Resource not found" });
        if (!resource)
            return;
        const chapter = resource.chapters.id(req.params.chapterId);
        // if (!chapter) return res.status(404).json({ error: "Chapter not found" });
        if (!chapter)
            return;
        Object.assign(chapter, req.body);
        await resource.save();
        res.json(resource);
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
// DELETE Chapter
export const deleteChapter = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        // if (!resource) return res.status(404).json({ error: "Resource not found" });
        if (!resource)
            return;
        const chapter = resource.chapters.id(req.params.chapterId);
        // if (!chapter) return res.status(404).json({ error: "Chapter not found" });
        if (!chapter)
            return;
        chapter.deleteOne();
        await resource.save();
        res.json(resource);
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
