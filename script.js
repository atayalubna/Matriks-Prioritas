/* =========================================
   SCRIPT.JS - VAL-ID (MATRIKS PRIORITAS)
   Versi Lengkap LKPD 6 (Scatter + Bar Chart + Laporan)
   ========================================= */

let ideas = JSON.parse(localStorage.getItem('kik_ideas')) || [];
let scatterChart = null;
let barChart = null;

// Fungsi Menentukan Kuadran (Sesuai Aturan LKPD: Tinggi=4-5, Rendah=1-3)
function getQuadrant(feasibility, impact) {
    if (feasibility >= 4 && impact >= 4) {
        return { name: 'PRIORITAS UTAMA', code: 'Q1', color: '#047857', badge: 'badge-q1' };
    } else if (feasibility <= 3 && impact >= 4) {
        return { name: 'POTENSI', code: 'Q2', color: '#0369A1', badge: 'badge-q2' };
    } else if (feasibility >= 4 && impact <= 3) {
        return { name: 'PERTIMBANGAN', code: 'Q3', color: '#B45309', badge: 'badge-q3' };
    } else {
        return { name: 'TUNDA', code: 'Q4', color: '#374151', badge: 'badge-q4' };
    }
}

// 1. UPDATE KARTU RINGKASAN
function updateSummary() {
    document.getElementById('total-ide').innerText = ideas.length;
    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
    ideas.forEach(idea => {
        if (idea.quadrantCode === 'Q1') q1++;
        if (idea.quadrantCode === 'Q2') q2++;
        if (idea.quadrantCode === 'Q3') q3++;
        if (idea.quadrantCode === 'Q4') q4++;
    });
    document.getElementById('count-q1').innerText = q1;
    document.getElementById('count-q2').innerText = q2;
    document.getElementById('count-q3').innerText = q3;
    document.getElementById('count-q4').innerText = q4;
}

// 2. RENDER TABEL
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = ''; 

    ideas.forEach((idea, index) => {
        tbody.innerHTML += `
            <tr>
                <td class="text-center text-muted">${index + 1}</td>
                <td class="fw-bold">${idea.name}</td>
                <td class="text-center">${idea.feasibility}</td>
                <td class="text-center">${idea.impact}</td>
                <td class="text-center fw-bold fs-6">${idea.totalScore}</td>
                <td class="text-center">
                    <span class="badge-custom ${idea.badgeClass}">${idea.quadrantName}</span>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteIdea(${idea.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

// PLUGIN LATAR BELAKANG UNTUK GRAFIK MATRIKS
const quadPlugin = {
    id: 'quadPlugin',
    beforeDraw: (chart) => {
        const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
        const midX = x.getPixelForValue(3.5);
        const midY = y.getPixelForValue(3.5);
        ctx.save();
        ctx.fillStyle = 'rgba(224, 242, 254, 0.4)'; ctx.fillRect(left, top, midX - left, midY - top); // Q2
        ctx.fillStyle = 'rgba(209, 250, 229, 0.4)'; ctx.fillRect(midX, top, right - midX, midY - top); // Q1
        ctx.fillStyle = 'rgba(243, 244, 246, 0.4)'; ctx.fillRect(left, midY, midX - left, bottom - midY); // Q4
        ctx.fillStyle = 'rgba(254, 243, 199, 0.4)'; ctx.fillRect(midX, midY, right - midX, bottom - midY); // Q3
        
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#94a3b8'; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(midX, top); ctx.lineTo(midX, bottom); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(left, midY); ctx.lineTo(right, midY); ctx.stroke();
        ctx.restore();
    }
};

// 3. RENDER KEDUA GRAFIK (SCATTER & BAR)
function renderCharts() {
    // Siapkan Label dan Data
    const labels = ideas.map(i => i.name.substring(0, 15) + (i.name.length > 15 ? '...' : ''));
    const totalScores = ideas.map(i => i.totalScore);
    const bgColors = ideas.map(i => i.color);

    // --- A. GRAFIK MATRIKS (SCATTER) ---
    const ctxScatter = document.getElementById('matrixChart').getContext('2d');
    if (scatterChart) scatterChart.destroy();
    
    scatterChart = new Chart(ctxScatter, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Ide Fitur',
                data: ideas.map(i => ({ x: i.feasibility, y: i.impact, label: i.name })),
                pointBackgroundColor: bgColors,
                pointRadius: 8,
                pointHoverRadius: 10,
                borderColor: '#fff', borderWidth: 2
            }]
        },
        plugins: [quadPlugin],
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Kelayakan Teknis (Feasibility)' }, min: 1, max: 5 },
                y: { title: { display: true, text: 'Dampak Bisnis (Impact)' }, min: 1, max: 5 }
            },
            plugins: {
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw.label} (F:${ctx.raw.x}, I:${ctx.raw.y})` } },
                legend: { display: false }
            }
        }
    });

    // --- B. GRAFIK TOTAL SKOR (BAR CHART) ---
    const ctxBar = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();

    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Skor',
                data: totalScores,
                backgroundColor: bgColors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 10, ticks: { stepSize: 1 } } },
            plugins: { legend: { display: false } }
        }
    });
}

