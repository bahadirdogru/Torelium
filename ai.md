# Torelium Stealth Browser Projesi - AI Mimari ve Karar Özeti

Bu belge, **Torelium Stealth Browser** (`Torelium.ps1` başlatıcısı) projesi kapsamında alınan mimari kararları, temel yapı taşlarını, güvenlik sertleştirmelerini ve parmak izi gizleme (fingerprint spoofing) mekanizmalarını yapay zeka ve geliştirici analizi açısından özetler.

## 🎯 Projenin Amacı ve Temel Felsefe

> **"Anonim olmak kalabalıklara karışmak demek."**

Torelium, **Tor ağı** üzerinden anonimleşmiş ve **Helium** (Chromium tabanlı, özellik kesintilerine sahip tarayıcı) üzerinde gelişmiş özelliklerle **donanım, ekran, ağ ve JS API parmak izini (fingerprint)** gizleyip/değiştirerek en üst düzeyde izlenemez bir tarama ortamı sağlamayı amaçlar.

Dünyadaki en katı olan, "Yalan Tespiti (Lie Detection)" ve matematiksel desen doğrulama yapabilen sistemleri (**CreepJS** vb.) atlatmak için sıfırdan kurgulanmış bir başlatıcı (Wrapper) betiktir.

**Kalabalıklara Karışma Prensibi:** Sistemdeki her karar, kullanıcının "normal bir Chrome kullanıcısı" gibi görünmesini hedefler. Bir farkı algılanabilecek her sinyal — özel bir `console.log`, tutarsız bir WebGL parametresi, tespit edilebilir bir global değişken — kalabalıktan ayrılmak ve "BEN GİZLENİYORUM" diye bağırmak anlamına gelir. Bu nedenle:
*   Extension kodunda sıfır `console.log` / `console.error` çağrısı bulunur (production modunda).
*   CDP üzerinden sayfaya hiçbir global değişken (`window.to_cdp_active` vb.) enjekte edilmez.
*   Spoof edilen tüm API değerleri, seçilen donanım profiliyle (RTX 3060) matematiksel tutarlılık gösterir.

## 🏗️ Mimari ve Yaşam Döngüsü (Lifecycle) Seçimleri

Olası iz bırakma, kaynak sızıntısı ve kararsız çalışma problemlerini engellemek için sistem mimarisinde şu yol izlenmiştir:

### 1. Dinamik Tor Yaşam Döngüsü (Lifecycle)
*   Önceki sistemde Tor "Zombi Process" olarak arka planda çalışmaya devam ediyordu.
*   **Karar:** Helium (Tarayıcı) başlatıldığı anda PowerShell betiğine `$browserProcess | Wait-Process` kancası atıldı.
*   Tarayıcı penceresi kapandığı milisaniyede tüm Tor ağ bağlantıları (`tor.exe`) otomatik uçurulur. Temiz bir bellek bırakılır.
*   **Garanti Cleanup (v7.6+):** Ana çalışma bloğu `try/finally` ile sarıldı ve `Register-EngineEvent PowerShell.Exiting` kaydedildi. Bu sayede `Ctrl+C` veya beklenmedik çökmeler dahil her senaryoda `Invoke-Cleanup` fonksiyonu çalışarak Tor süreçleri, Bridge Job ve geçici profil dizini güvenli şekilde temizlenir.
*   `Stop-Bridge` köprü sürecini (`$script:bridgeProcess`) ve 9060 portunu dinleyen süreci sonlandırır; eski oturumlardan kalan `Get-Job` kalıntıları da temizlenir.

### 2. Geçici Dosya Saklama (Isolation)
*   Her başlatmada, `$env:TEMP\helium_profiles` dizini altında rastgele yepyeni bir "Profile" klasörü yaratılır.
*   Kalıcı çerez (Cookie), Geçmiş (History) ve Önbellek (Cache) depolanması sıfıra indirgenir.

### 3. Harici Ağlara Çıkışların Kesilmesi (IP Sızıntısı Koruması)
*   Orijinal betikte `Get-TorIP` kontrolü için Powershell üzerinden açık nete (`check.torproject.org/api/ip`) ping atılıyordu. Bu da SOCKS5 tüneline girmiyordu.
*   **Karar:** Bu adım Script seviyesinden tamamen kaldırıldı. IP testleri yalnızca Tarayıcının ana sekmesinde yapılır.

