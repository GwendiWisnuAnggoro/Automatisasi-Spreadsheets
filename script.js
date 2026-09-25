    /* =======================================================
       HELPER FUNCTIONS
    ======================================================== */
    function ClassListTambah(sasaran, classList){ return sasaran.classList.add(classList); }
    function ClassListHapus(sasaran, classList){ return sasaran.classList.remove(classList); }
    function Toggle(sasaran, classT){ return sasaran.classList.toggle(classT); }
    function LStorageTambahItem(key, isi){ return localStorage.setItem(key, isi); }
    function AmbilItemDariLStorage(key){ return localStorage.getItem(key); }
    function innerHTMLSamaDengan(tujuan, isi){ return tujuan.innerHTML = isi; }
    function innerHTMLTambahSamaDengan(tujuan, isi){ return tujuan.innerHTML += isi; }
    function innerHTMLKurangSamaDengan(tujuan, isi){ return tujuan.innerHTML -= isi; }
    function innerTextSamaDengan(tujuan, isi){ return tujuan.innerText = isi; }
    function innerTextTambahSamaDengan(tujuan, isi){ return tujuan.innerText += isi; }
    function innerTextKurangSamaDengan(tujuan, isi){ return tujuan.innerText -= isi; }
    function Log(isi){ return console.log(isi); }
    function notif(isi){ return alert(isi); }
    function panggilElementDariID(id){ return document.getElementById(id); }
    function panggilElementDariKelas(kelas){ return document.getElementsByClassName(kelas); }
    function panggilElementDariTag(tag){ return document.getElementsByTagName(tag); }
    function panggilDenganQuery(name){ return document.querySelector(name) }
    function panggilSemuaQuery(name){ return document.querySelectorAll(name) }
    function tambahEvent(nama, acara, fungsi){ return nama.addEventListener(acara, fungsi); }

    /* =======================================================
       SISTEM DINAMIS PENGAMBILAN API DARI GOOGLE SHEET (REALTIME 1 DETIK)
    ======================================================== */
    let rawApifyTokens = [];
    let rawGsLinks = [];
    
    let apifyTokens = []; 
    let gsApiLinks = [];  
    
    let currentApifyIndex = 0;
    let currentGsIndex = 0;
    
    const ACTOR_ID = 'GdWCkxBtKWOsKjdch';
    let isCheckingConfig = false;
    let isFirstLoad = true;
    let laporanTabStarted = false;

    /* =======================================================
       TAB UTAMA: DOWNLOAD TIKTOK vs LAPORAN
       Tab Download aktif duluan & tidak butuh API sama sekali.
       API baru dicek pas pertama kali tab Laporan dibuka.
    ======================================================== */
    function switchMainTab(tab) {
        const isLaporan = tab === 'laporan';

        const btnDl = panggilElementDariID('mainTabBtn-download');
        const btnLp = panggilElementDariID('mainTabBtn-laporan');
        const paneDl = panggilElementDariID('mainTab-download');
        const paneLp = panggilElementDariID('mainTab-laporan');

        if (isLaporan) { ClassListHapus(btnDl, 'active'); ClassListTambah(btnLp, 'active'); }
        else { ClassListTambah(btnDl, 'active'); ClassListHapus(btnLp, 'active'); }

        if (isLaporan) { ClassListHapus(paneDl, 'active'); ClassListTambah(paneLp, 'active'); }
        else { ClassListTambah(paneDl, 'active'); ClassListHapus(paneLp, 'active'); }

        if (isLaporan && !laporanTabStarted) {
            laporanTabStarted = true;
            setInputsDisableState('all', true);
            loadConfigLoop();
        }
    }

    function ambilDataSheet(sheetId, kolom) {
        return new Promise((resolve, reject) => {
            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&tq=SELECT ${kolom}`;
            fetch(url, { cache: 'no-store' }) 
            .then(res => res.text())
            .then(result => {
                const json = JSON.parse(result.substr(47).slice(0, -2));
                const rows = json.table.rows;
                const dataArray = [];
                rows.forEach((e) => {
                    if (e.c && e.c[0] && e.c[0].v) dataArray.push(e.c[0].v);
                });
                resolve(dataArray);
            })
            .catch(err => reject(err));
        });
    }

    // Fungsi Tester GS Link
    async function testGSLink(url) {
        try {
            const token = atob("S3VuY2lSYWhhc2lhU2F0U2V0OTY=");
            const payload = { 
                action: "update_bulk", 
                packets: [{ 
                    url: "https://docs.google.com/spreadsheets/d/14PZpqxgifF-1PlK14CRqZxQK0OwKgjufIvcafaEd_VM/edit", 
                    sheetName: "Sheet1", colLetter: "A", rowNumber: 1, data: ["tester"], colName: "Tester" 
                }], 
                token: token 
            };
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return data && data.status === "success";
        } catch(e) {
            return false;
        }
    }

    // Fungsi Tester Apify Token
    async function testApifyToken(token) {
        try {
            const runInput = {
                "profiles": ["seputar_editing.official"],
                "resultsPerPage": 1,
                "profileScrapeSections": ["videos"],
                "newestPostDate": "2025-12-26",
                "oldestPostDateUnified": "2025-12-26"
            };
            const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${token}`, {
                method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(runInput)
            });
            return res.ok; 
        } catch (e) {
            return false;
        }
    }

    async function loadConfigLoop() {
        if (isCheckingConfig) return; 
        isCheckingConfig = true;

        const sheetId = '1ZURa3F8qEkyU9tzHdQmEYXXl98w5L8RxttOJBcVyCJQ';
        
        try {
            const mentahanA = await ambilDataSheet(sheetId, 'A');
            const fetchedGs = mentahanA.filter(isi => typeof isi === 'string' && isi.startsWith('https://script.google.com'));

            const mentahanC = await ambilDataSheet(sheetId, 'C');
            const fetchedApify = mentahanC.filter(isi => typeof isi === 'string' && isi.length > 15 && !isi.toLowerCase().includes("token"));

            const isGsChanged = JSON.stringify(fetchedGs) !== JSON.stringify(rawGsLinks);
            const isApifyChanged = JSON.stringify(fetchedApify) !== JSON.stringify(rawApifyTokens);

            if (isGsChanged || isApifyChanged) {
                Log("Perubahan Data API Terdeteksi! Memproses verifikasi...");
                
                // Set status awal saat sedang memverifikasi secara visual di log bawah
                addLog("Memverifikasi konfigurasi API...", "running");
                setInputsDisableState("all", true);

                if (isGsChanged) {
                    rawGsLinks = fetchedGs;
                    let validGS = [];
                    for (let url of fetchedGs) {
                        if (await testGSLink(url)) validGS.push(url);
                        else Log(`GS Link Gagal/Error: ${url}`);
                    }
                    gsApiLinks = validGS;
                    currentGsIndex = 0;
                }

                if (isApifyChanged) {
                    rawApifyTokens = fetchedApify;
                    let validApify = [];
                    for (let token of fetchedApify) {
                        if (await testApifyToken(token)) validApify.push(token);
                        else Log(`Apify Token Gagal/Limit: ${token}`);
                    }
                    apifyTokens = validApify;
                    currentApifyIndex = 0;
                }

                Log(`Verifikasi selesai. GS Valid: ${gsApiLinks.length} | Apify Valid: ${apifyTokens.length}`);
                handleAppStatus();
            }
        } catch (e) {
            // Abaikan kegagalan koneksi internet sesaat saat background polling berjalan
        }
        
        isCheckingConfig = false;
        
        if (isFirstLoad) {
            isFirstLoad = false;
            handleAppStatus(); 
        }

        setTimeout(loadConfigLoop, 1000); 
    }

    // Fungsi Pengatur Disable/Enable Input Sesuai Status API yang Error
    function setInputsDisableState(type, isDisable) {
        if (type === "scraper" || type === "all") {
            const btnStart = panggilElementDariID('btn-start-scrape');
            if (btnStart) btnStart.disabled = isDisable;
            
            Array.from(panggilSemuaQuery('.username-input')).forEach(inp => inp.disabled = isDisable);
            Array.from(panggilSemuaQuery('#dateMode, #singleDate, #startDate, #endDate')).forEach(inp => inp.disabled = isDisable);
            const btnAddRow = panggilDenganQuery("button[onclick='addRow()']");
            if (btnAddRow) btnAddRow.disabled = isDisable;
        }
        if (type === "mapper" || type === "all") {
            const btnSubmit = panggilElementDariID('btn_submit');
            if (btnSubmit) btnSubmit.disabled = isDisable;

            Array.from(panggilSemuaQuery('#main_file_selector, #url_list input, #url_list button')).forEach(inp => inp.disabled = isDisable);
            const btnAddTarget = panggilDenganQuery("button[onclick='addMappingTarget()']");
            if (btnAddTarget) btnAddTarget.disabled = isDisable;
            
            // Disable element di dalam workspace jika mapper bermasalah
            Array.from(panggilSemuaQuery('#mapping_workspace select, #mapping_workspace input, #mapping_workspace button')).forEach(inp => inp.disabled = isDisable);
        }
    }

    function handleAppStatus() {
        if (isFirstLoad) return;

        const apiStatusBox = panggilElementDariID('laporanApiStatus');
        if (apiStatusBox) apiStatusBox.style.display = 'none';

        const isGsValid = gsApiLinks.length > 0;
        const isApifyValid = apifyTokens.length > 0;

        // Kasus 1: Dua-duanya Valid (Ready Sempurna)
        if (isGsValid && isApifyValid) {
            setInputsDisableState("all", false);
            addLog("Sistem Ready!", "success");
            validate();
        } 
        // Kasus 2: Hanya Apify yang Valid (GS Link Error)
        else if (!isGsValid && isApifyValid) {
            setInputsDisableState("scraper", false);
            setInputsDisableState("mapper", true);
            addLog("1/2 API Error Tambah Data Spreadsheet", "error");
            
            // Override teks tombol submit di bawah untuk memberi info detail error
            const btnSubmit = panggilElementDariID('btn_submit');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                innerHTMLSamaDengan(btnSubmit, '<i data-lucide="alert-circle" class="w-4 h-4"></i> <span>ERROR: AMBIL DATA SPREADSHEET GAAL</span>');
                lucide.createIcons();
            }
        } 
        // Kasus 3: Hanya GS yang Valid (Apify Token Error)
        else if (isGsValid && !isApifyValid) {
            setInputsDisableState("scraper", true);
            setInputsDisableState("mapper", false);
            addLog("1/2 API Error Ambil Data TikTok", "error");
            validate();
        } 
        // Kasus 4: Dua-duanya Error (0/2 Mati Total)
        else {
            setInputsDisableState("all", true);
            addLog("0/2 Error API: Maaf server, Coba lagi besok", "error");
            
            const btnSubmit = panggilElementDariID('btn_submit');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                innerHTMLSamaDengan(btnSubmit, '<i data-lucide="alert-circle" class="w-4 h-4"></i> <span>ERROR API</span>');
                lucide.createIcons();
            }
        }
    }

    // Fungsi Jembatan Eksekutor API Apify (Fallback Support)
    async function runApifyWithFallback(runInput) {
        if(apifyTokens.length === 0) throw new Error("Proses dihentikan. API Eror!");
        
        let attempts = 0;
        while (attempts < apifyTokens.length) {
            if (currentApifyIndex >= apifyTokens.length) currentApifyIndex = 0; 
            
            let token = apifyTokens[currentApifyIndex];
            try {
                const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${token}`, {
                    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(runInput)
                });
                if (!runRes.ok) throw new Error("API Eror!");
                
                const runData = await runRes.json();
                let datasetId;
                
                while(true) {
                    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runData.data.id}?token=${token}`);
                    const statusData = await statusRes.json();
                    if(statusData.data.status === 'SUCCEEDED') { datasetId = statusData.data.defaultDatasetId; break; }
                    if(['FAILED','ABORTED'].includes(statusData.data.status)) throw new Error("Run Failed in Server");
                    await new Promise(r => setTimeout(r, 5000));
                }

                const dataRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
                const items = await dataRes.json();
                return items; 
                
            } catch(e) {
                Log(`Mengambil Data...`);
                currentApifyIndex++;
                attempts++;
            }
        }
        throw new Error("Server Eror! Coba lagi besok");
    }

    // Fungsi Jembatan Eksekutor API GS (Fallback Support)
    async function fetchGSWithFallback(payload) {
        if(gsApiLinks.length === 0) throw new Error("API Google Eror!");

        let attempts = 0;
        while (attempts < gsApiLinks.length) {
            if (currentGsIndex >= gsApiLinks.length) currentGsIndex = 0; 
            
            let currentUrl = gsApiLinks[currentGsIndex];
            try {
                const res = await fetch(currentUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error("HTTP Status: " + res.status);
                const data = await res.json();
                return data; 
            } catch(e) {
                Log(`Menambahkan...`);
                currentGsIndex++;
                attempts++;
            }
        }
        throw new Error("Server Eror! Coba lagi Besok");
    }

    // =======================================================
    // DETEKSI DROPDOWN ASLI DARI KOLOM SPREADSHEET TUJUAN (TANPA BACKEND)
    // Beda dengan detectColumnTypes() yang cuma menebak dari isi file CSV --
    // ini nanya LANGSUNG ke Google Sheets API v4 pakai API KEY publik saja
    // (tanpa lewat backend Apps Script/token internal sama sekali), apakah
    // kolom yang dipilih (misal kolom F) punya aturan Data Validation berupa
    // dropdown, lalu ambil daftar pilihannya apa adanya.
    //
    // SYARAT AGAR INI JALAN:
    // 1. Isi GOOGLE_API_KEY di bawah dengan API Key dari Google Cloud Console
    //    (APIs & Services > Credentials > Create Credentials > API Key),
    //    lalu aktifkan "Google Sheets API" di project itu.
    // 2. Spreadsheet TARGET wajib di-share minimal "Siapa saja yang punya
    //    link" sebagai Pelihat/Editor -- API Key publik cuma bisa MEMBACA
    //    spreadsheet yang aksesnya publik, tidak bisa buka sheet privat.
    // 3. Sebaiknya batasi API Key ini (HTTP referrer) ke domain web app Anda
    //    di Google Cloud Console, karena key ini ikut ke-expose di browser.
    //
    // CATATAN PENTING: API Key cuma bisa MEMBACA. Ini TIDAK BISA dipakai
    // untuk menguji apakah link benar² "editable" (itu perlu percobaan
    // TULIS beneran, yang cuma bisa lewat backend Apps Script yang sudah
    // Anda pakai untuk action "validate"/"update_bulk" -- bagian itu TETAP
    // seperti semula, tidak diubah di sini).
    // =======================================================
    const GOOGLE_API_KEY = "GANTI_DENGAN_API_KEY_GOOGLE_CLOUD_ANDA";

    let dropdownCache = {};

    function extractSheetIdFromUrl(url) {
        const match = String(url || '').match(/\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    }

    // Ambil isi 1 range mentah (dipakai kalau dropdown-nya bersumber dari
    // range lain, bukan daftar manual langsung).
    async function fetchRangeValuesPublic(sheetId, a1Range) {
        const rangeParam = encodeURIComponent(a1Range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rangeParam}?key=${GOOGLE_API_KEY}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'Gagal mengambil range sumber dropdown');
        return (data.values || []).flat().filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    }

    async function fetchColumnDropdown(sheetId, sheetName, colLetter) {
        const cacheKey = `${sheetId}|${sheetName}|${colLetter}`;
        if (dropdownCache[cacheKey]) return dropdownCache[cacheKey];

        try {
            const rangeRef = `${sheetName}!${colLetter}:${colLetter}`;
            const fields = 'sheets.data.rowData.values.dataValidation';
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?ranges=${encodeURIComponent(rangeRef)}&fields=${encodeURIComponent(fields)}&key=${GOOGLE_API_KEY}`;

            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();

            if (data.error) {
                // Biasanya berarti: API Key belum diisi/salah, Sheets API belum
                // aktif, atau spreadsheet-nya BELUM publik (masih private).
                const result = { hasDropdown: false, options: [], error: true, reason: data.error.message };
                dropdownCache[cacheKey] = result;
                return result;
            }

            const rowData = (data.sheets && data.sheets[0] && data.sheets[0].data && data.sheets[0].data[0] && data.sheets[0].data[0].rowData) || [];

            let options = [];
            for (const row of rowData) {
                const cell = row.values && row.values[0];
                const cond = cell && cell.dataValidation && cell.dataValidation.condition;
                if (!cond) continue;

                if (cond.type === 'ONE_OF_LIST') {
                    options = (cond.values || []).map(v => v.userEnteredValue);
                } else if (cond.type === 'BOOLEAN') {
                    options = (cond.values && cond.values.length >= 2)
                        ? cond.values.map(v => v.userEnteredValue)
                        : ['TRUE', 'FALSE'];
                } else if (cond.type === 'ONE_OF_RANGE') {
                    // Dropdown bersumber dari range lain, misal "=Sheet2!A1:A10"
                    const rawRef = (cond.values && cond.values[0] && cond.values[0].userEnteredValue) || '';
                    const cleanRef = rawRef.replace(/^=/, '');
                    try { options = await fetchRangeValuesPublic(sheetId, cleanRef); } catch (e) { options = []; }
                }
                if (options.length > 0) break;
            }

            options = [...new Set(options.map(o => String(o)))];
            const result = { hasDropdown: options.length > 0, options };
            dropdownCache[cacheKey] = result;
            return result;
        } catch (e) {
            return { hasDropdown: false, options: [], error: true };
        }
    }

    // Cek ulang dropdown untuk 1 kolom konfigurasi tertentu, lalu simpan hasilnya
    // ke state kolom itu sendiri supaya bisa dipakai saat renderConditionBlock().
    async function refreshColumnDropdown(confIdx, colName) {
        const conf = state[activeFileName] && state[activeFileName].configs[confIdx];
        if (!conf) return;
        const col = conf.columns.find(c => c.src === colName);
        if (!col || !col.condition) return;

        const linkData = globalLinks.find(l => l.id === conf.targetId);
        if (!linkData || !conf.sheetName || !col.letter) return;

        const sheetId = extractSheetIdFromUrl(linkData.url);
        if (!sheetId) return;

        col.condition.dropdownStatus = 'checking';
        renderMappings();

        const result = await fetchColumnDropdown(sheetId, conf.sheetName, col.letter);

        // Guard: konfigurasi bisa saja berubah/dihapus selagi fetch berjalan
        const stillConf = state[activeFileName] && state[activeFileName].configs[confIdx];
        const stillCol = stillConf && stillConf.columns.find(c => c.src === colName);
        if (!stillCol || !stillCol.condition) return;

        if (result.error) {
            stillCol.condition.dropdownStatus = 'error';
        } else if (result.hasDropdown && result.options.length > 0) {
            stillCol.condition.dropdownStatus = 'found';
            stillCol.condition.dropdownOptions = result.options;
        } else {
            stillCol.condition.dropdownStatus = 'none';
            stillCol.condition.dropdownOptions = [];
        }
        renderMappings();
    }

    function refreshAllDropdownsInConfig(confIdx) {
        const conf = state[activeFileName] && state[activeFileName].configs[confIdx];
        if (!conf) return;
        conf.columns.forEach(c => { if (c.condition) refreshColumnDropdown(confIdx, c.src); });
    }

    /* =======================================================
       LOGIKA JAVASCRIPT APP 1 (TIKTOK SCRAPER)
    ======================================================== */
    const BULAN_INDO = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let sessionData = {}; 

    function addRow() {
        const div = document.createElement('div');
        div.className = 'account-row';
        div.innerHTML = `<input type="text" class="username-input" placeholder="Masukkan tanpa @"><button class="btn-del" onclick="removeRow(this)">✕</button>`;
        panggilElementDariID('accountList').appendChild(div);
    }
    
    function removeRow(btn) { btn.parentElement.remove(); }

    function toggleDateUI() {
        const mode = panggilElementDariID('dateMode').value;
        const container = panggilElementDariID('dateInputs');
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(); 
        weekAgo.setDate(weekAgo.getDate() - 7);
        const start = weekAgo.toISOString().split('T')[0];
        
        if (mode === 'single') {
            innerHTMLSamaDengan(container, `<input type="date" id="singleDate" value="${today}">`);
        } else {
            innerHTMLSamaDengan(container, `
                <div class="date-item">
                    <span class="date-label">MULAI</span>
                    <input type="date" id="startDate" value="${start}">
                </div>
                <div class="date-item">
                    <span class="date-label">SAMPAI</span>
                    <input type="date" id="endDate" value="${today}">
                </div>
            `);
        }
    }

    function getSelectedDates() {
        const mode = panggilElementDariID('dateMode').value;
        let start, end;
        if (mode === 'single') {
            const d = panggilElementDariID('singleDate').value;
            if(!d) throw new Error("Tanggal belum dipilih.");
            start = new Date(d); start.setHours(0,0,0,0);
            end = new Date(d); end.setHours(23,59,59,999);
        } else {
            const s = panggilElementDariID('startDate').value; 
            const e = panggilElementDariID('endDate').value;
            if(!s || !e) throw new Error("Rentang tanggal belum lengkap.");
            start = new Date(s); start.setHours(0,0,0,0);
            end = new Date(e); end.setHours(23,59,59,999);
            if(start >= end) throw new Error("Tanggal Akhir harus melewati Tanggal Mulai.");
        }
        return { start, end };
    }

    function formatTgl(dateObj, short=false) {
        return `${String(dateObj.getDate()).padStart(2,'0')} ${BULAN_INDO[dateObj.getMonth()]} ${short ? String(dateObj.getFullYear()).substring(2) : dateObj.getFullYear()}`;
    }

    // =======================================================
    // DETEKSI DETAIL VIDEO TIKTOK LEWAT API DOWNLOADER (TIKWM)
    // Dipakai supaya Apify cuma dipakai untuk mendata LINK + TANGGAL video
    // (biar hemat kredit Apify), sedangkan judul/hashtag/statistik diambil
    // dari API gratis yang sama dengan fitur download video.
    // =======================================================

    async function scrapeTikTokMeta(url, resolution = 'hd', fetchMedia = true, onProgress = null) {
        if (!url) throw new Error("URL TikTok wajib diisi.");

        const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Gagal menghubungi server parser.");

        const resJson = await res.json();
        if (resJson.code !== 0 || !resJson.data) throw new Error(resJson.msg || "Video tidak ditemukan atau bersifat privat.");

        const raw = resJson.data;

        const rawHashtags = raw.title ? (raw.title.match(/#[\w\u0590-\u05ff]+/g) || []) : [];
        const hashtagString = rawHashtags.join(' ');
        const cleanTitle = raw.title ? raw.title.replace(/#[\w\u0590-\u05ff]+/g, '').replace(/[\r\n]+/g, ' ').trim() : "";

        const videoUrl = (resolution === 'hd' && raw.hdplay) ? raw.hdplay : (raw.play || raw.wmplay);
        const tiktokAudioUrl = raw.music || (raw.music_info && raw.music_info.play) || null;
        const coverUrl = raw.origin_cover || raw.cover || raw.ai_dynamic_cover || raw.dynamic_cover || null;

        let videoMedia = null, audioMedia = null;
        if (fetchMedia) {
            const downloadBlobStream = async (targetUrl, trackProgress) => {
                if (!targetUrl) return null;
                try {
                    const response = await fetch(targetUrl);
                    if (!response.ok) return null;
                    const contentLength = response.headers.get("content-length");
                    const total = parseInt(contentLength, 10);
                    if (!total || isNaN(total) || !trackProgress) {
                        if (trackProgress && onProgress) onProgress(50);
                        const blob = await response.blob();
                        if (trackProgress && onProgress) onProgress(100);
                        return { blob, objectUrl: URL.createObjectURL(blob) };
                    }
                    const reader = response.body.getReader();
                    let received = 0; const chunks = [];
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value); received += value.length;
                        if (onProgress) onProgress(Math.round((received / total) * 100));
                    }
                    const blob = new Blob(chunks);
                    return { blob, objectUrl: URL.createObjectURL(blob) };
                } catch (e) { return null; }
            };
            [videoMedia, audioMedia] = await Promise.all([
                downloadBlobStream(videoUrl, true),
                downloadBlobStream(tiktokAudioUrl, false)
            ]);
        }

        return {
            author: {
                id: raw.author?.id, username: raw.author?.unique_id, nickname: raw.author?.nickname
            },
            title: cleanTitle || (raw.title || "").replace(/[\r\n]+/g, ' ').trim(),
            hashtags: rawHashtags.map(t => t.replace('#', '')),
            hashtagString: hashtagString,
            createTime: raw.create_time || null,
            cover: coverUrl,
            stats: {
                likes: raw.digg_count || 0, comments: raw.comment_count || 0, shares: raw.share_count || 0,
                saves: raw.collect_count || 0, views: raw.play_count || 0
            },
            video: { url: videoUrl, objectUrl: (videoMedia && videoMedia.objectUrl) || videoUrl },
            audio: {
                tiktokMusic: { title: raw.music_info?.title || "TikTok Music Audio", objectUrl: (audioMedia && audioMedia.objectUrl) || tiktokAudioUrl }
            }
        };
    }

    // =======================================================
    // UI KARTU "DOWNLOAD VIDEO TIKTOK" (STANDALONE)
    // =======================================================
    async function processTikTokDownload() {
        const urlInput = panggilElementDariID('tkDlUrl');
        const url = urlInput ? urlInput.value.trim() : '';
        if (!url) return notif("Masukkan link video TikTok terlebih dahulu.");

        const btn = panggilElementDariID('tkDlBtn');
        const progBox = panggilElementDariID('tkDlProgress');
        const progState = panggilElementDariID('tkDlProgressState');
        const progPercent = panggilElementDariID('tkDlProgressPercent');
        const progBar = panggilElementDariID('tkDlProgressBar');
        const resultBox = panggilElementDariID('tkDlResult');

        btn.disabled = true; innerTextSamaDengan(btn, "Memproses...");
        ClassListTambah(progBox, 'show'); ClassListHapus(resultBox, 'show');
        innerTextSamaDengan(progState, "Mengambil data video..."); innerTextSamaDengan(progPercent, "0%");
        progBar.style.width = "0%";

        try {
            const resolution = panggilElementDariID('tkDlRes') ? panggilElementDariID('tkDlRes').value : 'hd';
            const data = await scrapeTikTokMeta(url, resolution, true, (p) => {
                innerTextSamaDengan(progState, "Mengunduh video...");
                innerTextSamaDengan(progPercent, `${p}%`);
                progBar.style.width = `${p}%`;
            });
            renderTikTokDownloadResult(data);
            ClassListTambah(resultBox, 'show');
            innerTextSamaDengan(progState, "Selesai!");
            progBar.style.width = "100%";
        } catch (e) {
            notif(`Gagal: ${e.message}`);
        } finally {
            btn.disabled = false; innerTextSamaDengan(btn, "Proses Link");
            setTimeout(() => ClassListHapus(progBox, 'show'), 1200);
        }
    }

    function renderTikTokDownloadResult(data) {
        const resultBox = panggilElementDariID('tkDlResult');
        const username = escapeStr(data.author.username || '-');
        innerHTMLSamaDengan(resultBox, `
            <div class="tkdl-meta"><div class="tkdl-meta-content"><span class="tkdl-meta-label">Akun Kreator</span><span class="tkdl-meta-val">@${username}</span></div></div>
            <div class="tkdl-meta"><div class="tkdl-meta-content"><span class="tkdl-meta-label">Judul / Caption</span><span class="tkdl-meta-val">${escapeStr(data.title || '-')}</span></div></div>
            <div class="tkdl-meta"><div class="tkdl-meta-content"><span class="tkdl-meta-label">Hashtag</span><span class="tkdl-meta-val">${escapeStr(data.hashtagString || '-')}</span></div></div>
            <div class="tkdl-stats-grid">
                <div class="tkdl-stat-box"><span class="val">${data.stats.likes}</span><span class="label">Likes</span></div>
                <div class="tkdl-stat-box"><span class="val">${data.stats.comments}</span><span class="label">Komen</span></div>
                <div class="tkdl-stat-box"><span class="val">${data.stats.shares}</span><span class="label">Share</span></div>
                <div class="tkdl-stat-box"><span class="val">${data.stats.saves}</span><span class="label">Save</span></div>
            </div>
            <video class="tkdl-video" controls playsinline src="${data.video.objectUrl || ''}"></video>
            <div class="tkdl-btn-group"><a href="${data.video.objectUrl || '#'}" download="tiktok-${username}.mp4">Download Video MP4</a></div>
            <div class="tkdl-audio-block">
                <div class="tkdl-audio-header"><span>${escapeStr(data.audio.tiktokMusic.title || 'Audio Musik TikTok')}</span><a class="tkdl-btn-sm" href="${data.audio.tiktokMusic.objectUrl || ''}" download="tiktok-audio-${username}.mp3">Download</a></div>
                <audio controls src="${data.audio.tiktokMusic.objectUrl || ''}"></audio>
            </div>
        `);
        lucide.createIcons();
    }

    // Tombol unduh cepat per baris pada hasil pengambilan data (pakai link yang sudah ada).
    async function quickDownloadItem(link, btn) {
        if (!link) return notif("Link video tidak tersedia.");
        const originalHTML = btn.innerHTML;
        btn.disabled = true; innerHTMLSamaDengan(btn, '<i data-lucide="loader" class="spin"></i>'); lucide.createIcons();
        try {
            const data = await scrapeTikTokMeta(link, 'hd', true, null);
            if (!data.video.objectUrl) throw new Error("Video tidak dapat diunduh.");
            const a = document.createElement('a');
            a.href = data.video.objectUrl;
            a.download = `tiktok-${data.author.username || 'video'}-${Date.now()}.mp4`;
            a.click();
        } catch (e) {
            notif(`Gagal mengunduh: ${e.message}`);
        } finally {
            btn.disabled = false; innerHTMLSamaDengan(btn, originalHTML); lucide.createIcons();
        }
    }

    // Pratinjau video (klik thumbnail) untuk item hasil pengambilan data.
    let currentPreviewObjectUrl = null;

    async function openVideoPreview(link) {
        if (!link) return;
        const overlay = panggilElementDariID('videoPreviewOverlay');
        const body = panggilElementDariID('videoPreviewBody');
        if (!overlay || !body) return;

        if (currentPreviewObjectUrl) { URL.revokeObjectURL(currentPreviewObjectUrl); currentPreviewObjectUrl = null; }
        innerHTMLSamaDengan(body, '<i data-lucide="loader" class="spin"></i>');
        lucide.createIcons();
        ClassListTambah(overlay, 'show');

        try {
            const data = await scrapeTikTokMeta(link, 'hd', true, null);
            if (!data.video.objectUrl) throw new Error("Video tidak dapat dimuat.");
            if (data.video.objectUrl.startsWith('blob:')) currentPreviewObjectUrl = data.video.objectUrl;
            innerHTMLSamaDengan(body, `<video controls autoplay playsinline src="${data.video.objectUrl}"></video>`);
        } catch (e) {
            innerHTMLSamaDengan(body, `<div class="vp-error">Gagal memuat pratinjau: ${escapeStr(e.message || 'Error tidak diketahui')}</div>`);
        }
    }

    function closeVideoPreview(event) {
        if (event && event.currentTarget !== event.target) return;
        const overlay = panggilElementDariID('videoPreviewOverlay');
        const body = panggilElementDariID('videoPreviewBody');
        if (overlay) ClassListHapus(overlay, 'show');
        if (body) innerHTMLSamaDengan(body, '');
        if (currentPreviewObjectUrl) { URL.revokeObjectURL(currentPreviewObjectUrl); currentPreviewObjectUrl = null; }
    }

    async function startScraping() {
        if(apifyTokens.length === 0) return notif("Aksi ditolak. Konfigurasi API Apify eror.");

        const usernames = Array.from(panggilSemuaQuery('.username-input')).map(i => i.value.trim().replace('@', '')).filter(i => i);
        if(!usernames.length) return notif("Masukkan minimal 1 username!");

        const btn = panggilElementDariID('btn-start-scrape');
        btn.disabled = true;
        innerTextSamaDengan(btn, "Memproses...");

        innerHTMLSamaDengan(panggilElementDariID('resultsArea'), "");
        sessionData = {}; 
        
        let dates;
        try { dates = getSelectedDates(); } catch (e) { btn.disabled = false; innerTextSamaDengan(btn, "Ambil Data"); return notif(e.message); }

        for (const user of usernames) {
            addLog(`Memproses Data @${user}...`, "running");
            const runInput = {
                "profiles": [user], "resultsPerPage": 100, "profileScrapeSections": ["videos"], "profileSorting": "oldest",
                "excludePinnedPosts": true, "newestPostDate": dates.end.toISOString().split('T')[0], "oldestPostDateUnified": dates.start.toISOString().split('T')[0]
            };

            try {
                // Apify di sini HANYA dipakai untuk mendata daftar LINK video.
                // Tanggal, judul, dan statistik semuanya dideteksi lewat API
                // downloader (tikwm) di bawah -- bukan dari data Apify.
                const items = await runApifyWithFallback(runInput);
                sessionData[user] = { dates: dates, items: [], searchTerm: "" };

                const linkToItem = {};
                const uniqueLinks = [];
                items.forEach(item => {
                    if (!item.webVideoUrl || linkToItem[item.webVideoUrl]) return;
                    linkToItem[item.webVideoUrl] = item;
                    uniqueLinks.push(item.webVideoUrl);
                });

                let idCount = 0;
                let processedCount = 0;
                for (const link of uniqueLinks) {
                    processedCount++;
                    addLog(`Mendeteksi detail video ${processedCount}/${uniqueLinks.length} dari @${user}...`, "running");

                    const rawItem = linkToItem[link];

                    try {
                        const meta = await scrapeTikTokMeta(link, 'hd', false, null);
                        if (!meta.createTime) throw new Error("Tanggal video tidak terdeteksi dari API.");

                        const d = new Date(meta.createTime * 1000);
                        if (d < dates.start || d > dates.end) continue; // di luar rentang tanggal, lewati

                        idCount++;
                        sessionData[user].items.push({
                            id: `vid_${idCount}`, tglObj: d, tglStr: formatTgl(d),
                            title: meta.title, hashtags: meta.hashtagString, link: link, cover: meta.cover || null,
                            views: meta.stats.views, likes: meta.stats.likes,
                            komens: meta.stats.comments, shares: meta.stats.shares, saves: meta.stats.saves,
                            isTrashed: false, trashReason: "", isForceRestored: false, isMatched: false
                        });
                    } catch (metaErr) {
                        // API deteksi link gagal untuk video ini -> pakai data cadangan dari Apify
                        // (termasuk tanggalnya) supaya data tidak hilang begitu saja.
                        if (!rawItem || !rawItem.createTimeISO) continue;
                        const d = new Date(rawItem.createTimeISO);
                        if (d < dates.start || d > dates.end) continue;

                        const textMatch = rawItem.text ? rawItem.text.replace(/#\w+/g, '').trim() : "";
                        const hashMatch = rawItem.text ? (rawItem.text.match(/#\w+/g) || []).join(" ") : "";

                        idCount++;
                        sessionData[user].items.push({
                            id: `vid_${idCount}`, tglObj: d, tglStr: formatTgl(d),
                            title: textMatch, hashtags: hashMatch, link: link,
                            cover: rawItem.covers?.default || rawItem.coverUrl || null,
                            views: rawItem.playCount || 0, likes: rawItem.diggCount || 0,
                            komens: rawItem.commentCount || 0, shares: rawItem.shareCount || 0, saves: rawItem.collectCount || 0,
                            isTrashed: false, trashReason: "Deteksi detail via API gagal, memakai data cadangan", isForceRestored: false, isMatched: false
                        });
                    }

                    await new Promise(r => setTimeout(r, 150)); // jeda kecil biar tidak membanjiri API deteksi
                }

                sessionData[user].items.sort((a,b) => a.tglObj - b.tglObj);
                sessionData[user].items.forEach((item, index) => { item.originalNo = index + 1; });

                addLog(`Berhasil memuat ${sessionData[user].items.length} data dari @${user}`, "success");
                renderUI(user);

            } catch(e) { addLog(`Error ambil data @${user}: ${e.message}`, "error"); }
        }
        
        btn.disabled = false;
        innerTextSamaDengan(btn, "Ambil Data");
    }

    function handleSearch(user) {
        const input = panggilElementDariID(`searchInput-${user}`);
        sessionData[user].searchTerm = input.value.toLowerCase().trim();
        renderListData(user);
    }

    function manualTrash(user, itemId) {
        let item = sessionData[user].items.find(i => i.id === itemId);
        item.isTrashed = true; item.isForceRestored = false; item.trashReason = "Dihapus Manual";
        renderListData(user);
    }

    function manualRestore(user, itemId) {
        let item = sessionData[user].items.find(i => i.id === itemId);
        item.isTrashed = false; item.isForceRestored = true; item.trashReason = "";
        renderListData(user);
    }

    function renderUI(user) {
        let sd = sessionData[user];
        const resArea = panggilElementDariID('resultsArea');
        let div = panggilElementDariID(`container-${user}`);
        if(!div) {
            div = document.createElement('div'); div.id = `container-${user}`; div.className = 'ts-card';
            resArea.appendChild(div);
        }

        let searchBoxHTML = "";
        if (sd.items.length > 6) {
            searchBoxHTML = `
                <div class="search-box">
                    <label class="ts-label">Pencarian Lanjutan (Ketik "kosong" untuk mendeteksi data blank)</label>
                    <input type="text" id="searchInput-${user}" placeholder="Cari Data" onkeyup="handleSearch('${user}')">
                </div>
            `;
        }

        innerHTMLSamaDengan(div, `
            <h2>Laporan: @${user}</h2>
            ${searchBoxHTML}
            <div class="tabs">
                <div class="tab active" id="tab-act-${user}" onclick="switchTab('${user}', 'act')">Daftar Utama</div>
                <div class="tab" id="tab-trh-${user}" onclick="switchTab('${user}', 'trh')">Tong Sampah</div>
            </div>
            <div id="list-act-${user}" class="data-list"></div>
            <div id="list-trh-${user}" class="data-list" style="display:none;"></div>
            
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-action" style="margin-top:0; flex: 1;" onclick="downloadData('${user}')">
                    Unduh Data (CSV)
                </button>
                <button class="btn-action" style="margin-top:0; flex: 1.5; background: var(--ts-success);" onclick="sendToSheetMapper('${user}')">
                    + Langsung Masukkan Data
                </button>
            </div>
        `);

        renderListData(user);
    }

    function renderListData(user) {
        let sd = sessionData[user];
        let term = sd.searchTerm;

        sd.items.forEach(item => {
            item.isMatched = false;
            if (term) {
                if (term === "kosong") {
                    if (!item.title.trim() || !item.hashtags.trim()) item.isMatched = true;
                } else {
                    let allData = `${item.title} ${item.hashtags} ${item.tglStr} ${item.views} ${item.likes} ${item.komens} ${item.shares} ${item.saves}`.toLowerCase();
                    if (allData.includes(term)) item.isMatched = true;
                }
            }
        });

        const activeData = sd.items.filter(i => !i.isTrashed);
        const trashData = sd.items.filter(i => i.isTrashed);

        activeData.sort((a, b) => a.originalNo - b.originalNo);
        activeData.forEach((item, index) => { item.displayNo = index + 1; });

        trashData.sort((a, b) => a.originalNo - b.originalNo);
        trashData.forEach((item, index) => { item.displayNo = index + 1; });

        const buildSeparatedHTML = (dataList, isActiveTab) => {
            if (!term) return generateListHTML(dataList, user, isActiveTab);
            
            const matched = dataList.filter(i => i.isMatched);
            const unmatched = dataList.filter(i => !i.isMatched);
            
            let html = "";
            if (matched.length > 0) {
                html += `<div class="group-header header-match">Hasil Pencarian (${matched.length})</div>`;
                html += generateListHTML(matched, user, isActiveTab);
            }
            if (unmatched.length > 0) {
                html += `<div class="group-header header-other">Data Lainnya (${unmatched.length})</div>`;
                html += generateListHTML(unmatched, user, isActiveTab);
            }
            if (matched.length === 0 && unmatched.length === 0) {
                html = `<div style="padding: 20px; text-align:center; color: var(--ts-text-muted); font-size: 0.9rem;">Tidak ada data yang cocok</div>`;
            }
            return html;
        };

        innerHTMLSamaDengan(panggilElementDariID(`list-act-${user}`), buildSeparatedHTML(activeData, true));
        innerHTMLSamaDengan(panggilElementDariID(`list-trh-${user}`), buildSeparatedHTML(trashData, false));

        innerTextSamaDengan(panggilElementDariID(`tab-act-${user}`), `Daftar Utama (${activeData.length})`);
        innerTextSamaDengan(panggilElementDariID(`tab-trh-${user}`), `Tong Sampah (${trashData.length})`);

        lucide.createIcons();
    }

    function switchTab(user, target) {
        panggilElementDariID(`list-act-${user}`).style.display = target === 'act' ? 'block' : 'none';
        panggilElementDariID(`list-trh-${user}`).style.display = target === 'trh' ? 'block' : 'none';
        
        if(target === 'act') {
            ClassListTambah(panggilElementDariID(`tab-act-${user}`), 'active');
            ClassListHapus(panggilElementDariID(`tab-trh-${user}`), 'active');
        } else {
            ClassListTambah(panggilElementDariID(`tab-trh-${user}`), 'active');
            ClassListHapus(panggilElementDariID(`tab-act-${user}`), 'active');
        }
    }

    function generateListHTML(items, user, isActiveTab) {
        if(!items.length) return `<div style="padding: 20px; text-align:center; color: var(--ts-text-muted); font-size: 0.9rem;">Data kosong.</div>`;
        return items.map((item) => `
            <div class="data-item ${item.isMatched ? 'highlight-match' : ''} ${item.isForceRestored && isActiveTab ? 'manual-restored' : ''}">
                <div class="data-thumb${item.link ? ' has-preview' : ''}" ${item.link ? `onclick="openVideoPreview('${escapeStr(item.link)}')"` : ''}>
                    ${item.cover
                        ? `<img src="${item.cover}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<i data-lucide=&quot;video-off&quot;></i>'; lucide.createIcons();">`
                        : `<i data-lucide="video"></i>`}
                    ${item.link ? `<div class="thumb-play-overlay"><i data-lucide="play"></i></div>` : ''}
                </div>
                <div class="data-body">
                    <div class="data-title">${item.displayNo}. ${item.title || "<i>(Blank Title)</i>"}</div>
                    <div class="data-meta">
                        Tanggal: <span class="stat-highlight">${item.tglStr}</span> | 
                        Views: <span class="stat-highlight">${item.views}</span> | 
                        Likes: <span class="stat-highlight">${item.likes}</span><br>
                        Komen: <span class="stat-highlight">${item.komens}</span> | 
                        Share: <span class="stat-highlight">${item.shares}</span> | 
                        Save: <span class="stat-highlight">${item.saves}</span><br>
                        <div style="margin-top: 6px; color: var(--ts-text-muted); font-size: 0.75rem;">${item.hashtags || '<i>No tags</i>'}</div>
                        ${item.trashReason && !isActiveTab ? `<div class="reason-badge">${item.trashReason}</div>` : ''}
                    </div>
                </div>
                <div class="data-actions">
                    ${item.link && isActiveTab ? `<button class="icon-btn icon-btn-primary" title="Unduh Video" onclick="quickDownloadItem('${escapeStr(item.link)}', this)"><i data-lucide="download"></i></button>` : ''}
                    ${isActiveTab 
                        ? `<button class="icon-btn icon-btn-danger" title="Hapus" onclick="manualTrash('${user}', '${item.id}')"><i data-lucide="trash-2"></i></button>`
                        : `<button class="icon-btn icon-btn-success" title="Pulihkan Data" onclick="manualRestore('${user}', '${item.id}')"><i data-lucide="rotate-ccw"></i></button>`}
                </div>
            </div>
        `).join('');
    }

    function downloadData(user) {
        const sd = sessionData[user];
        const activeItems = sd.items.filter(i => !i.isTrashed);
        if(activeItems.length === 0) return notif("Tidak ada data untuk diunduh.");

        let tglName = formatTgl(sd.dates.start, true).replace(/ /g,'');
        if(sd.dates.start.getTime() !== sd.dates.end.getTime()) tglName += `-${formatTgl(sd.dates.end, true).replace(/ /g,'')}`;
        
        let csv = generateCSVString(activeItems);

        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        a.download = `Laporan_${user}_${tglName}.csv`;
        a.click();
        
        notif(`File CSV untuk @${user} berhasil diunduh.`);
    }

    function sendToSheetMapper(user) {
        const sd = sessionData[user];
        const activeItems = sd.items.filter(i => !i.isTrashed);
        
        if(activeItems.length === 0) return notif("Tidak ada data untuk dimasukkan");

        let tglName = formatTgl(sd.dates.start, true).replace(/ /g,'');
        if(sd.dates.start.getTime() !== sd.dates.end.getTime()) tglName += `-${formatTgl(sd.dates.end, true).replace(/ /g,'')}`;
        
        let csv = generateCSVString(activeItems);
        const fileName = `Laporan_${user}_${tglName}.csv`;
        
        const file = new File([csv], fileName, { type: 'text/csv;charset=utf-8;' });
        processCSVFiles([file]);
        
        panggilElementDariID('sheet-mapper').scrollIntoView({ behavior: 'smooth' });
        addLog(`Sukses memuat CSV: ${fileName}`, "success");
    }

    // Selalu bungkus tiap kolom dengan tanda kutip supaya konten yang punya
    // koma atau baris baru di dalamnya (misal caption TikTok) tidak bikin
    // baris CSV "geser" saat dibaca ulang oleh parseCSVRobust().
    function csvField(val) {
        const s = (val === undefined || val === null) ? '' : String(val);
        return `"${s.replace(/"/g, '""')}"`;
    }

    function generateCSVString(items) {
        const header = ["No","Tanggal Upload","Judul Konten","Hashtag","Link Konten","View","Like","Komen","Share","Save"];
        let csv = header.map(csvField).join(',') + "\r\n";
        items.sort((a, b) => a.originalNo - b.originalNo);
        items.forEach((item, i) => {
            const rowVals = [
                i + 1, item.tglStr, item.title, item.hashtags, item.link,
                item.views, item.likes, item.komens, item.shares, item.saves
            ];
            csv += rowVals.map(csvField).join(',') + "\r\n";
        });
        return csv;
    }

    /* =======================================================
       LOGIKA JAVASCRIPT APP 2 (SHEET MAPPER)
    ======================================================== */
    let state = {};
    let globalLinks = [];
    let pollingIntervals = {};
    let checkingStatus = {}; 
    let activeFileName = null;
    let activeTargetAreaIndex = 0;

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const ALL_LETTERS = [...alphabet];
    for(let i=0; i<alphabet.length; i++) {
        for(let j=0; j<alphabet.length; j++) {
            ALL_LETTERS.push(alphabet[i] + alphabet[j]);
        }
    }
    const col_options = ALL_LETTERS.map(c => `<option value="${c}">${c}</option>`).join('');

    function escapeStr(str) { 
        return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); 
    }

    function initApp() {
        const urlList = panggilElementDariID('url_list');
        if(urlList && urlList.children.length === 0) addLinkInput();
        lucide.createIcons();
    }

    function handleCSVFileProcess(input) {
        if (!input.files || input.files.length === 0) return;
        processCSVFiles(Array.from(input.files));
        input.value = ""; 
    }

    // =======================================================
    // PARSER CSV YANG SADAR TANDA KUTIP & BARIS BARU (RFC4180)
    // Menggantikan parser regex per-baris lama yang gampang "geser"/salah
    // kolom kalau ada teks (misal caption TikTok) yang mengandung koma
    // atau baris baru di dalam tanda kutip. Ini akar masalah data yang
    // tumpuk/geser saat datanya sudah banyak.
    // =======================================================
    function parseCSVRobust(content) {
        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;
        const len = content.length;
        let i = 0;

        while (i < len) {
            const char = content[i];

            if (inQuotes) {
                if (char === '"') {
                    if (content[i + 1] === '"') { field += '"'; i += 2; continue; }
                    inQuotes = false; i++; continue;
                }
                field += char; i++; continue;
            }

            if (char === '"') { inQuotes = true; i++; continue; }
            if (char === ',') { row.push(field); field = ''; i++; continue; }
            if (char === '\r') { i++; continue; }
            if (char === '\n') {
                row.push(field); field = '';
                rows.push(row); row = [];
                i++; continue;
            }
            field += char; i++;
        }

        if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

        return rows
            .map(r => r.map(c => (c || '').trim()))
            .filter(r => !(r.length === 1 && r[0] === '') && !(r.length === 0));
    }

    // Mendeteksi apakah sebuah kolom cocok dijadikan tipe "dropdown boolean"
    // (isinya cuma TRUE/FALSE) supaya bisa ditawarkan kondisi nilai di Langkah 3.
    function detectColumnTypes(cleanHeaders, columnsData) {
        const colTypes = {};
        cleanHeaders.forEach(h => {
            const vals = (columnsData[h] || []).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
            if (vals.length > 0 && vals.every(v => ['true', 'false'].includes(String(v).trim().toLowerCase()))) {
                colTypes[h] = 'boolean';
            } else {
                colTypes[h] = 'text';
            }
        });
        return colTypes;
    }

    function processCSVFiles(filesArray) {
        filesArray.forEach(file => {
            if (!file.name.toLowerCase().endsWith('.csv')) {
                addLog(`Gagal: '${file.name}' bukan format CSV.`, "error");
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                addLog(`Gagal: Ukuran '${file.name}' melebih batas maksimal 10MB.`, "error");
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const rawContent = e.target.result;
                
                if (typeof rawContent !== 'string' || rawContent.trim() === "") {
                    addLog(`Gagal: '${file.name}' kosong atau rusak.`, "error");
                    return;
                }
                if (rawContent.indexOf('\x00') !== -1) {
                    addLog(`Gagal: '${file.name}' terdeteksi sebagai file biner/bukan teks murni.`, "error");
                    return;
                }

                let rowsData = parseCSVRobust(rawContent);

                if(rowsData.length === 0) {
                    addLog(`Gagal: Tidak ada baris data yang bisa dibaca di '${file.name}'.`, "error");
                    return;
                }

                let rawHeaders = rowsData[0].map((h, idx) => h.trim() !== "" ? h.trim() : `Kolom ${idx + 1}`);
                let bodyRows = rowsData.slice(1);

                let seenRows = new Set();
                let uniqueBodyRows = [];
                
                bodyRows.forEach(r => {
                    if (r[0] === rawHeaders[0] && r.join(',') === rawHeaders.join(',')) return;
                    let stringified = JSON.stringify(r);
                    if (!seenRows.has(stringified)) {
                        seenRows.add(stringified);
                        uniqueBodyRows.push(r);
                    }
                });

                let cleanHeaders = [];
                let headerCounts = {};
                rawHeaders.forEach(h => {
                    if(headerCounts[h] === undefined) {
                        headerCounts[h] = 0;
                        cleanHeaders.push(h);
                    } else {
                        headerCounts[h]++;
                        cleanHeaders.push(`${h}_${headerCounts[h]}`);
                    }
                });

                let columnsData = {};
                let colLengths = {};
                
                cleanHeaders.forEach((h, idx) => {
                    columnsData[h] = uniqueBodyRows.map(r => r[idx] !== undefined ? r[idx] : "");
                    
                    let lastValidIndex = 0;
                    for(let k = columnsData[h].length - 1; k >= 0; k--) {
                        let val = columnsData[h][k];
                        if(val !== undefined && val !== null && val.trim() !== "" && val.toLowerCase() !== 'nan' && val.toLowerCase() !== 'none') {
                            lastValidIndex = k + 1;
                            break;
                        }
                    }
                    colLengths[h] = lastValidIndex;
                });

                const colTypes = detectColumnTypes(cleanHeaders, columnsData);

                const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/["']/g, "").replace(/[_+\-=\[\]{}()]+/g, " ").replace(/\s+/g, " ").trim();
                
                const filePackage = [{
                    name: cleanFileName,
                    rows: uniqueBodyRows.length, 
                    columns: cleanHeaders,
                    col_lengths: colLengths,
                    col_types: colTypes,
                    raw_columns_matrix: columnsData
                }];

                syncFiles(filePackage);
            };
            
            reader.readAsText(file);
        });
    }

    function syncFiles(newFiles) {
        const selector = panggilElementDariID('main_file_selector');
        const fileListUi = panggilElementDariID('file_list_ui');
        const defBtn = panggilElementDariID('default_upload_btn');
        if(newFiles.length > 0 && defBtn) defBtn.style.display = 'none';

        newFiles.forEach(f => {
            if(!state[f.name]) {
                state[f.name] = { configs: [], columns: f.columns, rows: f.rows, col_lengths: f.col_lengths, col_types: f.col_types || {}, raw_columns_matrix: f.raw_columns_matrix };
                if(selector.options.length > 0 && selector.options[0].value === "") selector.remove(0);

                const opt = document.createElement('option');
                opt.value = f.name; innerTextSamaDengan(opt, f.name);
                selector.appendChild(opt);

                const cleanId = f.name.replace(/[^a-zA-Z0-9]/g, '_');
                const div = document.createElement('div');
                div.id = 'filebox_' + cleanId;
                div.className = "flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 animate-fadeIn gap-3 w-full shrink-0";
                innerHTMLSamaDengan(div, `
                    <div class="flex items-center gap-2 min-w-0 flex-grow">
                        <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-500 shrink-0"></i>
                        <input type="text" value="${escapeStr(f.name)}" onchange="renameFileKey('${escapeStr(f.name)}', this.value, '${cleanId}')" class="bg-transparent border-none text-xs font-medium text-slate-300 truncate w-full outline-none focus:bg-slate-900 focus:px-2 focus:py-0.5 rounded focus:ring-1 focus:ring-slate-700 p-0">
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <span class="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">${f.rows} Baris</span>
                        <button type="button" onclick="removeFile('${escapeStr(f.name)}', '${cleanId}')" class="text-slate-500 hover:text-rose-400 transition-colors p-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                `);
                fileListUi.appendChild(div);
            }
        });

        lucide.createIcons();

        if(!activeFileName && newFiles.length > 0) {
            selector.value = newFiles[0].name;
            switchActiveFile();
        }
    }

    function renameFileKey(oldName, newName, cleanId) {
        let sanitizedNewName = newName.trim().replace(/["']/g, "");
        if(!sanitizedNewName || sanitizedNewName === oldName) return;
        
        if(state[sanitizedNewName]) {
            notif("Nama file sudah digunakan!");
            renderMappings();
            return;
        }

        state[sanitizedNewName] = state[oldName];
        delete state[oldName];

        const selector = panggilElementDariID('main_file_selector');
        for(let i=0; i<selector.options.length; i++) {
            if(selector.options[i].value === oldName) {
                selector.options[i].value = sanitizedNewName;
                innerTextSamaDengan(selector.options[i], sanitizedNewName);
                break;
            }
        }

        if(activeFileName === oldName) {
            activeFileName = sanitizedNewName;
            innerTextSamaDengan(panggilElementDariID('active_file_label'), `(${activeFileName})`);
        }

        const fileBox = panggilElementDariID('filebox_' + cleanId);
        if(fileBox) {
            innerHTMLSamaDengan(fileBox, `
                <div class="flex items-center gap-2 min-w-0 flex-grow">
                    <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-500 shrink-0"></i>
                    <input type="text" value="${escapeStr(sanitizedNewName)}" onchange="renameFileKey('${escapeStr(sanitizedNewName)}', this.value, '${cleanId}')" class="bg-transparent border-none text-xs font-medium text-slate-300 truncate w-full outline-none focus:bg-slate-900 focus:px-2 focus:py-0.5 rounded focus:ring-1 focus:ring-slate-700 p-0">
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    <span class="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">${state[sanitizedNewName].rows} Baris</span>
                    <button type="button" onclick="removeFile('${escapeStr(sanitizedNewName)}', '${cleanId}')" class="text-slate-500 hover:text-rose-400 transition-colors p-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            `);
            lucide.createIcons();
        }
        
        renderMappings();
    }

    function removeFile(fName, cleanId) {
        delete state[fName];
        const fb = panggilElementDariID('filebox_' + cleanId);
        if (fb) fb.remove();
        
        const selector = panggilElementDariID('main_file_selector');
        for(let i=0; i<selector.options.length; i++) {
            if(selector.options[i].value === fName) { selector.remove(i); break; }
        }
        if(Object.keys(state).length === 0) {
            panggilElementDariID('default_upload_btn').style.display = 'flex';
            innerHTMLSamaDengan(selector, '<option value="">-- BELUM ADA FILE YANG DIUPLOAD --</option>');
            activeFileName = null;
            ClassListTambah(panggilElementDariID('mapping_workspace'), 'hidden');
        } else if (activeFileName === fName) {
            selector.value = selector.options[0].value;
            switchActiveFile();
        }
        validate();
    }

    function addLinkInput() {
        const id = "link_" + Date.now();
        const container = panggilElementDariID('url_list');
        const div = document.createElement('div');
        div.id = id;
        div.setAttribute('data-state', 'empty');
        div.setAttribute('data-url', '');
        div.className = "bg-slate-950 border border-slate-800 p-3 rounded-xl hover:border-slate-700 transition-all animate-fadeIn";
        innerHTMLSamaDengan(div, `
            <div class="flex gap-2 items-center">
                <input type="text" placeholder="Masukkan link Google Spreadsheet..." onchange="handleUrlChange(this, '${id}')" class="w-full bg-transparent border-none text-xs font-medium outline-none text-slate-200 placeholder:text-slate-600 focus:ring-0 p-0">
                <button type="button" onclick="removeLink('${id}')" class="text-slate-600 hover:text-rose-400 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
            <div class="status-box text-[10px] text-slate-500 font-medium mt-1">Menunggu input tautan...</div>`);
        container.appendChild(div);
        lucide.createIcons();
    }

    function handleUrlChange(el, id) {
        const url = el.value.trim();
        const box = panggilElementDariID(id);
        const statusBox = box.querySelector('.status-box');

        box.setAttribute('data-url', url);
        
        // Bersihkan interval lama jika ada
        if(pollingIntervals[id]) {
            clearInterval(pollingIntervals[id]);
            delete pollingIntervals[id];
        }

        if(!url) {
            innerTextSamaDengan(statusBox, "Menunggu input tautan...");
            statusBox.className = "status-box text-[10px] text-slate-500 font-medium mt-1";
            box.setAttribute('data-state', 'empty');
            return;
        }

        innerTextSamaDengan(statusBox, "Memeriksa akses Google Sheets...");
        statusBox.className = "status-box text-[10px] text-amber-400 font-medium mt-1 animate-pulse";

        executeLinkVerificationBridge(url, id);

        // Interval HANYA ditujukan untuk re-check otomatis jika statusnya "warning" (menunggu akses)
        pollingIntervals[id] = setInterval(() => {
            const checkEl = panggilElementDariID(id);
            if(!checkEl) { 
                clearInterval(pollingIntervals[id]); 
                delete pollingIntervals[id];
                return; 
            }
            const currentUrl = checkEl.getAttribute('data-url');
            
            // Jangan jalankan jika request sebelumnya belum selesai
            if(currentUrl && !checkingStatus[id]) {
                executeLinkVerificationBridge(currentUrl, id);
            }
        }, 5000);
    }

    async function executeLinkVerificationBridge(url, contextId) {
        if (!url || typeof url !== 'string') {
            linkVerified(contextId, 'error', 'Tautan Kosong', '', []);
            return;
        }

        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
            linkVerified(contextId, 'error', 'Bukan format link Spreadsheet', url, []);
            return;
        }

        checkingStatus[contextId] = true; // Kunci proses agar tidak di-spam interval

        const token = atob("S3VuY2lSYWhhc2lhU2F0U2V0OTY=");
        const payload = { action: "validate", spreadsheetUrl: url, token: token };

        try {
            const resData = await fetchGSWithFallback(payload);
            
            if(resData && resData.status === "success") {
                // Tidak cukup cuma percaya field "status: success" -- itu cuma berarti
                // linknya KETEMU/terbaca. Untuk memastikan linknya benar² BISA DIEDIT
                // (bukan cuma "Anyone with link can VIEW"), backend wajib mencoba
                // operasi tulis nyata ke spreadsheet dan melaporkan hasilnya lewat
                // salah satu field ini: permission, access, atau canEdit.
                const belumBisaEdit = resData.permission === "VIEWER" 
                    || resData.access === "READ_ONLY" 
                    || resData.canEdit === false;

                if (belumBisaEdit) {
                    linkVerified(contextId, 'warning', 'Akses Edit Belum Disetujui (Mode Pelihat)', url, []);
                } else {
                    linkVerified(contextId, 'success', resData.title || "Spreadsheet Tanpa Judul", url, resData.sheets || []);
                }
            } else if (resData && resData.status === "warning") {
                linkVerified(contextId, 'warning', resData.message || 'Akses Edit Belum Disetujui (Mode Pelihat)', url, []);
            } else {
                linkVerified(contextId, 'error', 'Akses Ditolak / Link Private', url, []);
            }
        } catch(e) {
            linkVerified(contextId, 'error', 'Gagal memverifikasi (Private/Error)', url, []);
        } finally {
            checkingStatus[contextId] = false; // Buka kunci
        }
    }

    function linkVerified(id, status, title, url, sheetsArr) {
        const box = panggilElementDariID(id);
        if(!box) return;

        // HENTIKAN POLLING JIKA STATUS SUDAH MUTLAK
        if (status === 'success' || status === 'error' || status === 'duplicate') {
            if (pollingIntervals[id]) {
                clearInterval(pollingIntervals[id]);
                delete pollingIntervals[id];
            }
        }

        const stringifiedSheets = JSON.stringify(sheetsArr);
        const currentState = box.getAttribute('data-state');
        const newState = status + title + stringifiedSheets;

        if(currentState === newState) return;

        const isDuplicate = globalLinks.some(l => l.url === url && l.id !== id);
        if(isDuplicate && status === 'success') {
            box.setAttribute('data-state', 'duplicate');
            box.className = "bg-slate-950 border border-rose-900/50 p-3 rounded-xl transition-all";
            innerHTMLSamaDengan(box, `
                <div class="flex gap-2 items-center">
                    <input type="text" value="${url}" onchange="handleUrlChange(this, '${id}')" class="w-full bg-transparent border-none text-xs font-medium text-rose-300 outline-none focus:ring-0 p-0">
                    <button type="button" onclick="removeLink('${id}')" class="text-rose-700 hover:text-rose-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                <div class="status-box text-[10px] text-rose-400 font-medium mt-1">Tautan duplikat terdeteksi</div>`);
            lucide.createIcons();
            return;
        }

        box.setAttribute('data-state', newState);

        if(status === 'success') {
            box.className = "bg-slate-950 border border-emerald-900/40 p-3 rounded-xl transition-all flex justify-between items-center";
            innerHTMLSamaDengan(box, `
                <div class="min-w-0 pr-2">
                    <div class="text-xs font-semibold text-emerald-400 truncate max-w-[180px] sm:max-w-[280px]" title="${escapeStr(title)}">${escapeStr(title)}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">${sheetsArr.length} Worksheet terdeteksi</div>
                </div>
                <button type="button" onclick="removeLink('${id}')" class="text-slate-600 hover:text-rose-400 transition-colors p-1 shrink-0"><i data-lucide="x" class="w-4 h-4"></i></button>
            `);

            globalLinks = globalLinks.filter(l => l.id !== id);
            globalLinks.push({id, title, url, sheets: sheetsArr});
        } else if (status === 'warning') {
            box.className = "bg-slate-950 border border-amber-500/40 p-3 rounded-xl transition-all";
            innerHTMLSamaDengan(box, `
                <div class="flex gap-2 items-center">
                    <input type="text" value="${url}" onchange="handleUrlChange(this, '${id}')" class="w-full bg-transparent border-none text-xs font-medium text-amber-300 placeholder:text-amber-700 outline-none focus:ring-0 p-0">
                    <button type="button" onclick="removeLink('${id}')" class="text-amber-700 hover:text-amber-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                <div class="status-box text-[10px] text-amber-400 font-medium mt-1 flex items-center gap-1">
                    <i data-lucide="alert-triangle" class="w-3 h-3"></i> ${title} <span class="text-amber-600 animate-pulse ml-1">(Memantau...)</span>
                </div>`);
            globalLinks = globalLinks.filter(l => l.id !== id);
        } else {
            box.className = "bg-slate-950 border border-rose-900/40 p-3 rounded-xl transition-all";
            innerHTMLSamaDengan(box, `
                <div class="flex gap-2 items-center">
                    <input type="text" value="${url}" onchange="handleUrlChange(this, '${id}')" class="w-full bg-transparent border-none text-xs font-medium text-rose-300 placeholder:text-rose-700 outline-none focus:ring-0 p-0">
                    <button type="button" onclick="removeLink('${id}')" class="text-rose-800 hover:text-rose-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                <div class="status-box text-[10px] text-rose-400 font-medium mt-1 flex items-center gap-1">
                    <i data-lucide="x-circle" class="w-3 h-3"></i> ${title}
                </div>`);
            globalLinks = globalLinks.filter(l => l.id !== id);
        }

        lucide.createIcons();
        if(activeFileName) renderMappings();
        validate();
    }

    function removeLink(id) {
        if(pollingIntervals[id]) clearInterval(pollingIntervals[id]);
        const el = panggilElementDariID(id);
        if(el) el.remove();
        
        globalLinks = globalLinks.filter(l => l.id !== id);
        if(activeFileName) renderMappings();
        validate();
    }

    function switchActiveFile() {
        activeFileName = panggilElementDariID('main_file_selector').value;
        const ws = panggilElementDariID('mapping_workspace');
        if(!activeFileName) { ClassListTambah(ws, 'hidden'); return; }

        ClassListHapus(ws, 'hidden');
        innerTextSamaDengan(panggilElementDariID('active_file_label'), `(${activeFileName})`);
        renderMappings();
        validate();
    }

    function addMappingTarget() {
        if(!activeFileName || !state[activeFileName]) return;
        
        if(!state[activeFileName].configs) {
            state[activeFileName].configs = [];
        }

        const firstLink = globalLinks.length > 0 ? globalLinks[0] : null;
        
        state[activeFileName].configs.push({
            targetId: firstLink ? firstLink.id : '',
            sheetName: firstLink && firstLink.sheets.length > 0 ? firstLink.sheets[0] : '',
            rowMode: 'global', 
            globalStartRow: 1,  
            columns: []
        });
        
        activeTargetAreaIndex = state[activeFileName].configs.length - 1;
        renderMappings();
        validate();
    }

    function toggleTargetArea(idx) {
        if(activeTargetAreaIndex === idx) {
            activeTargetAreaIndex = -1;
        } else {
            activeTargetAreaIndex = idx;
        }
        renderMappings();
    }

    function switchRowMode(confIdx, modeValue) {
        state[activeFileName].configs[confIdx].rowMode = modeValue;
        
        state[activeFileName].configs[confIdx].columns.forEach(c => {
            const maxData = Math.max(1, state[activeFileName].col_lengths[c.src] || 0);
            c.row = modeValue === 'global' ? parseInt(state[activeFileName].configs[confIdx].globalStartRow || 1) : 1;
            c.count = maxData;
        });
        
        renderMappings();
        validate();
    }

    function updateGlobalRow(confIdx, val) {
        let cleanRow = parseInt(val) || 1;
        if(cleanRow < 1) cleanRow = 1;

        const fileData = state[activeFileName];
        const conf = fileData.configs[confIdx];
        conf.globalStartRow = cleanRow;
        conf.columns.forEach(c => { c.row = cleanRow; });

        // PENTING: jangan panggil renderMappings() di sini. renderMappings()
        // menghancurkan & membangun ulang seluruh input di layar setiap kali
        // dipanggil, jadi kalau dipanggil per-ketikan (oninput) input ini akan
        // kehilangan fokus/kursor setiap huruf/angka diketik -- itulah sebabnya
        // ngetik jadi "kayak ngecek-ngecek terus" dan susah. Cukup update
        // label & input yang sudah ada di DOM secara langsung.
        (fileData.columns || []).forEach((col, colIdx) => {
            const existing = conf.columns.find(c => c.src === col);
            if (!existing) return;

            const rowInput = panggilElementDariID(`inp_row_${confIdx}_${colIdx}`);
            if (rowInput) rowInput.value = cleanRow;

            const letterEl = panggilElementDariID(`sel_let_${confIdx}_${colIdx}`);
            const letter = letterEl ? letterEl.value : existing.letter;
            const count = parseInt(existing.count) || 1;
            const endRow = cleanRow + count - 1;

            const lblStart = panggilElementDariID(`lbl_start_${confIdx}_${colIdx}`);
            const lblEnd = panggilElementDariID(`lbl_end_${confIdx}_${colIdx}`);
            if (lblStart) innerTextSamaDengan(lblStart, letter + cleanRow);
            if (lblEnd) innerTextSamaDengan(lblEnd, letter + endRow);
        });

        validate();
    }

    function removeTargetConfig(idx) { 
        state[activeFileName].configs.splice(idx, 1); 
        
        if (activeTargetAreaIndex === idx) {
            activeTargetAreaIndex = Math.max(0, idx - 1);
        } else if (activeTargetAreaIndex > idx) {
            activeTargetAreaIndex--;
        }

        renderMappings(); 
        validate(); 
    }

    function renderMappings() {
        const container = panggilElementDariID('mapping_targets');
        if (!container) return;
        
        const pageScrollY = window.scrollY;
        const colScrolls = {};
        const fileData = state[activeFileName];
        
        if (fileData && fileData.configs) {
            fileData.configs.forEach((_, idx) => {
                const el = panggilElementDariID(`cols_container_${idx}`);
                if (el) colScrolls[idx] = el.scrollTop;
            });
        }

        if(!fileData || !fileData.configs || fileData.configs.length === 0) {
            innerHTMLSamaDengan(container, '');
            return;
        }

        innerHTMLSamaDengan(container, '');

        fileData.configs.forEach((conf, confIdx) => {
            try {
                const div = document.createElement('div');
                const isExpanded = (confIdx === activeTargetAreaIndex);

                div.className = "w-full bg-slate-950 rounded-xl border " + (isExpanded ? "border-indigo-500/40 shadow-lg" : "border-slate-800/60 hover:border-slate-700 opacity-80 hover:opacity-100") + " flex flex-col transition-all duration-200";

                const linkData = globalLinks.find(l => l.id === conf.targetId) || null;
                const sheetsList = linkData ? linkData.sheets : [];
                const currentMode = conf.rowMode || 'global';
                const columnsList = fileData.columns || [];

                innerHTMLSamaDengan(div, `
                    <div class="p-4 flex justify-between items-center cursor-pointer select-none ${isExpanded ? 'bg-slate-900/90 border-b border-slate-800 rounded-t-xl' : 'rounded-xl'}" onclick="toggleTargetArea(${confIdx})">
                        <div class="flex flex-col gap-1 min-w-0">
                            <span class="text-[10px] font-bold ${isExpanded ? 'text-indigo-400' : 'text-slate-400'} uppercase tracking-wider">Konfigurasi #${confIdx + 1}</span>
                            ${!isExpanded ? `<span class="text-xs text-slate-500 font-medium truncate pr-4">${linkData ? escapeStr(linkData.title) : 'Belum memilih spreadsheet target'}</span>` : ''}
                        </div>
                        <div class="flex items-center gap-3 shrink-0">
                            <span class="text-[10px] font-mono font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded">${conf.columns.length} Kolom</span>
                            <button type="button" onclick="event.stopPropagation(); removeTargetConfig(${confIdx})" class="text-slate-500 hover:text-rose-400 transition-colors p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                            <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 ${isExpanded ? 'text-indigo-400' : 'text-slate-500'}"></i>
                        </div>
                    </div>

                    <div class="${isExpanded ? 'flex flex-col' : 'hidden'}">
                        <div class="bg-slate-900/90 p-4 flex flex-col gap-3 shrink-0 border-b border-slate-800/60">
                            <div class="grid grid-cols-2 gap-2">
                                <div class="flex flex-col gap-1">
                                    <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Spreadsheet</span>
                                    <select onchange="updateTargetUrl(${confIdx}, this.value)" class="bg-slate-950 text-slate-200 border border-slate-800 text-xs font-medium rounded-md px-2 py-1.5 outline-none focus:border-slate-700 cursor-pointer w-full truncate appearance-none">
                                        <option value="">-- Pilih Target --</option>
                                        ${globalLinks.map(l => `<option value="${l.id}" ${l.id === conf.targetId ? 'selected' : ''}>${escapeStr(l.title)}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Pilih Worksheet</span>
                                    <select onchange="updateSheetName(${confIdx}, this.value)" class="bg-slate-950 text-slate-200 border border-slate-800 text-xs font-medium rounded-md px-2 py-1.5 outline-none focus:border-slate-700 cursor-pointer w-full truncate appearance-none">
                                        ${sheetsList.map(s => `<option value="${escapeStr(s)}" ${s === conf.sheetName ? 'selected' : ''}>${escapeStr(s)}</option>`).join('')}
                                        ${sheetsList.length === 0 ? '<option value="">- Kosong -</option>' : ''}
                                    </select>
                                </div>
                            </div>

                            <div class="flex flex-col gap-1.5 pt-1">
                                <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Pilih Metode</span>
                                <select onchange="switchRowMode(${confIdx}, this.value)" class="bg-slate-950 text-indigo-400 border border-slate-800 text-[11px] font-semibold rounded-md px-2 py-1.5 outline-none focus:border-slate-700 cursor-pointer w-full appearance-none">
                                    <option value="global" ${currentMode === 'global' ? 'selected' : ''}>1. Samakan Baris Awal ke Semua Kolom</option>
                                    <option value="individual" ${currentMode === 'individual' ? 'selected' : ''}>2. Atur Baris Awal Manual Per Kolom</option>
                                </select>
                            </div>

                            ${currentMode === 'global' ? `
                            <div class="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800 animate-fadeIn mt-1">
                                <span class="text-[10px] text-slate-400 font-medium">Baris Awal :</span>
                                <input type="number" value="${conf.globalStartRow || 1}" oninput="updateGlobalRow(${confIdx}, this.value)" class="w-16 bg-slate-900 border border-slate-800 text-xs rounded text-center p-1 outline-none text-white font-mono hide-arrows" min="1">
                            </div>
                            ` : ''}
                        </div>

                        <div id="cols_container_${confIdx}" class="p-4 space-y-2.5 bg-slate-950/40 overflow-y-auto max-h-[360px] custom-scroll">
                            ${columnsList.map((col, colIdx) => {
                                const safeColStr = escapeStr(col);
                                const existing = conf.columns.find(c => c.src === col);
                                const isChecked = !!existing;

                                const colMaxRows = Math.max(1, (fileData.col_lengths && fileData.col_lengths[col]) || 0);
                                
                                let defaultCount = (existing && existing.count !== undefined) ? existing.count : colMaxRows;
                                let existingRow = existing ? existing.row : 1;
                                let existingLetter = existing ? existing.letter : 'A';
                                
                                let defaultRow = currentMode === 'global' ? parseInt(conf.globalStartRow || 1) : existingRow;
                                let endRow = defaultRow + defaultCount - 1;

                                return `
                                <div class="bg-slate-900 rounded-xl border ${isChecked ? 'border-indigo-500/30 bg-slate-900/90 shadow-sm' : 'border-slate-800/60 opacity-60'} transition-all flex flex-col overflow-hidden">
                                    
                                    <div class="flex items-center justify-between p-3 select-none bg-slate-900/60">
                                        <label class="flex items-center gap-2.5 cursor-pointer flex-grow min-w-0">
                                            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleCol(${confIdx}, '${safeColStr}', this.checked)" class="w-3.5 h-3.5 accent-indigo-500 rounded bg-slate-950 border-slate-700 shrink-0">
                                            <span class="text-xs font-semibold text-slate-200 truncate pr-2" title="${safeColStr}">${safeColStr}</span>
                                        </label>
                                    </div>

                                    <div class="${!isChecked ? 'hidden' : 'p-3 pt-0 border-t border-slate-800/40 flex flex-col gap-2.5 animate-fadeIn'}">
                                        <div class="grid grid-cols-2 gap-2 mt-2">
                                            <div class="flex flex-col gap-0.5">
                                                <span class="text-[9px] text-slate-500 uppercase">Ke Kolom</span>
                                                <select id="sel_let_${confIdx}_${colIdx}" onchange="updateColDetail(${confIdx}, '${safeColStr}', ${colIdx}, 'letter', this.value)" class="bg-slate-950 text-slate-300 text-xs border border-slate-800 rounded p-1 outline-none font-mono text-center appearance-none">
                                                    ${getColOptions(existingLetter)}
                                                </select>
                                            </div>

                                            <div class="flex flex-col gap-0.5">
                                                <span class="text-[9px] text-slate-500 uppercase text-center">Mulai Baris</span>
                                                <input type="number" id="inp_row_${confIdx}_${colIdx}" value="${defaultRow}" 
                                                    ${currentMode === 'global' ? 'disabled class="bg-slate-950/50 text-slate-500 text-xs border border-slate-800/60 rounded p-1 text-center font-mono hide-arrows"' : `oninput="updateColDetail(${confIdx}, '${safeColStr}', ${colIdx}, 'row', this.value)" class="bg-slate-950 text-slate-300 text-xs border border-slate-800 rounded p-1 text-center font-mono outline-none focus:border-slate-700 hide-arrows"`} min="1">
                                            </div>
                                        </div>

                                        <div class="flex flex-col gap-1.5 bg-slate-950 p-2 rounded border border-slate-800/60">
                                            <div class="flex items-center justify-between border border-slate-800 rounded bg-slate-900 overflow-hidden h-7">
                                                <button type="button" onclick="adjustCount(${confIdx}, '${safeColStr}', ${colIdx}, -1, ${colMaxRows})" class="w-7 h-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors text-xs">-</button>
                                                <input type="number" id="inp_count_${confIdx}_${colIdx}" value="${defaultCount}" oninput="validateInputCount(this, ${confIdx}, '${safeColStr}', ${colIdx}, ${colMaxRows})" class="w-full text-center text-xs font-mono font-semibold text-white bg-transparent outline-none border-none p-0 hide-arrows">
                                                <button type="button" onclick="adjustCount(${confIdx}, '${safeColStr}', ${colIdx}, 1, ${colMaxRows})" class="w-7 h-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors text-xs">+</button>
                                            </div>
                                            <div class="grid grid-cols-2 text-[9px] font-mono text-center gap-1.5">
                                                <div class="bg-slate-900 border border-slate-800/50 rounded py-0.5 text-slate-500">Awal: <span id="lbl_start_${confIdx}_${colIdx}" class="text-indigo-400 font-medium">${existingLetter}${defaultRow}</span></div>
                                                <div class="bg-slate-900 border border-slate-800/50 rounded py-0.5 text-slate-500">Akhir: <span id="lbl_end_${confIdx}_${colIdx}" class="text-emerald-400 font-medium">${existingLetter}${endRow}</span></div>
                                            </div>
                                        </div>
                                        ${fileData.col_types && fileData.col_types[col] === 'boolean' && existing ? renderConditionBlock(confIdx, colIdx, safeColStr, existing) : ''}
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                `);
                container.appendChild(div);
            } catch (e) {
                console.error("renderMappings error:", e);
                addLog("Terjadi kendala memuat tampilan. Cek console (F12) untuk detail.", "error");
            }
        });

        lucide.createIcons();

        requestAnimationFrame(() => {
            window.scrollTo(0, pageScrollY); 
            if (fileData && fileData.configs) {
                fileData.configs.forEach((_, idx) => {
                    const el = panggilElementDariID(`cols_container_${idx}`);
                    if (el && colScrolls[idx] !== undefined) {
                        el.scrollTop = colScrolls[idx];
                    }
                });
            }
        });
    }

    function getColOptions(selected) {
        let options = col_options;
        if(selected) options = options.replace(`value="${selected}"`, `value="${selected}" selected`);
        return options;
    }

    // =======================================================
    // KONDISI NILAI UNTUK KOLOM BERTIPE BOOLEAN (TRUE/FALSE)
    // Kolom apapun yang isinya cuma TRUE/FALSE (misal kolom status ya/tidak) otomatis
    // dianggap seperti dropdown: nilainya bisa diganti massal ke label lain,
    // atau diatur satu per satu per baris.
    // =======================================================
    const CONDITION_PRESETS = {
        raw:        { trueLabel: 'TRUE', falseLabel: 'FALSE', label: 'Apa Adanya (TRUE/FALSE)' },
        ada_tidak:  { trueLabel: 'Ada',  falseLabel: 'Tidak Ada', label: 'Ada / Tidak Ada' },
        ya_tidak:   { trueLabel: 'Ya',   falseLabel: 'Tidak', label: 'Ya / Tidak' },
        custom:     { label: 'Kustom...' }
    };

    function renderConditionBlock(confIdx, colIdx, safeColStr, existing) {
        if (!existing) return '';
        const cond = existing.condition || { preset: 'raw', trueLabel: 'TRUE', falseLabel: 'FALSE', mode: 'bulk', overrides: {}, dropdownStatus: 'idle', dropdownOptions: [] };
        const preset = cond.preset || 'raw';
        const isPerRow = cond.mode === 'per_row';
        const dStatus = cond.dropdownStatus || 'idle';
        const dOptions = cond.dropdownOptions || [];
        const hasRealDropdown = dStatus === 'found' && dOptions.length > 0;

        // Kontrol label TRUE/FALSE: kalau spreadsheet tujuan terbukti punya
        // dropdown asli, tampilkan sebagai <select> berisi pilihan ASLI dari
        // spreadsheet (bukan cuma tebakan). Kalau tidak ada, jatuh ke input
        // teks manual seperti sebelumnya.
        const labelControl = (labelKey, currentVal) => {
            if (hasRealDropdown) {
                return `<select onchange="updateConditionLabel(${confIdx}, '${safeColStr}', '${labelKey}', this.value)" class="bg-slate-900 border border-slate-800 text-[10px] rounded px-1.5 py-1 outline-none text-slate-200 w-full appearance-none">
                    ${dOptions.map(o => `<option value="${escapeStr(o)}" ${o === currentVal ? 'selected' : ''}>${escapeStr(o)}</option>`).join('')}
                </select>`;
            }
            return `<input type="text" value="${escapeStr(currentVal || '')}" placeholder="Label jika ${labelKey === 'trueLabel' ? 'TRUE' : 'FALSE'}" oninput="updateConditionLabel(${confIdx}, '${safeColStr}', '${labelKey}', this.value)" class="bg-slate-900 border border-slate-800 text-[10px] rounded px-1.5 py-1 outline-none text-slate-200">`;
        };

        let statusHTML = '';
        if (dStatus === 'checking') {
            statusHTML = `<span class="text-[9px] text-amber-400 flex items-center gap-1"><i data-lucide="loader" class="w-3 h-3 animate-spin"></i>Memeriksa dropdown di spreadsheet...</span>`;
        } else if (dStatus === 'found') {
            statusHTML = `<span class="text-[9px] text-emerald-400 flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i>Dropdown terdeteksi (${dOptions.length} pilihan) dari spreadsheet.</span>`;
        } else if (dStatus === 'error') {
            statusHTML = `<span class="text-[9px] text-rose-400">Gagal cek dropdown (API Key belum diisi/valid, atau spreadsheet belum publik), memakai label manual.</span>`;
        } else if (dStatus === 'none') {
            statusHTML = `<span class="text-[9px] text-slate-500">Kolom tujuan tidak punya dropdown, memakai label manual.</span>`;
        }

        let rowsHTML = '';
        if (isPerRow) {
            const rawVals = (state[activeFileName].raw_columns_matrix[existing.src] || []).slice(0, parseInt(existing.count) || 0);
            rowsHTML = `
                <div class="mt-2 max-h-[160px] overflow-y-auto custom-scroll flex flex-col gap-1 bg-slate-900 border border-slate-800 rounded p-1.5">
                    ${rawVals.map((raw, idx) => {
                        const rawLower = String(raw || '').trim().toLowerCase();
                        const defaultLabel = rawLower === 'true' ? (cond.trueLabel || 'TRUE') : (rawLower === 'false' ? (cond.falseLabel || 'FALSE') : raw);
                        const overrideVal = (cond.overrides && cond.overrides[idx] !== undefined) ? cond.overrides[idx] : '';
                        const overrideControl = hasRealDropdown
                            ? `<select onchange="updateConditionOverride(${confIdx}, '${safeColStr}', ${idx}, this.value)" class="flex-1 bg-slate-950 border border-slate-800 text-[10px] rounded px-1.5 py-0.5 outline-none text-slate-200 appearance-none">
                                  <option value="">(pakai label bulk: ${escapeStr(defaultLabel)})</option>
                                  ${dOptions.map(o => `<option value="${escapeStr(o)}" ${overrideVal === o ? 'selected' : ''}>${escapeStr(o)}</option>`).join('')}
                               </select>`
                            : `<input type="text" value="${escapeStr(overrideVal)}" placeholder="${escapeStr(defaultLabel)}" oninput="updateConditionOverride(${confIdx}, '${safeColStr}', ${idx}, this.value)" class="flex-1 bg-slate-950 border border-slate-800 text-[10px] rounded px-1.5 py-0.5 outline-none text-slate-200">`;
                        return `
                        <div class="flex items-center gap-1.5">
                            <span class="text-[9px] font-mono text-slate-500 w-6 shrink-0">#${idx + 1}</span>
                            <span class="text-[9px] font-mono text-slate-500 w-10 shrink-0 truncate" title="${escapeStr(raw)}">${escapeStr(String(raw))}</span>
                            ${overrideControl}
                        </div>`;
                    }).join('')}
                </div>
                <span class="text-[9px] text-slate-500">Kosongkan untuk memakai label bulk di atas.</span>
            `;
        }

        return `
        <div class="flex flex-col gap-1.5 bg-slate-950 p-2 rounded border border-slate-800/60 mt-1">
            <div class="flex items-center justify-between">
                <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Kondisi Nilai (TRUE / FALSE)</span>
                <button type="button" onclick="refreshColumnDropdown(${confIdx}, '${safeColStr}')" class="text-[9px] text-indigo-400 hover:text-indigo-300 underline shrink-0">Cek Dropdown</button>
            </div>
            ${statusHTML}
            ${!hasRealDropdown ? `
            <select onchange="updateConditionPreset(${confIdx}, '${safeColStr}', this.value)" class="bg-slate-900 text-slate-300 text-[11px] border border-slate-800 rounded p-1 outline-none appearance-none">
                ${Object.keys(CONDITION_PRESETS).map(k => `<option value="${k}" ${preset === k ? 'selected' : ''}>${CONDITION_PRESETS[k].label}</option>`).join('')}
            </select>` : ''}
            <div class="grid grid-cols-2 gap-2">
                ${labelControl('trueLabel', cond.trueLabel)}
                ${labelControl('falseLabel', cond.falseLabel)}
            </div>
            <button type="button" onclick="togglePerRowCondition(${confIdx}, '${safeColStr}')" class="text-[10px] text-indigo-400 hover:text-indigo-300 underline text-left">
                ${isPerRow ? 'Tutup pengaturan per baris' : 'Atur per baris (override manual)'}
            </button>
            ${rowsHTML}
        </div>`;
    }

    function updateConditionPreset(confIdx, colName, preset) {
        const col = state[activeFileName].configs[confIdx].columns.find(c => c.src === colName);
        if (!col) return;
        if (!col.condition) col.condition = { mode: 'bulk', overrides: {} };
        col.condition.preset = preset;
        if (preset !== 'custom') {
            col.condition.trueLabel = CONDITION_PRESETS[preset].trueLabel;
            col.condition.falseLabel = CONDITION_PRESETS[preset].falseLabel;
        }
        renderMappings();
        validate();
    }

    function updateConditionLabel(confIdx, colName, key, val) {
        const col = state[activeFileName].configs[confIdx].columns.find(c => c.src === colName);
        if (!col || !col.condition) return;
        // Update state saja tanpa renderMappings() supaya ngetik label kustom tetap lancar.
        col.condition[key] = val;
    }

    function togglePerRowCondition(confIdx, colName) {
        const col = state[activeFileName].configs[confIdx].columns.find(c => c.src === colName);
        if (!col) return;
        if (!col.condition) col.condition = { preset: 'raw', trueLabel: 'TRUE', falseLabel: 'FALSE', mode: 'bulk', overrides: {} };
        col.condition.mode = col.condition.mode === 'per_row' ? 'bulk' : 'per_row';
        renderMappings();
    }

    function updateConditionOverride(confIdx, colName, idx, val) {
        const col = state[activeFileName].configs[confIdx].columns.find(c => c.src === colName);
        if (!col || !col.condition) return;
        if (!col.condition.overrides) col.condition.overrides = {};
        // Update state saja tanpa renderMappings() supaya ngetik override per baris tetap lancar.
        if (val === '') { delete col.condition.overrides[idx]; }
        else { col.condition.overrides[idx] = val; }
    }

    function toggleCol(confIdx, colName, checked) {
        let conf = state[activeFileName].configs[confIdx];
        
        if(checked) {
            const usedLetters = conf.columns.map(c => c.letter);
            let assignedLetter = 'A';
            for(let l of ALL_LETTERS) {
                if(!usedLetters.includes(l)) { assignedLetter = l; break; }
            }
            const colMaxRows = Math.max(1, state[activeFileName].col_lengths[colName] || 0);
            const initRow = conf.rowMode === 'global' ? parseInt(conf.globalStartRow || 1) : 1;

            const newCol = {src: colName, letter: assignedLetter, row: initRow, count: colMaxRows};

            // Kolom yang isinya cuma TRUE/FALSE (misal kolom status ya/tidak) otomatis dapat
            // opsi kondisi nilai / dropdown.
            if (state[activeFileName].col_types && state[activeFileName].col_types[colName] === 'boolean') {
                newCol.condition = { preset: 'raw', trueLabel: 'TRUE', falseLabel: 'FALSE', mode: 'bulk', overrides: {}, dropdownStatus: 'idle', dropdownOptions: [] };
            }

            conf.columns.push(newCol);
        } else {
            conf.columns = conf.columns.filter(c => c.src !== colName);
        }
        renderMappings();
        validate();

        // Begitu kolom boolean dicentang, langsung cek apakah kolom tujuan di
        // spreadsheet punya dropdown asli supaya labelnya akurat.
        if (checked) {
            const addedCol = conf.columns.find(c => c.src === colName);
            if (addedCol && addedCol.condition) refreshColumnDropdown(confIdx, colName);
        }
    }

    function updateTargetUrl(idx, id) {
        const linkObj = globalLinks.find(l => l.id === id);
        state[activeFileName].configs[idx].targetId = id;
        state[activeFileName].configs[idx].sheetName = linkObj && linkObj.sheets.length > 0 ? linkObj.sheets[0] : '';
        renderMappings();
        validate();
        refreshAllDropdownsInConfig(idx);
    }

    function updateSheetName(idx, sheetName) {
        state[activeFileName].configs[idx].sheetName = sheetName;
        refreshAllDropdownsInConfig(idx);
    }

    function adjustCount(confIdx, colName, colIdx, delta, maxRows) {
        const inp = panggilElementDariID(`inp_count_${confIdx}_${colIdx}`);
        let current = parseInt(inp.value) || 1;
        let nextVal = current + delta;
        if(nextVal < 1) nextVal = 1;
        if(nextVal > maxRows) nextVal = maxRows;

        inp.value = nextVal;
        updateColDetail(confIdx, colName, colIdx, 'count', nextVal);
    }

    function validateInputCount(el, confIdx, colName, colIdx, maxRows) {
        let val = parseInt(el.value) || 1;
        if(val > maxRows) { val = maxRows; el.value = maxRows; }
        if(val < 1) { val = 1; el.value = 1; }
        updateColDetail(confIdx, colName, colIdx, 'count', val);
    }

    function updateColDetail(confIdx, colName, colIdx, key, val) {
        let col = state[activeFileName].configs[confIdx].columns.find(c => c.src === colName);
        if(col) {
            col[key] = val;
            try {
                const elLetter = panggilElementDariID(`sel_let_${confIdx}_${colIdx}`).value;
                const currentMode = state[activeFileName].configs[confIdx].rowMode || 'global';
                let elRow = currentMode === 'global' ? parseInt(state[activeFileName].configs[confIdx].globalStartRow || 1) : (parseInt(panggilElementDariID(`inp_row_${confIdx}_${colIdx}`).value) || 1);
                
                const currentCount = col.count || Math.max(1, state[activeFileName].col_lengths[colName] || 0);
                const endRowNumber = elRow + parseInt(currentCount) - 1;

                innerTextSamaDengan(panggilElementDariID(`lbl_start_${confIdx}_${colIdx}`), elLetter + elRow);
                innerTextSamaDengan(panggilElementDariID(`lbl_end_${confIdx}_${colIdx}`), elLetter + endRowNumber);
            } catch(e) {}
        }
        validate();

        // Huruf kolom tujuan berubah -> kolom fisik di spreadsheet berbeda,
        // jadi dropdown-nya perlu dicek ulang.
        if (key === 'letter' && col && col.condition) {
            refreshColumnDropdown(confIdx, colName);
        }
    }

    function validate() {
        const btn = panggilElementDariID('btn_submit');
        if (!btn) return;
        
        // Skip jika status global sedang menyatakan GS API bermasalah
        if (!isFirstLoad && gsApiLinks.length === 0) {
            return; 
        }

        let valid = false;
        Object.values(state).forEach(f => {
            if(f && f.configs) {
                f.configs.forEach(c => { if(c.targetId && c.columns.length > 0) valid = true; });
            }
        });

        btn.disabled = !valid;
        if(valid) {
            btn.removeAttribute('disabled');
            btn.className = "w-full bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold text-sm tracking-widest uppercase transition-all duration-200 active:scale-[0.98] border border-transparent shadow-xl shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2";
            innerHTMLSamaDengan(btn, '<i data-lucide="send" class="w-4 h-4"></i> <span>MASUKKAN KE SPREADSHEET</span>');
        } else {
            btn.setAttribute('disabled', 'true');
            btn.className = "w-full bg-slate-800 text-slate-500 px-8 py-4 rounded-xl font-bold text-sm tracking-widest uppercase transition-all duration-200 active:scale-[0.98] cursor-not-allowed border border-slate-700/50 shadow-lg flex items-center justify-center gap-2";
            innerHTMLSamaDengan(btn, '<i data-lucide="send" class="w-4 h-4"></i> <span>MASUKKAN KE SPREADSHEET</span>');
        }
        lucide.createIcons();
    }

    async function submitData() {
        const btn = panggilElementDariID('btn_submit');
        innerHTMLSamaDengan(btn, '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> <span>MEMPROSES DATA...</span>'); 
        lucide.createIcons();
        btn.disabled = true;

        try {
            await submitDataInner();
        } finally {
            // Selalu kembalikan tombol ke kondisi normal, baik sukses, gagal, maupun error,
            // supaya teks & ikon loading tidak berputar terus-menerus.
            validate();
            lucide.createIcons();
        }
    }

    async function submitDataInner() {
        addLog("Mengompilasi paket data massal...", "running");
        const bulkPackets = [];
        const seenConfigs = new Set();

        try {
            Object.keys(state).forEach(fName => {
                if (!state[fName] || !state[fName].configs) return;
                
                state[fName].configs.forEach(conf => {
                    if (!conf || !conf.targetId) return;
                    
                    const linkData = globalLinks.find(l => l.id === conf.targetId);
                    if(!linkData || !linkData.url) return;
                    
                    if (!conf.columns || !Array.isArray(conf.columns)) return;

                    conf.columns.forEach(c => {
                        if (!c || !c.src || !c.letter || !c.row) return;

                        const configKey = `${linkData.url}|${conf.sheetName || ''}|${c.letter}|${c.row}|${fName}|${c.src}`;

                        if(!seenConfigs.has(configKey)) {
                            seenConfigs.add(configKey);
                            
                            let fullColumnArray = (state[fName].raw_columns_matrix && state[fName].raw_columns_matrix[c.src]) ? state[fName].raw_columns_matrix[c.src] : [];
                            let slicedData = fullColumnArray.slice(0, parseInt(c.count || 0));

                            // Terapkan kondisi nilai TRUE/FALSE (dropdown) jika kolom ini dikonfigurasi.
                            if (c.condition) {
                                slicedData = slicedData.map((val, idx) => {
                                    const rawLower = String(val || '').trim().toLowerCase();
                                    if (rawLower !== 'true' && rawLower !== 'false') return val; // biarkan nilai non-boolean apa adanya
                                    if (c.condition.mode === 'per_row' && c.condition.overrides && c.condition.overrides[idx] !== undefined && c.condition.overrides[idx] !== '') {
                                        return c.condition.overrides[idx];
                                    }
                                    return rawLower === 'true' ? (c.condition.trueLabel || 'TRUE') : (c.condition.falseLabel || 'FALSE');
                                });
                            }

                            bulkPackets.push({
                                url: linkData.url,
                                sheetName: conf.sheetName || '',
                                colLetter: c.letter,
                                rowNumber: parseInt(c.row) || 1,
                                data: slicedData,
                                colName: c.src
                            });
                        }
                    });
                });
            });
        } catch (err) {
            addLog(`Gagal Kompilasi Data: ${err.message}`, "error");
            return;
        }

        if (bulkPackets.length === 0) {
            addLog("Eror :", "error");
            return;
        }

        addLog("Menambahkan Data...", "running");

        try {
            const token = atob("S3VuY2lSYWhhc2lhU2F0U2V0OTY=");
            const payload = { action: "update_bulk", packets: bulkPackets, token: token };
            
            const resData = await fetchGSWithFallback(payload);

            if(resData && resData.status === "success") {
                addLog("Data Berhasil Di tambahkan!", "done");
            } else {
                addLog(`Gagal Eksekusi Bulk: ${resData.message || 'Error Tidak Diketahui'}`, "error");
            }
        } catch (error) {
            addLog(`Kendala Eksternal: ${error.message || 'Koneksi terputus...'}`, "error");
        }
    }

    function addLog(msg, status) {
        const l = panggilElementDariID('logs');
        if (!l) return;
        innerHTMLSamaDengan(l, ""); 
        
        let icon = "info";
        let iconColor = "text-indigo-400";
        let bgIcon = "bg-indigo-500/10 border-indigo-500/20";
        let label = "INFO";
        let labelColor = "text-slate-500 border-slate-800";
        let textStyle = "text-slate-300";

        if (status === "running") {
            icon = "loader";
            iconColor = "text-amber-400 animate-spin";
            bgIcon = "bg-amber-500/10 border-amber-500/20";
            label = "RUNNING";
            labelColor = "text-amber-400 border-amber-500/20 bg-amber-500/5";
        } else if (status === "success" || status === "done") {
            icon = "check";
            iconColor = "text-emerald-400";
            bgIcon = "bg-emerald-500/10 border-emerald-500/20";
            label = status === "done" ? "FINISHED" : "SUCCESS";
            labelColor = "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
            textStyle = "text-slate-200 font-medium";
        } else if (status === "error") {
            icon = "alert-circle";
            iconColor = "text-rose-400";
            bgIcon = "bg-rose-500/10 border-rose-500/20";
            label = "FAILED";
            labelColor = "text-rose-400 border-rose-400/20 bg-rose-500/5";
            textStyle = "text-rose-300/90";
        }

        const taskItem = document.createElement('div');
        taskItem.className = "flex items-center justify-between bg-slate-950/40 border border-slate-800/60 rounded-lg p-2.5 px-3 animate-fadeIn shrink-0";
        innerHTMLSamaDengan(taskItem, `
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-5 h-5 rounded-full ${bgIcon} border flex items-center justify-center shrink-0">
                    <i data-lucide="${icon}" class="w-3 h-3 ${iconColor}"></i>
                </div>
                <span class="text-xs ${textStyle} truncate">${msg}</span>
            </div>
            <span class="text-[9px] font-mono font-bold border px-1.5 py-0.5 rounded ${labelColor} shrink-0 select-none tracking-wider">${label}</span>
        `);

        l.appendChild(taskItem);
        lucide.createIcons();
    }

    /* =======================================================
       INISIALISASI GABUNGAN
    ======================================================== */
    window.onload = () => {
        toggleDateUI();
        initApp();
        
        const startBtn = panggilElementDariID('btn-start-scrape');
        if (startBtn) {
            startBtn.disabled = true; 
        }

        // Tab "Download TikTok" aktif duluan & tidak butuh API Apify/Google Sheets
        // sama sekali (dia pakai API tikwm langsung). Cek status API (loadConfigLoop)
        // baru dijalankan saat tab "Laporan" pertama kali dibuka, lihat switchMainTab().
    };
