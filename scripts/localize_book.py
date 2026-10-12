"""Replace only the two printed page islands and package the original mesh as GLB.

Run from any directory: python scripts/localize_book.py
Requires Pillow. Font may be overridden with BOOK_FONT / BOOK_FONT_BOLD.
"""
from pathlib import Path
import json
import os
import struct
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "3d-model/textbook_schoolboy_runaway-gltf.zip"
OUTPUT = ROOT / "public/models"
FONT = os.environ.get("BOOK_FONT", "C:/Windows/Fonts/arial.ttf")
BOLD = os.environ.get("BOOK_FONT_BOLD", "C:/Windows/Fonts/arialbd.ttf")

LEFT = [
    ("text", "610. Bir dikdörtgenler prizması ile bir küpün yüzey alanları eşittir. Prizmanın uzunluğu 18 m'dir; genişliğinin 2 katı, yüksekliğinden ise 8 m fazladır. Küpün ayrıtını bulunuz."),
    ("text", "611. 4 cm, 5 cm ve 6 cm boyutlarında bir dikdörtgenler prizması tüm yüzlerinden boyanıp 1 cm ayrıtlı küplere bölünüyor. 1) Üç yüzü, 2) iki yüzü, 3) bir yüzü boyalı kaç küp vardır?"),
    ("heading", "Tekrar alıştırmaları"),
    ("text", "612. Bir roketin hızı 8 km/sn'dir. 960 km'yi kaç dakikada kat eder?"),
    ("text", "613. Bir karton levhadan altı eş kare kesilebilir. Bu karelerden 50 tane kesmek için kaç levha gerekir?"),
    ("text", "614. Bir tren saat 16.00'da istasyondan 54 km/sa hızla ayrılıyor. Saat 19.00'da aynı istasyondan ters yönde ikinci bir tren hareket ediyor. Saat 24.00'te aralarındaki uzaklık 642 km oluyor. İkinci trenin hızı kaçtır?"),
    ("text", "615. Denklemleri çözünüz:"),
    ("math", "1) 6x + 8x − 7x = 714;       2) 23x − 19x + 5x = 1 827;"),
    ("math", "3) 11x − 6x + 17 = 2 042;    4) 5x + 3x − 47 = 6 401."),
    ("heading", "Problem"),
    ("text", "616. Bir cetvel ve birkaç özdeş tuğla kullanarak bir tuğlanın köşegenini nasıl ölçersiniz? Köşegen, aynı yüz üzerinde bulunmayan iki köşeyi birleştiren doğru parçasıdır."),
    ("heading", "§ 23. Dikdörtgenler prizmasının hacmi"),
    ("text", "Şekil 175'teki a ve b cisimleri eş sayıda özdeş küpten oluşur. Bu cisimlerin hacimleri eşittir. c ve d dikdörtgenler prizmaları sırasıyla 18 ve 9 özdeş küpten oluşur. Dolayısıyla birincinin hacmi, ikincinin hacminin iki katıdır."),
    ("text", "Hacim kavramıyla günlük yaşamda da karşılaşırız: buzdolabının, su deposunun, sınıfın hacmi; gaz ve su sayaçlarının gösterdiği miktar gibi."),
]
RIGHT = [
    ("text", "Deneyimlerimiz, eş cisimlerin hacimlerinin eşit olduğunu gösterir. Örneğin özdeş varillerin hacimleri eşittir."),
    ("text", "Bir cisim parçalara bölünürse hacmi, parçaların hacimlerinin toplamına eşittir. Örneğin iki bölmeli bir buzdolabının hacmi, bölmelerinin hacimlerinin toplamıdır."),
    ("text", "Bu örnekler hacmin şu özelliklerini gösterir:"),
    ("rule", "1) Eş cisimlerin hacimleri eşittir."),
    ("rule", "2) Bir cismin hacmi, onu oluşturan parçaların hacimlerinin toplamıdır."),
    ("text", "Uzunluk ve alan ölçümünde olduğu gibi, hacmi ölçmek için de bir ölçü birimi seçilmelidir."),
    ("text", "Hacim birimi olarak ayrıtı birim uzunlukta olan bir küp seçilir. Böyle bir küpe birim küp denir."),
    ("text", "Ayrıtı 1 mm olan küpün hacmi bir milimetreküptür: 1 mm³."),
    ("text", "Ayrıtı 1 cm olan küpün hacmi bir santimetreküptür: 1 cm³."),
    ("text", "Ayrıtı 1 dm olan küpün hacmi bir desimetreküptür: 1 dm³."),
    ("text", "Sıvı ve gazların hacmini ölçerken 1 dm³, bir litre olarak adlandırılır. 1 L = 1 dm³."),
    ("text", "Ayrıtı 1 m olan küpün hacmi bir metreküptür: 1 m³. Ayrıtı 1 km olan küpün hacmi bir kilometreküptür: 1 km³."),
    ("rule", "Bir cismin hacmini ölçmek, içine kaç birim küp sığdığını belirlemektir."),
]


