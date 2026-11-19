/* =========================================
   SCRIPT.JS - VAL-ID (MATRIKS PRIORITAS)
   Versi Lengkap LKPD 6 (Scatter + Bar Chart + Laporan)
   ========================================= */

let ideas = [];
let activeQuadrantFilter = null;

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

function addQuadrantData(idea) {
    const quadrant = getQuadrant(idea.feasibility, idea.impact);
    return {
        ...idea,
        totalScore: idea.feasibility + idea.impact,
        quadrantName: quadrant.name,
        quadrantCode: quadrant.code,
        color: quadrant.color,
        badgeClass: quadrant.badge
    };
}

function getChartIdeas() {
    return activeQuadrantFilter
        ? ideas.filter(idea => idea.quadrantCode === activeQuadrantFilter)
        : ideas;
}

function updateFilterControls() {
    const activeFilter = activeQuadrantFilter || 'all';
    document.querySelectorAll('.summary-filter').forEach(button => {
        const isActive = button.dataset.filter === activeFilter;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    const status = document.getElementById('chart-filter-status');
    if (!activeQuadrantFilter) {
        status.textContent = `Grafik menampilkan semua ide (${ideas.length}). Klik kategori untuk memfilter.`;
        return;
    }

    const selectedButton = document.querySelector(`.summary-filter[data-filter="${activeQuadrantFilter}"]`);
    status.textContent = `Filter grafik: ${selectedButton.dataset.label} (${getChartIdeas().length} ide). Klik Total Ide untuk menampilkan semua.`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Permintaan ke database gagal.');
    }
    return result;
}

function showError(message) {
    const errorBox = document.getElementById('app-error');
    errorBox.textContent = message;
    errorBox.classList.remove('d-none');
}

function clearError() {
    const errorBox = document.getElementById('app-error');
    errorBox.textContent = '';
    errorBox.classList.add('d-none');
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
    updateFilterControls();
}

// 2. RENDER TABEL
function renderTable() {
    const tbody = document.getElementById('table-body');
    if (ideas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Belum ada ide yang tersimpan.</td></tr>';
        return;
    }

    tbody.innerHTML = ideas.map((idea, index) => `
            <tr>
                <td class="text-center text-muted">${index + 1}</td>
                <td class="fw-bold">${escapeHtml(idea.name)}</td>
                <td class="text-center">${idea.feasibility}</td>
                <td class="text-center">${idea.impact}</td>
                <td class="text-center fw-bold fs-6">${idea.totalScore}</td>
                <td class="text-center">
                    <span class="badge-custom ${idea.badgeClass}">${escapeHtml(idea.quadrantName)}</span>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteIdea(${idea.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
}

const chartFocusStates = new WeakMap();

function updateChartFocus(graph, ideaId) {
    const meshIndices = [];
    const meshOpacity = [];
    const lineIndices = [];
    const lineColors = [];
    const markerIndices = [];
    const markerOpacity = [];

    graph.data.forEach((trace, index) => {
        if (trace.meta?.ideaId == null) return;
        const isFocused = ideaId == null || trace.meta.ideaId === ideaId;

        if (trace.type === 'mesh3d') {
            meshIndices.push(index);
            meshOpacity.push(isFocused ? trace.meta.focusOpacity : 0.015);
        } else if (trace.type === 'scatter3d' && trace.mode === 'lines') {
            lineIndices.push(index);
            lineColors.push(isFocused ? trace.meta.focusLineColor : 'rgba(30,41,59,0.015)');
        } else if (trace.type === 'scatter3d' && trace.mode === 'markers') {
            markerIndices.push(index);
            markerOpacity.push(isFocused ? trace.meta.focusMarkerOpacity : 0.015);
        }
    });

    const updates = [];
    if (meshIndices.length) {
        updates.push(Plotly.restyle(graph, { opacity: meshOpacity }, meshIndices));
    }
    if (lineIndices.length) {
        updates.push(Plotly.restyle(graph, { 'line.color': lineColors }, lineIndices));
    }
    if (markerIndices.length) {
        updates.push(Plotly.restyle(graph, { 'marker.opacity': markerOpacity }, markerIndices));
    }
    return Promise.all(updates);
}

function resetChartFocus(graphId) {
    const graph = document.getElementById(graphId);
    const state = chartFocusStates.get(graph);
    if (!state) return Promise.resolve();
    clearTimeout(state.restoreTimer);
    state.activeIdeaId = null;
    state.restoreTimer = null;
    if (!graph.data?.length) return Promise.resolve();
    return updateChartFocus(graph, null);
}

function attachChartFocus(graphId) {
    const graph = document.getElementById(graphId);
    if (chartFocusStates.has(graph)) return;

    const state = { activeIdeaId: null, restoreTimer: null };
    graph.on('plotly_hover', event => {
        const point = event.points.find(item => item.data.meta?.ideaId != null);
        if (!point) return;

        const ideaId = point.data.meta.ideaId;
        clearTimeout(state.restoreTimer);
        state.restoreTimer = null;
        if (state.activeIdeaId === ideaId) return;

        state.activeIdeaId = ideaId;
        updateChartFocus(graph, ideaId);
    });
    graph.on('plotly_unhover', () => {
        if (state.activeIdeaId == null) return;
        state.activeIdeaId = null;
        clearTimeout(state.restoreTimer);
        state.restoreTimer = setTimeout(() => {
            updateChartFocus(graph, null);
            state.restoreTimer = null;
        }, 80);
    });
    chartFocusStates.set(graph, state);
}

function createFloorPatch(x0, x1, y0, y1, color, name) {
    return {
        type: 'mesh3d',
        x: [x0, x1, x1, x0],
        y: [y0, y0, y1, y1],
        z: [0, 0, 0, 0],
        i: [0, 0],
        j: [1, 2],
        k: [2, 3],
        color,
        opacity: 0.35,
        hoverinfo: 'skip',
        showlegend: false,
        name
    };
}

function createBarTrace(idea, index, count) {
    const halfWidth = Math.min(0.32, 1.4 / Math.max(count, 1));
    const x0 = index + 1 - halfWidth;
    const x1 = index + 1 + halfWidth;
    const z0 = -0.28;
    const z1 = 0.28;
    const height = idea.totalScore;
    const x = [x0, x1, x1, x0, x0, x1, x1, x0];
    const y = [0, 0, 0, 0, height, height, height, height];
    const z = [z0, z0, z1, z1, z0, z0, z1, z1];
    const faces = [
        [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
        [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2],
        [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]
    ];

    return {
        type: 'mesh3d',
        x,
        y,
        z,
        i: faces.map(face => face[0]),
        j: faces.map(face => face[1]),
        k: faces.map(face => face[2]),
        color: idea.color,
        opacity: 0.92,
        flatshading: true,
        text: Array(8).fill(idea.name),
        hovertemplate: `<b>${escapeHtml(idea.name)}</b><br>Total skor: ${height}<br>Feasibility: ${idea.feasibility}<br>Impact: ${idea.impact}<extra></extra>`,
        showlegend: false,
        name: idea.name,
        meta: { ideaId: idea.id, focusOpacity: 0.92 }
    };
}

function createChartLayout(scene, title) {
    return {
        autosize: true,
        margin: { l: 0, r: 0, t: 12, b: 0 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false,
        hoverlabel: { font: { family: 'Plus Jakarta Sans, sans-serif' } },
        scene: {
            ...scene,
            bgcolor: 'rgba(0,0,0,0)',
            aspectmode: 'manual',
            aspectratio: { x: 1.15, y: 1.1, z: 0.8 },
            camera: { eye: { x: 1.55, y: 1.65, z: 1.2 } },
            xaxis: {
                ...scene.xaxis,
                showbackground: true,
                backgroundcolor: '#f8fafc',
                gridcolor: '#dce4ec',
                zerolinecolor: '#94a3b8',
                title: { font: { size: 12 } },
                tickfont: { size: 10 }
            },
            yaxis: {
                ...scene.yaxis,
                showbackground: true,
                backgroundcolor: '#f8fafc',
                gridcolor: '#dce4ec',
                zerolinecolor: '#94a3b8',
                title: { font: { size: 12 } },
                tickfont: { size: 10 }
            },
            zaxis: {
                ...scene.zaxis,
                showbackground: true,
                backgroundcolor: '#f8fafc',
                gridcolor: '#dce4ec',
                zerolinecolor: '#94a3b8',
                title: { font: { size: 12 } },
                tickfont: { size: 10 }
            }
        },
        title: { text: title, font: { size: 1 } }
    };
}

function renderMatrixChart() {
    const chartIdeas = getChartIdeas();
    const traces = [
        createFloorPatch(3.5, 5, 3.5, 5, '#d1fae5', 'Prioritas Utama'),
        createFloorPatch(1, 3.5, 3.5, 5, '#e0f2fe', 'Potensi'),
        createFloorPatch(3.5, 5, 1, 3.5, '#fef3c7', 'Pertimbangan'),
        createFloorPatch(1, 3.5, 1, 3.5, '#f3f4f6', 'Tunda')
    ];
    const visibleQuadrants = new Set();

    chartIdeas.forEach(idea => {
        traces.push({
            type: 'scatter3d',
            mode: 'lines',
            x: [idea.feasibility, idea.feasibility],
            y: [idea.impact, idea.impact],
            z: [0, idea.totalScore],
            line: { color: '#64748b', width: 4 },
            hoverinfo: 'skip',
            showlegend: false,
            meta: { ideaId: idea.id, focusLineColor: '#64748b' }
        });
        traces.push({
            type: 'scatter3d',
            mode: 'markers',
            x: [idea.feasibility],
            y: [idea.impact],
            z: [0],
            marker: {
                size: 4,
                color: idea.color,
                line: { color: '#ffffff', width: 1 }
            },
            hoverinfo: 'skip',
            showlegend: false,
            meta: { ideaId: idea.id, focusMarkerOpacity: 1 }
        });
        traces.push({
            type: 'scatter3d',
            mode: 'markers',
            name: idea.quadrantName,
            x: [idea.feasibility],
            y: [idea.impact],
            z: [idea.totalScore],
            text: [idea.name],
            customdata: [[idea.feasibility, idea.impact, idea.totalScore]],
            marker: {
                size: 7,
                color: idea.color,
                line: { color: '#ffffff', width: 1.5 },
                opacity: 0.95
            },
            hovertemplate: '<b>%{text}</b><br>Feasibility: %{customdata[0]}<br>Impact: %{customdata[1]}<br>Total skor: %{customdata[2]}<extra>%{fullData.name}</extra>',
            showlegend: !visibleQuadrants.has(idea.quadrantCode),
            meta: { ideaId: idea.id, focusMarkerOpacity: 1 }
        });
        visibleQuadrants.add(idea.quadrantCode);
    });

    traces.push({
        type: 'scatter3d',
        mode: 'lines',
        x: [3.5, 3.5, null, 1, 5],
        y: [1, 5, null, 3.5, 3.5],
        z: [0, 0, null, 0, 0],
        line: { color: '#64748b', width: 4, dash: 'dash' },
        hoverinfo: 'skip',
        showlegend: false
    });

    const layout = createChartLayout({
        xaxis: { title: 'Kelayakan Teknis (Feasibility)', range: [1, 5], dtick: 1 },
        yaxis: { title: 'Dampak Bisnis (Impact)', range: [1, 5], dtick: 1 },
        zaxis: { title: 'Total Skor', range: [0, 10], dtick: 2 }
    }, 'Matriks 3D Ide');
    layout.showlegend = true;
    layout.margin.t = 32;
    layout.legend = {
        orientation: 'h',
        x: 0,
        y: 1.08,
        font: { size: 10 }
    };
    return resetChartFocus('matrixChart').then(() => Plotly.react('matrixChart', traces, layout, {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso3d', 'select3d']
    })).then(() => attachChartFocus('matrixChart'));
}

function renderScoreChart() {
    const chartIdeas = getChartIdeas();
    const count = chartIdeas.length;
    const traces = chartIdeas.map((idea, index) => createBarTrace(idea, index, count));
    const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    const outlines = traces.map(bar => {
        const x = [];
        const y = [];
        const z = [];
        edges.forEach(([start, end]) => {
            x.push(bar.x[start], bar.x[end], null);
            y.push(bar.y[start], bar.y[end], null);
            z.push(bar.z[start], bar.z[end], null);
        });
        return {
            type: 'scatter3d',
            mode: 'lines',
            x,
            y,
            z,
            line: { color: '#1e293b', width: 2.5 },
            hoverinfo: 'skip',
            showlegend: false,
            meta: { ideaId: bar.meta.ideaId, focusLineColor: '#1e293b' }
        };
    });
    traces.push(...outlines);
    const tickStep = Math.max(1, Math.ceil(count / 10));
    const tickValues = ideas
        .map((_, index) => index + 1)
        .filter(value => value === 1 || value === count || (value - 1) % tickStep === 0);

    const layout = createChartLayout({
        xaxis: {
            title: 'Urutan Ide',
            range: [0.5, Math.max(count + 0.5, 1.5)],
            tickvals: tickValues,
            ticktext: tickValues.map(value => `#${value}`)
        },
        yaxis: { title: 'Total Skor', range: [0, 10], dtick: 2 },
        zaxis: { title: 'Kedalaman', range: [-0.5, 0.5], showticklabels: false, showgrid: false }
    }, 'Total Skor Ide');

    if (count === 0) {
        layout.annotations = [{
            text: 'Belum ada ide untuk ditampilkan',
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            showarrow: false,
            font: { size: 15, color: '#64748b' }
        }];
    }

    return resetChartFocus('barChart').then(() => Plotly.react('barChart', traces, layout, {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso3d', 'select3d']
    })).then(() => attachChartFocus('barChart'));
}

