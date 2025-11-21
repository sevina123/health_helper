/**
 * Mendapatkan referensi koleksi Firestore (menggunakan path Private Data).
 */
function getCollectionRef(collectionName) {
    if (!db || !userId) return null;
    // Private data path: /artifacts/{appId}/users/{userId}/health_data/{collectionName}
    const path = `artifacts/${appId}/users/${userId}/health_data/${collectionName}`;
    return collection(db, path);
}

/**
 * Mengatur listener real-time untuk semua koleksi data.
 */
function startDataListeners() {
    if (!isAuthReady || !db || !userId) return;

    const handleSnapshot = (snapshot, key, notifId, labelKey, bgClass, textClass, title) => {
        dataStore[key] = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
        
        updateCharts();

        const notifEl = document.getElementById(notifId);
        const latestLog = dataStore[key][dataStore[key].length - 1];
        
        if (notifEl) {
            if (latestLog && latestLog.timestamp) {
                const time = latestLog.timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const value = latestLog[labelKey];
                notifEl.innerHTML = `Catatan ${title} terakhir: <strong>${value} ${labelKey === 'glasses' ? 'gelas' : 'menit'}</strong> pada ${time}.`;
                notifEl.className = `mt-4 p-3 ${bgClass} ${textClass} rounded-lg min-h-[50px] text-sm`;
            } else {
                notifEl.textContent = `Belum ada catatan ${title}.`;
                notifEl.className = `mt-4 p-3 ${bgClass} ${textClass} rounded-lg min-h-[50px] text-sm`;
            }
        }
    };

    // Listener BMI
    onSnapshot(getCollectionRef('bmi_history'), (snapshot) => {
        // BMI uses the same notification element as water for simplicity in the original code, we'll keep it here
        handleSnapshot(snapshot, 'bmi_history', 'airNotif', 'bmi_value', 'bg-emerald-100', 'text-emerald-800', 'BMI');
    }, (error) => { console.error("BMI Listener Error:", error); });

    }

/**
 * Mencatat data Air atau Olahraga ke Firestore.
 * @param {string} type - 'water' atau 'exercise'.
 */
export async function logData(type) {
    if (!isAuthReady || !db || !userId) {
        displayLog("Aplikasi sedang memuat atau fitur penyimpanan dinonaktifkan.", true);
        return;
    }

    let value;
    let collectionName;
    let logDetails = {};
    let inputEl;
    let notifEl;

    if (type === 'water') {
        inputEl = document.getElementById('airInput'); 
        notifEl = document.getElementById('airNotif');
        value = parseInt(inputEl.value);
        collectionName = 'water_logs';
        logDetails = { glasses: value };
        if (isNaN(value) || value <= 0) {
            notifEl.textContent = "Masukkan jumlah gelas air yang valid (> 0)!";
            notifEl.className = 'mt-4 p-3 bg-red-100 text-red-800 rounded-lg';
            return;
        }
        notifEl.innerText = `Mencatat ${value} gelas air...`;
    } else if (type === 'exercise') {
        inputEl = document.getElementById('olahragaInput'); 
        notifEl = document.getElementById('olahragaNotif');
        value = parseInt(inputEl.value);
        collectionName = 'exercise_logs';
        logDetails = { minutes: value };
        if (isNaN(value) || value <= 0) {
            notifEl.textContent = "Masukkan durasi olahraga yang valid (> 0)!";
            notifEl.className = 'mt-4 p-3 bg-red-100 text-red-800 rounded-lg';
            return;
        }
        notifEl.innerText = `Mencatat ${value} menit olahraga...`;
    } else {
        return;
    }
    
    try {
        await addDoc(getCollectionRef(collectionName), {
            ...logDetails,
            timestamp: serverTimestamp()
        });
        
        inputEl.value = ''; 
        displayLog(`Data ${type} berhasil disimpan.`);
    } catch (e) {
        console.error("Error adding document: ", e);
        notifEl.textContent = `Gagal menyimpan: ${e.message}`;
    }
}


