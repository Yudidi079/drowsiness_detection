import math
import sys

import cv2
import pygame
from mediapipe.python.solutions import drawing_utils as mp_drawing  # noqa: F401
from mediapipe.python.solutions import face_mesh as mp_face_mesh

EAR_THRESHOLD = 0.25      
EAR_CONSEC_FRAMES = 12     

MAR_THRESHOLD = 0.60       
YAWN_CONSEC_FRAMES = 12    

LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]

MOUTH_VERTICAL = (13, 14)
MOUTH_HORIZONTAL = (61, 291)

def calculate_distance(point1, point2):
    return math.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2)

def calculate_ear(landmarks, eye_indices, img_w, img_h):
    pts = [(int(landmarks[idx].x * img_w), int(landmarks[idx].y * img_h)) for idx in eye_indices]
    v1 = calculate_distance(pts[1], pts[5])
    v2 = calculate_distance(pts[2], pts[4])
    h = calculate_distance(pts[0], pts[3])
    return (v1 + v2) / (2.0 * h) if h > 0 else 0.0

def calculate_mar(landmarks, img_w, img_h):
    p_top = (int(landmarks[MOUTH_VERTICAL[0]].x * img_w), int(landmarks[MOUTH_VERTICAL[0]].y * img_h))
    p_bot = (int(landmarks[MOUTH_VERTICAL[1]].x * img_w), int(landmarks[MOUTH_VERTICAL[1]].y * img_h))
    p_left = (int(landmarks[MOUTH_HORIZONTAL[0]].x * img_w), int(landmarks[MOUTH_HORIZONTAL[0]].y * img_h))
    p_right = (int(landmarks[MOUTH_HORIZONTAL[1]].x * img_w), int(landmarks[MOUTH_HORIZONTAL[1]].y * img_h))

    vertical_dist = calculate_distance(p_top, p_bot)
    horizontal_dist = calculate_distance(p_left, p_right)

    return vertical_dist / horizontal_dist if horizontal_dist > 0 else 0.0

pygame.mixer.init()

face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Error: Kamera tidak terdeteksi!")
    sys.exit()

ear_counter = 0
yawn_counter = 0

print("Tekan 'q' pada jendela video untuk menghentikan program.")

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
        mar = calculate_mar(face_landmarks, w, h)

        if avg_ear < EAR_THRESHOLD:
            ear_counter += 1
            if ear_counter >= EAR_CONSEC_FRAMES:
                cv2.putText(
                    frame,
                    "MENGANTUK",
                    (30, 90),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 0, 255),
                    2,
                )
        else:
            ear_counter = 0

        if mar > MAR_THRESHOLD:
            yawn_counter += 1
            if yawn_counter >= YAWN_CONSEC_FRAMES:
                cv2.putText(
                    frame,
                    "MENGUAP",
                    (30, 130),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 165, 255),
                    2,
                )
        else:
            yawn_counter = 0

        ear_color = (0, 0, 255) if avg_ear < EAR_THRESHOLD else (0, 255, 0)
        mar_color = (0, 165, 255) if mar > MAR_THRESHOLD else (0, 255, 0)

        cv2.putText(
            frame,
            f"EAR (Mata): {avg_ear:.2f}",
            (30, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            ear_color,
            2,
        )
        cv2.putText(
            frame,
            f"MAR (Mulut): {mar:.2f}",
            (300, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            mar_color,
            2,
        )

        for idx in LEFT_EYE_INDICES + RIGHT_EYE_INDICES:
            pt = face_landmarks[idx]
            cv2.circle(frame, (int(pt.x * w), int(pt.y * h)), 1, (0, 255, 255), -1)

        for idx in [13, 14, 61, 291]:
            pt = face_landmarks[idx]
            cv2.circle(frame, (int(pt.x * w), int(pt.y * h)), 2, (255, 255, 0), -1)

    cv2.imshow("Drowsiness Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()