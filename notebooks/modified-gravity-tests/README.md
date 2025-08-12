# Test General Relativity using Strong Lenses

For more information, please check `slcomp` reference paper. In this folder, you'll will find notebooks on how we prepared the data from literature and combine them with data from `LaStBeRu_cosmo_ground` data.

## `01_LaStBeRu_cosmo_ground.csv`

Data obtained exclusively from `slcomp` and matched with SDSS DR17, with visually inspected images from ground. We show below the description for each column in this csv file:

- `JNAME`: object identifier
- `RA`: right ascention [$^\circ$]
- `DEC`: declination [$^\circ$]
- `System_Type`: system type (`slcomp` reference paper)
- `Lens_Type`: lens type
- `Source_Type`: source type
- `theta_E`: Einstein radius [$^{\prime\prime}$]
- `theta_E_rad`: Einstein radius [$\mathrm{rad}$]
- `theta_EErr`: Einstein radius error [$^{\prime\prime}$]
- `theta_EMethod`: method used to obtain Einstein radius
- `theta_ERef`: where the data came from
- `z_L`: lens redshift
- `z_LErr`: lens redshift error
- `z_LType`: lens redshift type
- `z_LRef`: where the data came from
- `z_S`: source redshift
- `z_SErr`: source redshift error
- `z_SType`: source redshift type
- `z_SRef`: where the data came from
- `velDisp`: velocity dispersion [$\mathrm{km/s}$]
- `velDispErr`: velocity dispersion error [$\mathrm{km/s}$]
- `velDispRef`: where the data came from
- `mag_u`: lens magnitude in u-band
- `mag_uErr`: lens magnitude error in u-band
- `mag_uRef`: where the data came from
- `mag_uS`: source magnitude in u-band
- `mag_uSRef`: where the data came from
- `mag_g`: lens magnitude in g-band
- `mag_gErr`: lens magnitude error in g-band
- `mag_gRef`: where the data came from
- `mag_gS`: source magnitude in g-band
- `mag_gSRef`: where the data came from
- `mag_r`: lens magnitude in r-band
- `mag_rErr`: lens magnitude error in r-band
- `mag_rRef`: where the data came from
- `mag_rS`: source magnitude in r-band
- `mag_rSRef`: where the data came from
- `mag_i`: lens magnitude in i-band
- `mag_iErr`: lens magnitude error in i-band
- `mag_iRef`: where the data came from
- `mag_iS`: source magnitude in i-band
- `mag_iSRef`: where the data came from
- `mag_z`: lens magnitude in z-band
- `mag_zErr`: lens magnitude error in z-band
- `mag_zRef`: where the data came from
- `mag_zS`: source magnitude in z-band
- `mag_zSRef`: where the data came from
- `mag_F814W`: lens magnitude in f814w filter
- `mag_F814WErr`: lens magnitude error in f814w filter
- `mag_F814WRef`: where the data came from
- `fiberid`: fiber identification from SDSS
- `mjd`: modified julian date from SDSS
- `plate`: plate used in the observation
- `theta_ap`: aparent aperture size [$^{\prime\prime}$]
- `theta_ap_rad`: aparent aperture size [$\mathrm{rad}$]
- `seeing20`: observational seeing from SDSS [$^{\prime\prime}$]
- `seeing20_rad`: observational seeing from SDSS [$\mathrm{rad}$]
- `seeing50`: observational seeing from SDSS [$^{\prime\prime}$]
- `seeing50_rad`: observational seeing from SDSS [$\mathrm{rad}$]
- `seeing80`: observational seeing from SDSS [$^{\prime\prime}$]
- `seeing80_rad`: observational seeing from SDSS [$\mathrm{rad}$]
- `devrad_r`: de Vaucouleurs radius in r-band [$^{\prime\prime}$]
- `exprad_r`: exponential radius in r-band [$^{\prime\prime}$]
- `petror50_r`: petrosian radius at half-light in r-band [$^{\prime\prime}$]
- `devrad_r_rad`: de Vaucouleurs radius in r-band [$\mathrm{rad}$]
- `exprad_r_rad`: exponential radius in r-band [$\mathrm{rad}$]
- `petror50_r_rad`: petrosian radius at half-light in r-band [$\mathrm{rad}$]
- `velDisp0_dev`: corrected velocity dispersion assuming de Vaucouleurs effective radius [$\mathrm{km/s}$]
- `velDisp0Err_dev`: corrected velocity dispersion error assuming de Vaucouleurs effective radius [$\mathrm{km/s}$]
- `velDisp0_exp`: corrected velocity dispersion assuming exponential effective radius [$\mathrm{km/s}$]
- `velDisp0Err_exp`: corrected velocity dispersion error assuming exponential effective radius [$\mathrm{km/s}$]
- `velDisp0_petro`: corrected velocity dispersion assuming petrosian effective radius [$\mathrm{km/s}$]
- `velDisp0Err_petro`: corrected velocity dispersion error assuming petrosian effective radius [$\mathrm{km/s}$]

