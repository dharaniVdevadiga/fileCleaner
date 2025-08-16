# Clean Your Images

**Clean Your Images** is a cross-platform desktop application that helps you quickly organize and clean up folders of images. It uses a [Flask](https://flask.palletsprojects.com/) backend for processing, a [React](https://react.dev/) + [Vite](https://vitejs.dev/) frontend for the UI, and [Electron](https://www.electronjs.org/) for packaging into a standalone desktop app.

---

## Techniques Highlighted

- **Safe File Operations**:  
  The backend uses careful file handling strategies:
  - Unique path resolution to prevent overwriting (`_unique_path`).  
  - [Shutil](https://docs.python.org/3/library/shutil.html) for safe file moving and deletion.  
  - Soft deletes into a `.trash` directory (instead of permanent deletion).

- **CORS Management in Flask**:  
  The API uses [Flask-CORS](https://flask-cors.readthedocs.io/en/latest/) to allow the Electron frontend to communicate with the Python backend.

- **React Components with Async API Calls**:  
  The frontend calls Flask endpoints using `fetch` to analyze image folders and apply actions.

- **Electron + Vite Integration**:  
  The project combines Electron for desktop distribution and Vite for a modern frontend development experience. This allows rapid iteration and then bundling into a distributable app.

---

## Libraries & Tools

- [Flask](https://flask.palletsprojects.com/) – Python micro web framework for the backend.
- [Flask-CORS](https://flask-cors.readthedocs.io/en/latest/) – Handles cross-origin requests.
- [React](https://react.dev/) – Frontend UI library.
- [Vite](https://vitejs.dev/) – Frontend build tool and dev server.
- [Electron](https://www.electronjs.org/) – Packages web apps as desktop apps.
- [7zip-bin](https://www.npmjs.com/package/7zip-bin) – Used internally by electron-builder for packaging.  
- Fonts (via Tailwind + shadcn/ui):  
  - [Inter](https://rsms.me/inter/) (default system-optimized sans serif).  
