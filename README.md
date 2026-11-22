# Sınav Simülatörü

Ders slaytlarından (PDF) ve çıkmış sorulardan yapay zekâ destekli deneme sınavları, konu özetleri ve
flashcard'lar üreten web uygulaması.

**Yığın:** Next.js 16 (App Router) · Tailwind CSS 4 · lucide-react · yerel SQLite (`node:sqlite`) + PDF klasörü ·
Google Gemini (ücretsiz katman) · NVIDIA build.nvidia.com (son yedek)

## Özellikler

- **Dersler ve materyaller:** PDF yükleme/silme. Görsel ağırlıklı (taranmış, el yazısı, diyagram) PDF'ler Gemini ile sayfa sayfa okunur.
- **Deneme sınavı:** tüm dosyalardan ya da seçilen slaytlardan; soru sayısı, zorluk, soru tipi seçilir. Çıkmış sorular varsa hocanın tarzına benzetilir.
- **Cevap anahtarı doğrulaması:** çoktan seçmeli sorular anahtarı görmeyen ayrı bir model çağrısına çözdürülür; uyuşmazlıkta hakem karar verir, hatalı sorular çıkarılır.
- **Tekrar önleme:** önceki sınavlara çok benzeyen sorular (rakamlar yok sayılarak) fazladan üretilenlerle değiştirilir.
- **Değerlendirme:** çoktan seçmeli otomatik, açık uçlu yapay zekâ ile puanlanır; konu bazlı başarı ve "şu konulara çalış" özeti.
- **Çalışma rehberi:** sınavdaki zayıf konular için hap özet, tuzaklar ve 5 flashcard (kaydedilir).
- **Özet & Kartlar:** sınavsız; seçilen dosyalardan konu özetleri ve "bildim / bilemedim" kart destesi (ilerleme kaydedilir).
- **Yanlışlarımı Tekrar Et:** önceki sınavlardaki yanlışlardan, aynı kavramları farklı açıdan soran mini sınav.
- **Süreli sınav:** 15-90 dk seçilebilir; geri sayım, süre bitince otomatik teslim, soru başına yaklaşık süre. Başlangıç sunucuya yazılır (yenileme sayacı sıfırlamaz).
- **Bu soru hatalı:** sonuç ekranında işaretlenen soru puana, konu analizine ve tekrar sınavına dahil edilmez; geri alınabilir.
- **Derse soru sor:** materyallerden kaynak göstererek ([Dosya.pdf, s. N]) cevap veren sohbet (`/chat/[ders]`); kapsam dışı cevaplar işaretlenir.
- **İlerleme grafiği:** ders panelinde sınav puanlarının zaman içindeki seyri.
- Sınav, materyal ve çalışma setleri panelden ✕ ile silinebilir.

## Kurulum

```bash
npm install
cp .env.example .env.local   # değerleri doldurun
npm run dev                  # http://localhost:3000
```

`.env.local`: `GEMINI_API_KEY` (Google AI Studio), isteğe bağlı `NVIDIA_API_KEY` (build.nvidia.com).

### Veriler

Her şey bu bilgisayarda durur (Node 22.5+ ile gelen `node:sqlite`, ek paket yok):

- Veritabanı: `~/.sinav-simulatoru/data.db` (SQLite, WAL) — şema `src/lib/db/index.ts` içinde, ilk açılışta kendiliğinden kurulur/güncellenir
- PDF'ler: `~/.sinav-simulatoru/pdfs/<ders id>/<id>.pdf`
- Konum `DATA_DIR` ile değiştirilebilir. OneDrive gibi senkronize klasörlere koymayın (açık SQLite dosyası bozulabilir).
- Yedek almak için uygulama kapalıyken `~/.sinav-simulatoru` klasörünü kopyalamak yeterli.

Kasım 2026'ya kadar veriler Supabase'deydi; tek seferlik bir betikle aynı kimliklerle yerel depoya taşındı
ve doğrulandı. Supabase'deki eski kopya dokunulmadan duruyor.

## Yapay zekâ modelleri ve kota

Ücretsiz katmanda çalışır (bilinçli tercih). Tüm çağrılar `src/lib/gemini.ts` üzerinden; her iş sıralı bir
model zinciri kullanır ve kullanılamayan / kotası dolan / aşırı yoğun modelden sıradakine geçer.

