# Using and contributing to the LaStBeRu Strong Lensing compilation

**Goal:** leave with a sample for your own science question, and know how to contribute to the project.

## Before the course: set up the environment

### Standalone environment with uv

[uv](https://docs.astral.sh/uv/) is a fast Python package and project manager: it installs everything in seconds, downloads a suitable Python if needed, and pins the versions in `uv.lock`, so everyone gets the same environment.

#### 1. Install uv

**Linux and macOS**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

(or `brew install uv` on macOS with Homebrew; without `curl`, use `wget -qO- https://astral.sh/uv/install.sh | sh`)

**Windows** (PowerShell)

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

(or `winget install --id=astral-sh.uv -e`)

Open a new terminal and check the installation with `uv --version`.

#### 2. Create the environment

Same commands on all systems (on Windows, `git` comes with [Git for Windows](https://git-scm.com/download/win), or download the repository as a ZIP from GitHub):

```bash
git clone https://github.com/CosmoObs/slcomp.git
cd slcomp/notebooks/minicourse
uv sync
```

#### 3. Register the Jupyter kernel and start JupyterLab

```bash
uv run python -m ipykernel install --user --name lastberu --display-name "Python (LaStBeRu)"
uv run jupyter lab
```

The kernel appears as **Python (LaStBeRu)** in any Jupyter installation and in VS Code. `uv run` uses `.venv` without activating it (to activate: `source .venv/bin/activate` on Linux/macOS, `.venv\Scripts\activate` on Windows). To check the setup, run the first cells of `01_building_the_catalog.ipynb`.

<details>
<summary>Alternative: conda</summary>

Besides the Python packages, `environment.yml` installs the MinIO server and client and PostgreSQL. With [Miniforge](https://conda-forge.org/download/):

```bash
conda env create -f environment.yml
conda activate lastberu
python -m ipykernel install --user --name lastberu --display-name "Python (LaStBeRu)"
jupyter lab
```

</details>

To remove the kernel later: `jupyter kernelspec uninstall lastberu`.

## Notebooks

| # | Notebook | Content | Runs where |
|---|---|---|---|
| 1 | [`01_building_the_catalog.ipynb`](01_building_the_catalog.ipynb) | Following the Cosmic Horseshoe through the pipeline: extracting a literature table, merging records, cross-matching with SDSS and Legacy Surveys, cutouts | Anywhere |
| 2 | [`02_accessing_the_data.ipynb`](02_accessing_the_data.ipynb) | Where the data live (MinIO), the tables, and a selection for a science case with images | Anywhere |
| 3 | [`03_contributing.ipynb`](03_contributing.ipynb) | Adding a catalog, the git workflow, reporting corrections, finding bugs | Anywhere |
| 4 | [`04_relational_database.ipynb`](04_relational_database.ipynb) | The PostgreSQL model of the next release (records ↔ systems) | Demonstration on `che.cbpf.br` |

## Links

* Dashboard: <https://cosmoobs.github.io/slcomp>
* Public repository: <https://github.com/CosmoObs/slcomp>
* Development repository (private, ask for access): <https://github.com/CosmoObs/slcomp-dev>
* Article: [arXiv:2509.09798](https://arxiv.org/abs/2509.09798)
* SDSS SkyServer SQL Search: <https://skyserver.sdss.org/dr18/SearchTools/sql>
* Legacy Surveys sky viewer: <https://www.legacysurvey.org/viewer>
* Astro Data Lab XMatch: <https://datalab.noirlab.edu/xmatch.php>