def wrapped(draw, value, font, width):
    line, lines = "", []
    for word in value.split():
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=font) > width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def make_page(width, height, paragraphs, number, figure=None):
    # Render onto gently varied paper without retaining any printed Russian text.
    page = Image.new("RGB", (width, height), "#f5f2e9")
    draw = ImageDraw.Draw(page)
    for y in range(height):
        tone = 246 - int(4 * abs(y / height - 0.5))
        draw.line((0, y, width, y), fill=(tone, tone - 3, tone - 10))
    y_start = 26
    if figure is not None:
        page.paste(figure, (28, 25))
        y_start = 25 + figure.height + 15
    # Fit the translated wording into the same physical page, never clip content.
    for size in range(19, 12, -1):
        normal = ImageFont.truetype(FONT, size)
        bold = ImageFont.truetype(BOLD, size)
        layout = []
        y = y_start
        for kind, value in paragraphs:
            font = bold if kind in ("heading", "rule") else normal
            if kind == "heading":
                y += 5
            lines = wrapped(draw, value, font, width - 58)
            layout.append((kind, lines, font, y))
            y += len(lines) * (size + 4) + (9 if kind == "heading" else 7)
        if y < height - 42:
            break
    else:
        raise ValueError("Translation does not fit page; adjust layout rather than clipping.")
    for kind, lines, font, y in layout:
        color = "#974b23" if kind == "heading" and lines[0].startswith("§") else "#302d28"
        for line in lines:
            draw.text((29, y), line, font=font, fill=color)
            y += size + 4
    draw.text((width / 2, height - 29), str(number), font=bold, anchor="mt", fill="#302d28")
    return page


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    original = Image.open(SOURCE / "textures/Textbook_baseColor.png").convert("RGB")
    upright = Image.open(ROOT / "3d-model/textbook-schoolboy-runaway-3ds.zip/textures/Textbook.png").convert("RGB")
    atlas = original.resize((2048, 2048), Image.Resampling.LANCZOS)
    figure = upright.crop((418, 652, 767, 747)).resize((698, 190), Image.Resampling.LANCZOS)
    fd = ImageDraw.Draw(figure)
    fd.rectangle((0, 0, 698, 27), fill="#f5f2e9")
    fd.text((349, 3), "Şekil 175", font=ImageFont.truetype(BOLD, 17), anchor="mt", fill="#302d28")
    fd.rectangle((3, 165, 695, 189), fill="#f5f2e9")
    for x, label in zip((86, 230, 398, 543, 650), "abcde"):
        fd.text((x, 167), label, font=ImageFont.truetype(FONT, 17), anchor="mt", fill="#302d28")
    left = make_page(812, 782, LEFT, 153)
    right = make_page(748, 782, RIGHT, 154, figure)
    # The glTF atlas uses vertically reversed islands; preserve the original UVs.
    atlas.paste(left.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, 0))
    atlas.paste(right.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (812, 0))
    texture = OUTPUT / "book-tr.png"
    atlas.save(texture, optimize=True)
    # A readable, upright preview also serves as the WebGL fallback.
    preview = Image.new("RGB", (1560, 782), "#f5f2e9")
    preview.paste(left, (0, 0))
    preview.paste(right, (812, 0))
    preview.save(OUTPUT / "book-pages-tr.webp", quality=90)

    gltf = json.loads((SOURCE / "scene.gltf").read_text(encoding="utf-8"))
    binary = (SOURCE / gltf["buffers"][0]["uri"]).read_bytes()
    binary += b"\0" * ((-len(binary)) % 4)
    png = texture.read_bytes()
    gltf["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(png)})
    gltf["images"] = [{"bufferView": len(gltf["bufferViews"]) - 1, "mimeType": "image/png"}]
    binary += png
    gltf["buffers"] = [{"byteLength": len(binary)}]
    gltf["asset"]["generator"] = "KazanımAI Turkish localization script"
    gltf["asset"]["extras"]["modifications"] = "Printed page text translated to Turkish; original geometry and illustrations retained."
    encoded = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((-len(encoded)) % 4)
    binary += b"\0" * ((-len(binary)) % 4)
    length = 12 + 8 + len(encoded) + 8 + len(binary)
    glb = struct.pack("<III", 0x46546C67, 2, length)
    glb += struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
    glb += struct.pack("<II", len(binary), 0x004E4942) + binary
    (OUTPUT / "book-tr.glb").write_bytes(glb)
    (OUTPUT / "translation-notes.md").write_text(
        "# Kitap Türkçeleştirme Notları\n\n"
        "Kaynak: fraservyse, textbook schoolboy runaway, CC-BY-4.0.\n"
        "https://sketchfab.com/3d-models/textbook-schoolboy-runaway-c2df23da0cd5451794546e4e51104b01\n\n"
        "Sayfa 153–154 üzerindeki tüm okunabilir metin Türkçeye çevrildi. "
        "Tekrar alıştırmaları 610–616, dört denklem, §23 hacim açıklaması ve hacim birimleri korundu. "
        "Şekil 175'in özgün çizimleri korundu; harf etiketleri a–e olarak yerelleştirildi. "
        "Belirsiz kaynak ifade saptanmadı. Cümleler Türkçe sayfa yerleşimine göre düzenlendi. "
        "Geometri ve UV verisi değiştirilmedi; eksik geometri dosyası saptanmadı.\n",
        encoding="utf-8",
    )
    print(f"Localized GLB: {length:,} bytes; texture: 2048×2048; original mesh preserved.")


if __name__ == "__main__":
    main()
