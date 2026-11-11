import os

import cv2
import mediapipe as mp
import numpy as np

# Inisialisasi modul MediaPipe Face Mesh untuk deteksi landmark wajah
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=True,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5
)

# Ambang batas deteksi mata pejam (EAR) dan menguap (MAR)
EAR_THRESHOLD = 0.25
MAR_THRESHOLD = 0.60

# Indeks landmark titik mata kiri, mata kanan, dan mulut
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]
MOUTH = [61, 291, 0, 17, 84, 314, 13, 14]

def dist(p1, p2):
    return np.linalg.norm(np.array([p1.x - p2.x, p1.y - p2.y]))

def calculate_ear(eye_pts, landmarks):
    p = [landmarks[idx] for idx in eye_pts]
    v1 = dist(p[1], p[5])
    v2 = dist(p[2], p[4])
    h = dist(p[0], p[3])
    return (v1 + v2) / (2.0 * h) if h != 0 else 0

def calculate_mar(mouth_pts, landmarks):
    p = [landmarks[idx] for idx in mouth_pts]
    v = dist(p[6], p[7])
    h = dist(p[0], p[1])
    return v / h if h != 0 else 0

def test_category(folder_path, expected_type):
    if not os.path.exists(folder_path):
        print(f"Folder tidak ditemukan: {folder_path}")
        return 0, 0, 0

    # Inisialisasi variabel penghitung statistik evaluasi
    total_images = 0
    correct = 0
    undetected = 0

    # Filter daftar file yang memiliki ekstensi gambar valid
    valid_exts = ('.jpg', '.jpeg', '.png', '.bmp')
    file_list = [f for f in os.listdir(folder_path) if f.lower().endswith(valid_exts)]

    # Iterasi setiap file gambar dalam direktori
    for filename in file_list:
        img_path = os.path.join(folder_path, filename)
        image = cv2.imread(img_path)
        if image is None:
            continue

        total_images += 1
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_image)

        # Cek jika landmark wajah tidak terdeteksi
        if not results.multi_face_landmarks:
            undetected += 1
            continue

        landmarks = results.multi_face_landmarks[0].landmark

        # Evaluasi kategori mata terpejam
        if expected_type == 'eye_closed':
            left_ear = calculate_ear(LEFT_EYE, landmarks)
            right_ear = calculate_ear(RIGHT_EYE, landmarks)
            avg_ear = (left_ear + right_ear) / 2.0
            if avg_ear < EAR_THRESHOLD:
                correct += 1

        # Evaluasi kategori mata terbuka
        elif expected_type == 'eye_open':
            left_ear = calculate_ear(LEFT_EYE, landmarks)
            right_ear = calculate_ear(RIGHT_EYE, landmarks)
            avg_ear = (left_ear + right_ear) / 2.0
            if avg_ear >= EAR_THRESHOLD:
                correct += 1

        # Evaluasi kategori menguap berdasarkan nilai MAR
        elif expected_type == 'yawn':
            mar = calculate_mar(MOUTH, landmarks)
            if mar > MAR_THRESHOLD:
                correct += 1

        # Evaluasi kategori tidak menguap
        elif expected_type == 'no_yawn':
            mar = calculate_mar(MOUTH, landmarks)
            if mar <= MAR_THRESHOLD:
                correct += 1

    return total_images, correct, undetected

DATASET_BASE_DIR = "dataset"

categories = [
    ("Closed", "eye_closed", "Mata Terpejam"),
    ("Open", "eye_open", "Mata Terbuka"),
    ("yawn", "yawn", "Mulut Menguap"),
    ("no_yawn", "no_yawn", "Mulut Normal")
]

# Menampilkan header laporan pengujian akurasi sistem
print("="*50)
print("  PENGUJIAN AKURASI SISTEM DETEKSI KANTUK")
print("="*50)

total_all_images = 0
total_all_correct = 0

# Iterasi pengujian untuk setiap folder kategori dataset
for folder_name, exp_type, label_name in categories:
    folder_full_path = os.path.join(DATASET_BASE_DIR, folder_name)
    tot, corr, undet = test_category(folder_full_path, exp_type)

    # Menghitung dan menampilkan persentase akurasi per kategori
    if tot > 0:
        acc = (corr / tot) * 100
        print(f"\n Kategori: {label_name}")
        print(f"   • Total Gambar     : {tot}")
        print(f"   • Prediksi Benar   : {corr}")
        print(f"   • Wajah Tak Terbaca: {undet}")
        print(f"   • Akurasi Kategori : {acc:.2f}%")

        total_all_images += tot
        total_all_correct += corr

print("\n" + "="*50)
if total_all_images > 0:
    final_accuracy = (total_all_correct / total_all_images) * 100
    print(f" AKURASI KESELURUHAN: {final_accuracy:.2f}%")
else:
    print(" Folder dataset tidak ditemukan atau kosong.")
print("="*50)