// 3. RENDER KEDUA GRAFIK 3D INTERAKTIF
function renderCharts() {
    if (!window.Plotly) {
        showError('Grafik 3D tidak dapat dimuat. Periksa koneksi internet lalu muat ulang halaman.');
        return;
    }
    Promise.all([renderMatrixChart(), renderScoreChart()])
        .catch(error => showError(`Grafik 3D gagal dimuat: ${error.message}`));
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
            htmlList += `<li>${escapeHtml(ide.name)} <span class="badge bg-success ms-2">Skor: ${ide.totalScore}</span></li>`;
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
document.getElementById('form-idea').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('ideaName').value.trim();
    const f = parseInt(document.getElementById('feasibilityScore').value);
    const i = parseInt(document.getElementById('impactScore').value);

    try {
        const savedIdea = await apiRequest('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, feasibility: f, impact: i })
        });
        ideas.push(addQuadrantData(savedIdea));
        bootstrap.Modal.getInstance(document.getElementById('tambahIdeModal')).hide();
        this.reset();
        clearError();
        updateAll();
    } catch (error) {
        showError(`Gagal menyimpan ide ke database: ${error.message}`);
    }
});

// 6. HAPUS DATA
async function deleteIdea(id) {
    if(confirm("Hapus ide ini?")) {
        try {
            await apiRequest(`/api/ideas/${id}`, { method: 'DELETE' });
            ideas = ideas.filter(i => i.id !== id);
            clearError();
            updateAll();
        } catch (error) {
            showError(`Gagal menghapus ide: ${error.message}`);
        }
    }
}

async function clearAllData() {
    if(confirm("Yakin ingin menghapus SEMUA data?")) {
        try {
            await apiRequest('/api/ideas', { method: 'DELETE' });
            ideas = [];
            clearError();
            updateAll();
        } catch (error) {
            showError(`Gagal mengosongkan data: ${error.message}`);
        }
    }
}

// 7. REFRESH SEMUA TAMPILAN
function updateAll() {
    updateSummary();
    renderTable();
    renderCharts();
    generateReport();
}

async function loadIdeas() {
    try {
        const savedIdeas = await apiRequest('/api/ideas');
        ideas = savedIdeas.map(addQuadrantData);
        clearError();
        updateAll();
    } catch (error) {
        updateAll();
        showError(`Tidak dapat terhubung ke database. Jalankan aplikasi dengan perintah "python app.py". Detail: ${error.message}`);
    }
}

window.onload = loadIdeas;

document.querySelectorAll('.summary-filter').forEach(button => {
    button.addEventListener('click', () => {
        activeQuadrantFilter = button.dataset.filter === 'all' ? null : button.dataset.filter;
        updateFilterControls();
        renderCharts();
    });
});