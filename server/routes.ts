import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  insertAssociationSchema,
  insertUnitSchema,
  insertPersonSchema,
  insertOwnershipSchema,
  insertOccupancySchema,
  insertBoardRoleSchema,
} from "@shared/schema";

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/associations", async (_req, res) => {
    try {
      const result = await storage.getAssociations();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/associations", async (req, res) => {
    try {
      const parsed = insertAssociationSchema.parse(req.body);
      const result = await storage.createAssociation(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/associations/:id", async (req, res) => {
    try {
      const parsed = insertAssociationSchema.partial().parse(req.body);
      const result = await storage.updateAssociation(req.params.id, parsed);
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/units", async (_req, res) => {
    try {
      const result = await storage.getUnits();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/units", async (req, res) => {
    try {
      const parsed = insertUnitSchema.parse(req.body);
      const result = await storage.createUnit(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/units/:id", async (req, res) => {
    try {
      const parsed = insertUnitSchema.partial().parse(req.body);
      const result = await storage.updateUnit(req.params.id, parsed);
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/persons", async (_req, res) => {
    try {
      const result = await storage.getPersons();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/persons", async (req, res) => {
    try {
      const parsed = insertPersonSchema.parse(req.body);
      const result = await storage.createPerson(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/persons/:id", async (req, res) => {
    try {
      const parsed = insertPersonSchema.partial().parse(req.body);
      const result = await storage.updatePerson(req.params.id, parsed);
      if (!result) return res.status(404).json({ message: "Not found" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ownerships", async (_req, res) => {
    try {
      const result = await storage.getOwnerships();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ownerships", async (req, res) => {
    try {
      const parsed = insertOwnershipSchema.parse(req.body);
      const result = await storage.createOwnership(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/occupancies", async (_req, res) => {
    try {
      const result = await storage.getOccupancies();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/occupancies", async (req, res) => {
    try {
      const parsed = insertOccupancySchema.parse(req.body);
      const result = await storage.createOccupancy(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/board-roles", async (_req, res) => {
    try {
      const result = await storage.getBoardRoles();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/board-roles", async (req, res) => {
    try {
      const parsed = insertBoardRoleSchema.parse(req.body);
      const result = await storage.createBoardRole(parsed);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/documents", async (_req, res) => {
    try {
      const result = await storage.getDocuments();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }

      const result = await storage.createDocument({
        associationId: req.body.associationId,
        title: req.body.title,
        documentType: req.body.documentType,
        uploadedBy: req.body.uploadedBy || null,
        fileUrl: `/api/uploads/${file.filename}`,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/uploads/:filename", (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }
    res.sendFile(filePath);
  });

  return httpServer;
}
