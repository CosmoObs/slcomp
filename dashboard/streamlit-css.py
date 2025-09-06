import base64
import re
import os

import numpy as np
import pandas as pd
from minio import Minio

import streamlit as st

# --- MinIO Configuration ---
MINIO_ENDPOINT_URL = "nonarithmetically-undeliberating-janelle.ngrok-free.app"
BUCKET_NAME = "slcomp"
ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
if not ACCESS_KEY or not SECRET_KEY:
    st.error("MinIO credentials not found in environment variables!")
    st.stop()

# --- Page Settings ---
st.set_page_config(page_title="Strong Lensing Database", page_icon="🔭", layout="wide")

# --- Attempt MinIO Connection ---
try:
    client = Minio(
        MINIO_ENDPOINT_URL,
        access_key=ACCESS_KEY,
        secret_key=SECRET_KEY,
        secure=True,
    )
    client.list_buckets()
    minio_available = True
    # st.sidebar.success("MinIO connection successful!") # User commented this out
except Exception as e:
    st.sidebar.error(f"MinIO connection failed: {e}")
    minio_available = False
    client = None


# --- Custom CSS ---
st.markdown(
    """
    <style>
    .streamlit-expanderHeader {
        font-size: x-large;
    }
    /* This class was in your original code, presumably for markdown table horizontal scroll */
    .e1tzin5v3{
        overflow-x: auto;
        overflow-y: hidden;
        white-space: nowrap;
        padding-bottom: 17px;
    }
    .logo-container {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 10px;
    }
    .logo-container img {
        width: 25%;
        min-width: 150px;
        max-width: 300px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# --- Data Loading Functions ---
@st.cache_data
def load_data():
    try:
        database_df = pd.read_pickle("./dashboard/data/database_df.pickle")
        database_consolidated_df = pd.read_parquet(
            "./dashboard/data/database_consolidated_df.parquet"
        )
        dictionary_data = np.load("./dashboard/data/dictionary.npy", allow_pickle=True).item()
        cutouts_df = pd.read_parquet("./dashboard/data/cutouts.parquet")
        return database_df, database_consolidated_df, dictionary_data, cutouts_df
    except FileNotFoundError as e:
        st.error(
            f"Error loading data file: {e}. Please ensure data files are in the './dashboard/data/' directory."
        )
        return pd.DataFrame(), pd.DataFrame(), {}, pd.DataFrame()


database_df, database_consolidated_df, dictionary, cutouts_df = load_data()
values_available = list(dictionary.keys())


# --- Main Page ---
st.title("🔭 LaStBeRu Database Explorer")


# --- Sidebar for Selections ---
st.sidebar.markdown(
    """
    <div style="text-align: center; padding: 10px 0 20px 0;"> <img src='https://lh3.googleusercontent.com/d/1zUyApLRerT1kIdOCEE8EKeeCQEo9JFfy?authuser=0' alt='slcomp sidebar logo' style='width:100%; height:auto; border-radius: 8px;'>
    </div>
    """,
    unsafe_allow_html=True,
)
st.sidebar.header("Object Selector")
st.sidebar.caption("Select a reference catalog and then the specific object JNAME.")

select_object_Reference = st.sidebar.selectbox(
    "Reference Catalog:",
    values_available,
    index=0 if values_available else -1,
    help="Choose the survey or catalog the object belongs to.",
)

jname_options = []
if select_object_Reference and select_object_Reference in dictionary:
    options_from_dict = dictionary[str(select_object_Reference)].get("JNAME", [])
    if isinstance(options_from_dict, (np.ndarray, pd.Series)):
        jname_options = options_from_dict.tolist()
    elif isinstance(options_from_dict, list):
        jname_options = options_from_dict
    else:
        jname_options = []

select_object_ID = st.sidebar.selectbox(
    "Object JNAME:",
    jname_options,
    index=0 if jname_options else -1,
    help="Choose the unique identifier for the lensing system.",
)

if select_object_ID:
    st.sidebar.markdown("---")
    st.sidebar.markdown(f"**Displaying details for:** `{str(select_object_ID)}`")

if not values_available:
    st.sidebar.warning("No reference catalogs found in the data dictionary.")
elif len(jname_options) == 0 and select_object_Reference:
    st.sidebar.warning(
        f"No JNAMEs available for the selected reference: {select_object_Reference}"
    )


# --- Helper function for data cleaning before converting to Markdown ---
def aux_for_markdown(x):
    if isinstance(x, (list, np.ndarray, pd.Series)):
        if len(x) == 0:
            return pd.NA
        return ", ".join([str(elem).replace("nan", "-") for elem in x])
    return x


# --- Function to get data for a single object ---
@st.cache_data
def get_df(jname):
    if jname is None:
        return pd.DataFrame(), pd.DataFrame()

    db_df_single = database_df[database_df["JNAME"] == jname].copy()
    if not db_df_single.empty:
        db_df_single = db_df_single.replace("nan", pd.NA)
        db_df_single = db_df_single.applymap(aux_for_markdown)
        db_df_single = db_df_single.dropna(how="all", axis=1).reset_index(drop=True)

    cons_df_single = database_consolidated_df[
        database_consolidated_df["JNAME"] == jname
    ].copy()
    if not cons_df_single.empty:
        cons_df_single = cons_df_single.replace("nan", pd.NA)
        cons_df_single = cons_df_single.applymap(aux_for_markdown)
        cons_df_single = cons_df_single.dropna(how="all", axis=1).reset_index(drop=True)

    return db_df_single, cons_df_single


# --- Function to load image from MinIO ---
@st.cache_data
def load_image_from_minio(bucket_name, object_name):
    if not minio_available or client is None:
        return None
    try:
        response = client.get_object(bucket_name, "Cutouts/" + object_name)
        image_data = response.read()
        return image_data
    except Exception:
        return None
    finally:
        if "response" in locals() and response:
            response.close()
            response.release_conn()


# --- Helper function to sanitize names for CSS classes ---
def sanitize_for_css(name):
    name = str(name).lower()
    name = re.sub(r"\s+", "_", name)  # Replace spaces with underscores
    name = re.sub(r"[^a-z0-9_-]", "", name)  # Remove other special characters
    return name


# --- Display Data and Cutouts for Selected Object ---
if select_object_ID:
    jname = str(select_object_ID)
    st.markdown("""---""")

    with st.spinner(f"Fetching data for {jname}..."):
        database_df_single, consolidated_data_single = get_df(jname)

    tab_full_data, tab_consolidated, tab_cutouts_display = st.tabs(
        ["Full Dataset Record", "Consolidated Parameters", "Image Cutouts"]
    )

    with tab_full_data:
        st.subheader("Complete Original Data Entries")
        if not database_df_single.empty:
            markdown_output = database_df_single.fillna("-").to_markdown(index=False)
            st.markdown(markdown_output, unsafe_allow_html=True)
        else:
            st.info(f"No detailed data entries found for JNAME: {jname}")

    with tab_consolidated:
        st.subheader("Key Consolidated Parameters Table")
        if not consolidated_data_single.empty:
            markdown_output = consolidated_data_single.fillna("-").to_markdown(
                index=False
            )
            st.markdown(markdown_output, unsafe_allow_html=True)
        else:
            st.info(f"No consolidated data parameters found for JNAME: {jname}")

    with tab_cutouts_display:
        st.subheader("Observational Cutouts")
        if not minio_available:
            st.warning("MinIO connection is unavailable. Cutouts cannot be displayed.")
        else:
            Cutouts_df_filtered = (
                cutouts_df.query(f'JNAME == "{jname}"')
                .sort_values(by=["survey", "band"])
                .reset_index(drop=True)
            )

            if not Cutouts_df_filtered.empty:
                surveys = sorted(Cutouts_df_filtered.survey.unique())
                fixed_grid_columns = 5

                for survey_idx, survey in enumerate(surveys):
                    with st.expander(f"Survey: {survey}", expanded=True):
                        with st.spinner(f"Generating image grid for {survey}..."):
                            cutout_survey_df = Cutouts_df_filtered.query(
                                f'survey == "{survey}"'
                            )

                            if not cutout_survey_df.empty:
                                sanitized_survey_name = (
                                    sanitize_for_css(survey) + f"_{survey_idx}"
                                )
                                grid_class = f"image-grid-{sanitized_survey_name}"

                                grid_css = f"""
                                <style>
                                .{grid_class} {{
                                    display: grid;
                                    grid-template-columns: repeat({fixed_grid_columns}, minmax(100px, 1fr));
                                    gap: 15px;
                                    padding: 10px 0;
                                }}
                                .{grid_class} .image-item {{
                                    text-align: center;
                                    border: 1px solid #333;
                                    border-radius: 4px;
                                    padding: 8px;
                                    background-color: rgba(85, 85, 85, 0.1);
                                    box-shadow: 2px 2px 5px rgba(0,0,0,1);
                                    display: flex;
                                    flex-direction: column;
                                    justify-content: space-between;
                                }}
                                .{grid_class} .image-item img {{
                                    max-width: 100%;
                                    height: auto;
                                    max-height: 180px;
                                    object-fit: contain;
                                    margin-bottom: 8px;
                                    border-radius: 2px;
                                }}
                                .{grid_class} .image-item p.caption {{
                                    font-size: 0.8em;
                                    margin: 0;
                                    line-height: 1.2;
                                    word-wrap: break-word;
                                    color: #ccc;
                                }}
                                </style>
                                """
                                st.markdown(grid_css, unsafe_allow_html=True)

                                html_items = []
                                for _idx, row_cutout in cutout_survey_df.iterrows():
                                    band = row_cutout.band
                                    object_key = row_cutout.file_path
                                    image_bytes = load_image_from_minio(
                                        BUCKET_NAME, object_key
                                    )

                                    item_html = "<div class='image-item'>"
                                    if image_bytes:
                                        b64_image = base64.b64encode(
                                            image_bytes
                                        ).decode()
                                        item_html += f'<img src="data:image/png;base64,{b64_image}" alt="{survey} - {band}">'
                                        item_html += (
                                            f'<p class="caption">{survey} - {band}</p>'
                                        )
                                    elif minio_available:
                                        item_html += (
                                            f'<p class="caption">{band}: Not found</p>'
                                        )
                                    else:
                                        item_html += f'<p class="caption">{band}: MinIO unavailable</p>'
                                    item_html += "</div>"
                                    html_items.append(item_html)

                                if html_items:
                                    st.markdown(
                                        f"<div class='{grid_class}'>{''.join(html_items)}</div>",
                                        unsafe_allow_html=True,
                                    )
                                else:
                                    st.write(
                                        f"No images processed for survey: {survey}"
                                    )
                            else:
                                st.write(f"No images to display for survey: {survey}")
            else:
                st.info(
                    "No cutout records found for this object in the configured surveys."
                )
else:
    st.markdown("""---""")
    st.info(
        "✨ Welcome! Please select a Reference Catalog and Object JNAME from the sidebar to explore strong lensing systems."
    )
    st.markdown(
        "Use the options on the left to load and view data for specific gravitational lenses."
    )
