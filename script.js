// --- BACKGROUND NEURAL / CONSTELLATION PARTICLES EFFECT ---
const bgCanvas = document.createElement('canvas');
bgCanvas.id = 'bg_canvas';
bgCanvas.className = 'fixed inset-0 pointer-events-none z-0 opacity-40';
document.body.prepend(bgCanvas);

const ctxBg = bgCanvas.getContext('2d');
let particlesArray = [];

function resizeBgCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeBgCanvas);
resizeBgCanvas();

const mouse = { x: null, y: null, radius: 150 };
window.addEventListener('mousemove', (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

class Particle {
  constructor() {
    this.x = Math.random() * bgCanvas.width;
    this.y = Math.random() * bgCanvas.height;
    this.vx = (Math.random() - 0.5) * 0.8;
    this.vy = (Math.random() - 0.5) * 0.8;
    this.size = Math.random() * 2 + 1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > bgCanvas.width) this.vx = -this.vx;
    if (this.y < 0 || this.y > bgCanvas.height) this.vy = -this.vy;
  }
  draw() {
    ctxBg.fillStyle = '#d4b46b';
    ctxBg.beginPath();
    ctxBg.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctxBg.fill();
  }
}

function initParticles() {
  particlesArray = [];
  let numParticles = (bgCanvas.width * bgCanvas.height) / 15000;
  for (let i = 0; i < numParticles; i++) {
    particlesArray.push(new Particle());
  }
}
initParticles();

function animateParticles() {
  ctxBg.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  
  for (let i = 0; i < particlesArray.length; i++) {
    particlesArray[i].update();
    particlesArray[i].draw();

    for (let j = i; j < particlesArray.length; j++) {
      let dx = particlesArray[i].x - particlesArray[j].x;
      let dy = particlesArray[i].y - particlesArray[j].y;
      let distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 100) {
        ctxBg.strokeStyle = `rgba(212, 180, 107, ${1 - distance / 100})`;
        ctxBg.lineWidth = 0.5;
        ctxBg.beginPath();
        ctxBg.moveTo(particlesArray[i].x, particlesArray[i].y);
        ctxBg.lineTo(particlesArray[j].x, particlesArray[j].y);
        ctxBg.stroke();
      }
    }

    let mdx = particlesArray[i].x - mouse.x;
    let mdy = particlesArray[i].y - mouse.y;
    let mdist = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mdist < mouse.radius) {
      ctxBg.strokeStyle = `rgba(59, 130, 246, ${1 - mdist / mouse.radius})`;
      ctxBg.lineWidth = 0.6;
      ctxBg.beginPath();
      ctxBg.moveTo(particlesArray[i].x, particlesArray[i].y);
      ctxBg.lineTo(mouse.x, mouse.y);
      ctxBg.stroke();
    }
  }
  requestAnimationFrame(animateParticles);
}
animateParticles();


// --- KODE UTAMA SISTEM DETEKSI KANTUK ---
const $ = id => document.getElementById(id);
const RIGHT_EYE = [33, 160, 158, 133, 153, 144], LEFT_EYE = [362, 385, 387, 263, 373, 380], MOUTH = [61, 291, 0, 17, 84, 314, 13, 14];

let earThreshold = 0.25, marThreshold = 0.60, consecFrames = 12, currentEyeType = "Standar", activeSessionId = "SESI-001";
let camera = null, isCameraOn = false, frameCounter = 0, lastAlarmTime = 0, lastLogTime = 0, audioCtx = null, alarmType = 'beep', customAudioElement = null, barChartInstance = null, pieChartInstance = null;

