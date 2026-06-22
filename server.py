from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import json
import sqlite3
import uuid
import random
from datetime import datetime, timedelta


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "annamacharya.db"
BRANCHES = [
    "AI&DS",
    "AI&ML",
    "CSE(AI)",
    "CSE(DS)",
    "CSE(IOT)",
    "CSE(AI&ML)",
    "ECE",
    "EEE",
    "CIVIL",
]
HOD_USER = "bpk@2024"
HOD_PASSWORD = "20242028"


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT NOT NULL,
                mobile TEXT NOT NULL,
                branch TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                faculty_username TEXT NOT NULL,
                student_username TEXT,
                branch TEXT NOT NULL,
                subject TEXT NOT NULL,
                student_name TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS marks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_username TEXT NOT NULL,
                subject TEXT NOT NULL,
                category TEXT NOT NULL,
                score INTEGER NOT NULL,
                total INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS notices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                audience TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_username TEXT NOT NULL,
                label TEXT NOT NULL,
                amount INTEGER NOT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS password_resets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                otp TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        columns = [row["name"] for row in conn.execute("PRAGMA table_info(attendance)").fetchall()]
        if "student_username" not in columns:
            conn.execute("ALTER TABLE attendance ADD COLUMN student_username TEXT")
        notice_count = conn.execute("SELECT COUNT(*) AS total FROM notices").fetchone()["total"]
        if notice_count == 0:
            conn.executemany(
                "INSERT INTO notices (title, body, audience) VALUES (?, ?, ?)",
                [
                    ("Mid Examination Schedule", "Mid-I exams begin Monday. Hall tickets are available in the profile section.", "All"),
                    ("Innovation Day", "AI, IoT and data science project demos are open for registrations.", "Students"),
                    ("Faculty Review", "Department review meeting at 3:30 PM in the conference hall.", "Faculty"),
                ],
            )
        seed_user_count = conn.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"]
        if seed_user_count == 0:
            seed_users(conn)