// --- NAVIGATION ---
const sections = ['home', 'bmi', 'tips', 'gameTebak', 'about'];
const history = ['home'];

/**
 * Menampilkan section tertentu berdasarkan ID.
 * @param {string} id - ID dari section yang akan ditampilkan.
 */
export function show(id) {
    sections.forEach(secId => {
        const el = document.getElementById(secId);
        if (el) el.classList.add('hidden');
    });

    const nextEl = document.getElementById(id);
    if (nextEl) {
        nextEl.classList.remove('hidden');
        
        // Update history
        if (history[history.length - 1] !== id) {
            history.push(id);
        }
    }
    
    // Trigger specific actions when entering a section
    if (id === 'grafik') initializeCharts();
    else if (id === 'gameTebak') { 
        // Panggil Level Selection saat masuk ke gameTebak
        renderLevelSelection(); 
    }
    else if (id === 'tips') cariTips();
}

/**
 * Kembali ke halaman sebelumnya.
 */
export function back() {
    if (history.length > 1) {
        history.pop(); 
        const prevView = history[history.length - 1]; 
        // Hapus item teratas agar show tidak menambahkannya lagi
        history.pop();
        show(prevView);
    } else {
        show('home');
    }
}

// --- BMI CALCULATOR ---

export function hitungBMI() {
    const berat = parseFloat(document.getElementById('berat').value);
    const tinggiCm = parseFloat(document.getElementById('tinggi').value);
    const hasilEl = document.getElementById('hasilBMI');

    if (isNaN(berat) || isNaN(tinggiCm) || berat <= 0 || tinggiCm <= 0) {
        hasilEl.innerHTML = '<span class="text-red-600 font-semibold">❌ Mohon masukkan berat dan tinggi yang valid.</span>';
        return;
    }

    const tinggiM = tinggiCm / 100;
    const bmi = berat / (tinggiM * tinggiM);
    const roundedBmi = bmi.toFixed(2);
    let kategori = '';
    let warna = 'text-gray-700';
    let ikon = '❓';

    if (bmi < 18.5) {
        kategori = 'Kekurangan berat badan';
        warna = 'text-blue-600';
        ikon = '📉';
    } else if (bmi >= 18.5 && bmi < 24.9) {
        kategori = 'Berat badan normal';
        warna = 'text-green-600';
        ikon = '✅';
    } else if (bmi >= 25 && bmi < 29.9) {
        kategori = 'Kelebihan berat badan';
        warna = 'text-orange-600';
        ikon = '⚠️';
    } else {
        kategori = 'Obesitas';
        warna = 'text-red-600';
        ikon = '🚨';
    }

    hasilEl.innerHTML = `
        <p class="font-bold text-xl">${ikon} BMI Anda: ${roundedBmi}</p>
        <p class="${warna} font-semibold">Kategori: ${kategori}</p>
    `;

    if (isAuthReady && db && userId) {
        logBMIResult(roundedBmi, berat, tinggiCm, kategori);
    }
}

async function logBMIResult(bmiValue, weight, height, category) {
    try {
        await addDoc(getCollectionRef('bmi_history'), {
            bmi_value: parseFloat(bmiValue),
            weight: weight,
            height: height,
            category: category,
            timestamp: serverTimestamp()
        });
        displayLog("Hasil BMI berhasil disimpan ke riwayat.");
    } catch (e) {
        console.error("Error saving BMI: ", e);
        displayLog("Gagal menyimpan BMI ke riwayat.", true);
    }
}

