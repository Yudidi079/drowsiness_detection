const $ = id => document.getElementById(id);
const RIGHT_EYE = [33, 160, 158, 133, 153, 144], LEFT_EYE = [362, 385, 387, 263, 373, 380], MOUTH = [61, 291, 0, 17, 84, 314, 13, 14];

let earThreshold = 0.25, marThreshold = 0.60, consecFrames = 12, currentEyeType = "Standar", activeSessionId = "SESI-001";
let camera = null, isCameraOn = false, frameCounter = 0, lastAlarmTime = 0, lastLogTime = 0, audioCtx = null, alarmType = 'beep', customAudioElement = null, barChartInstance = null, pieChartInstance = null;

const videoElement = $('webcam'), canvasElement = $('output_canvas'), canvasCtx = canvasElement.getContext('2d'), camPlaceholder =$('cam_placeholder');

document.addEventListener('DOMContentLoaded', openParamModal);
window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'q') closeApp(); });

function openParamModal() {
  const selectElem = $('eye_profile_select');
  selectElem.value = currentEyeType === "Standar" ? "0.25" : (currentEyeType === "Sipit" ? "0.15" : "custom");
  handleEyeProfileChange(selectElem.value);
  $('input_ear').value = earThreshold;
  $('input_mar').value = marThreshold;
  $('input_frames').value = consecFrames;
  updateModalBoxes();
  $('param_modal').classList.remove('hidden');
}

const closeParamModal = () => $('param_modal').classList.add('hidden');

function handleEyeProfileChange(val) {
  const isCustom = val === 'custom';
  $('custom_ear_box').classList.toggle('hidden', !isCustom);
  $('input_ear').value = isCustom ? (parseFloat($('custom_ear_input').value) || 0.18) : parseFloat(val);
  updateModalBoxes();
}

function syncCustomEar(val) {
  if (val) { $('input_ear').value = parseFloat(val); updateModalBoxes(); }
}

function updateModalBoxes() {
  $('box_ear_display').innerText = `${parseFloat($('input_ear').value) || 0.25} - Normal`;
  $('box_mar_display').innerText = `${parseFloat($('input_mar').value) || 0.60} - Normal`;
  $('box_frame_display').innerText = `${parseInt($('input_frames').value) || 60} Frames`;
}

function saveParams() {
  const pSelect = $('eye_profile_select').value;
  if (pSelect === 'custom') {
    const customVal = parseFloat($('custom_ear_input').value);
    if (!customVal || customVal <= 0 || customVal > 0.5) return alert("Masukkan nilai EAR Kustom yang valid (misal: 0.18)");
    earThreshold = customVal; currentEyeType = "Kustom";
  } else {
    earThreshold = parseFloat($('input_ear').value);
    currentEyeType = pSelect === '0.25' ? "Standar" : (pSelect === '0.15' ? "Sipit" : "Kustom");
  }
  marThreshold = parseFloat($('input_mar').value);
  consecFrames = parseInt($('input_frames').value);$('active_profile_badge').innerText = `Profil: ${currentEyeType} (EAR ${earThreshold})`;
  alert(`Profil & Parameter berhasil disimpan!\nProfil: ${currentEyeType}\nEAR: ${earThreshold} | MAR: ${marThreshold} | Frame: ${consecFrames}`);
  closeParamModal();
}

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function changeAlarmType(val) {
  alarmType = val;
  $('custom_audio_container').classList.toggle('hidden', val !== 'custom');
}

function handleAudioUpload(e) {
  if (e.target.files[0]) customAudioElement = new Audio(URL.createObjectURL(e.target.files[0]));
}

