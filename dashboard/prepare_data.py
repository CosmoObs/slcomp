import io
import json
import math
import os
import pathlib
from typing import Any

import numpy as np
import pandas as pd
from minio import Minio

MINIO_ENDPOINT_URL = os.getenv("MINIO_ENDPOINT_URL")
ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
SECRET_KEY = os.getenv("MINIO_SECRET_KEY")

client = Minio(
    MINIO_ENDPOINT_URL,
    access_key=ACCESS_KEY,
    secret_key=SECRET_KEY,
    secure=True,
)

# Data will be saved to public/data directory
DATA_PATH = "public/data"

# Create data directory if it doesn't exist
os.makedirs(DATA_PATH, exist_ok=True)

# Cutouts

cutouts_df_object = client.get_object(
    "slcomp", "Cutouts/Processed_Cutouts.parquet"
).data
cutouts_df = pd.read_parquet(io.BytesIO(cutouts_df_object))
cutouts_df = cutouts_df.query('cutout_size=="20asec"').reset_index(drop=True)
cutouts_df["file_strip"] = cutouts_df.file_name.apply(lambda x: pathlib.Path(x).stem)

cutouts_fits_object = client.get_object("slcomp", "Cutouts/FITS.parquet").data
cutouts_fits = pd.read_parquet(io.BytesIO(cutouts_fits_object))
cutouts_fits["file_strip"] = cutouts_fits.file_name.apply(
    lambda x: pathlib.Path(x).stem
)
cutouts_fits["file_strip"] = cutouts_fits["file_strip"].str.split(".fits").str[0]

cutouts = pd.merge(
    cutouts_fits,
    cutouts_df,
    on=["file_strip", "JNAME", "survey", "cutout_size"],
    how="outer",
)

cutouts = cutouts[
    [
        "JNAME",
        "survey",
        "cutout_size",
        "band",
        "tile",
        "is_rgb",
        "processing",
        "file_name_y",
        "file_path_y",
    ]
]
cutouts = cutouts.rename(
    columns={"file_path_y": "file_path", "file_name_y": "file_name"}
)

cutouts = cutouts[cutouts.file_path.notnull()].reset_index(drop=True)

idxs = cutouts[~cutouts.band.notnull()].index
cutouts.loc[idxs, "band"] = cutouts.loc[idxs, "processing"]

cutouts.band = pd.Categorical(
    cutouts.band, categories=["u", "g", "r", "i", "z", "y", "trilogy", "lsb"]
)

cutouts = cutouts.drop(columns=["cutout_size", "tile", "file_name"]).reset_index(
    drop=True
)

cutouts.convert_dtypes().to_json(DATA_PATH + "/cutouts.json", orient="records")

# Consilidated Database

database_consolidated_df_object = client.get_object(
    "slcomp", "Data/Consolidated_Data.csv"
).data
database_consolidated_df = pd.read_csv(
    io.StringIO(database_consolidated_df_object.decode("utf-8")),
    low_memory=False,
    dtype=object,
).convert_dtypes()

database_consolidated_df[
    [
        "RA",
        "DEC",
        "theta_E",
        "theta_EErr",
        "z_L",
        "z_LErr",
        "velDisp",
        "velDispErr",
        "z_S",
        "z_SErr",
        "mag_u",
        "mag_uErr",
        "mag_uS",
        "mag_g",
        "mag_gErr",
        "mag_gS",
        "mag_r",
        "mag_rErr",
        "mag_rS",
        "mag_i",
        "mag_iErr",
        "mag_iS",
        "mag_z",
        "mag_zErr",
        "mag_zS",
        "mag_y",
        "mag_yErr",
        "mag_F814W",
        "mag_F814WErr",
        "mag_F814WS",
    ]
] = database_consolidated_df[
    [
        "RA",
        "DEC",
        "theta_E",
        "theta_EErr",
        "z_L",
        "z_LErr",
        "velDisp",
        "velDispErr",
        "z_S",
        "z_SErr",
        "mag_u",
        "mag_uErr",
        "mag_uS",
        "mag_g",
        "mag_gErr",
        "mag_gS",
        "mag_r",
        "mag_rErr",
        "mag_rS",
        "mag_i",
        "mag_iErr",
        "mag_iS",
        "mag_z",
        "mag_zErr",
        "mag_zS",
        "mag_y",
        "mag_yErr",
        "mag_F814W",
        "mag_F814WErr",
        "mag_F814WS",
    ]
].astype(float)

