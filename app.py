import argparse
import json
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "database.sqlite"
INITIAL_IDEAS = [
    ("Kalender PO (jadwal PO otomatis, diumumkan minimal H-14)", 5, 5),
    ("Wishlist novel + target tabungan", 4, 5),
    ("Notifikasi pengingat PO (H-14, H-7, H-1)", 4, 5),
    ("Pembayaran fleksibel (QRIS/e-wallet/virtual account)", 4, 4),
    ("Countdown PO + progres kuota", 4, 3),
    ("Cicilan bertahap / DP lalu cicil", 3, 5),
    ("Booking slot dengan DP kecil", 3, 4),
    ("Harga COD sama dengan harga TF", 3, 4),
    ("PO bergelombang (masa PO lebih panjang)", 4, 3),
    ("PO berdasarkan voting pembeli", 3, 3),
]


def initialize_database():
    is_new_database = not DATABASE_PATH.exists()
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                feasibility INTEGER NOT NULL CHECK (feasibility BETWEEN 1 AND 5),
                impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5)
            )
            """
        )
        if is_new_database:
            connection.executemany(
                "INSERT INTO ideas (name, feasibility, impact) VALUES (?, ?, ?)",
                INITIAL_IDEAS,
            )


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 10000:
            raise ValueError("Ukuran data terlalu besar.")
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/ideas":
            with sqlite3.connect(DATABASE_PATH) as connection:
                connection.row_factory = sqlite3.Row
                ideas = [
                    dict(row)
                    for row in connection.execute(
                        "SELECT id, name, feasibility, impact FROM ideas ORDER BY id"
                    )
                ]
            self.send_json(200, ideas)
            return
        if path.startswith("/api/"):
            self.send_json(404, {"error": "Endpoint tidak ditemukan."})
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/ideas":
            self.send_json(404, {"error": "Endpoint tidak ditemukan."})
            return

        try:
            payload = self.read_json()
            name = payload.get("name", "").strip()
            feasibility = payload.get("feasibility")
            impact = payload.get("impact")
            if not name:
                raise ValueError("Nama ide wajib diisi.")
            if (
                type(feasibility) is not int
                or type(impact) is not int
                or not 1 <= feasibility <= 5
                or not 1 <= impact <= 5
            ):
                raise ValueError("Skor kelayakan dan dampak harus berupa angka 1-5.")
        except (ValueError, AttributeError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error) or "Data tidak valid."})
            return

        with sqlite3.connect(DATABASE_PATH) as connection:
            cursor = connection.execute(
                "INSERT INTO ideas (name, feasibility, impact) VALUES (?, ?, ?)",
                (name, feasibility, impact),
            )
            idea_id = cursor.lastrowid
        self.send_json(
            201,
            {
                "id": idea_id,
                "name": name,
                "feasibility": feasibility,
                "impact": impact,
            },
        )

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path == "/api/ideas":
            with sqlite3.connect(DATABASE_PATH) as connection:
                connection.execute("DELETE FROM ideas")
            self.send_json(200, {"deleted": True})
            return
        if path.startswith("/api/ideas/"):
            try:
                idea_id = int(path.rsplit("/", 1)[1])
            except ValueError:
                self.send_json(400, {"error": "ID ide tidak valid."})
                return
            with sqlite3.connect(DATABASE_PATH) as connection:
                cursor = connection.execute("DELETE FROM ideas WHERE id = ?", (idea_id,))
            if cursor.rowcount == 0:
                self.send_json(404, {"error": "Ide tidak ditemukan."})
                return
            self.send_json(200, {"deleted": True})
            return
        self.send_json(404, {"error": "Endpoint tidak ditemukan."})


def main():
    parser = argparse.ArgumentParser(description="Val-Id dengan database SQLite")
    parser.add_argument(
        "--init-db",
        action="store_true",
        help="Buat database.sqlite dan isi data awal tanpa menjalankan server",
    )
    args = parser.parse_args()
    initialize_database()
    if args.init_db:
        print(f"Database siap: {DATABASE_PATH}")
        return

    server = ThreadingHTTPServer(("127.0.0.1", 8000), AppHandler)
    print("Val-Id berjalan di http://127.0.0.1:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