## 🔒 Güvenlik Sertleştirmeleri (v7.6 Security Hardening)

### 4. İndirme Bütünlüğü ve TLS Zorunluluğu
*   **TLS 1.2 Zorunluluğu:** Script başlangıcında `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12` ile eski TLS protokolleri devre dışı bırakılır.
*   **SHA256 Hash Doğrulaması:** `Test-FileHash` fonksiyonu, indirilen Tor Expert Bundle ve Helium arşivlerini bilinen SHA256 hash değerleriyle doğrular. Hash uyuşmazlığında indirme iptal edilir ve arşiv silinir. Hash değerleri `$torExpectedHash` ve `$heliumExpectedHash` değişkenlerinde saklanır; yeni sürümlere geçişte resmi kaynaklardan güncellenmesi gerekir.
*   **`-UseBasicParsing`:** `Invoke-WebRequest` çağrılarında ek HTML parsing davranışı engellenir.

### 5. Tor Control Port Kimlik Doğrulaması (Cookie Authentication)
*   **Öncesi:** `--CookieAuthentication 0` ile 9051 portuna kimlik doğrulamasız erişim mümkündü.
*   **Karar (v7.6):** `--CookieAuthentication 1 --DataDirectory "$torDataDir"` argümanları ile Tor, başlatma anında `$torDir\data\control_auth_cookie` konumunda 32-byte rastgele cookie dosyası oluşturur.
*   Tüm `AUTHENTICATE` çağrıları (hem `Invoke-TorNewnym` hem Bridge Job) bu cookie dosyasını okuyup hex'e çevirerek `AUTHENTICATE <hex>` formatında kimlik doğrulama yapar.
*   **Sonuç:** Aynı makinede çalışan diğer süreçler cookie dosyasını okumadan Tor Control Port'a erişemez.

### 6. Torelium Bridge: Token Tabanlı Kimlik Doğrulaması ve CORS Kısıtlaması
Manifest V3 mimarisinde Chromium `chrome.sockets` API'sini kısıtladığı için eklentiler doğrudan Tor Control Port (9051) ile konuşamaz. Bu sorunu aşmak için:
*   **Bridge Mimarisi:** `Torelium.ps1`, `Torelium.Bridge.ps1` dosyasını **ayrı bir PowerShell sürecinde** (`Start-Process`, gizli pencere) çalıştırır. Köprü **TcpListener** ile `127.0.0.1:9060` üzerinde minimal HTTP/1.1 sunar (`HttpListener`/http.sys ve bazı ortamlarda `Start-Job` ile görülen **Completed + timeout** sorunlarından kaçınmak için).
*   **Send-TorNewnym Yanıt Doğrulaması (v7.6+):** `Send-TorNewnym` fonksiyonu her Tor kontrol komutu için `StreamReader` ile yanıt okur ve `250 OK` doğrulaması yapar. `AUTHENTICATE` başarısız olursa detaylı hata fırlatılır. `ReadTimeout` (5 saniye) ile Tor yanıt vermezse askıda kalmaz. Eski sürümde yanıt okunmadan bağlantı kapatılıyordu — bu, komutların Tor tarafından işlenmemesine neden olabiliyordu.
*   **Token Tabanlı Auth (v7.6):** Her başlatmada `$bridgeToken = [guid]::NewGuid().ToString('N')` ile 32 karakterlik rastgele bir token üretilir. Bu token:
    1.  Köprü sürecine `-Token` parametresi ile geçirilir.
    2.  `New-SpoofExtension` fonksiyonu tarafından extension dizinine `bridge_config.json` olarak yazılır.
    3.  `background.js` başlarken `chrome.runtime.getURL('bridge_config.json')` ile token'ı okur.
    4.  Her Bridge isteğinde `X-Bridge-Token` header'ı ile gönderilir.
    5.  Bridge, gelen token'ı doğrular; eşleşmezse **HTTP 403** döner.