// --- TIPS KESEHATAN ---
const allTips = [
    { text: "Minum minimal 8 gelas air per hari untuk hidrasi optimal.", tags: ["air", "hidrasi", "umum"] },
    { text: "Lakukan peregangan ringan setiap 30 menit saat bekerja di depan komputer.", tags: ["olahraga", "duduk", "stres", "ergonomi"] },
    { text: "Tidur 7-9 jam setiap malam untuk pemulihan mental dan fisik.", tags: ["tidur", "stres", "umum"] },
    { text: "Konsumsi buah dan sayur berwarna-warni setiap hari, terutama yang kaya antioksidan.", tags: ["makanan", "diet", "nutrisi"] },
    { text: "Jalan kaki 30 menit per hari dapat meningkatkan kesehatan jantung dan mood.", tags: ["olahraga", "jantung", "mood"] },
    { text: "Ganti minuman manis dengan air putih atau teh herbal tanpa gula.", tags: ["diet", "air", "minuman"] },
    { text: "Praktekkan teknik pernapasan dalam saat merasa stres untuk menenangkan sistem saraf.", tags: ["stres", "mental", "relaksasi"] },
    { text: "Gunakan tabir surya setiap hari, bahkan saat cuaca mendung.", tags: ["kulit", "kecantikan"] },
];

