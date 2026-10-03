"""Exercise the MinIO export with in-memory CSV/Parquet source objects."""

import io
import json
import os
from pathlib import Path
import runpy
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import pandas as pd


class PrepareDataTest(unittest.TestCase):
    def test_reference_expansion_and_processed_cutout_merge(self):
        fields = [
            "RA", "DEC", "theta_E", "theta_EErr", "z_L", "z_LErr",
            "velDisp", "velDispErr", "z_S", "z_SErr", "mag_u", "mag_uErr",
            "mag_uS", "mag_g", "mag_gErr", "mag_gS", "mag_r", "mag_rErr",
            "mag_rS", "mag_i", "mag_iErr", "mag_iS", "mag_z", "mag_zErr",
            "mag_zS", "mag_y", "mag_yErr", "mag_F814W", "mag_F814WErr",
            "mag_F814WS",
        ]
        rows = [
            dict.fromkeys(fields) | dict(
                JNAME="J0001", Reference="One", RA="10", DEC="-30",
                z_L="0.4", Grade="A",
            ),
            dict.fromkeys(fields) | dict(
                JNAME="J0002", Reference="Two § Three", RA="20 § 21",
                DEC="-30", z_L="0.5 § 0.6", Grade="B § C",
            ),
        ]
        common = dict(JNAME="J0001", survey="Legacy", cutout_size="20asec")

        def parquet(row):
            stream = io.BytesIO()
            pd.DataFrame([row]).to_parquet(stream, index=False)
            return stream.getvalue()

        objects = {
            "Data/Database.csv": pd.DataFrame(rows).to_csv(index=False).encode(),
            "Data/Consolidated_Data.csv": pd.DataFrame(rows[:1]).to_csv(index=False).encode(),
            "Cutouts/FITS.parquet": parquet(common | dict(
                file_name="J0001-image-r.fits", file_path="raw.fits",
                band="r", tile="x", is_rgb=False,
            )),
            "Cutouts/Processed_Cutouts.parquet": parquet(common | dict(
                file_name="J0001-image-r.png", file_path="image.png", processing="raw",
            )),
        }

        class FakeMinio:
            def __init__(self, *args, **kwargs):
                pass

            def get_object(self, bucket, key):
                return SimpleNamespace(data=objects[key])

        script = Path(__file__).resolve().parents[1] / "prepare_data.py"
        original_directory = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                with patch.dict("sys.modules", {"minio": SimpleNamespace(Minio=FakeMinio)}):
                    runpy.run_path(str(script), run_name="__main__")
                output = Path("public/data")
                data = json.loads((output / "database.json").read_text())
                self.assertEqual(len(data), 3)
                by_reference = {row["Reference"]: row for row in data}
                self.assertEqual(by_reference["Two"]["RA"], 20)
                self.assertEqual(by_reference["Three"]["RA"], 21)
                self.assertEqual(by_reference["Two"]["z_L"], 0.5)
                self.assertEqual(by_reference["Three"]["z_L"], 0.6)
                self.assertEqual(by_reference["One"]["RA"], "10")
                cutouts = json.loads((output / "cutouts.json").read_text())
                self.assertEqual(len(cutouts), 1)
                self.assertEqual(cutouts[0]["file_path"], "image.png")
                dictionary = json.loads((output / "dictionary.json").read_text())
                self.assertEqual(set(dictionary), {"All", "One", "Two", "Three"})
            finally:
                os.chdir(original_directory)


if __name__ == "__main__":
    unittest.main()
