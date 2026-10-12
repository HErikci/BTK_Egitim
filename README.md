# KazanımAI web sitesi

Türkçe sayfalı 3D kitap, öğretmenlere yönelik tanıtım ve tarayıcı içinde çalışan örnek hedef seçimi.

## Çalıştırma

Windows / PowerShell, Node.js 22.12+:

```powershell
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --open
```

Vite port doluysa bir sonraki boş portu kullanır. `npm.cmd`, PowerShell yürütme ilkesi nedeniyle engellenebilen `npm.ps1` dosyasını kullanmaz.

```powershell
npm.cmd run build
npm.cmd run preview
```

Vite 7.0.6 ve TypeScript kullanılır. 3D görüntüleyici yerel WebGL2 kodudur; çalışma zamanında dış CDN veya 3D kütüphanesi gerekmez. Bu ortamda ağdan paket indirme engellendiği için Vite, mevcut npm önbelleğinden kurulmuştur. `package-lock.json` kurulan sürümleri sabitler.

## Kitap dosyalarını yeniden oluşturma

Python 3.10+ ve Pillow gerekir:

```powershell
python -m pip install -r scripts/requirements.txt
npm.cmd run assets:book
npm.cmd run check:model
```

Betik mevcut `3d-model` kaynaklarını okur; özgün dosyaları değiştirmez. İki sayfayı Türkçeleştirir, renkli çizimleri korur ve `public/models` altında gömülü dokulu `book-tr.glb`, 2048 × 2048 doku, okunabilir sayfa görseli ve çeviri notları üretir. Varsayılan font Windows Arial'dir; başka bir sistemde `BOOK_FONT` ve `BOOK_FONT_BOLD` ortam değişkenleriyle Türkçe karakterleri destekleyen font dosyaları seçilebilir.

Model incelemesinde eksik kaynak bağımlılığı saptanmadı: 462 köşe, 374 üçgen, geometri tamponu ve doku mevcut. GLB doğrulaması, özgün geometri baytlarının korunmasını ve yeni PNG'nin gömülmesini kontrol eder. Görüntüleyici bu modelin tek mesh yapısına göre yazılmıştır.

## Kontroller

- Kitabı döndürme: fareyle sürükleme, dokunma veya ok tuşları.
- Yakınlaştırma: fare tekerleği, iki parmak hareketi veya `+` / `−`.
- Görünümü sıfırlama: `↺` düğmesi veya `0`.
- Türkçe sayfaları okuma: kitabın altındaki `↗` düğmesi. Pencere `Escape` veya Kapat ile kapanır.
- WebGL2 kullanılamazsa veya model yüklenemezse Türkçe sayfalar görsel olarak gösterilir.
- Hareket azaltma tercihi giriş animasyonunu ve yumuşak kaydırmayı kapatır.

Örnek kullanım hazır bir soru üzerinde çalışır. Hedef ifadeleri açıklama amaçlıdır; resmî kazanım kodu değildir. Seçimler tarayıcı belleğindedir. Gerçek yapay zekâ analizi, hesap, dosya yükleme ve sunucu API'si bulunmaz. Özellik anlatımı `../kazanim_ai_moduller.md` belgesindeki planlanan özelliklere dayanır.

## Lisans

Kitap modeli: [textbook schoolboy runaway](https://sketchfab.com/3d-models/textbook-schoolboy-runaway-c2df23da0cd5451794546e4e51104b01), [fraservyse](https://sketchfab.com/fraservyse), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Değişiklik: sayfa metinleri Türkçeye çevrildi; doku yeniden dizildi. Özgün geometri ve çizimler korunmuştur. Kaynak belirtimi site altbilgisinde de yer alır.
"# BTK_Egitim" 
