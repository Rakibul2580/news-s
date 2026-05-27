const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const compression = require("compression");

dotenv.config();

const app = express();

// =======================
// MIDDLEWARE
// =======================

app.use(cors());

app.use(express.json({ limit: "10mb" }));

app.use(compression());

// Cache
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  next();
});

// =======================
// MONGODB CONNECTION
// =======================

const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  maxPoolSize: 20,
});

let db;

async function connectDB() {
  try {
    await client.connect();

    db = client.db("newsDB");

    // INDEXES
    await db.collection("news").createIndex({ createdAt: -1 });

    await db.collection("news").createIndex({ category: 1 });

    await db.collection("news").createIndex({
      titleBangla: "text",
      titleEnglish: "text",
    });

    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.log("MongoDB Error:", error);
  }
}

connectDB();

// =======================
// ROOT ROUTE
// =======================

app.get("/", (req, res) => {
  res.send("News API Running Successfully");
});

// =======================
// POST NEWS
// =======================

app.post("/api/news", async (req, res) => {
  try {
    const {
      titleBangla,
      titleEnglish,
      category,
      tags,
      contentBangla,
      contentEnglish,
      image,
      author,
      publishDate,
    } = req.body;

    const news = {
      titleBangla: titleBangla || "",
      titleEnglish: titleEnglish || "",
      category: category || "",
      tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
      contentBangla: contentBangla || "",
      contentEnglish: contentEnglish || "",
      image: image || "",
      author: author || "",
      publishDate: publishDate || "",
      createdAt: new Date(),
    };

    const result = await db.collection("news").insertOne(news);

    res.status(201).json({
      success: true,
      message: "News Created Successfully",
      news: {
        _id: result.insertedId,
        ...news,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Create News",
    });
  }
});

// =======================
// UPDATE NEWS
// =======================

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
      image,
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
      image,
      author,
      publishDate,
      updatedAt: new Date(),
    };

    const result = await db.collection("news").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updatedNews,
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "News Not Found",
      });
    }

    res.json({
      success: true,
      message: "News Updated Successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Update News",
    });
  }
});

// =======================
// DELETE NEWS
// =======================

app.delete("/api/news/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.collection("news").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "News Not Found",
      });
    }

    res.json({
      success: true,
      message: "News Deleted Successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Delete News",
    });
  }
});

// =======================
// GET ALL NEWS
// =======================

app.get("/api/news", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", category = "" } = req.query;

    const query = {};

    // SEARCH
    if (search) {
      query.$text = {
        $search: search,
      };
    }

    // CATEGORY
    if (category) {
      query.category = category;
    }

    const news = await db
      .collection("news")
      .find(query)
      .project({
        contentBangla: 0,
        contentEnglish: 0,
      })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .toArray();

    const total = await db.collection("news").countDocuments(query);

    res.json({
      success: true,
      news,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      totalNews: total,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Fetch News",
    });
  }
});

// =======================
// HOME PAGE API
// FAST SINGLE API
// =======================

app.get("/api/home-news", async (req, res) => {
  try {
    const collection = db.collection("news");

    const [hero, politics, sports, entertainment, technology] =
      await Promise.all([
        collection
          .find({})
          .project({
            contentBangla: 0,
            contentEnglish: 0,
          })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray(),

        collection
          .find({ category: "politics" })
          .project({
            contentBangla: 0,
            contentEnglish: 0,
          })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray(),

        collection
          .find({ category: "sports" })
          .project({
            contentBangla: 0,
            contentEnglish: 0,
          })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray(),

        collection
          .find({ category: "entertainment" })
          .project({
            contentBangla: 0,
            contentEnglish: 0,
          })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray(),

        collection
          .find({ category: "technology" })
          .project({
            contentBangla: 0,
            contentEnglish: 0,
          })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray(),
      ]);

    res.json({
      success: true,
      hero,
      politics,
      sports,
      entertainment,
      technology,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Fetch Home News",
    });
  }
});

// =======================
// CATEGORY NEWS
// =======================

app.get("/api/category-news/:category", async (req, res) => {
  try {
    const { category } = req.params;

    const news = await db
      .collection("news")
      .find({ category })
      .project({
        contentBangla: 0,
        contentEnglish: 0,
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    res.json({
      success: true,
      news,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Fetch Category News",
    });
  }
});

// =======================
// NEWS DETAILS
// =======================

app.get("/api/news/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const news = await db.collection("news").findOne({
      _id: new ObjectId(id),
    });

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News Not Found",
      });
    }

    res.json({
      success: true,
      newsItem: news,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Fetch News Details",
    });
  }
});

// =======================
// CONTACT API
// =======================

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "All Fields Are Required",
      });
    }

    const contact = {
      name,
      email,
      subject,
      message,
      createdAt: new Date(),
    };

    const result = await db.collection("contacts").insertOne(contact);

    res.status(201).json({
      success: true,
      message: "Message Sent Successfully",
      id: result.insertedId,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Send Message",
    });
  }
});

// =======================
// ADVERTISE API
// =======================

app.post("/api/advertise", async (req, res) => {
  try {
    const { name, email, company, website, budget, message } = req.body;

    if (!name || !email || !company) {
      return res.status(400).json({
        success: false,
        message: "Required Fields Missing",
      });
    }

    const inquiry = {
      name,
      email,
      company,
      website,
      budget,
      message,
      createdAt: new Date(),
    };

    const result = await db
      .collection("advertise_inquiries")
      .insertOne(inquiry);

    res.status(201).json({
      success: true,
      message: "Advertise Request Submitted",
      id: result.insertedId,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed To Submit Advertise Request",
    });
  }
});

// =======================
// SERVER
// =======================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server Running On Port ${PORT}`);
});