function playAlarm() {
  const now = Date.now();
  if (now - lastAlarmTime <= 800) return;
  lastAlarmTime = now;

  if (alarmType === 'custom') {
    if (customAudioElement) { customAudioElement.currentTime = 0; customAudioElement.play().catch(e => console.log(e)); }
    return;
  }

  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  const freqs = { beep: 1800, high: 2800, siren: 800 };
  const types = { beep: 'square', high: 'sawtooth', siren: 'sine' };

  osc.type = types[alarmType] || 'square';
  osc.frequency.setValueAtTime(freqs[alarmType] || 1800, audioCtx.currentTime);
  if (alarmType === 'siren') osc.frequency.exponentialRampToValueAtTime(2200, audioCtx.currentTime + 0.4);

  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function testAlarm() { initAudio(); lastAlarmTime = 0; playAlarm(); }

const faceMesh = new FaceMesh({ 
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` 
});
faceMesh.setOptions({ maxNumFaces: 1,
   refineLandmarks: true,
    minDetectionConfidence: 0.5,
     minTrackingConfidence: 0.5 
});
faceMesh.onResults(onResults);

const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

function calculateEAR(pts, lm) {
  const p = pts.map(i => lm[i]), h = dist(p[0], p[3]);
  return h ? (dist(p[1], p[5]) + dist(p[2], p[4])) / (2.0 * h) : 0;
}

function calculateMAR(pts, lm) {
  const p = pts.map(i => lm[i]), h = dist(p[0], p[1]);
  return h ? dist(p[6], p[7]) / h : 0;
}

function estimateHeadPose(lm, w, h) {
  const angle = Math.atan2((lm[263].y - lm[33].y) * h, (lm[263].x - lm[33].x) * w) * (180 / Math.PI);
  if (angle > 22) return "Miring Kiri"; if (angle < -22) return "Miring Kanan";

  const eyeWidth = Math.abs(lm[263].x - lm[33].x);
  if (eyeWidth > 0) {
    const yaw = (lm[1].x - (lm[263].x + lm[33].x) / 2.0) / eyeWidth;
    if (yaw > 0.35) return "Menoleh Kanan"; if (yaw < -0.35) return "Menoleh Kiri";
  }

  const lowerDist = lm[152].y - lm[1].y;
  if (lowerDist > 0) {
    const pitch = (lm[1].y - (lm[263].y + lm[33].y) / 2.0) / lowerDist;
    if (pitch < 0.25) return "Menengadah"; if (pitch > 0.95) return "Menunduk";
  }
  return "Lurus Depan";
}

function logEvent(earVal, marVal, statusText) {
  const now = Date.now();
  if (now - lastLogTime > 3000) {
    lastLogTime = now;
    const logs = JSON.parse(localStorage.getItem('drowsiness_logs') || '[]');
    const isCritical = statusText.includes("MENGANTUK");
    logs.push({
      idLog: `LOG-${(logs.length + 1).toString().padStart(2, '0')}`,
      idSesi: activeSessionId,
      timestamp: new Date().toLocaleString('id-ID'),
      jenis: statusText, tipeMata: currentEyeType,
      durasi: isCritical ? "4.2 Detik" : "2.5 Detik",
      status: isCritical ? "Critical" : "Warning",
      ear: earVal.toFixed(2), mar: marVal.toFixed(2)
    });
    localStorage.setItem('drowsiness_logs', JSON.stringify(logs));
  }
}

function setStat(id, text, isError) {
  $(id).innerText = text;
  $(id).className = isError ? "text-red-400 font-bold" : "text-green-400";
}

function onResults(results) {
  canvasElement.width = videoElement.videoWidth || 640;
  canvasElement.height = videoElement.videoHeight || 480;
  canvasCtx.save(); canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const lm = results.multiFaceLandmarks[0], w = canvasElement.width, h = canvasElement.height;
    const avgEar = (calculateEAR(LEFT_EYE, lm) + calculateEAR(RIGHT_EYE, lm)) / 2.0;
    const mar = calculateMAR(MOUTH, lm), headPose = estimateHeadPose(lm, w, h);

    $('ear_val').innerText = avgEar.toFixed(2);
    $('mar_val').innerText = mar.toFixed(2);$('head_val').innerText = headPose;

    if (avgEar < earThreshold) { frameCounter++; setStat('ear_stat', "Terpejam", true); }
    else { frameCounter = 0; setStat('ear_stat', "Normal", false); }

    const isDrowsy = frameCounter >= consecFrames, isYawning = mar > marThreshold;
    setStat('mar_stat', isYawning ? "Menguap" : "Normal", isYawning);
    setStat('head_stat', headPose === "Lurus Depan" ? "Normal" : "Miring/Paling", headPose !== "Lurus Depan");

    const statusBox = $('status_box'), statusText =$('status_text');
    let msg = isDrowsy && isYawning ? "MENGANTUK & MENGUAP" : (isDrowsy ? "MENGANTUK" : (isYawning ? "MENGUAP" : "NORMAL"));

    if (msg !== "NORMAL") {
      statusText.innerText = `[ ${msg} ]`;
      statusBox.className = `bg-[${isDrowsy ? '#e74c3c' : '#e67e22'}] p-2.5 rounded-md text-center transition-colors`;
      if (isDrowsy) playAlarm();
      logEvent(avgEar, mar, msg);
    } else {
      statusText.innerText = "[ NORMAL ]";
      statusBox.className = "bg-[#2ecc71] p-2.5 rounded-md text-center transition-colors";
    }

    canvasCtx.fillStyle = '#00FF00';
    [...LEFT_EYE, ...RIGHT_EYE, ...MOUTH].forEach(idx => {
      canvasCtx.beginPath(); canvasCtx.arc(lm[idx].x * w, lm[idx].y * h, 1.5, 0, 2 * Math.PI); canvasCtx.fill();
    });
  }
  canvasCtx.restore();
}

function toggleCamera() {
  const btn = $('btn_toggle'), statusBox = $('status_box'), statusText =$('status_text');
  if (!isCameraOn) {
    initAudio();
    camera = new Camera(videoElement, { 
      onFrame: async () => { 
        await faceMesh.send({ image: videoElement }); }, 
        width: 640, height: 480 });
    camera.start(); 
    isCameraOn = true;
    btn.innerHTML = "<span>&#9632;</span> Stop Kamera";
    btn.className = "w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold py-2.5 rounded-md mb-2 transition text-sm flex items-center justify-center gap-1";
    camPlaceholder.classList.add('hidden'); canvasElement.classList.remove('hidden');
    statusText.innerText = "[ SISTEM MENDETEKSI - KAMERA AKTIF ]";
    statusBox.className = "bg-[#2ecc71] p-2.5 rounded-md text-center transition-colors";
  } else {
    if (camera) camera.stop();
    isCameraOn = false;
    btn.innerHTML = "<span>&#9654;</span> Start Kamera";
    btn.className = "w-full bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold py-2.5 rounded-md mb-2 transition text-sm flex items-center justify-center gap-1";
    camPlaceholder.classList.remove('hidden'); canvasElement.classList.add('hidden');
    statusText.innerText = "[ KAMERA NONAKTIF ]";
    statusBox.className = "bg-[#f39c12] p-2.5 rounded-md text-center transition-colors";
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    $('ear_val').innerText = $('mar_val').innerText =$('head_val').innerText = "-";
  }
}

function openLogModal() {
  const logs = JSON.parse(localStorage.getItem('drowsiness_logs') || '[]'), tbody = $('log_table_body');
  tbody.innerHTML = logs.length === 0 ? `<tr><td colspan="8" class="p-4 text-gray-500 italic">Belum ada riwayat catatan deteksi.</td></tr>` : '';

  logs.forEach((l, i) => {
    tbody.innerHTML += `
      <tr class="bg-white hover:bg-gray-100 transition">
        <td class="p-2 border border-gray-300">${i + 1}</td>
        <td class="p-2 border border-gray-300 font-mono">${l.idLog || 'LOG-' + (i+1)}</td>
        <td class="p-2 border border-gray-300 font-mono">${l.idSesi || activeSessionId}</td>
        <td class="p-2 border border-gray-300">${l.timestamp}</td>
        <td class="p-2 border border-gray-300">${l.jenis}</td>
        <td class="p-2 border border-gray-300">${l.tipeMata || 'Standar'}</td>
        <td class="p-2 border border-gray-300">${l.durasi || '3.0 Detik'}</td>
        <td class="p-2 border border-gray-300"><span class="text-${l.status === 'Critical' ? 'red' : 'yellow'}-600 font-bold">${l.status}</span></td>
      </tr>`;
  });
  $('log_count_info').innerText = logs.length ? `Menampilkan 1 - ${logs.length} dari ${logs.length} data` : 'Menampilkan 0 data';
  $('log_modal').classList.remove('hidden');
}

const closeLogModal = () => $('log_modal').classList.add('hidden');

function downloadCSV() {
  const logs = JSON.parse(localStorage.getItem('drowsiness_logs') || '[]');
  if (!logs.length) return alert('Belum ada data log tersimpan.');
  let csv = "No,ID LOG,ID SESI,WAKTU KEJADIAN,JENIS KEJADIAN,TIPE MATA,DURASI,STATUS,EAR,MAR\n";
  logs.forEach((l, i) => { csv += `${i + 1},${l.idLog || 'LOG-'+(i+1)},${l.idSesi || activeSessionId},
  ${l.timestamp},${l.jenis},${l.tipeMata || 'Standar'},${l.durasi || '3.0 Detik'},${l.status},${l.ear},${l.mar}\n`; });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `drowsiness_log_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

function resetLogData() {
  if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat log & mereset grafik tren?')) {
    localStorage.removeItem('drowsiness_logs'); alert('Data berhasil direset!'); closeChartModal();
  }
}

function openChartModal() {
  const logs = JSON.parse(localStorage.getItem('drowsiness_logs') || '[]');
  if (!logs.length) return alert('Belum ada data kejadian terdeteksi di dalam log.');

  $('chart_modal').classList.remove('hidden');
  const hourlyData = {}, totals = { "MENGANTUK": 0, "MENGUAP": 0, "MENGANTUK & MENGUAP": 0 };

  logs.forEach(l => {
    const hour = l.timestamp.length > 10 ? l.timestamp.substring(11, 13) + ":00" : "12:00";
    if (!hourlyData[hour]) hourlyData[hour] = { drowsy: 0, yawn: 0, both: 0 };
    if (l.jenis === "MENGANTUK") { hourlyData[hour].drowsy++; totals["MENGANTUK"]++; }
    else if (l.jenis === "MENGUAP") { hourlyData[hour].yawn++; totals["MENGUAP"]++; }
    else if (l.jenis === "MENGANTUK & MENGUAP") { hourlyData[hour].both++; totals["MENGANTUK & MENGUAP"]++; }
  });

  const hours = Object.keys(hourlyData).sort();
  if (barChartInstance) barChartInstance.destroy();
  barChartInstance = new Chart($('bar_chart'), {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [
        { label: 'Mengantuk', data: hours.map(h => hourlyData[h].drowsy), backgroundColor: '#e74c3c' },
        { label: 'Menguap', data: hours.map(h => hourlyData[h].yawn), backgroundColor: '#e67e22' },
        { label: 'Keduanya', data: hours.map(h => hourlyData[h].both), backgroundColor: '#8e44ad' }
      ]
    }, options: { responsive: true, plugins: { legend: { labels: { color: '#333' } } } }
  });

  if (pieChartInstance) pieChartInstance.destroy();
  pieChartInstance = new Chart($('pie_chart'), {
    type: 'pie',
    data: {
      labels: ['Mengantuk', 'Menguap', 'Mengantuk & Menguap'],
      datasets: [{ data: [totals["MENGANTUK"], totals["MENGUAP"], totals["MENGANTUK & MENGUAP"]], backgroundColor: ['#e74c3c', '#e67e22', '#8e44ad'] }]
    }, options: { responsive: true, plugins: { legend: { labels: { color: '#333' } } } }
  });
}

const closeChartModal = () => $('chart_modal').classList.add('hidden');

function closeApp() {
  if (isCameraOn) toggleCamera();
  alert("Sesi telah diakhiri."); window.location.reload();
}