*   **CORS Kısıtlaması (v7.6):** `Access-Control-Allow-Origin: *` yerine, gelen `Origin` header'ı kontrol edilerek yalnızca `chrome-extension://` ve `http://127.0.0.1` / `http://localhost` pattern'lerine uyan origin'lere izin verilir.
*   **IP Parametresi Doğrulaması (v7.6):** `/country?ip=` endpoint'inde IP parametresi `^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$` regex'i ile doğrulanır. Bu, Tor Control Protocol komut enjeksiyonunu (`\r\n` ile ek komut gönderme) önler.
*   **Detaylı Hata Mesajları (v7.6+):** Bridge, `/newnym` endpoint'inde Tor kontrol portu hatalarını detaylı mesajla döner (`Tor control error: <mesaj>`). Extension popup'u bu mesajı doğrudan kullanıcıya gösterir.
*   **Dinamik Tor ve Helium Yönetimi:** Başlatıcı, proje dizininde `tor/` ve `helium/` klasörlerini kontrol eder. Yoklarsa resmi kaynaklardan indirir, hash doğrular, ayıklar ve konfigüre eder.
*   **İletişim Akışı:** Eklenti (Popup veya Background), token içeren `fetch` çağrıları ile köprüye sinyal gönderir. Köprü, token doğruladıktan sonra cookie-authenticated Tor bağlantısı üzerinden sinyalleri (NEWNYM, Country Lookup) paslar.

### 7. Extension Mesaj Güvenliği
*   `chrome.runtime.onMessage` listener'ında `sender.id !== chrome.runtime.id` kontrolü eklendi. Yalnızca kendi extension'ından gelen mesajlar işlenir; harici content script veya sayfalardan gelen mesajlar reddedilir.
*   Popup'ta checklist açılırken `chrome.runtime.getURL("checklist.html")` kullanılarak güvenli URL çözümlemesi sağlanır.
*   `web_accessible_resources` listesi boşaltıldı; `checklist.html` ve `checklist.js` artık dışarıdan (web sayfalarından) erişilemez.

**📁 Extension Dosya Mimarisi (v7.6+):**
```
Torelium/
├── Torelium.ps1          ← Başlatıcı, Tor, Bridge süreci, Token, Cleanup
├── Torelium.Bridge.ps1   ← HTTP köprüsü (TcpListener, NEWNYM / country / ping)
├── .gitignore            ← Repo temizlik kuralları (Binary, Log, Secret izolasyonu)
├── README.md             ← Proje genel rehberi (English)
├── ai.md                 ← Teknik mimari ve AI kararları (Bu belge)
└── extension/
    ├── manifest.json     ← Manifest V3 tanımı (proxy, privacy, debugger, tabs)
    ├── spoof.js          ← Content Script (MAIN world, document_start, sıfır log)
    ├── background.js     ← Service Worker (Proxy PAC, Token Auth Bridge & CDP, sıfır log)
    ├── popup.html/js     ← Kontrol Paneli (NEWNYM & CreepJS ID gösterimi)
    ├── checklist.html/js ← Gizlilik Kontrol Paneli (XSS-safe renderCard)
    └── creep_scraper.js  ← Remote CreepJS Scraper (sıfır log)
```
Çalışma anında `New-SpoofExtension` fonksiyonu ek olarak:
*   `bridge_config.json` (token içerir) dosyasını geçici extension dizinine yazar.

## 🎭 Parmak İzi (Fingerprint) ve Spoofing Mühendisliği

Parmak izini gizlemek, genellikle API metotlarını ezmekten geçer. Ancak CreepJS gibi modern sistemler "metotların ezilip ezilmediğini" anlamak için "Yalan Tespiti (Lie Detection)" uygularlar. "Kalabalıklara karışmak" felsefesiyle aşağıdaki kararlar alındı:

### 8. Gelişmiş Eklenti (Extension) Enjeksiyonu
JavaScript spoofing işlemlerinin sayfa yüklendikten (Page Load) *sonra* değil, DOM oluşmadan *önce* (`document_start`) ve ana dünyada (`MAIN` world) çalışmasını sağlamak için dinamik bir Chrome Eklentisi oluşturulur. Ayrıca, bu eklentinin arka planda çalışan ayrılmış servisi (`background.js`) aktif edilerek **Chrome Privacy API** yetkisi ile UDP ve WebRTC STUN sızıntılarını çekirdekten engeller.