## `03_Cao_et_al._(2015)_Data.csv`

Modified data from [Cao et al. (2015)](https://iopscience.iop.org/article/10.1088/0004-637X/806/2/185). We added/modified the following columns:

- `JNAME`: identifier used in `slcomp`
- `in_cao_2017`: flag to indificate if the data was used in [Cao et al. (2017)](https://iopscience.iop.org/article/10.3847/1538-4357/835/1/92). `True` means they used this system data
- `in_lastberu_cosmo_ground`: system also found in `LaStBeRu_cosmo_ground` data
- `Cao_velDisp0`: corrected velocity dispersion using expression from [Chen et al. (2019)](https://doi.org/10.1093/mnras/stz1902). The different between the data from this paper was only the index, and we followed the latest work
- `Cao_velDisp0Err`: corrected velocity dispersion error using Eq. (20) from [Chen et al. (2019)](https://doi.org/10.1093/mnras/stz1902)
- `Cao_Seeing_atm`: observational seeing from [Cao et al. (2016)](https://doi.org/10.1093/mnras/stw932)
- `*_rad`: columns with converted values to radians

## `03_Chen_et_al._(2019)_Data.csv`

Modified data from [Chen et al. (2019)](https://doi.org/10.1093/mnras/stz1902). We added/modified the following columns:

- `JNAME`: identifier used in `slcomp`
- `in_liu_2022`: flat to indicate ifthe data was used in [Liu et al. (2022)](https://iopscience.iop.org/article/10.3847/1538-4357/ac4c3b)
- `in_lastberu_cosmo_ground`: system also found in `LaStBeRu_cosmo_ground` data
- `Chen_velDisp0`: corrected velocity dispersion using expression from [Chen et al. (2019)](https://doi.org/10.1093/mnras/stz1902).
- `Chen_velDisp0Err`: corrected velocity dispersion error using Eq. (20) from [Chen et al. (2019)](https://doi.org/10.1093/mnras/stz1902)
- `Chen_Seeing_atm`: observational seeing from [Cao et al. (2016)](https://doi.org/10.1093/mnras/stw932)
- `*_rad`: columns with converted values to radians

## `05_Combined_Data.csv`

Combination of all systems used in the previous dataframes we presented assuming the following priority:

1. `LaStBeRu_cosmo_ground`
2. `Chen et al. (2019)`
3. `Cao et al. (2015)`

The image bellow shows the intersection between all three datasets:

![combination](./graphics/venn.png "Combined Data")

- `JNAME`: object identifier
- `Original_ID`: object identifier (from source)
- `z_L`: lens redshift
- `z_S`: source redshift
- `velDisp`: velocity dispersion [$\mathrm{km/s}$]
- `velDispErr`: velocity dispersion error [$\mathrm{km/s}$]
- `velDisp0`: corrected velocity dispersion [$\mathrm{km/s}$]
- `velDisp0Err`: corrected velocity dispersion error [$\mathrm{km/s}$]
- `theta_E`: Einstein radius [$^{\prime\prime}$]
- `theta_ap`: aparent aperture size [$^{\prime\prime}$]
- `theta_Eff`: effective radius
- `Seeing`: observational seeing
- `*_rad`: columns with converted values to radians
- `Reference`: where this data came from
- `in_cao_2015`: data from [Cao et al. (2015)](https://iopscience.iop.org/article/10.1088/0004-637X/806/2/185)
- `in_cao_2017`: data used in [Cao et al. (2017)](https://iopscience.iop.org/article/10.3847/1538-4357/835/1/92)
- `in_chen_2019`: data from [Chen et al. (2019)](https://doi.org/10.1093/mnras/stz1902)
- `in_liu_2022`: data used in [Liu et al. (2022)](https://iopscience.iop.org/article/10.3847/1538-4357/ac4c3b)
- `in_lastberu_cosmo_ground`: data in `LaStBeRu_cosmo_ground`