export function cariTips() {
    const searchText = document.getElementById('searchTips').value.toLowerCase().trim();
    const listEl = document.getElementById('tipsList');
    listEl.innerHTML = '';

    const filteredTips = allTips.filter(tip => 
        tip.text.toLowerCase().includes(searchText) || tip.tags.some(tag => tag.includes(searchText))
    );

    if (filteredTips.length === 0) {
        listEl.innerHTML = `<li class="list-item p-3 text-center text-gray-500 bg-white">Tidak ada tips yang cocok dengan kata kunci Anda.</li>`;
        return;
    }

    filteredTips.forEach(tip => {
        const li = document.createElement('li');
        li.className = 'p-3 text-sky-800 bg-white border-b border-gray-100 last:border-b-0 hover:bg-sky-50 transition duration-100';
        li.innerHTML = `
            <p class="font-medium">${tip.text}</p>
            <span class="text-xs text-gray-400 mt-1 block">Tag: ${tip.tags.map(t => `#${t}`).join(' ')}</span>
        `;
        listEl.appendChild(li);
    });
}


// --- GAME TEBAK MAKANAN (SISTEM LEVEL BARU) ---

// VARIABEL BARU UNTUK LEVEL
let currentQuestionIndex = 0;
let score = 0;
window.currentQuestion = null; 

let currentLevel = 1;
let maxUnlockedLevel = 1; // Level tertinggi yang sudah dibuka, mulai dari Level 1
const totalLevels = 10;
const questionsPerLevel = 5; // Tetapkan 5 soal per level

// BANK SOAL LENGKAP HINGGA LEVEL 10
const levelQuizzes = [
    // Level 1: MUDAH (DASAR NUTRISI)
    { 
        level: 1, 
        questions: [
            { question: "Buah yang kaya Potasium (untuk tekanan darah) dan sering dimakan atlet?", options: ["Apel", "Pisang", "Alpukat"], answer: "Pisang" },
            { question: "Mineral yang paling banyak ditemukan dalam susu dan produk olahan susu, penting untuk tulang?", options: ["Zat Besi", "Kalsium", "Sodium"], answer: "Kalsium" },
            { question: "Vitamin yang paling banyak didapat dari sinar matahari pagi?", options: ["Vitamin C", "Vitamin D", "Vitamin B12"], answer: "Vitamin D" },
            { question: "Sumber karbohidrat kompleks yang baik, sering menjadi pengganti nasi bagi yang sedang diet?", options: ["Nasi Putih", "Ubi Jalar", "Gula Pasir"], answer: "Ubi Jalar" },
            { question: "Zat yang berfungsi utama membangun dan memperbaiki jaringan tubuh?", options: ["Karbohidrat", "Protein", "Lemak"], answer: "Protein" },
        ]
    },
    // Level 2: DASAR (MEMBEDAKAN JENIS MAKANAN)
    { 
        level: 2, 
        questions: [
            { question: "Lemak yang harus dihindari karena dapat meningkatkan risiko penyakit jantung?", options: ["Lemak Jenuh", "Lemak Tak Jenuh Tunggal", "Omega-3"], answer: "Lemak Jenuh" },
            { question: "Manakah yang merupakan biji-bijian utuh (whole grain)?", options: ["Roti Tawar Putih", "Oatmeal", "Kerupuk"], answer: "Oatmeal" },
            { question: "Sayuran hijau yang mengandung antioksidan kuat Lutein dan Zeaxanthin (baik untuk mata)?", options: ["Wortel", "Bayam", "Sawi"], answer: "Bayam" },
            { question: "Contoh makanan yang memiliki Indeks Glikemik (IG) rendah?", options: ["Nasi Putih", "Roti Gandum Utuh", "Kentang Goreng"], answer: "Roti Gandum Utuh" },
            { question: "Buah yang dikenal sebagai sumber Vitamin C dan antioksidan untuk meningkatkan daya tahan tubuh?", options: ["Alpukat", "Mangga", "Jeruk"], answer: "Jeruk" },
        ]
    },
    // Level 3: SEDANG (DETAIL NUTRISI & KESEHATAN)
    { 
        level: 3, 
        questions: [
            { question: "Apa nama asam lemak esensial yang terkandung dalam ikan salmon, biji-bijian, dan alpukat?", options: ["Asam Laktat", "Omega-3", "Kolesterol"], answer: "Omega-3" },
            { question: "Kekurangan vitamin B12 dapat menyebabkan anemia jenis apa?", options: ["Anemia Defisiensi Besi", "Anemia Aplastik", "Anemia Megaloblastik"], answer: "Anemia Megaloblastik" },
            { question: "Manakah yang bukan merupakan makronutrien?", options: ["Protein", "Vitamin", "Karbohidrat"], answer: "Vitamin" },
            { question: "Apa peran utama Serat (Fiber) dalam diet?", options: ["Menambah energi cepat", "Melancarkan pencernaan", "Membangun otot"], answer: "Melancarkan pencernaan" },
            { question: "Berapa persentase kira-kira tubuh manusia terdiri dari air?", options: ["20-30%", "60-70%", "85-95%"], answer: "60-70%" },
        ]
    },
    // Level 4: LANJUT (MITOS VS FAKTA)
    { 
        level: 4, 
        questions: [
            { question: "Benarkah makan malam setelah jam 8 malam pasti menyebabkan kenaikan berat badan?", options: ["Ya", "Tidak", "Tergantung jenis makanan"], answer: "Tergantung jenis makanan" },
            { question: "Apa yang dimaksud dengan kalori defisit?", options: ["Jumlah kalori yang masuk lebih banyak dari yang dibakar", "Jumlah kalori yang dibakar lebih banyak dari yang masuk", "Jumlah kalori masuk dan dibakar seimbang"], answer: "Jumlah kalori yang dibakar lebih banyak dari yang masuk" },
            { question: "Berapa asupan gula harian maksimum yang direkomendasikan WHO untuk orang dewasa (dalam sendok teh)?", options: ["3 sdt", "6 sdt", "10 sdt"], answer: "6 sdt" },
            { question: "Pemanis alami manakah yang memiliki Indeks Glikemik lebih tinggi dari gula pasir (sukrosa)?", options: ["Madu", "Sirup Maple", "Stevia"], answer: "Madu" },
            { question: "Manakah sumber protein nabati yang dianggap 'protein lengkap' (mengandung semua asam amino esensial)?", options: ["Kacang Tanah", "Tahu (Kedelai)", "Lentil"], answer: "Tahu (Kedelai)" },
        ]
    },
    // Level 5: KHUSUS VITAMIN & MINERAL
    { 
        level: 5, 
        questions: [
            { question: "Vitamin yang larut dalam lemak dan penting untuk pembekuan darah?", options: ["Vitamin C", "Vitamin K", "Vitamin B6"], answer: "Vitamin K" },
            { question: "Kekurangan mineral apa yang menyebabkan Gondok (pembengkakan kelenjar tiroid)?", options: ["Zink", "Iodium", "Selenium"], answer: "Iodium" },
            { question: "Apa peran utama Vitamin A?", options: ["Kesehatan tulang", "Kesehatan mata dan penglihatan", "Produksi energi"], answer: "Kesehatan mata dan penglihatan" },
            { question: "Mineral utama yang hilang melalui keringat saat olahraga intens?", options: ["Fosfor", "Kalsium", "Sodium (Garam)"], answer: "Sodium (Garam)" },
            { question: "Manakah yang merupakan nama kolektif untuk Vitamin B kompleks?", options: ["Tokoferol", "Asam Folat", "Tiamin"], answer: "Asam Folat" },
        ]
    },
    // Level 6: GAYA HIDUP SEHAT
    { 
        level: 6, 
        questions: [
            { question: "Berapa rata-rata waktu tidur yang ideal untuk orang dewasa per malam?", options: ["5-6 jam", "7-9 jam", "9-10 jam"], answer: "7-9 jam" },
            { question: "Apa manfaat utama dari latihan kekuatan (resistance training) selain membangun otot?", options: ["Meningkatkan fleksibilitas", "Meningkatkan kepadatan tulang", "Mengurangi kebutuhan tidur"], answer: "Meningkatkan kepadatan tulang" },
            { question: "Waktu terbaik untuk menimbang berat badan agar hasilnya paling akurat?", options: ["Setelah makan siang", "Di malam hari sebelum tidur", "Pagi hari setelah buang air"], answer: "Pagi hari setelah buang air" },
            { question: "Apa hormon yang dilepaskan saat Anda merasa stres kronis dan dapat menyebabkan penumpukan lemak perut?", options: ["Insulin", "Kortisol", "Serotonin"], answer: "Kortisol" },
            { question: "Apa yang dimaksud dengan 'mindful eating'?", options: ["Makan sangat cepat", "Makan sambil menonton TV", "Makan dengan penuh kesadaran dan perlahan"], answer: "Makan dengan penuh kesadaran dan perlahan" },
        ]
    },
    // Level 7: PENGELOLAAN BERAT BADAN
    { 
        level: 7, 
        questions: [
            { question: "Komponen utama dari Total Pengeluaran Energi Harian (TDEE) yang menghitung energi untuk fungsi dasar tubuh saat istirahat?", options: ["TEF", "NEAT", "BMR"], answer: "BMR" },
            { question: "Apa peran protein dalam menjaga berat badan yang sehat?", options: ["Membuat kenyang lebih cepat dan lama", "Menyediakan kalori kosong", "Langsung membakar lemak"], answer: "Membuat kenyang lebih cepat dan lama" },
            { question: "Kondisi di mana tubuh menggunakan lemak sebagai sumber energi utama (bukan glukosa) karena kekurangan karbohidrat?", options: ["Glukoneogenesis", "Katabolisme", "Ketosis"], answer: "Ketosis" },
            { question: "Lemak perut jenis apa yang paling berbahaya karena mengelilingi organ vital?", options: ["Lemak Subkutan", "Lemak Visceral", "Lemak Cokelat"], answer: "Lemak Visceral" },
            { question: "Penurunan berat badan yang sehat dan berkelanjutan per minggu yang direkomendasikan?", options: ["0.25 - 0.5 kg", "1 - 2 kg", "2.5 - 3 kg"], answer: "0.25 - 0.5 kg" },
        ]
    },
    // Level 8: MAKANAN FUNGSIONAL & SUPERFOODS
    { 
        level: 8, 
        questions: [
            { question: "Apa zat dalam teh hijau yang dikenal sebagai antioksidan kuat dan dapat meningkatkan metabolisme?", options: ["Kasein", "EGCG", "Bromelain"], answer: "EGCG" },
            { question: "Probiotik paling sering ditemukan dalam makanan yang melalui proses apa?", options: ["Pengeringan", "Fermentasi", "Pasteurisasi"], answer: "Fermentasi" },
            { question: "Nutrisi yang ditemukan dalam tomat (memberi warna merah) yang dikaitkan dengan penurunan risiko kanker?", options: ["Kurkumin", "Lutein", "Likopen"], answer: "Likopen" },
            { question: "Manakah yang merupakan sumber prebiotik yang memberi makan bakteri baik di usus?", options: ["Yogurt", "Bawang Putih", "Daging Sapi"], answer: "Bawang Putih" },
            { question: "Selain Vitamin C, nutrisi apa yang membuat buah berry (seperti blueberry) dikategorikan sebagai superfood?", options: ["Antosianin", "Kreatin", "Klorofil"], answer: "Antosianin" },
        ]
    },
    // Level 9: KESEHATAN KHUSUS
    { 
        level: 9, 
        questions: [
            { question: "Penyakit yang disebabkan oleh autoimun, di mana penderitanya tidak dapat mencerna gluten?", options: ["Alergi Gandum", "Penyakit Celiac", "Intoleransi Laktosa"], answer: "Penyakit Celiac" },
            { question: "Apa nama zat yang terkandung dalam garam dapur yang harus dibatasi untuk mencegah hipertensi?", options: ["Kalium", "Natrium", "Magnesium"], answer: "Natrium" },
            { question: "Jenis karbohidrat yang seharusnya dihindari penderita diabetes karena memicu lonjakan gula darah sangat cepat?", options: ["Karbohidrat Kompleks", "Karbohidrat Sederhana", "Serat"], answer: "Karbohidrat Sederhana" },
            { question: "Apa yang merupakan 'silent killer' karena gejalanya sering tidak disadari hingga tahap parah, dan terkait erat dengan diet?", options: ["Flu", "Kanker", "Hipertensi"], answer: "Hipertensi" },
            { question: "Manakah yang merupakan lemak tak jenuh ganda (polyunsaturated fat)?", options: ["Minyak Kelapa", "Minyak Zaitun", "Minyak Bunga Matahari"], answer: "Minyak Bunga Matahari" },
        ]
    },
    // Level 10: SANGAT SULIT (APLIKASI ILMU GIZI)
    { 
        level: 10, 
        questions: [
            { question: "Pada tingkat sel, apa yang terjadi pada protein (misal: telur) ketika Anda memasaknya?", options: ["Terhidrolisis", "Terrehidrasi", "Terdenturasi"], answer: "Terdenturasi" },
            { question: "Proses biologis di mana tubuh membuat glukosa dari sumber non-karbohidrat (misalnya protein/lemak)?", options: ["Glikolisis", "Glukoneogenesis", "Glukogenesis"], answer: "Glukoneogenesis" },
            { question: "Manakah yang merupakan koenzim yang berasal dari vitamin B2 dan berperan penting dalam siklus energi tubuh?", options: ["NADH", "FADH2", "ATP"], answer: "FADH2" },
            { question: "Senyawa apa yang berfungsi sebagai pembawa oksigen utama dalam darah dan sangat bergantung pada zat besi?", options: ["Albumin", "Hemoglobin", "Kolagen"], answer: "Hemoglobin" },
            { question: "Apa yang dimaksud dengan 'Asam Amino Esensial'?", options: ["Asam amino yang hanya dibutuhkan anak-anak", "Asam amino yang diproduksi sendiri oleh tubuh", "Asam amino yang harus diperoleh dari makanan"], answer: "Asam amino yang harus diperoleh dari makanan" },
        ]
    }
];

// --- FUNGSI UTAMA (Diperbarui untuk menggunakan levelQuizzes) ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Menampilkan tampilan kuis (pertanyaan & opsi).
 */
function showQuizContent() {
    const questionEl = document.getElementById('question');
    const optionsEl = document.getElementById('options');
    const resultGameEl = document.getElementById('resultGame');
    
    // Kembalikan tata letak opsi ke grid 3 kolom dan teks awal
    optionsEl.className = 'grid grid-cols-1 md:grid-cols-3 gap-3'; 
    questionEl.textContent = '';
    resultGameEl.textContent = 'Pilih salah satu jawaban di bawah ini.';
    resultGameEl.className = 'mt-6 p-3 bg-gray-100 rounded-lg min-h-[50px] text-gray-700';
}

/**
 * Merender tombol Level Selection (terkunci/terbuka).
 */
export function renderLevelSelection() {
    const questionEl = document.getElementById('question');
    const optionsEl = document.getElementById('options');
    const resultGameEl = document.getElementById('resultGame');
    
    // Persiapan tampilan Level Selection
    questionEl.textContent = "Pilih Level Kuis Makanan Sehat";
    resultGameEl.innerHTML = `Anda telah membuka Level **${maxUnlockedLevel}** dari **${totalLevels}** total Level. Selesaikan minimal 4/5 soal untuk membuka Level berikutnya!`;
    resultGameEl.className = 'p-3 bg-indigo-100 text-indigo-800 rounded-lg font-medium';
    
    // Gunakan container opsi untuk tombol Level Selection
    optionsEl.innerHTML = '';
    optionsEl.className = 'grid grid-cols-5 gap-4'; // Tata letak 5 kolom untuk tombol level

    for (let i = 1; i <= totalLevels; i++) {
        const button = document.createElement('button');
        button.textContent = `Level ${i}`;
        
        const isUnlocked = i <= maxUnlockedLevel;
        
        if (isUnlocked) {
            button.className = 'bg-green-500 text-white p-3 rounded-lg font-bold hover:bg-green-600 transition duration-150';
            button.onclick = () => startLevel(i);
        } else {
            button.className = 'bg-gray-300 text-gray-600 p-3 rounded-lg font-bold cursor-not-allowed';
            button.disabled = true;
            button.textContent += ' 🔒';
        }
        optionsEl.appendChild(button);
    }
}


/**
 * Memulai level kuis tertentu.
 * @param {number} levelNumber - Level yang akan dimainkan.
 */
export function startLevel(levelNumber) {
    currentLevel = levelNumber;
    currentQuestionIndex = 0;
    score = 0;

    // --- PERUBAHAN UTAMA: MENGAMBIL SOAL DARI ARRAY levelQuizzes ---
    const levelData = levelQuizzes.find(q => q.level === currentLevel);
    
    if (!levelData) {
        alert(`Data untuk Level ${currentLevel} belum tersedia!`);
        renderLevelSelection(); 
        return;
    }

    // Acak urutan soal HANYA untuk level saat ini
    shuffleArray(levelData.questions);
    
    showQuizContent(); 
    loadQuestion();
}


function loadQuestion() {
    const questionEl = document.getElementById('question');
    const optionsEl = document.getElementById('options');
    const resultGameEl = document.getElementById('resultGame');
    
    optionsEl.innerHTML = '';
    resultGameEl.className = 'p-3 bg-gray-100 rounded-lg min-h-[50px] text-gray-700';

    // Target harus benar 80% (yaitu 4 dari 5)
    const targetScore = Math.floor(questionsPerLevel * 0.8);

    // --- LOGIKA LEVEL SELESAI / NAIK LEVEL ---
    if (currentQuestionIndex >= questionsPerLevel) {

        if (score >= targetScore) {
            questionEl.innerHTML = `🌟 **LEVEL ${currentLevel} SELESAI!** Skor Akhir: ${score}/${questionsPerLevel}.`;
            
            // Buka level berikutnya
            if (currentLevel < totalLevels && currentLevel === maxUnlockedLevel) {
                maxUnlockedLevel++; 
                resultGameEl.innerHTML = `SELAMAT! Level **${maxUnlockedLevel}** telah dibuka!`;
                resultGameEl.className = 'p-3 bg-yellow-400 text-yellow-900 rounded-lg font-bold';
            } else if (currentLevel === totalLevels) {
                resultGameEl.innerHTML = `HEBAT! Anda telah menyelesaikan **SEMUA ${totalLevels} Level!**`;
                resultGameEl.className = 'p-3 bg-green-500 text-white rounded-lg font-bold';
            } else {
                 resultGameEl.innerHTML = `Level ${currentLevel} selesai. Anda sudah pernah menyelesaikan level ini sebelumnya.`;
            }
            
            // Kembali ke layar seleksi level setelah jeda
            optionsEl.innerHTML = ''; 
            setTimeout(() => {
                show('gameTebak'); // Kembali ke seleksi level
            }, 3000); 

            return; 
            
        } else {
            // GAGAL LEVEL
            questionEl.innerHTML = `😭 **GAGAL!** Level ${currentLevel} belum selesai. Skor: ${score}/${questionsPerLevel}.`;
            resultGameEl.innerHTML = `Anda harus mendapatkan minimal **${targetScore}** jawaban benar. Coba ulangi Level ${currentLevel}.`;
            resultGameEl.className = 'p-3 bg-red-400 text-white rounded-lg font-bold';
            
            // Kembali ke layar seleksi level setelah jeda
            optionsEl.innerHTML = ''; 
            setTimeout(() => {
                show('gameTebak'); // Kembali ke seleksi level
            }, 3000); 

            return;
        }
    }
    // --- AKHIR LOGIKA LEVEL SELESAI ---

    // Dapatkan data kuis untuk level saat ini
    const levelData = levelQuizzes.find(q => q.level === currentLevel);
    
    // Ambil pertanyaan dari set soal level ini
    // Pastikan levelData ada sebelum mencoba mengakses questions
    if (!levelData || !levelData.questions[currentQuestionIndex]) {
        return; 
    }
    
    window.currentQuestion = levelData.questions[currentQuestionIndex];
    
    // Tampilkan informasi Level dan Soal saat ini
    questionEl.innerHTML = `Level ${currentLevel} | Soal ${currentQuestionIndex + 1}/${questionsPerLevel}: ${window.currentQuestion.question}`;
    
    // Acak opsi sebelum ditampilkan
    const shuffledOptions = [...window.currentQuestion.options];
    shuffleArray(shuffledOptions);

    shuffledOptions.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.className = 'bg-yellow-100 text-yellow-800 p-3 rounded-lg font-semibold hover:bg-yellow-600 hover:text-white transition duration-150';
        button.onclick = () => checkAnswer(option);
        optionsEl.appendChild(button);
    });
}

export function checkAnswer(selectedOption) {
    const resultGameEl = document.getElementById('resultGame');
    const optionsEl = document.getElementById('options');

    // Nonaktifkan tombol setelah menjawab
    Array.from(optionsEl.children).forEach(btn => btn.disabled = true);
    
    if (selectedOption === window.currentQuestion.answer) {
        score++;
        resultGameEl.innerHTML = `✅ **BENAR!** Skor Level ${currentLevel}: ${score}`;
        resultGameEl.className = 'p-3 bg-green-100 text-green-800 rounded-lg min-h-[50px] font-bold';
    } else {
        resultGameEl.innerHTML = `❌ **SALAH!** Jawaban yang benar adalah: **${window.currentQuestion.answer}**. Skor Level ${currentLevel}: ${score}`;
        resultGameEl.className = 'p-3 bg-red-100 text-red-800 rounded-lg min-h-[50px] font-bold';
    }

    currentQuestionIndex++;
    
    // Tunggu sejenak sebelum memuat pertanyaan berikutnya
    setTimeout(loadQuestion, 1500); 
}

// Tambahkan ekspor renderLevelSelection agar bisa dipanggil dari show('gameTebak')
window.renderLevelSelection = renderLevelSelection; 
window.startLevel = startLevel; 
window.checkAnswer = checkAnswer;

// --- Eksport fungsi ke global window agar dapat dipanggil dari `onclick` di HTML ---
// Mengganti `startGame` dengan `startLevel`
window.show = show;
window.back = back;
window.hitungBMI = hitungBMI;
window.cariTips = cariTips;
window.startLevel = startLevel; // Fungsi baru untuk memulai level
window.checkAnswer = checkAnswer; 

// Inisialisasi Firebase saat halaman dimuat
initializeFirebase();