import csv
import math
import os
import sys
from datetime import datetime

import cv2
import pygame
from mediapipe.python.solutions import drawing_utils as mp_drawing  # noqa: F401
from mediapipe.python.solutions import face_mesh as mp_face_mesh

EAR_THRESHOLD = 0.25  
EAR_CONSEC_FRAMES = 12   

MAR_THRESHOLD = 0.60  
YAWN_CONSEC_FRAMES = 12   

LOG_FILE = "drowsiness_log.csv"
ALARM_FILE = "alarm.wav"  

LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
MOUTH_VERTICAL = (13, 14)
MOUTH_HORIZONTAL = (61, 291)

def calculate_distance(p1, p2):
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)

def calculate_ear(landmarks, eye_indices, img_w, img_h):
    pts = [
        (int(landmarks[i].x * img_w), int(landmarks[i].y * img_h))
        for i in eye_indices
    ]
    v1 = calculate_distance(pts[1], pts[5])
    v2 = calculate_distance(pts[2], pts[4])
    h = calculate_distance(pts[0], pts[3])
    return (v1 + v2) / (2.0 * h) if h > 0 else 0.0

def calculate_mar(landmarks, img_w, img_h):
    p_top = (
        int(landmarks[MOUTH_VERTICAL[0]].x * img_w),
        int(landmarks[MOUTH_VERTICAL[0]].y * img_h),
    )
    p_bot = (
        int(landmarks[MOUTH_VERTICAL[1]].x * img_w),
        int(landmarks[MOUTH_VERTICAL[1]].y * img_h),
    )
    p_left = (
        int(landmarks[MOUTH_HORIZONTAL[0]].x * img_w),
        int(landmarks[MOUTH_HORIZONTAL[0]].y * img_h),
    )
    p_right = (
        int(landmarks[MOUTH_HORIZONTAL[1]].x * img_w),
        int(landmarks[MOUTH_HORIZONTAL[1]].y * img_h),
    )

    v_dist = calculate_distance(p_top, p_bot)
    h_dist = calculate_distance(p_left, p_right)
    return v_dist / h_dist if h_dist > 0 else 0.0

def log_event(event_type, ear, mar):
    file_exists = os.path.isfile(LOG_FILE)
    with open(LOG_FILE, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["Timestamp", "Event", "EAR", "MAR"])
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        writer.writerow([timestamp, event_type, f"{ear:.2f}", f"{mar:.2f}"])

pygame.mixer.init()
alarm_sound = None

if os.path.exists(ALARM_FILE):
    try:
        alarm_sound = pygame.mixer.Sound(ALARM_FILE)
        print(f"[OK] File audio '{ALARM_FILE}' berhasil dimuat.")
    except Exception as e:  # noqa: BLE001
        print(f"[WARNING] Gagal memuat file audio: {e}")
else:
    print(f"[INFO] File '{ALARM_FILE}' tidak ditemukan.")

face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("[ERROR] Kamera tidak terdeteksi!")
    sys.exit()

ear_counter = 0
yawn_counter = 0
alarm_playing = False
last_log_time = 0

print("Tekan 'q' pada jendela video untuk keluar.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)

    status_text = "STATUS: NORMAL"
    status_color = (0, 255, 0)

    if results.multi_face_landmarks:
        face_landmarks = results.multi_face_landmarks[0].landmark

        left_ear = calculate_ear(face_landmarks, LEFT_EYE_INDICES, w, h)
        right_ear = calculate_ear(face_landmarks, RIGHT_EYE_INDICES, w, h)
        avg_ear = (left_ear + right_ear) / 2.0
        mar = calculate_mar(face_landmarks, w, h)

        if mar > MAR_THRESHOLD:
            yawn_counter += 1
            if yawn_counter >= YAWN_CONSEC_FRAMES:
                status_text = "MENGUAP"
                status_color = (0, 165, 255)
                log_event("MENGUAP", avg_ear, mar)
        else:
            yawn_counter = 0

        if avg_ear < EAR_THRESHOLD:
            ear_counter += 1
            if ear_counter >= EAR_CONSEC_FRAMES:
                status_text = "MENGANTUK"
                status_color = (0, 0, 255)

                if alarm_sound and not alarm_playing:
                    alarm_sound.play(-1)
                    alarm_playing = True

                current_time = cv2.getTickCount() / cv2.getTickFrequency()
                if current_time - last_log_time > 1.0:
                    log_event("MENGANTUK", avg_ear, mar)
                    last_log_time = current_time
        else:
            ear_counter = 0
            if alarm_playing:
                if alarm_sound:
                    alarm_sound.stop()
                alarm_playing = False

        cv2.rectangle(frame, (0, 0), (w, 110), (20, 20, 20), -1)
        cv2.putText(
            frame,
            status_text,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            status_color,
            2,
        )
        cv2.putText(
            frame,
            f"EAR: {avg_ear:.2f} (Thresh: {EAR_THRESHOLD}) | Frames: {ear_counter}/{EAR_CONSEC_FRAMES}",
            (20, 75),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (220, 220, 220),
            1,
        )
        cv2.putText(
            frame,
            f"MAR: {mar:.2f} (Thresh: {MAR_THRESHOLD}) | Yawn Frames: {yawn_counter}/{YAWN_CONSEC_FRAMES}",
            (20, 95),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (220, 220, 220),
            1,
        )

        for idx in LEFT_EYE_INDICES + RIGHT_EYE_INDICES:
            pt = face_landmarks[idx]
            cv2.circle(frame, (int(pt.x * w), int(pt.y * h)), 1, (0, 255, 255), -1)
        for idx in [13, 14, 61, 291]:
            pt = face_landmarks[idx]
            cv2.circle(frame, (int(pt.x * w), int(pt.y * h)), 2, (255, 255, 0), -1)

    cv2.imshow("Drowsiness Detection System", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

if alarm_sound and alarm_playing:
    alarm_sound.stop()
cap.release()
cv2.destroyAllWindows()