const videoElement = $('webcam'), canvasElement = $('output_canvas'), canvasCtx = canvasElement.getContext('2d'), camPlaceholder = $('cam_placeholder');

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
    if (!customVal || customVal <= 0 || customVal > 0.5) {
      Swal.fire({
        title: 'Peringatan',
        text: 'Masukkan nilai EAR Kustom yang valid (misal: 0.18)',
        icon: 'warning',
        background: '#141d33',
        color: '#f8fafc',
        confirmButtonColor: '#d4b46b'
      });
      return;
    }
    earThreshold = customVal; 
    currentEyeType = "Kustom";
  } else {
    earThreshold = parseFloat($('input_ear').value);
    currentEyeType = pSelect === '0.25' ? "Standar" : (pSelect === '0.15' ? "Sipit" : "Kustom");
  }
  
  marThreshold = parseFloat($('input_mar').value);
  consecFrames = parseInt($('input_frames').value);
  
  $('active_profile_badge').innerText = `Profil: ${currentEyeType} (EAR ${earThreshold})`;
  
  closeParamModal();

  Swal.fire({
    title: 'Berhasil Disimpan!',
    html: `
      <div style="font-size: 13px; color: #cbd5e1; margin-top: 8px;">
        Profil & Parameter berhasil diperbarui.<br>
        <strong style="color: #d4b46b;">Profil:</strong> ${currentEyeType}<br>
        <strong style="color: #d4b46b;">EAR:</strong> ${earThreshold} | 
        <strong style="color: #d4b46b;">MAR:</strong> ${marThreshold} | 
        <strong style="color: #d4b46b;">Frame:</strong> ${consecFrames}
      </div>
    `,
    icon: 'success',
    confirmButtonText: 'OK',
    background: '#141d33',
    color: '#f8fafc',
    confirmButtonColor: '#d4b46b',
    customClass: {
      popup: 'border border-[#283556] rounded-2xl shadow-2xl',
      confirmButton: 'text-[#0c1326] font-extrabold px-5 py-2.5 rounded-xl shadow-lg'
    }
  });
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
faceMesh.setOptions({ 
  maxNumFaces: 1,
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
    if (yaw > 0.35) return "Menoleh Kiri"; if (yaw < -0.35) return "Menoleh Kanan";
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
  const el = $(id);
  el.innerText = text;
  if (isError) {
    el.className = "text-xs font-bold text-rose-400";
  } else {
    el.className = "text-xs font-bold text-emerald-400";
  }
}

function onResults(results) {
  canvasElement.width = videoElement.videoWidth || 640;
  canvasElement.height = videoElement.videoHeight || 480;
  canvasCtx.save(); 
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const lm = results.multiFaceLandmarks[0], w = canvasElement.width, h = canvasElement.height;
    const avgEar = (calculateEAR(LEFT_EYE, lm) + calculateEAR(RIGHT_EYE, lm)) / 2.0;
    const mar = calculateMAR(MOUTH, lm), headPose = estimateHeadPose(lm, w, h);

    $('ear_val').innerText = avgEar.toFixed(2);
    $('mar_val').innerText = mar.toFixed(2);
    $('head_val').innerText = headPose;

    if (avgEar < earThreshold) { frameCounter++; setStat('ear_stat', "Terpejam", true); }
    else { frameCounter = 0; setStat('ear_stat', "Normal", false); }

    const isDrowsy = frameCounter >= consecFrames, isYawning = mar > marThreshold;
    setStat('mar_stat', isYawning ? "Menguap" : "Normal", isYawning);
    setStat('head_stat', headPose === "Lurus Depan" ? "Normal" : "Miring/Paling", headPose !== "Lurus Depan");

    const statusBox = $('status_box'), statusText = $('status_text');
    let msg = isDrowsy && isYawning ? "MENGANTUK & MENGUAP" : (isDrowsy ? "MENGANTUK" : (isYawning ? "MENGUAP" : "NORMAL"));

    if (msg !== "NORMAL") {
      statusText.innerText = `[ ${msg} ]`;
      statusText.className = "text-xs font-extrabold text-white tracking-wide";
      statusBox.className = `bg-[${isDrowsy ? '#e74c3c' : '#e67e22'}] p-2.5 rounded-lg text-center transition-all duration-300 shadow-sm`;
      if (isDrowsy) playAlarm();
      logEvent(avgEar, mar, msg);
    } else {
      statusText.innerText = "[ NORMAL ]";
      statusText.className = "text-xs font-extrabold text-white tracking-wide";
      statusBox.className = "bg-[#2ecc71] p-2.5 rounded-lg text-center transition-all duration-300 shadow-sm";
    }

    canvasCtx.fillStyle = '#00FF00';
    [...LEFT_EYE, ...RIGHT_EYE, ...MOUTH].forEach(idx => {
      canvasCtx.beginPath(); 
      canvasCtx.arc(lm[idx].x * w, lm[idx].y * h, 1.5, 0, 2 * Math.PI); 
      canvasCtx.fill();
    });
  }
  canvasCtx.restore();
}

