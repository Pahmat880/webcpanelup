// src/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- KONFIGURASI PENTING UNTUK CLIENT-SIDE (tidak sensitif) ---
    // WEBSITE_ACCESS_KEY masih di frontend untuk validasi awal jika diperlukan.
    // Tetapi validasi utamanya sebaiknya juga dilakukan di serverless function.
    const WEBSITE_ACCESS_KEY = import.meta.env.VITE_WEBSITE_ACCESS_KEY;

    // Flags untuk mengaktifkan/menonaktifkan opsi panel di UI (tidak sensitif)
    const IS_PUBLIC_PANEL_ENABLED = import.meta.env.VITE_IS_PUBLIC_PANEL_ENABLED === 'true';
    const IS_PRIVATE_PANEL_ENABLED = import.meta.env.VITE_IS_PRIVATE_PANEL_ENABLED === 'true';

    // URL ke Serverless Function Anda di Vercel (ini adalah path relatif)
    // Vercel otomatis akan me-route '/api/create-panel' ke file 'api/create-panel.js'
    const YOUR_VERCEL_API_ENDPOINT = '/api/create-panel';
    
    // Harga dan Spec Paket (tidak sensitif, bisa tetap di frontend)
    const PACKAGES = {
        "1gb": { ram: 1024, disk: 1024, cpu: 100, name: "1 GB" },
        "2gb": { ram: 2048, disk: 2048, cpu: 100, name: "2 GB" },
        "3gb": { ram: 3072, disk: 3072, cpu: 100, name: "3 GB" },
        "4gb": { ram: 4096, disk: 4096, cpu: 100, name: "4 GB" },
        "5gb": { ram: 5120, disk: 5120, cpu: 100, name: "5 GB" },
        "6gb": { ram: 6144, disk: 6144, cpu: 100, name: "6 GB" },
        "7gb": { ram: 7168, disk: 7168, cpu: 100, name: "7 GB" },
        "8gb": { ram: 8192, disk: 8192, cpu: 150, name: "8 GB" },
        "9gb": { ram: 9216, disk: 9216, cpu: 150, name: "9 GB" },
        "10gb": { ram: 10240, disk: 10240, cpu: 200, name: "10 GB" },
        "unlimited": { ram: 0, disk: 0, cpu: 0, name: "Unlimited" }
    };
    // --- AKHIR KONFIGURASI CLIENT-SIDE ---


    const createPanelForm = document.getElementById('createPanelForm');
    const createButton = document.getElementById('createButton');
    const responseMessageDiv = document.getElementById('responseMessage');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const toastContainer = document.getElementById('toast-notification-container');
    const panelTypeSelect = document.getElementById('panelType');

    // --- Fungsi Utility (Tidak ada perubahan) ---
    function showMainMessage(type, messageHTML) {
        responseMessageDiv.className = type; 
        responseMessageDiv.innerHTML = messageHTML;
        responseMessageDiv.style.opacity = 0; 
        responseMessageDiv.style.transform = 'translateY(20px)'; 
        void responseMessageDiv.offsetWidth; 
        responseMessageDiv.style.opacity = 1; 
        responseMessageDiv.style.transform = 'translateY(0)'; 
    }

    function showToast(type, message, duration = 3000) {
        const toast = document.createElement('div');
        toast.classList.add('toast-notification', type); 

        let icon = '';
        if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
        else if (type === 'error') icon = '<i class="fas fa-times-circle"></i>';
        else if (type === 'info') icon = '<i class="fas fa-info-circle"></i>';

        toast.innerHTML = `
            <span class="icon">${icon}</span>
            <span class="message">${message}</span>
            <button class="close-btn">&times;</button>
        `;

        toast.querySelector('.close-btn').addEventListener('click', () => {
            toast.remove();
        });

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.5s ease-in forwards';
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, duration);
    }

    function populatePanelTypeDropdown() {
        panelTypeSelect.innerHTML = '<option value="" disabled selected>Pilih Tipe Panel</option>';

        let optionsAdded = 0;
        if (IS_PUBLIC_PANEL_ENABLED) {
            const publicOption = document.createElement('option');
            publicOption.value = 'public';
            publicOption.textContent = 'Public Panel';
            panelTypeSelect.appendChild(publicOption);
            optionsAdded++;
        }

        if (IS_PRIVATE_PANEL_ENABLED) {
            const privateOption = document.createElement('option');
            privateOption.value = 'private';
            privateOption.textContent = 'Private Panel';
            panelTypeSelect.appendChild(privateOption);
            optionsAdded++;
        }

        if (optionsAdded === 0) {
            const noOption = document.createElement('option');
            noOption.value = '';
            noOption.textContent = 'Tidak ada panel tersedia';
            noOption.disabled = true;
            panelTypeSelect.appendChild(noOption);
            panelTypeSelect.disabled = true;
        } else if (optionsAdded === 1) {
            panelTypeSelect.selectedIndex = 1;
        }
    }
    // --- End Fungsi Utility ---

    populatePanelTypeDropdown();

    createPanelForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        createButton.textContent = 'Creating Panel'; 
        createButton.disabled = true;
        loadingSpinner.style.display = 'flex'; 
        responseMessageDiv.innerHTML = ''; 
        responseMessageDiv.className = ''; 

        const accessKey = document.getElementById('accessKey').value;
        const selectedPanelType = panelTypeSelect.value;
        const username = document.getElementById('username').value;
        const hostingPackage = document.getElementById('hostingPackage').value;

        // --- Validasi Access Key (di frontend) ---
        // Jika validasi ini lolos, permintaan akan diteruskan ke serverless function.
        // Anda BISA memindahkan validasi accessKey ini sepenuhnya ke serverless function
        // jika tidak ingin accessKey terlihat di frontend sama sekali.
        if (accessKey !== WEBSITE_ACCESS_KEY) {
            showToast('error', 'Access Key Salah!');
            createButton.textContent = 'Create Panel';
            createButton.disabled = false;
            loadingSpinner.style.display = 'none';
            return;
        }
        // --- Akhir Validasi Access Key ---

        // --- Validasi Input lainnya (tetap di frontend untuk user experience yang cepat) ---
        if (!selectedPanelType) {
            showToast('error', 'Silakan pilih tipe panel (Public/Private)!');
            createButton.textContent = 'Create Panel';
            createButton.disabled = false;
            loadingSpinner.style.display = 'none';
            return;
        }

        if (!username || !hostingPackage) {
            showToast('error', 'Username dan Paket Hosting harus diisi!');
            createButton.textContent = 'Create Panel';
            createButton.disabled = false;
            loadingSpinner.style.display = 'none';
            return;
        }

        const usernameInput = document.getElementById('username');
        if (!usernameInput.checkValidity()) {
            showToast('error', `Username tidak valid: ${usernameInput.title}`);
            createButton.textContent = 'Create Panel';
            createButton.disabled = false;
            loadingSpinner.style.display = 'none';
            return;
        }

        const selectedPackage = PACKAGES[hostingPackage];
        if (!selectedPackage) {
            showToast('error', 'Pilih paket hosting yang valid.');
            createButton.textContent = 'Create Panel';
            createButton.disabled = false;
            loadingSpinner.style.display = 'none';
            return;
        }

        const { ram, disk, cpu } = selectedPackage;
        
        // --- MEMANGGIL SERVERLESS FUNCTION ANDA ---
        // Kirim semua data yang diperlukan ke serverless function Anda.
        // Serverless function akan menangani logika pemilihan konfigurasi panel (public/private)
        // dan penggunaan API key Pterodactyl yang aman.
        const requestParams = new URLSearchParams({
            username: username,
            ram: ram,
            disk: disk,
            cpu: cpu,
            hostingPackage: hostingPackage, // Kirim ini juga agar serverless tahu paketnya
            panelType: selectedPanelType, // Penting untuk memilih config di serverless function
            accessKey: accessKey // Kirim accessKey untuk validasi di serverless function
        }).toString();

        const finalRequestUrl = `${YOUR_VERCEL_API_ENDPOINT}?${requestParams}`;

        try {
            // Melakukan panggilan ke serverless function Anda
            const response = await fetch(finalRequestUrl, {
                method: 'GET', // Serverless function juga akan menerima GET
            });

            const data = await response.json();

            if (response.ok && data.status) {
                // Respons dari serverless function (yang sudah diproses dari API Pterodactyl)
                const result = data.result;
                const panelDomainUrl = result.domain; 

                const fullTextToCopy = `
==============================
   DETAIL AKUN PANEL ANDA   
==============================
Username: ${result.username}
Password: ${result.password}
Paket: ${selectedPackage.name}
Tipe Panel: ${selectedPanelType.toUpperCase()}
ID User: ${result.id_user}
Server ID: ${result.id_server}
Domain: ${panelDomainUrl}
==============================
`.trim();

                const successMessageHTML = `
                    <div class="result-title">Panel Berhasil Dibuat!</div>
                    <div class="result-row"><span>Username:</span> <span id="copyUsernameValue">${result.username}</span></div>
                    <div class="result-row"><span>Password:</span> <span id="copyPasswordValue">${result.password}</span></div>
                    <div class="result-row"><span>Paket:</span> <span>${selectedPackage.name}</span></div>
                    <div class="result-row"><span>Tipe Panel:</span> <span>${selectedPanelType.toUpperCase()}</span></div>
                    <div class="result-row"><span>ID User:</span> <span>${result.id_user}</span></div>
                    <div class="result-row"><span>Server ID:</span> <span>${result.id_server}</span></div>
                    <div class="result-row"><span>Domain:</span> <span id="copyDomainValue"><a href="${panelDomainUrl}" target="_blank">${result.domain}</a></span></div>
                    
                    <div class="result-actions">
                        <button class="copy-button" data-copy-target="copyUsernameValue">Copy Username</button>
                        <button class="copy-button" data-copy-target="copyPasswordValue">Copy Password</button>
                        <button class="copy-button" data-copy-target="copyDomainValue">Copy Domain</button>
                        <button class="login-panel-button" onclick="window.open('${panelDomainUrl}', '_blank')">Login Panel</button>
                        <button class="copy-all-button" data-copy-value="${fullTextToCopy}">Copy All Details</button>
                    </div>
                    <p class="contact-message">
                        Jika tidak bisa login, silakan hubungi <a href="#">Admin</a>
                    </p>
                `;
                showMainMessage('success', successMessageHTML); 
                createPanelForm.reset(); 
                showToast('success', 'Panel berhasil dibuat!'); 

            } else {
                const errorMessage = data.message || 'Terjadi kesalahan saat membuat panel.';
                showMainMessage('error', `<b>Gagal membuat server!</b><br>Pesan: ${errorMessage}`); 
                showToast('error', 'Gagal membuat panel!'); 
            }
        } catch (error) {
            console.error('Error saat menghubungi Serverless Function:', error);
            showMainMessage('error', `Terjadi kesalahan jaringan atau server tidak merespons: ${error.message}.`); 
            showToast('error', 'Kesalahan koneksi Serverless API!'); 
        } finally {
            createButton.textContent = 'Create Panel';
            createButton.disabled = false;
            loadingSpinner.style.display = 'none';
        }
    });

    responseMessageDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('copy-button')) {
            const targetId = event.target.dataset.copyTarget;
            const textToCopy = document.getElementById(targetId).textContent;
            
            if (textToCopy) {
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    showToast('info', `Disalin: ${textToCopy.substring(0, Math.min(25, textToCopy.length))}...`); 
                    event.target.textContent = 'Copied!';
                    setTimeout(() => {
                        if (targetId === 'copyUsernameValue') event.target.textContent = 'Copy Username';
                        else if (targetId === 'copyPasswordValue') event.target.textContent = 'Copy Password';
                        else if (targetId === 'copyDomainValue') event.target.textContent = 'Copy Domain';
                    }, 1500);
                } catch (err) {
                    console.error('Failed to copy text:', err);
                    showToast('error', 'Gagal menyalin!');
                }
            }
        } else if (event.target.classList.contains('copy-all-button')) { 
            const textToCopy = event.target.dataset.copyValue;
             if (textToCopy) {
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    showToast('info', 'Semua detail berhasil disalin!'); 
                    event.target.textContent = 'All Copied!';
                    setTimeout(() => {
                        event.target.textContent = 'Copy All Details';
                    }, 1500);
                } catch (err) {
                    console.error('Failed to copy all text:', err);
                    showToast('error', 'Gagal menyalin semua!');
                }
            }
        }
    });
});