**Sıfır İz Kuralı (v7.6):** Extension kodunun tamamında (`spoof.js`, `background.js`, `creep_scraper.js`) hiçbir `console.log`, `console.error` veya `console.warn` çağrısı bulunmaz. CDP üzerinden sayfaya hiçbir global değişken enjekte edilmez. Bu kural, anti-fingerprint sistemlerinin console çıktılarını veya global scope'u tarayarak Torelium kullanıcılarını tespit etmesini imkansız kılar.

### 9. İşletim Sistemi Kilitleri ve CDP (DevTools Protocol) Sızıntı Koruması
Sıradan betikler ve sayfa-içi (In-Page) JavaScript dosyaları, Chromium'un derin arka plan iş parçacıklarına (`ServiceWorkerGlobalScope` ve `WebWorker`) gizlilik amaçlı müdahale edemez. Bu senaryoda asıl Timezone (Örn: Europe/Istanbul) bilginizi sızdıran arka plan işçileri devreye girer. Torelium bu açığı **iki katmanlı hibrit kilit** ile tamamen mühürler:
1.  **OS-Layer (İşletim Sistemi):** Helium başlatılmadan saniyeler önce PowerShell üzerinden `$env:TZ` ortam değişkenini zorunlu bir bölgeye (`America/New_York`) eşitler.
2.  **Chrome DevTools Protocol (CDP):** `background.js` (Service Worker) uzantısının yüksek yetkileriyle (`debugger` API'si) Chromium çekirdeğine doğrudan bağlanır. Arka planda türeyen her yeni sayfa 500ms aralıklarla denetlenerek `Emulation.setTimezoneOverride` ("America/New_York") ve `Emulation.setLocaleOverride` ("en-US") komutları gönderilir. **v7.6 Farkı:** CDP artık `Runtime.evaluate` ile sayfaya hiçbir kod enjekte etmez; `window.to_cdp_active` gibi tespit edilebilir global değişkenler tamamen kaldırılmıştır.

### 10. Gelişmiş `toString()` Native Proxy Kancası (The Hook)
Modern analiz sistemleri bir objenin parmak izinin değiştirildiğini şu kodla anlar: `CanvasRenderingContext2D.prototype.getImageData.toString()`.
Eğer sonuç native tarayıcı kodu dışında bir değer dönerse sistem 0 puan verir.
*   **Çözüm:** `Function.prototype.toString` tamamen "Override" edildi. Sistem bir fonksiyonu Hook'ladığı anda `WeakMap`'e kayıt düşülüyor. Güvenlik sistemi "Senin içeriğin nedir?" derse, Torelium sahte bir şekilde **`function methodName() { [native code] }`** cevabı döndürüyor.
*   **Özyineleme Koruması (v7.6):** `inToString` boolean guard'ı eklendi. Recursive `toString` çağrılarında (ör. CreepJS'in derinlemesine prototip ve call-stack sınır testlerinde) döngüye girilmesi önlenir; guard aktifken doğrudan `originalToString.call(this)` dönülür.
*   **Object.prototype.toString Güçlendirmesi (v7.6):** `Object.prototype.toString` da hook'lanarak, spooflanmış fonksiyonlar üzerinde `Object.prototype.toString.call(fn)` çağrıldığında `"[object Function]"` dönmesi garanti edilir. Bu, `typeof` ve `toString` bazlı Proxy tespit mekanizmalarını atlatır.

### 11. Hedeflenen API Spoofing Katmanları
Aşağıdaki tarayıcı API'leri Helium başlatılırken Eklenti tarafından sahte fakat *kendi içinde tutarlı (Consistent)* verilerle beslenir:

*   **Donanım ve Ekran Profilleri:** Sabit bir donanım profili (`hwProfile`) vasıtasıyla Çekirdek (8), Bellek (8GB), Ekran Çözünürlüğü (1920x1080) ve GPU (RTX 3060) tutarlı olarak simüle edilir.
*   **WebGL Rendering (v7.6 Genişletilmiş):** Hem WebGL1 hem WebGL2 için yalnızca `UNMASKED_VENDOR` ve `UNMASKED_RENDERER` değil, toplam **15 parametre** seçilen GPU profiline uygun olarak spoof edilir:
    *   `MAX_TEXTURE_SIZE` (16384), `MAX_VIEWPORT_DIMS` (32768x32768), `MAX_RENDERBUFFER_SIZE` (16384)
    *   `MAX_CUBE_MAP_TEXTURE_SIZE` (16384), `MAX_TEXTURE_IMAGE_UNITS` (32), `MAX_VERTEX_TEXTURE_IMAGE_UNITS` (32)
    *   `MAX_COMBINED_TEXTURE_IMAGE_UNITS` (192), `MAX_VERTEX_ATTRIBS` (16), `MAX_VARYING_VECTORS` (31)
    *   `MAX_VERTEX_UNIFORM_VECTORS` (4096), `MAX_FRAGMENT_UNIFORM_VECTORS` (1024)
    *   `ALIASED_LINE_WIDTH_RANGE` (1–7.375), `ALIASED_POINT_SIZE_RANGE` (1–2048)
    *   Bu tutarlılık, "GPU X raporluyor ama parametreleri Y'ye ait" tarzı anomali tespitini engeller.
