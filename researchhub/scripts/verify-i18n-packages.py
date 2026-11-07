"""Independent ZIP/XML QA of synthetic bilingual exports. Requires Python 3 + Node."""
import os
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "s": "http://www.w3.org/2000/svg"}


def archive(path):
    with ZipFile(path) as package:
        assert package.testzip() is None, f"CRC failure: {path.name}"
        # Parse every XML and relationship entry, not an undecoded ZIP substring.
        trees = {name: ET.fromstring(package.read(name))
                 for name in package.namelist() if name.endswith((".xml", ".rels"))}
        assert "[Content_Types].xml" in trees
        assert "_rels/.rels" in trees
        return trees


def cells(sheet):
    return [[cell.findtext("x:v", namespaces=NS) if cell.get("t") != "inlineStr"
             else cell.findtext("x:is/x:t", namespaces=NS)
             for cell in row.findall("x:c", NS)]
            for row in sheet.findall("x:sheetData/x:row", NS)]


with tempfile.TemporaryDirectory(prefix="researchhub-i18n-") as directory:
    env = dict(os.environ, SCHOLAR_I18N_QA_DIR=directory)
    subprocess.run(["node", "tests/i18n-statistics.cjs"], cwd=ROOT, env=env, check=True)
    packages = {}
    for locale, language, history_name, date_label in [
        ("pt-BR", "pt-BR", "Histórico recente", "Data"),
        ("es", "es-ES", "Historial reciente", "Fecha"),
    ]:
        base = Path(directory)
        xlsx = archive(base / f"{locale}-collection.xlsx")
        docx = archive(base / f"{locale}-results.docx")
        svg = ET.parse(base / f"{locale}-figure.svg").getroot()
        names = [sheet.get("name") for sheet in xlsx["xl/workbook.xml"].findall("x:sheets/x:sheet", NS)]
        assert len(names) == len(set(name.casefold() for name in names))
        assert all(name and len(name) <= 31 and not any(c in name for c in "[]:*?/\\") for name in names)
        history = xlsx[f"xl/worksheets/sheet{names.index(history_name) + 1}.xml"]
        assert cells(history)[0][0] == date_label
        collection_name = "Recolección" if locale == "es" else "Coleta"
        raw = cells(xlsx[f"xl/worksheets/sheet{names.index(collection_name) + 1}.xml"])
        assert raw[0][:3] == ["codigo_pesquisa", "situacao", "motivo_exclusao"]
        assert raw[1][:2] == ["P0", "included"]
        word_text = "\n".join(node.text or "" for node in docx["word/document.xml"].findall(".//w:t", NS))
        assert "Notas originais" in word_text
        assert "P0" not in word_text  # Aggregate report excludes participant codes.
        assert docx["word/styles.xml"].find(".//w:lang", NS).get(f"{{{NS['w']}}}val") == language
        svg_text = " ".join(svg.itertext())
        assert "Título original <script>" in svg_text
        assert not svg.findall(".//s:script", NS)
        numeric = [node.text for name, tree in xlsx.items() if name.startswith("xl/worksheets/")
                   for node in tree.findall(".//x:c/x:v", NS)]
        geometry = [(node.tag, tuple((key, node.get(key)) for key in ["x", "y", "width", "height", "d"]))
                    for node in svg.iter() if node.tag in {f"{{{NS['s']}}}rect", f"{{{NS['s']}}}path"}]
        packages[locale] = (numeric, raw, geometry)
    assert packages["pt-BR"] == packages["es"], "Locale changed numeric cells, raw data or chart geometry"
    print("PASS: six real XLSX/DOCX/SVG packages; ZIP CRC, XML, sheet names, Word language, original text, identical numeric cells/raw data/chart geometry.")
    print("Scope: file integrity and content only; no Office rendering, browser login or live AI validation.")