function toggleCamera() {
  const btn = $('btn_toggle'), statusBox = $('status_box'), statusText = $('status_text');
  if (!isCameraOn) {
    initAudio();
    
    if (!camera) {
      camera = new Camera(videoElement, { 
        onFrame: async () => { 
          if (isCameraOn) {
            await faceMesh.send({ image: videoElement }); 
          }
        }, 
        width: 640, 
        height: 480 
      });
    }
    
    camera.start().then(() => {
      isCameraOn = true;
      btn.innerHTML = "<span>&#9632;</span> Stop Kamera";
      btn.className = "w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold py-2.5 rounded-md mb-2 transition text-sm flex items-center justify-center gap-1";
      camPlaceholder.classList.add('hidden'); 
      canvasElement.classList.remove('hidden');
      statusText.innerText = "[ SISTEM MENDETEKSI - KAMERA AKTIF ]";
      statusText.className = "text-xs font-extrabold text-white tracking-wide";
      statusBox.className = "bg-[#2ecc71] p-2.5 rounded-lg text-center transition-all duration-300 shadow-sm";
    }).catch(err => {
      console.error("Gagal memulai kamera:", err);
      alert("Tidak dapat mengakses kamera. Pastikan izin kamera aktif.");
    });

  } else {
    if (camera) camera.stop();
    isCameraOn = false;
    btn.innerHTML = "<span>&#9654;</span> Start Kamera";
    btn.className = "w-full bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold py-2.5 rounded-md mb-2 transition text-sm flex items-center justify-center gap-1";
    camPlaceholder.classList.remove('hidden'); 
    canvasElement.classList.add('hidden');
    statusText.innerText = "[ KAMERA NONAKTIF ]";
    statusText.className = "text-xs font-extrabold text-white tracking-wide";
    statusBox.className = "bg-[#f39c12] p-2.5 rounded-lg text-center transition-all duration-300 shadow-sm";
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    $('ear_val').innerText = $('mar_val').innerText = $('head_val').innerText = "-";
  }
}

function openLogModal() {
  const logs = JSON.parse(localStorage.getItem('drowsiness_logs') || '[]'), tbody = $('log_table_body');
  tbody.innerHTML = logs.length === 0 ? `<tr><td colspan="8" class="p-4 text-slate-400 italic">Belum ada riwayat catatan deteksi.</td></tr>` : '';

  logs.forEach((l, i) => {
    tbody.innerHTML += `
      <tr class="bg-[#141d33] hover:bg-[#1b2642] transition border-b border-[#283556] text-slate-200">
        <td class="p-2.5 border border-[#283556]">${i + 1}</td>
        <td class="p-2.5 border border-[#283556] font-mono text-[#d4b46b]">${l.idLog || 'LOG-' + (i+1)}</td>
        <td class="p-2.5 border border-[#283556] font-mono">${l.idSesi || activeSessionId}</td>
        <td class="p-2.5 border border-[#283556]">${l.timestamp}</td>
        <td class="p-2.5 border border-[#283556] font-bold">${l.jenis}</td>
        <td class="p-2.5 border border-[#283556]">${l.tipeMata || 'Standar'}</td>
        <td class="p-2.5 border border-[#283556]">${l.durasi || '3.0 Detik'}</td>
        <td class="p-2.5 border border-[#283556]"><span class="${l.status === 'Critical' ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}">${l.status}</span></td>
      </tr>`;
  });
  $('log_count_info').innerText = logs.length ? `Menampilkan 1 - ${logs.length} dari ${logs.length} data` : 'Menampilkan 0 data';
  $('log_modal').classList.remove('hidden');
}

