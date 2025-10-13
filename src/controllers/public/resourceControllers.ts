import { Request, Response } from "express";
import Resource from "../../models/resource.js";

// GET Resource by productId
export const getResourceByProductId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const resource = await Resource.findOne({
      productId: req.params.productId,
    });
    // console.log("getResourceByProduct", resource);
    // if (!resource) return res.status(404).json({ error: "Resource not found" });
    if (!resource) return;
    res.json(resource);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