| İş | Zincir (varsayılan) |
|---|---|
| Sınav, çalışma rehberi, özet & kartlar | 3.5-flash → 3.8-flash → 3.7-flash → 4-hydrogen → 3.5-flash-lite → 3.1-flash-lite → NVIDIA Nemotron Ultra |
| Cevap anahtarı doğrulaması | 3.1-flash-lite → 3.5-flash-lite → güçlü Gemini'ler → NVIDIA |
| Açık uçlu puanlama | lite'lar → güçlü Gemini'ler → NVIDIA |
| PDF görsel okuma | güçlü Gemini'ler → lite'lar (NVIDIA'da PDF girdisi yok) |

Ölçülen gerçekler (Kasım 2026):

- `gemini-3.5-flash` ücretsiz katmanda **günde 20 istek**; kota Pasifik gece yarısı (TR ~11:00) sıfırlanır.
  Her sınav ~1 güçlü istek harcar (doğrulama lite ile yapılır). Taranmış PDF okuma da bu kotadan yer.
- Kalite: 3.5-flash 27 soruda 0 yanlış anahtar; lite 13 soruda 2; Nemotron Ultra 15 soruda 1 yanlış + 1 hatalı (80-120 sn).
- Pro modelleri ve gemini-4 (hydrogen hariç) ücretsiz katmanda kapalı (kota 0). `gemini-2.5-*` yeni anahtarlarda 404.
- NVIDIA: Mistral Large 4 / Nemotron Super matematik sembollerini içerik filtresine takıyor (422); Nemotron Ultra
  yalnızca "düşünme" açıkken doğru cevap veriyor.
- Doğrulama bir güvenlik ağıdır, garanti değil (zor bir döngü sayma sorusunda yanlış anahtarı kaçırdı).

Zincirler `.env.local`'de virgülle ayrılmış listeyle değiştirilebilir: `GEMINI_MODEL`, `GEMINI_VERIFY_MODEL`,
`GEMINI_GRADING_MODEL`, `GEMINI_VISION_MODEL`, `GEMINI_CHAT_MODEL` (`nvidia:` önekiyle NVIDIA modelleri de yazılabilir);
`NVIDIA_POSITION=beforeLite` NVIDIA'yı lite modellerin önüne alır.

Modeller "LaTeX kullanma" talimatına rağmen LaTeX yazabiliyor; `src/lib/latex.ts` JSON'u ayrıştırmadan önce
komutları Unicode'a çevirir (`\neg` → ¬, `\mathbb{R}` → ℝ) ve geçersiz kaçışları onarır.

## Masaüstü kısayolu

`launcher/start.vbs` uygulamayı tek tıkla açar (masaüstündeki **Sınav Simülatörü** kısayolu bunu çağırır):
sunucu zaten açıksa yalnızca pencereyi açar; değilse kod değiştiyse önce derler, sonra `next start`'ı
gizli olarak `127.0.0.1:3456`'da başlatır (ev ağından erişilemez) ve uygulamayı Edge uygulama penceresinde açar.
Sunucu pencere kapansa da arka planda çalışmaya devam eder; kapatmak için `launcher/stop.vbs`.
Günlükler: `launcher/server.log`, `launcher/server.err.log`. `.ps1` dosyaları BOM'lu UTF-8 olmalı (Windows PowerShell 5.1).

## Klasör yapısı

```
launcher/                              Masaüstü başlatıcı, simge, açılış sayfası
src/app/page.tsx                       Dashboard
src/app/exams/[examId]/page.tsx        Sınav çözme / sonuç sayfası
src/app/study/[setId]/page.tsx         Çalışma seti: kart çalışma + konu özetleri
src/lib/db/                            Yerel veri: index (SQLite + şema), repo (tüm tablo işlemleri), files (PDF klasörü)
src/app/api/courses/…                  Dersler, materyal yükleme, sınav üretme, çalışma seti üretme
src/app/api/exams/[examId]/…           DELETE sınav, submit (puanlama), study-guide
src/app/api/materials/[materialId]/…   DELETE materyal, vision (yeniden okuma)
src/app/api/study-sets/[setId]/        PATCH kart durumları, DELETE
src/components/dashboard/              Sidebar, CourseView, yükleme / sınav / çalışma seti pencereleri, SourcePicker
src/components/exam/                   ExamScreen, ExamRunner, ExamResult, StudyGuidePanel, RichText
src/components/study/                  StudySetScreen, CardReview
src/components/ui/                     Modal, ThemeToggle, FormBits
src/lib/gemini.ts                      Model zincirleri, Gemini + NVIDIA çağrıları, yeniden deneme
src/lib/latex.ts                       Model JSON'unda LaTeX → Unicode, kaçış onarımı
src/lib/exam/                          Tipler, üretim (generate), doğrulama (verify), tekrar önleme (similarity),
                                       puanlama (grade), tekrar sınavı (review), çalışma rehberi, görünüm
src/lib/study/                         Çalışma seti üretimi ve tipleri
src/lib/pdf.ts, pdf-vision.ts          unpdf ile metin; Gemini Vision ile görsel okuma (≤14 MB inline, üstü Files API)
src/lib/material-text.ts               Hangi PDF'in görsel okunacağına karar verir (eşikler: constants.ts)
src/lib/course-sources.ts              Seçilen materyallerin metnini yükler
```

## Notlar

- Tek kullanıcılı, yerel bir uygulama: sunucu yalnızca `127.0.0.1`'i dinler, giriş sistemi yoktur.
  İnternete açılacaksa önce kimlik doğrulama eklenmeli.
- Sınav bitene kadar doğru cevaplar ve çözümler tarayıcıya gönderilmez. Cevap taslağı localStorage'da tutulur.
- Konu özeti (`feedback_summary`) kodda hesaplanır; zayıf konu eşiği %70.
- Next 16 `cacheComponents`: env/DB okuyan GET rotalarında `await connection()`; dinamik sayfalarda params
  `<Suspense>` içinde okunur; önceki sayfa `<Activity>` ile gizli tutulduğu için modal pencereler gizlenince
  kendini kapatır (`Modal.tsx`). Silinmiş bir sınavın sayfası "bulunamadı" ekranını HTTP 200 ile gösterir (PPR).

## Yol haritası

- [x] Aşama 1: iskelet, şema, dashboard, PDF yükleme ve metin çıkarma
- [x] Aşama 2: Gemini ile sınav üretimi, çözme ekranı, puanlama ve konu bazlı geri bildirim
- [x] Aşama 3: görsel ağırlıklı PDF'ler için Gemini Vision, zayıf konulara çalışma rehberi + flashcard
- [x] Slayt seçerek sınav, sınavsız özet + flashcard (bildim/bilemedim), yanlışlardan tekrar sınavı
- [x] Cevap anahtarı doğrulaması, tekrar önleme, ücretsiz kota için model zincirleri + NVIDIA yedeği
- [x] Süreli sınav, "bu soru hatalı", derse soru sor, ilerleme grafiği
- [x] Supabase'den yerel SQLite'a geçiş (duraklatma derdi yok, ağ gerekmez)