const closeLogModal = () => $('log_modal').classList.add('hidden');

function downloadCSV() {
  const logs = JSON.parse(localStorage.getItem('drowsiness_logs') || '[]');
  if (!logs.length) {
    Swal.fire({
      title: 'Informasi',
      text: 'Belum ada data log tersimpan.',
      icon: 'warning',
      confirmButtonText: 'Tutup',
      background: '#141d33',
      color: '#f8fafc',
      confirmButtonColor: '#d4b46b',
      customClass: {
        popup: 'border border-[#283556] rounded-2xl shadow-2xl font-sans',
        confirmButton: 'text-[#0c1326] font-extrabold px-5 py-2.5 rounded-xl shadow-lg'
      }
    });
    return;
  }
  let csv = "No,ID LOG,ID SESI,WAKTU KEJADIAN,JENIS KEJADIAN,TIPE MATA,DURASI,STATUS,EAR,MAR\n";
  logs.forEach((l, i) => { csv += `${i + 1},${l.idLog || 'LOG-'+(i+1)},${l.idSesi || activeSessionId},${l.timestamp},${l.jenis},${l.tipeMata || 'Standar'},${l.durasi || '3.0 Detik'},${l.status},${l.ear},${l.mar}\n`; });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `drowsiness_log_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

function resetLogData() {
  Swal.fire({
    title: 'Konfirmasi Reset',
    text: 'Apakah Anda yakin ingin menghapus seluruh riwayat log & mereset grafik tren?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Reset',
    cancelButtonText: 'Batal',
    background: '#141d33',
    color: '#f8fafc',
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#283556',
    customClass: {
      popup: 'border border-[#283556] rounded-2xl shadow-2xl font-sans',
      confirmButton: 'text-white font-extrabold px-4 py-2 rounded-xl shadow-md',
      cancelButton: 'text-slate-200 font-extrabold px-4 py-2 rounded-xl shadow-md'
    }
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem('drowsiness_logs');
      closeChartModal();
      
      Swal.fire({
        title: 'Berhasil!',
        text: 'Data berhasil direset!',
        icon: 'success',
        background: '#141d33',
        color: '#f8fafc',
        confirmButtonColor: '#d4b46b',
        customClass: {
          popup: 'border border-[#283556] rounded-2xl shadow-2xl font-sans',
          confirmButton: 'text-[#0c1326] font-extrabold px-5 py-2.5 rounded-xl shadow-lg'
        }
      });
    }
  });
}

function openChartModal() {
  const logs = JSON.parse(localStorage.getItem('drowsiness_logs') || '[]');
  if (!logs.length) {
    Swal.fire({
      title: 'Informasi',
      text: 'Belum ada data kejadian terdeteksi di dalam log.',
      icon: 'warning',
      confirmButtonText: 'Tutup',
      background: '#141d33',
      color: '#f8fafc',
      confirmButtonColor: '#d4b46b',
      customClass: {
        popup: 'border border-[#283556] rounded-2xl shadow-2xl font-sans',
        confirmButton: 'text-[#0c1326] font-extrabold px-5 py-2.5 rounded-xl shadow-lg'
      }
    });
    return;
  }

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
  
  Swal.fire({
    title: 'Sesi Berakhir',
    text: 'Sesi telah diakhiri.',
    icon: 'info',
    confirmButtonText: 'OK',
    background: '#141d33',
    color: '#f8fafc',
    confirmButtonColor: '#d4b46b',
    customClass: {
      popup: 'border border-[#283556] rounded-2xl shadow-2xl',
      confirmButton: 'text-[#0c1326] font-extrabold px-5 py-2.5 rounded-xl shadow-lg'
    }
  }).then(() => {
    window.location.reload();
  });
}

// Fungsi untuk menyambut pengguna saat halaman pertama kali dimuat
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const text = "Selamat datang di website Drowwsiness Detection System. Harap berkendara dengan hati-hati.";
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID'; 
        utterance.rate = 1.2;     
        utterance.pitch = 1.2;   
        
        
        window.speechSynthesis.speak(utterance);
      }
    }, 100); 
  });

  