*   **Canvas Fingerprinting Sabotajı (v7.6 Seed-Based):** Eski yöntem (son pixel XOR) deterministik ve tespit edilebilirdi. Yeni algoritma:
    1.  Oturum başlangıcında `crypto.getRandomValues` ile rastgele `sessionSeed` üretilir.
    2.  `getImageData` çağrıldığında, canvas içeriğinin hash'i `sessionSeed` ile birleştirilerek `contentHash` hesaplanır.
    3.  Bu hash'ten türetilen LCG (Linear Congruential Generator) ile birden fazla piksel noktasına dağıtılmış, yalnızca R/G/B kanallarını etkileyen (alpha dokunulmaz) subtil noise eklenir.
    4.  **Oturum Tutarlılığı:** Aynı canvas → aynı hash → aynı noise. Farklı oturum → farklı seed → farklı noise.
    5.  `measureText` offset'i korunmaktadır (+0.0000000000001 piksel).
*   **Tam Timezone Koruma Katmanı:** Iframe'ler ve sayfa içi saat dilimi `Intl.DateTimeFormat` kancalanarak; ServiceWorker ve Chromium motoru tabanlı sorgular ise başlatma öncesi atanan işletim sistemi kilidi (`$env:TZ`) ve CDP ile hedeflenen izole bölgeye (`America/New_York`) sabitlenir.
*   **WebRTC ve IP Sızıntı Önleyici (Leak Proof):** Olası In-Page IP okumalarını önlemek için `RTCPeerConnection` constructor'ı sarılarak `config.iceServers` her zaman boşaltılır. `prototype`, `name`, `length` ve `toString` maskeleme ile native görünüm korunur. Buna ek olarak Background Service Worker üzerinden `chrome.privacy.network.webRTCIPHandlingPolicy` ile `disable_non_proxied_udp` emri C++ motor katmanından kilitlenir.
*   **Diğer Gizlilik Katmanları:** AudioContext Frequency Data gürültülenir (+0.0000001). Performance API `now()` zamanı offset'lenir (+0.0001). Gamepad ve Battery API tamamen reddedilir.
*   **Helium Native Flags:** Tarayıcı `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`, `--disable-reading-from-canvas`, `--disable-webgl` vb. motor katmanı kuralları sayesinde ekstra savunma hattı kurar.
*   **Dinamik UI Kontrolleri:** `popup.html` üzerinden aktif oturumda Tor kimliği değiştirilebilir (NEWNYM Bridge). `checklist.html` ise tarayıcının o anki gerçek API değerlerini test ederek kullanıcıya güven sağlar. **XSS Koruması (v7.6):** `checklist.js`'te `renderCard` fonksiyonunda tüm dinamik değerler (`r.label`, `r.value`, `item.icon`, `item.title`, kategori adları) `escapeHtml()` fonksiyonu ile sanitize edilir.
*   **Remote CreepJS Entegrasyonu:** CreepJS raporları `creep_scraper.js` üzerinden canlı `https://abrahamjuliot.github.io/creepjs/` sitesinden kazınarak arka planda Torelium arayüzüne senkronize edilir.

### 12. Ağ (Network) ve DOM Eşleşmesi (DNR) - v7.7
*   **Sorun:** Chromium PowerShell'den başlatılırken `--user-agent` vb. bayraklarla zorlanan HTTP başlıkları, JS tarafında (`spoof.js`) atanan `navigator` bilgileriyle farklılaşıyor ve "Network Lie" yaratıyordu.
*   **Çözüm:** PowerShell argümanları temizlendi. Eklentinin arkaplan servisinde `chrome.declarativeNetRequest` (DNR) devreye alındı. Seed üzerinden hesaplanan User-Agent, Accept-Language ve platform değişkenleri dinamik olarak giden HTTP başlıklarına yamanarak ağ ve JS katmanları %100 senkronize edildi.

