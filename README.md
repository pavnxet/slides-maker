# 🚀 MCQ to Slides Converter

> Transform raw text into professional presentation slides instantly.

![GitHub last commit](https://img.shields.io/github/last-commit/pavnxet/slides-maker?style=for-the-badge&color=blue)
![GitHub license](https://img.shields.io/github/license/pavnxet/slides-maker?style=for-the-badge&color=green)
![GitHub stars](https://img.shields.io/github/stars/pavnxet/slides-maker?style=for-the-badge&color=yellow)

**MCQ to Slides Converter** is a powerful single-page web application designed for educators and content creators. It takes raw multiple-choice questions (MCQs) in a simple text format and converts them into beautifully designed, landscape PDF presentation slides.

---

## ✨ Key Features

- **🎨 Modern Design**: Sleek "Glassmorphism" UI with dark mode support for a premium feel.
- **🚀 Instant PDF Generation**: Uses client-side processing to generate high-quality PDFs in seconds without server uploads.
- **📄 Robust Parsing Engine**: Parses questions in English and Hindi with support for multiline and inline options (`(a) OptA (b) OptB` on a single line).
- **🌓 Multiple Themes**:
    - **Whiteboard Mode**: Clean white background optimized for teaching.
    - **Dark Mode**: High-contrast dark theme for screen presentations.
    - **Print Friendly**: Minimalist black-on-white for saving ink.
- **📱 PWA Support**: Installable as a Progressive Web App on desktop and mobile devices.
- **🔒 Privacy First**: All processing happens in your browser. No data is sent to any server.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript
- **Styling**: Tailwind CSS (via CDN)
- **Icons**: Lucide Icons
- **PDF Generation**: `jspdf`, `html2canvas`

---

## 📖 Usage Guide

### 1. Input Format
Paste your questions into the text area. Options can be on separate lines or inline:

**Multiline format:**
```text
1. What is the capital of France?
   फ्रांस की राजधानी क्या है?
(a) Berlin          (b) Madrid
(c) Paris           (d) Rome
```

**Inline format:**
```text
2. Which planet is the Red Planet? (a) Earth (b) Mars (c) Jupiter (d) Saturn
```

### 2. Customization
- **Theme**: Switch between Whiteboard, Dark, and Print modes using the dropdown.
- **Live Preview**: See exactly how your slide will look as you type.

### 3. Generate PDF
- Click the **"Generate PDF"** button.
- Watch the progress bar as your slides are rendered.
- The PDF will automatically download once complete.

---

## 💻 Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/pavnxet/slides-maker.git
   cd slides-maker
   ```

2. **Run a local server**
   Since this project uses ES modules and Service Workers, it's best to run it on a local server.
   ```bash
   # Python 3
   python3 -m http.server 3000

   # Node.js (http-server)
   npx http-server .
   ```

3. **Open in Browser**
   Navigate to `http://localhost:3000` to view the app.

### Run Tests
```bash
node test_parser.js
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/pavnxet">pavnxet</a>
</p>