def seed_users(conn):
    users = [
        ("Ravi Kumar", "student", "student123", "ravi@student.edu", "9876543210", "AI&DS", "student"),
        ("Dr. Priya Sharma", "faculty", "faculty123", "priya@aec.edu", "9876501234", "CSE(AI)", "faculty"),
    ]
    for full_name, username, password, email, mobile, branch, role in users:
        conn.execute(
            """
            INSERT INTO users (id, full_name, username, password, email, mobile, branch, role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), full_name, username, password, email, mobile, branch, role),
        )
    conn.executemany(
        "INSERT INTO marks (student_username, subject, category, score, total) VALUES (?, ?, ?, ?, ?)",
        [
            ("student", "Java", "Mid Marks", 80, 100),
            ("student", "Python", "Mid Marks", 95, 100),
            ("student", "Java Lab", "Mid Lab", 70, 100),
            ("student", "C++ Lab", "Mid Lab", 85, 100),
        ],
    )
    conn.executemany(
        "INSERT INTO payments (student_username, label, amount, status) VALUES (?, ?, ?, ?)",
        [
            ("student", "Tuition Fee", 45000, "Paid"),
            ("student", "Library Fee", 2500, "Due"),
            ("student", "Exam Fee", 1800, "Paid"),
        ],
    )
    conn.executemany(
        "INSERT INTO attendance (faculty_username, student_username, branch, subject, student_name, status) VALUES (?, ?, ?, ?, ?, ?)",
        [
            ("faculty", "student", "AI&DS", "Java", "Ravi Kumar", "Present"),
            ("faculty", "student", "AI&ML", "Python", "Meghana Reddy", "Present"),
            ("faculty", "student", "CSE(AI)", "Data Structures", "Ravi Kumar", "Present"),
            ("faculty", "student", "CSE(DS)", "C++ Lab", "Ravi Kumar", "Present"),
        ],
    )


def row_to_dict(row):
    return dict(row) if row else None


def read_body(handler):
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def send_json(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class AppHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def translate_path(self, path):
        parsed = urlparse(path).path
        if parsed == "/":
            parsed = "/index.html"
        return str(ROOT / parsed.lstrip("/"))

    def do_GET(self):
        parsed = urlparse(self.path).path
        if parsed == "/api/bootstrap":
            return self.bootstrap()
        if parsed.startswith("/api/user/"):
            return self.user(parsed.rsplit("/", 1)[-1])
        if parsed == "/api/notices":
            return self.notices()
        if parsed == "/api/hod":
            return self.hod()
        if parsed == "/api/students":
            return self.students()
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path).path
        if parsed == "/api/register":
            return self.register()
        if parsed == "/api/login":
            return self.login()
        if parsed == "/api/forgot":
            return self.forgot()
        if parsed == "/api/reset-password":
            return self.reset_password()
        if parsed == "/api/attendance":
            return self.save_attendance()
        if parsed == "/api/marks":
            return self.save_mark()
        if parsed == "/api/profile":
            return self.update_profile()
        send_json(self, 404, {"error": "Route not found"})

    def bootstrap(self):
        send_json(self, 200, {"branches": BRANCHES})

    def notices(self):
        with connect() as conn:
            rows = conn.execute("SELECT * FROM notices ORDER BY id DESC").fetchall()
        send_json(self, 200, {"notices": [row_to_dict(row) for row in rows]})

    def hod(self):
        send_json(
            self,
            200,
            {
                "name": "Dr. B.Phaneendra kumar",
                "profession": "HOD",
                "branch": "AI&DS",
                "students": 1500,
                "reports": [
                    "Attendance consolidation is ready",
                    "Mid marks review completed",
                    "Lab performance above department target",
                ],
            },
        )

    def students(self):
        with connect() as conn:
            rows = conn.execute(
                """
                SELECT full_name, username, branch, email
                FROM users
                WHERE role = 'student'
                ORDER BY full_name
                """
            ).fetchall()
        send_json(self, 200, {"students": [row_to_dict(row) for row in rows]})

    def user(self, username):
        with connect() as conn:
            user = conn.execute("SELECT id, full_name, username, email, mobile, branch, role FROM users WHERE username = ?", (username,)).fetchone()
            marks = conn.execute("SELECT * FROM marks WHERE student_username = ?", (username,)).fetchall()
            payments = conn.execute("SELECT * FROM payments WHERE student_username = ?", (username,)).fetchall()
            attendance = conn.execute(
                """
                SELECT *
                FROM attendance
                WHERE student_username = ? OR student_name = ?
                ORDER BY id DESC
                LIMIT 12
                """,
                (username, user["full_name"] if user else ""),
            ).fetchall()
        if not user:
            return send_json(self, 404, {"error": "User not found"})
        send_json(
            self,
            200,
            {
                "user": row_to_dict(user),
                "marks": [row_to_dict(row) for row in marks],
                "payments": [row_to_dict(row) for row in payments],
                "attendance": [row_to_dict(row) for row in attendance],
            },
        )

    def register(self):
        data = read_body(self)
        required = ["full_name", "username", "password", "email", "mobile", "branch", "role"]
        if any(not data.get(field) for field in required):
            return send_json(self, 400, {"error": "Please fill every registration field."})
        if len(data["password"]) < 6:
            return send_json(self, 400, {"error": "Password must be minimum 6 characters."})
        if data["branch"] not in BRANCHES:
            return send_json(self, 400, {"error": "Please select a valid branch."})
        if data["role"] not in ["student", "faculty"]:
            return send_json(self, 400, {"error": "Please choose student or faculty."})
        try:
            with connect() as conn:
                conn.execute(
                    """
                    INSERT INTO users (id, full_name, username, password, email, mobile, branch, role)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        data["full_name"].strip(),
                        data["username"].strip(),
                        data["password"],
                        data["email"].strip(),
                        data["mobile"].strip(),
                        data["branch"],
                        data["role"],
                    ),
                )
                if data["role"] == "student":
                    conn.executemany(
                        "INSERT INTO marks (student_username, subject, category, score, total) VALUES (?, ?, ?, ?, ?)",
                        [
                            (data["username"], "Java", "Mid Marks", 80, 100),
                            (data["username"], "Python", "Mid Marks", 95, 100),
                            (data["username"], "Java Lab", "Mid Lab", 70, 100),
                            (data["username"], "C++ Lab", "Mid Lab", 85, 100),
                        ],
                    )
                    conn.executemany(
                        "INSERT INTO payments (student_username, label, amount, status) VALUES (?, ?, ?, ?)",
                        [
                            (data["username"], "Tuition Fee", 45000, "Due"),
                            (data["username"], "Library Fee", 2500, "Due"),
                            (data["username"], "Exam Fee", 1800, "Paid"),
                        ],
                    )
        except sqlite3.IntegrityError:
            return send_json(self, 409, {"error": "Username already exists."})
        send_json(self, 201, {"message": "Registration saved. Please login.", "username": data["username"]})

    def login(self):
        data = read_body(self)
        if data.get("username") == HOD_USER and data.get("password") == HOD_PASSWORD and data.get("role") == "hod":
            return send_json(self, 200, {"role": "hod", "username": HOD_USER, "full_name": "Dr. B.Phaneendra kumar"})
        with connect() as conn:
            user = conn.execute(
                """
                SELECT id, full_name, username, email, mobile, branch, role
                FROM users
                WHERE username = ? AND password = ? AND role = ?
                """,
                (data.get("username"), data.get("password"), data.get("role")),
            ).fetchone()
        if not user:
            return send_json(self, 401, {"error": "Invalid username, password or login type."})
        payload = row_to_dict(user)
        send_json(self, 200, payload)

    def forgot(self):
        data = read_body(self)
        with connect() as conn:
            user = conn.execute(
                "SELECT username, email, mobile, role FROM users WHERE username = ? AND role IN ('student', 'faculty')",
                (data.get("username"),),
            ).fetchone()
        if not user:
            return send_json(self, 404, {"error": "No student or faculty account found for this username."})
        otp = f"{random.randint(100000, 999999)}"
        expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
        with connect() as conn:
            conn.execute(
                "INSERT INTO password_resets (username, otp, expires_at) VALUES (?, ?, ?)",
                (user["username"], otp, expires_at),
            )
        send_json(
            self,
            200,
            {
                "message": f"OTP sent to registered email {user['email']}.",
                "email": user["email"],
                "otp": otp,
            },
        )

    def reset_password(self):
        data = read_body(self)
        username = data.get("username", "").strip()
        otp = data.get("otp", "").strip()
        new_password = data.get("password", "")
        if len(new_password) < 6:
            return send_json(self, 400, {"error": "Password must be minimum 6 characters."})
        with connect() as conn:
            reset = conn.execute(
                """
                SELECT *
                FROM password_resets
                WHERE username = ? AND otp = ? AND used = 0
                ORDER BY id DESC
                LIMIT 1
                """,
                (username, otp),
            ).fetchone()
            if not reset:
                return send_json(self, 400, {"error": "Invalid OTP."})
            if datetime.fromisoformat(reset["expires_at"]) < datetime.utcnow():
                return send_json(self, 400, {"error": "OTP expired. Please request a new OTP."})
            conn.execute("UPDATE users SET password = ? WHERE username = ?", (new_password, username))
            conn.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (reset["id"],))
        send_json(self, 200, {"message": "Password reset successful. Please login."})

    def save_attendance(self):
        data = read_body(self)
        student_username = data.get("student_username", "")
        with connect() as conn:
            student = conn.execute(
                "SELECT full_name, branch FROM users WHERE username = ? AND role = 'student'",
                (student_username,),
            ).fetchone()
        if not student:
            return send_json(self, 400, {"error": "Please select a registered student."})
        with connect() as conn:
            conn.execute(
                "INSERT INTO attendance (faculty_username, student_username, branch, subject, student_name, status) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    data.get("faculty_username"),
                    student_username,
                    data.get("branch") or student["branch"],
                    data.get("subject"),
                    student["full_name"],
                    data.get("status", "Present"),
                ),
            )
            rows = conn.execute("SELECT * FROM attendance ORDER BY id DESC LIMIT 8").fetchall()
        send_json(self, 201, {"message": "Attendance saved.", "attendance": [row_to_dict(row) for row in rows]})

    def save_mark(self):
        data = read_body(self)
        with connect() as conn:
            conn.execute(
                "INSERT INTO marks (student_username, subject, category, score, total) VALUES (?, ?, ?, ?, ?)",
                (data.get("student_username"), data.get("subject"), data.get("category"), int(data.get("score", 0)), int(data.get("total", 100))),
            )
        send_json(self, 201, {"message": "Marks saved."})

    def update_profile(self):
        data = read_body(self)
        with connect() as conn:
            conn.execute(
                "UPDATE users SET full_name = ?, email = ?, mobile = ?, branch = ? WHERE username = ?",
                (data.get("full_name"), data.get("email"), data.get("mobile"), data.get("branch"), data.get("username")),
            )
        send_json(self, 200, {"message": "Profile updated."})


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer(("127.0.0.1", 8000), AppHandler)
    print("Annamacharya University app running at http://127.0.0.1:8000")
    server.serve_forever()
