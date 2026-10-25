import math
import sys

import cv2
import pygame
from mediapipe.python.solutions import drawing_utils as mp_drawing  # noqa: F401
from mediapipe.python.solutions import face_mesh as mp_face_mesh

EAR_THRESHOLD = 0.25 
EAR_CONSEC_FRAMES = 12 

LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]

def calculate_distance(point1, point2):
    return math.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2)

def calculate_ear(landmarks, eye_indices, img_w, img_h):
    pts = []
    for idx in eye_indices:
        lm = landmarks[idx]
        pts.append((int(lm.x * img_w), int(lm.y * img_h)))

    v1 = calculate_distance(pts[1], pts[5])
    v2 = calculate_distance(pts[2], pts[4])
    h = calculate_distance(pts[0], pts[3])

    if h == 0:
        return 0.0

    ear = (v1 + v2) / (2.0 * h)
    return ear

pygame.mixer.init()

face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Error: Kamera tidak dapat diakses.")
    sys.exit()

frame_counter = 0
alarm_on = False

print("ENGINE DETEKSI KANTUK AKTIF")
print("Tekan 'q' pada jendela video untuk keluar.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)

    if results.multi_face_landmarks:
        face_landmarks = results.multi_face_landmarks[0].landmark

        left_ear = calculate_ear(face_landmarks, LEFT_EYE_INDICES, w, h)
        right_ear = calculate_ear(face_landmarks, RIGHT_EYE_INDICES, w, h)
        avg_ear = (left_ear + right_ear) / 2.0

        if avg_ear < EAR_THRESHOLD:
            frame_counter += 1
            if frame_counter >= EAR_CONSEC_FRAMES:
                if not alarm_on:
                    alarm_on = True
                    pygame.mixer.stop()

                cv2.putText(
                    frame,
                    "PERINGATAN: BAHAYA KANTUK!",
                    (30, 80),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (0, 0, 255),
                    3,
                )
        else:
            frame_counter = 0
            alarm_on = False

        color = (0, 0, 255) if avg_ear < EAR_THRESHOLD else (0, 255, 0)
        cv2.putText(
            frame,
            f"EAR: {avg_ear:.2f}",
            (30, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            color,
            2,
        )
        cv2.putText(
            frame,
            f"Closed Frames: {frame_counter}/{EAR_CONSEC_FRAMES}",
            (30, 120),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            1,
        )

        for eye in [LEFT_EYE_INDICES, RIGHT_EYE_INDICES]:
            for idx in eye:
                pt = face_landmarks[idx]
                cx, cy = int(pt.x * w), int(pt.y * h)
                cv2.circle(frame, (cx, cy), 1, (255, 255, 0), -1)

    cv2.imshow("Drowsiness Detection System", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()