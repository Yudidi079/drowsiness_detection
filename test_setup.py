import sys

import cv2
import pygame
from mediapipe.python.solutions import drawing_utils as mp_drawing
from mediapipe.python.solutions import face_mesh as mp_face_mesh

try:
    pygame.mixer.init()
    print("[OK] Pygame Audio Mixer aktif.")
except Exception as e:  # noqa: BLE001
    print(f"[ERROR] Pygame Audio gagal: {e}")

try:
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    print("[OK] MediaPipe Face Mesh berhasil diinisialisasi.")
except Exception as e:  # noqa: BLE001
    print(f"[ERROR] MediaPipe Face Mesh gagal: {e}")
    sys.exit()

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("[ERROR] Kamera tidak terdeteksi!")
    sys.exit()

print("[OK] Kamera terdeteksi.")
print("\nMembuka kamera... Tekan 'q' untuk keluar.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("[ERROR] Gagal mengambil gambar dari kamera.")
        break

    frame = cv2.flip(frame, 1)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)

    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            mp_drawing.draw_landmarks(
                image=frame,
                landmark_list=face_landmarks,
                connections=mp_face_mesh.FACEMESH_TESSELATION,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing.DrawingSpec(
                    color=(0, 255, 0), thickness=1, circle_radius=1
                ),
            )

    cv2.putText(
        frame,
        "Tekan 'q' untuk keluar.",
        (30, 50),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 255, 0),
        2,
    )

    cv2.imshow("Test Setup Drowsiness Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()