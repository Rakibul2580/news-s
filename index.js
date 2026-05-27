const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("Uploads folder created successfully");
}

// MongoDB Connection
const uri =
  "mongodb+srv://news:3qq9PoI7WVk0YhyC@cluster0.49jtlcd.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri);

let db;

async function connectToMongoDB() {
  try {
    await client.connect();
    db = client.db("newsDB"); // Database name
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.log("MongoDB connection error:", error);
  }
}

connectToMongoDB();

// Multer setup for image upload with file extension handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, jpg, png, gif) are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post("/api/news", async (req, res) => {
  try {
    const {
      titleBangla,
      titleEnglish,
      category,
      tags,
      contentBangla,
      contentEnglish,
      image, // Expecting image URL as a string
      author,
      publishDate,
    } = req.body;
    console.log(req.body);

    const news = {
      titleBangla,
      titleEnglish,
      category,
      tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
      contentBangla,
      contentEnglish,
      image, // Store image URL directly
      author,
      publishDate,
      createdAt: new Date(),
    };

    const result = await db.collection("news").insertOne(news);
    res.status(201).json({
      message: "News posted successfully",
      news: { _id: result.insertedId, ...news },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error posting news", error: error.message });
  }
});

// Update News
app.put("/api/news/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titleBangla,
      titleEnglish,
      category,
      tags,
      contentBangla,
      contentEnglish,
      image, // Expecting image URL as a string
      author,
      publishDate,
    } = req.body;

    const updatedNews = {
      titleBangla,
      titleEnglish,
      category,
      tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
      contentBangla,
      contentEnglish,
      image, // Store image URL directly
      author,
      publishDate,
    };

    const result = await db
      .collection("news")
      .updateOne({ _id: new ObjectId(id) }, { $set: updatedNews });

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "News not found" });
    }

    res.json({ message: "News updated successfully", news: updatedNews });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating news", error: error.message });
  }
});

// Get All News with Pagination, Search, and Category Filter
app.get("/api/news", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", category = "" } = req.query;
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { titleBangla: { $regex: search, $options: "i" } },
        { titleEnglish: { $regex: search, $options: "i" } },
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    const news = await db
      .collection("news")
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection("news").countDocuments(query);

    res.json({
      news,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching news", error: error.message });
  }
});

// Delete News
app.delete("/api/news/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db
      .collection("news")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "News not found" });
    }

    res.json({ message: "News deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting news", error: error.message });
  }
});

// For the home page, we can create a route that fetches a limited number of news items, possibly with some filtering options like category or tags. Here's an example of how you might implement this:

// GET /api/home-news
app.get("/api/home-news", async (req, res) => {
  try {
    const { category, limit = 10, skip = 0 } = req.query; // default limit 10 for home page
    const query = {};
    if (category) query.category = category;

    const news = await db
      .collection("news")
      .find(query)
      .sort({ date: -1 }) // newest first
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .toArray();

    res.json({
      success: true,
      count: news.length,
      news,
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching news",
      error: error.message,
    });
  }
});

app.get("/api/news/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const newsItem = await db
      .collection("news")
      .findOne({ _id: new ObjectId(id) });

    if (!newsItem) {
      return res.status(404).json({ message: "News item not found" });
    }

    res.json({ success: true, newsItem });
  } catch (error) {
    console.error("Error fetching news item:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching news item",
      error: error.message,
    });
  }
});

// POST /api/contact
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const contact = {
      name: name.trim(),
      email: email.trim(),
      subject: subject?.trim() || "No subject",
      message: message.trim(),
      createdAt: new Date(),
    };

    const result = await db.collection("contacts").insertOne(contact);
    res.status(201).json({
      success: true,
      message: "Your message has been sent successfully!",
      id: result.insertedId,
    });
  } catch (error) {
    console.error("Contact save error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// POST /api/advertise
app.post("/api/advertise", async (req, res) => {
  try {
    const { name, email, company, website, budget, message } = req.body;

    // Validation
    if (!name || !email || !company) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and company are required.",
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const inquiry = {
      name: name.trim(),
      email: email.trim(),
      company: company.trim(),
      website: website?.trim() || "",
      budget: budget || "Not specified",
      message: message?.trim() || "",
      createdAt: new Date(),
      status: "pending", // for internal tracking
    };

    const result = await db
      .collection("advertise_inquiries")
      .insertOne(inquiry);
    res.status(201).json({
      success: true,
      message: "Thank you! We'll be in touch shortly.",
      id: result.insertedId,
    });
  } catch (error) {
    console.error("Advertise submission error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

app.get("/", (req, res) => {
  res.send("Welcome to the News API");
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