database_consolidated_df.to_json(
    DATA_PATH + "/consolidated_database.json", orient="records"
)

# Database

database_df_object = client.get_object("slcomp", "Data/Database.csv").data
database_df = pd.read_csv(
    io.StringIO(database_df_object.decode("utf-8")), low_memory=False, dtype=object
)

dictionary = {}
dictionary["All"] = {"JNAME": database_df.JNAME.values}

for ref in np.unique(np.hstack(database_df.Reference.str.split(" § "))):
    jnames = database_df[
        database_df.Reference.str.contains(ref, regex=False)
    ].JNAME.values
    dictionary[ref] = {"JNAME": jnames}


def to_serializable(obj: Any):
    if isinstance(obj, np.ndarray):
        return [to_serializable(x) for x in obj.tolist()]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, dict):
        return {str(k): to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [to_serializable(v) for v in obj]
    return obj


converted = to_serializable(dictionary)

out_path = pathlib.Path(DATA_PATH + "/dictionary.json")
with out_path.open("w", encoding="utf-8") as f:
    json.dump(converted, f, ensure_ascii=False, indent=2)

database_df["multiple"] = database_df["Reference"].apply(
    lambda x: True if "§" in x else False
)

single_entry = database_df.query("multiple == False").reset_index(drop=True)
single_entry = single_entry.drop(columns=["multiple"])


def get_proper_values_scalar(item):
    """
    Processes a single item from a DataFrame cell.
    If the item contains multiple values separated by " § ", it splits them into a list.
    Otherwise, it returns the item as a string (or NaN if it's NaN).
    This is used to handle fields where multiple references or values
    for a single object are concatenated in the raw CSV.
    """
    if pd.isna(item):
        return item

    value = str(item)

    if " § " in value:
        return value.split(" § ")
    else:
        return value


multiple_entry = database_df.query("multiple == True").reset_index(drop=True)

for key in multiple_entry.keys():
    multiple_entry[key] = multiple_entry[key].apply(get_proper_values_scalar)

values = []
for key in multiple_entry:
    try:
        multiple_entry[key].unique()
    except:
        values.append(key)

df_new = pd.DataFrame()
for jname in multiple_entry.JNAME:
    entry = multiple_entry[multiple_entry.JNAME == jname].reset_index(drop=True)
    reference = len(entry.Reference[0])
    for column in values:
        if bool(pd.isna(entry[column])[0]):
            entry.loc[0, column] = np.repeat(np.nan, reference)
    df_new = pd.concat([df_new, entry], axis=0).reset_index(drop=True)

df_new = df_new.drop(columns=["multiple"])

multiple_entry_new = df_new.explode(column=values)

multiple_entry_new = multiple_entry_new.reset_index(drop=True).convert_dtypes()

multiple_entry_new[
    [
        "RA",
        "DEC",
        "theta_E",
        "theta_EErr",
        "z_L",
        "z_LErr",
        "velDisp",
        "velDispErr",
        "z_S",
        "z_SErr",
        "mag_u",
        "mag_uErr",
        "mag_uS",
        "mag_g",
        "mag_gErr",
        "mag_gS",
        "mag_r",
        "mag_rErr",
        "mag_rS",
        "mag_i",
        "mag_iErr",
        "mag_iS",
        "mag_z",
        "mag_zErr",
        "mag_zS",
        "mag_y",
        "mag_yErr",
        "mag_F814W",
        "mag_F814WErr",
        "mag_F814WS",
    ]
] = multiple_entry_new[
    [
        "RA",
        "DEC",
        "theta_E",
        "theta_EErr",
        "z_L",
        "z_LErr",
        "velDisp",
        "velDispErr",
        "z_S",
        "z_SErr",
        "mag_u",
        "mag_uErr",
        "mag_uS",
        "mag_g",
        "mag_gErr",
        "mag_gS",
        "mag_r",
        "mag_rErr",
        "mag_rS",
        "mag_i",
        "mag_iErr",
        "mag_iS",
        "mag_z",
        "mag_zErr",
        "mag_zS",
        "mag_y",
        "mag_yErr",
        "mag_F814W",
        "mag_F814WErr",
        "mag_F814WS",
    ]
].astype(float)

full_data = pd.concat([multiple_entry_new, single_entry], axis=0).reset_index(drop=True)

full_data = full_data.replace(np.nan, pd.NA).replace("nan", pd.NA)

full_data.to_json(DATA_PATH + "/database.json", orient="records")