### 13. Asenkron Çarpışma ve Statik Seed Enjeksiyonu - v7.7
*   **Sorun:** Asenkron Seed arayışları (`sessionStorage` veya köprü), hızlı IFrame yüklemelerinde veya cross-origin sayfalarda rastgele yeni bir uydurma kimliğe (`crypto.getRandomValues`) düşülmesine yol açıyordu.
*   **Çözüm:** `spoof_bridge.js` tamamen kaldırıldı. Eklenti yüklenmeden önce PowerShell ve `/newseed` köprü tetikleyicisi (`Torelium.Bridge.ps1`) dosyaya *Regex* ile doğrudan koda statik `const __TORE_SEED__` enjekte eder. Artık gecikme, çarpışma veya sekme atlamasında cihazın/parmak izinin değişmesi imkansızdır.

## 🚀 Sonuç ve Çalışma Akışı
Torelium başlatıldığında süreç şu sırayla çalışır:
1.  TLS 1.2 zorunlu kılınır; `$bridgeToken` üretilir.
2.  Geçmiş tüm Tor işlemleri ve eski profiller RAM'den temizlenir.
3.  Tor Expert Bundle ve Helium yoksa indirilir ve **SHA256 hash doğrulaması** yapılır.
4.  Yeni izole profil klasörü yaratılır.
5.  Tor ağı tüneli **CookieAuthentication 1** ile ayağa kaldırılır; ilk NEWNYM gönderilir.
6.  Bridge Job, `$bridgeToken` ve `$torCookieFile` ile başlatılır (token auth + cookie auth).
7.  Spoofing extension profil içine kopyalanır; `bridge_config.json` (token) yazılır.
8.  `Register-EngineEvent PowerShell.Exiting` ile garanti cleanup kaydedilir.
9.  Helium tarayıcısı SOCKS5 Tor proxy'si (`--proxy-server=socks5://127.0.0.1:9050`), bypass listesi (`--proxy-bypass-list=127.0.0.1,localhost`), extension ve stealth argümanları ile 1366x768 pencerede başlatılır.
10. Extension yüklenince `chrome.proxy` API ile PAC script devreye girer: `127.0.0.1` → DIRECT, diğer trafik → SOCKS5. Bu, `--proxy-bypass-list`'in service worker fetch'lerine uygulanmadığı senaryolarda güvenilir bridge iletişimi sağlar.
11. Tarayıcı kapatıldığı an `Invoke-Cleanup` (`try/finally` bloğu) devreye girer: Bridge Job durdurulur, Tor sonlandırılır, profil silinir.

## 🚨 CreepJS Analizleri ve İleri Seviye Atlatma (Bypass) Stratejileri

CreepJS üzerinde yapılan kapsamlı testler neticesinde tespit edilen "Yalan (Lie)" ve "Bot" bildirimlerini aşmak için aşağıdaki stratejiler geliştirilmiştir:

### 1. Timezone DST (Yaz Saati) Ofset Uyuşmazlığı
*   **Sorun:** Sistem saati "America/New_York" olarak ayarlanmasına rağmen, `getTimezoneOffset()` sonucu ile CreepJS'in beklediği yaz saati ofseti uyuşmadı.
*   **Mevcut Durum:** `getTimezoneOffset` hook'u sabit 240 (EDT) döndürür. DST geçişlerinde (EST=300) uyumsuzluk oluşabilir.
*   **Gelecek İyileştirme:** `Intl.DateTimeFormat` kullanılarak o anın gerçek DST kurallarına göre dinamik ofset hesaplanması.

### 2. JS Proxy Yakalanması (Call Stack Exceeded)
*   **Sorun:** `Function.prototype.toString` kancası, CreepJS'in derinlemesine prototip testlerine dayanamayarak `RangeError: maximum call stack size exceeded` fırlatıyordu.
*   **Çözüm (v7.6 — Uygulandı):** `inToString` boolean guard'ı ile recursive çağrılar tespit edilip kısa devre yapılır. `Object.prototype.toString` da hook'lanarak `[object Function]` tutarlılığı sağlanır. Stack overflow riski sıfırlandı.

