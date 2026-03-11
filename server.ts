import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Email Configuration - Only add auth if credentials are provided
  const smtpConfig: any = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    tls: {
      rejectUnauthorized: false
    }
  };

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    smtpConfig.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  const transporter = nodemailer.createTransport(smtpConfig);

  // API: Test Email
  app.post("/api/admin/test-email", async (req, res) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing SMTP credentials",
        details: "נא להגדיר SMTP_USER ו-SMTP_PASS בתפריט ה-Secrets (גלגל שיניים -> Settings -> Secrets)"
      });
    }

    try {
      await transporter.sendMail({
        from: `"Tectona Test" <${process.env.SMTP_USER}>`,
        to: "Support@tectona.io",
        subject: "מייל בדיקה - Tectona Onboarding",
        text: "זהו מייל בדיקה לוודא שהחיבור לשרת המיילים תקין.",
      });
      res.json({ success: true, message: "Email sent successfully to Support@tectona.io" });
    } catch (error: any) {
      console.error("Test mail error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        details: "וודא שפרטי ה-SMTP נכונים (שרת, פורט, משתמש וסיסמה)"
      });
    }
  });

  // Ensure submissions directory exists
  const submissionsDir = path.join(__dirname, 'submissions');
  if (!fs.existsSync(submissionsDir)) {
    fs.mkdirSync(submissionsDir);
  }

  // API: Submit KYC
  app.post("/api/submit", async (req, res) => {
    const { fullName, pdfBase64, email } = req.body;
    
    if (!fullName || !pdfBase64) {
      return res.status(400).json({ error: "Missing data" });
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `KYC_${fullName.replace(/\s+/g, '_')}_${timestamp}.pdf`;
      const filePath = path.join(submissionsDir, filename);
      
      // Remove header if present
      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      
      fs.writeFileSync(filePath, base64Data, 'base64');
      
      console.log(`Saved submission: ${filename}`);

      // Send Email to Support
      try {
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          await transporter.sendMail({
            from: `"Tectona Onboarding" <${process.env.SMTP_USER}>`,
            to: "Support@tectona.io",
            subject: `פניית KYC חדשה: ${fullName}`,
            text: `שלום,\n\nהתקבלה פניית KYC חדשה עבור הלקוח: ${fullName}.\nאימייל הלקוח: ${email || 'לא צוין'}\nהקובץ נשמר בשרת בשם ${filename}.\n\nהקובץ מצורף למייל זה.`,
            attachments: [
              {
                filename: filename,
                content: base64Data,
                encoding: 'base64'
              }
            ]
          });
          console.log(`Email sent to Support@tectona.io for ${fullName}`);
        } else {
          console.log("SMTP credentials missing, skipping email send.");
        }
      } catch (mailErr) {
        console.error("Mail error:", mailErr);
      }

      res.json({ success: true, filename });
    } catch (error) {
      console.error("Failed to save submission:", error);
      res.status(500).json({ error: "Failed to save" });
    }
  });

  // API: List Submissions (Admin)
  app.get("/api/admin/submissions", (req, res) => {
    try {
      const files = fs.readdirSync(submissionsDir)
        .filter(f => f.endsWith('.pdf'))
        .map(f => {
          const stats = fs.statSync(path.join(submissionsDir, f));
          return {
            filename: f,
            createdAt: stats.birthtime,
            size: stats.size
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to list" });
    }
  });

  // API: Download Submission
  app.get("/api/admin/download/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(submissionsDir, filename);
    
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).send("File not found");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
