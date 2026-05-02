require("dotenv").config();
const express = require("express");
const app = express();
const pool = require("../config/db");
app.use(express.json());
const axios = require("axios");

const generateSummary = async (content) => {
    try {
        const MODEL = "gemini-1.5-flash"; 

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: `Summarize this in one short sentence:\n\n${content}`
                            }
                        ]
                    }
                ]
            }
        );

        return (
            response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
            || "Summary not available"
        );

    } catch (err) {
        console.error("❌ Gemini API error:");
        console.error(err.response?.data || err.message);
        return "Summary not available";
    }
};

app.post("/notes", async (req, res) => {
    try {
        const { title, content } = req.body;

        // ✅ validation
        if (!title || !content) {
            return res.status(400).json({ message: "Title & content required" });
        }

        let summary;

        // ✅ safe summary generation (with fallback)
        try {
            summary = await generateSummary(content);
        } catch (err) {
            console.error("Summary error:", err.message);
            summary = "Summary not available";
        }

        const result = await pool.query(
            `INSERT INTO notes (title, content, summary) 
             VALUES ($1, $2, $3) RETURNING *`,
            [title.trim(), content.trim(), summary]
        );

        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error("Server error:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
app.get("/notes", async (req, res) => {
  try {
    let { page = 1, limit = 5, title } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    let values = [];

    if (title) {
      values.push(`%${title}%`);
      whereClause += ` AND title ILIKE $${values.length}`;
    }

    const countQuery = `SELECT COUNT(*) FROM notes ${whereClause}`;
    const totalResult = await pool.query(countQuery, values);

    const dataQuery = `
      SELECT * FROM notes
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const dataValues = [...values, limit, offset];

    const dataResult = await pool.query(dataQuery, dataValues);

    res.json({
      total: parseInt(totalResult.rows[0].count),
      page,
      pages: Math.ceil(totalResult.rows[0].count / limit),
      data: dataResult.rows,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/notes/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { title, content } = req.body;

        // get existing note
        const existing = await pool.query(
            "SELECT * FROM notes WHERE id = $1",
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ message: "Note not found" });
        }

        const oldNote = existing.rows[0];

        let summary = oldNote.summary;

        //  Only regenerate if content changed
        if (content && content !== oldNote.content) {
            try {
                summary = await generateSummary(content);
            } catch (err) {
                // retry once
                try {
                    summary = await generateSummary(content);
                } catch (err2) {
                    summary = "Summary not available";
                }
            }
        }

        const result = await pool.query(
            `UPDATE notes 
             SET title = $1, content = $2, summary = $3
             WHERE id = $4 
             RETURNING *`,
            [
                title || oldNote.title,
                content || oldNote.content,
                summary,
                id
            ]
        );

        res.json(result.rows[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


//  DELETE NOTE
app.delete("/notes/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const result = await pool.query(
            "DELETE FROM notes WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Note not found" });
        }

        res.json({ message: "Note deleted successfully" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = app;