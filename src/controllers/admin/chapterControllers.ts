// controllers/chapterController.ts
import { Request, Response } from "express";
import Resource from "../../models/resource.js";

// ADD Chapter
export const addChapter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const resource = await Resource.findById(req.params.id);
    //if (!resource) return res.status(404).json({ error: "Resource not found" });
    if (!resource) return;

    resource.chapters.push(req.body);
    await resource.save();
    res.status(201).json(resource);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// EDIT Chapter
export const editChapter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const resource = await Resource.findById(req.params.id);
    // if (!resource) return res.status(404).json({ error: "Resource not found" });
    if (!resource) return;

    const chapter = (resource.chapters as any).id(req.params.chapterId);
    // if (!chapter) return res.status(404).json({ error: "Chapter not found" });
    if (!chapter) return;

    Object.assign(chapter, req.body);
    await resource.save();
    res.json(resource);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// DELETE Chapter
export const deleteChapter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const resource = await Resource.findById(req.params.id);
    // if (!resource) return res.status(404).json({ error: "Resource not found" });
    if (!resource) return;

    const chapter = (resource.chapters as any).id(req.params.chapterId);
    // if (!chapter) return res.status(404).json({ error: "Chapter not found" });
    if (!chapter) return;

    chapter.deleteOne();
    await resource.save();
    res.json(resource);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