// 4. GENERATE LAPORAN IDE TERPILIH
function generateReport() {
    const reportDiv = document.getElementById('laporan-hasil');
    
    if(ideas.length === 0) {
        reportDiv.innerHTML = `<p class="text-muted mb-0">Belum ada ide yang dimasukkan. Silakan tambah data terlebih dahulu.</p>`;
        return;
    }

    // Filter hanya ide yang masuk Q1 (Prioritas Utama)
    const q1Ideas = ideas.filter(i => i.quadrantCode === 'Q1');
    
    // Urutkan ide di Q1 berdasarkan Total Skor tertinggi
    q1Ideas.sort((a, b) => b.totalScore - a.totalScore);

    if(q1Ideas.length > 0) {
        // Ambil maksimal 3 ide terbaik
        const topIdeas = q1Ideas.slice(0, 3);
        
        let htmlList = `<div class="alert alert-success border-0 shadow-sm mb-0">
            <h6 class="fw-bold mb-2">🎉 Kesimpulan Analisis Data:</h6>
            <p class="small mb-2">Berdasarkan pemetaan matriks, terdapat <b>${q1Ideas.length} ide</b> di Kuadran Prioritas Utama. Berikut adalah ide terbaik (skor tertinggi) yang disarankan untuk segera dikembangkan (Ide Siap Dikembangkan):</p>
            <ol class="mb-0 fw-bold text-success-emphasis">`;
        
        topIdeas.forEach(ide => {
            htmlList += `<li>${ide.name} <span class="badge bg-success ms-2">Skor: ${ide.totalScore}</span></li>`;
        });
        
        htmlList += `</ol></div>`;
        reportDiv.innerHTML = htmlList;
    } else {
        // Jika tidak ada ide yang masuk Q1 sama sekali
        reportDiv.innerHTML = `
            <div class="alert alert-warning border-0 shadow-sm mb-0">
                <h6 class="fw-bold mb-2">⚠️ Analisis Data:</h6>
                <p class="small mb-0">Belum ada ide yang memenuhi kriteria <b>Prioritas Utama</b> (Feasibility Tinggi & Impact Tinggi). Silakan kaji ulang ide di area Potensi (Q2) atau Quick Win (Q3).</p>
            </div>`;
    }
}

// 5. EVENT LISTENER FORM
document.getElementById('form-idea').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('ideaName').value;
    const f = parseInt(document.getElementById('feasibilityScore').value);
    const i = parseInt(document.getElementById('impactScore').value);
    
    const quad = getQuadrant(f, i);
    
    ideas.push({
        id: Date.now(),
        name: name,
        feasibility: f,
        impact: i,
        totalScore: f + i,
        quadrantName: quad.name,
        quadrantCode: quad.code,
        color: quad.color,
        badgeClass: quad.badge
    });
    
    localStorage.setItem('kik_ideas', JSON.stringify(ideas));
    
    bootstrap.Modal.getInstance(document.getElementById('tambahIdeModal')).hide();
    this.reset();
    updateAll();
});

// 6. HAPUS DATA
function deleteIdea(id) {
    if(confirm("Hapus ide ini?")) {
        ideas = ideas.filter(i => i.id !== id);
        localStorage.setItem('kik_ideas', JSON.stringify(ideas));
        updateAll();
    }
}

function clearAllData() {
    if(confirm("Yakin ingin menghapus SEMUA data?")) {
        ideas = [];
        localStorage.removeItem('kik_ideas');
        updateAll();
    }
}

// 7. REFRESH SEMUA TAMPILAN
function updateAll() {
    updateSummary();
    renderTable();
    renderCharts();
    generateReport();
}

window.onload = updateAll;