### 3. WebDriver ve Headless Tespiti
*   **Sorun:** `navigator.webdriver` değeri tam olarak maskelenemediği için tarayıcı CreepJS tarafından "Bot" olarak işaretleniyordu.
*   **Çözüm (v7.6 — Uygulandı):** `hookFunction` ile `Navigator.prototype.webdriver` getter'ı `document_start` aşamasında (`MAIN` world) `false` dönecek şekilde ezildi. `toString` maskeleme ile getter'ın varlığı gizlendi.

### 4. WebGL Parametre Tutarsızlığı
*   **Sorun:** Yalnızca GPU adı ve vendor spoof edilip diğer parametreler dokunulmadığı için `hasBadWebGL: true` işaretleniyordu.
*   **Çözüm (v7.6 — Uygulandı):** RTX 3060 profiline uygun **15 WebGL parametresi** (MAX_TEXTURE_SIZE, MAX_VIEWPORT_DIMS, ALIASED_LINE_WIDTH_RANGE vb.) tutarlı şekilde spoof ediliyor. Gürültü algoritması yumuşatıldı.

## 📋 Güvenlik Denetim Özeti (v7.7)

| Kategori | Durum | Açıklama |
|----------|-------|----------|
| Console.log Parmak İzi | ✅ Çözüldü | Tüm log çağrıları kaldırıldı |
| CDP Global Değişken İzi | ✅ Çözüldü | `window.to_cdp_active` kaldırıldı |
| Bridge Komut Enjeksiyonu | ✅ Çözüldü | IP regex doğrulaması eklendi |
| İndirme Hash Doğrulaması | ✅ Altyapı hazır | SHA256 fonksiyonu eklendi, hash'ler güncellenmeli |
| Tor Control Port Auth | ✅ Çözüldü | CookieAuthentication 1 + hex cookie |
| Bridge Token Auth | ✅ Çözüldü | GUID token + X-Bridge-Token header |
| Bridge CORS | ✅ Çözüldü | Origin bazlı izin (chrome-extension / localhost) |
| Bridge NEWNYM Yanıt Doğrulama | ✅ Çözüldü | StreamReader ile 250 OK doğrulaması, ReadTimeout 5s |
| Bridge Proxy Bypass | ✅ Çözüldü | `chrome.proxy` PAC script + `<-loopback>` kaldırıldı |
| Donanım Kimliği Randomizasyonu | ✅ Çözüldü | Seed-tabanlı, deterministik profil üretimi (v7.7+) |
| Bölgesel Profil (Timezone/Locale) | ✅ Çözüldü | Seed-tabanlı, 16+ bölge (ABD, UK, JP, AU, TR vb.) |
| Timezone DST Dinamikliği | ✅ Çözüldü | Intl.DateTimeFormat ile dinamik offset hesaplama |
| Worker/SharedWorker Hooking | ✅ Çözüldü | Blob-wrapper ile worker içi izolasyon önleme |
| OffscreenCanvas Spoofing | ✅ Çözüldü | 2D ve WebGL için worker-safe gürültü |
| Error Stack Trace Cleaning | ✅ Çözüldü | extension-id ve file-path gizleme |
| CreepJS ID Kararlılığı | ✅ Çözüldü | Statik Seed doğrudan enjeksiyonu ve iframe izolasyonu ile stabil. |
| Canvas Noise | ✅ Çözüldü | Seed-based, oturum-tutarlı, multi-pixel |
| toString Proxy | ✅ Çözüldü | Recursion guard + Object.prototype.toString |
| WebGL Tutarlılığı | ✅ Çözüldü | 15 parametre RTX 3060 profiline uygun |
| XSS Koruması | ✅ Çözüldü | escapeHtml() fonksiyonu eklendi |
| Cleanup Güvenilirliği | ✅ Çözüldü | try/finally + Register-EngineEvent |
| Message Sender Kontrolü | ✅ Çözüldü | sender.id doğrulaması eklendi |
| Hata Mesajı Sızıntısı | ✅ Çözüldü | Bridge detaylı hata mesajı döner |
| .gitignore Güvenliği | ✅ Çözüldü | *.env, *.key, *.pem, credentials* eklendi |
