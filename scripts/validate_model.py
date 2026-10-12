"""Validate the delivered GLB, including geometry equality to the source."""
from pathlib import Path
import io
import json
import struct
from PIL import Image

root = Path(__file__).resolve().parents[1]
raw = (root / "public/models/book-tr.glb").read_bytes()
magic, version, length = struct.unpack_from("<III", raw)
assert magic == 0x46546C67 and version == 2 and length == len(raw)
size, kind = struct.unpack_from("<II", raw, 12)
assert kind == 0x4E4F534A and size % 4 == 0
gltf = json.loads(raw[20:20 + size])
bin_size, bin_kind = struct.unpack_from("<II", raw, 20 + size)
assert bin_kind == 0x004E4942
binary = raw[28 + size:]
assert len(binary) == bin_size
assert len(binary) - gltf["buffers"][0]["byteLength"] in range(4)
source = root / "3d-model/textbook_schoolboy_runaway-gltf.zip"
original = (source / "scene.bin").read_bytes()
assert binary[:len(original)] == original, "Original geometry changed"
for view in gltf["bufferViews"]:
    assert view.get("byteOffset", 0) + view["byteLength"] <= len(binary)
for acc in gltf["accessors"]:
    view = gltf["bufferViews"][acc["bufferView"]]
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[acc["type"]]
    stride = view.get("byteStride", components * 4)
    assert acc.get("byteOffset", 0) + (acc["count"] - 1) * stride + components * 4 <= view["byteLength"]
index_acc = gltf["accessors"][3]
view = gltf["bufferViews"][index_acc["bufferView"]]
indices = struct.unpack_from("<" + "I" * index_acc["count"], binary, view.get("byteOffset", 0))
assert max(indices) < gltf["accessors"][0]["count"]
image_view = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
start = image_view["byteOffset"]
with Image.open(io.BytesIO(binary[start:start + image_view["byteLength"]])) as image:
    assert image.size == (2048, 2048)
    image.verify()
assert gltf["asset"]["extras"]["license"].startswith("CC-BY-4.0")
print(f"PASS: GLB structure, embedded PNG, {len(indices)//3} triangles, indices, original geometry and attribution.")
