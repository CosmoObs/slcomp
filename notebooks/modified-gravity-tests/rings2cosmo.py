import emcee
import numpy as np
import scipy as sp

from scipy.optimize import minimize
from astropy import constants as const
from astropy import units as u
from astropy.cosmology import FlatLambdaCDM
from multiprocessing import Pool

# Cosmology used:
# From Wikipedia (https://en.wikipedia.org/wiki/Lambda-CDM_model)
cosmo = FlatLambdaCDM(H0=67.74, Om0=0.3089)

# Physical constants:
c = (const.c).to(u.km / u.second)
clight = c.value


def ratio_gamma(x):
    """Eq. (15) from arXiv:0907.4992v2

    Args:
        x (float): parameter

    Returns:
        float: ratio of gamma funcions.
    """
    return sp.special.gamma((x - 1) / 2) / sp.special.gamma(x / 2)


def vel(z_S, z_L, theta_E, seeing_atm, theta_ap, alpha, beta, delta, gamma):
    """Eq. (23) from arXiv:0907.4992v2

    Args:
        z_S (float): source redshift
        z_L (float): lens redshift
        theta_E (float): Einstein radius (in radians)
        seeing_atm (float): Atmospheric seeing (in radians)
        theta_ap (float): Aperture size (in radians)
        alpha (float): power-law matter density profile index
        beta (float): anisotropy parameter
        delta (float): luminosity density profile index
        gamma (float): splip parameter


    Returns:
        float: analytic model for velocity dispersion.
    """

    # Angular diameter distances:
    DS = cosmo.angular_diameter_distance(z_S)
    DL = cosmo.angular_diameter_distance(z_L)
    DLS = cosmo.angular_diameter_distance_z1z2(z_L, z_S)

    # \chi
    chi = theta_ap / seeing_atm

    # \chi^tilde
    tilde_sigma = seeing_atm * np.sqrt(1 + (chi**2) / 4 + (chi**4) / 40)  # Eq. (20)

    ksi = delta + alpha - 2

    term_1 = (2 / (1 + gamma)) * (clight**2 / 4) * (DS / DLS) * theta_E
    term_2 = (2 / np.sqrt(np.pi)) * (
        (2 * ((tilde_sigma / theta_E) ** 2)) ** (1 - alpha / 2) / (ksi - 2 * beta)
    )
    term_3 = (ratio_gamma(ksi) - beta * ratio_gamma(ksi + 2)) / (
        ratio_gamma(alpha) * ratio_gamma(delta)
    )
    term_4 = sp.special.gamma((3 - ksi) / 2) / sp.special.gamma((3 - delta) / 2)

    sigma_star = term_1 * term_2 * term_3 * term_4

    return np.sqrt(np.abs(sigma_star))


# Goodness of fit of a statistical model


def log_likelihood(theta, z_S, z_L, velDisp, velDispErr, theta_E, seeing_atm, theta_ap):
    """log(Eq. (25)) from arXiv:0907.4992v2

    Args:
        theta (list): list of parameters [alpha, beta, delta, gamma]
        z_S (float): source redshift
        z_L (float): lens redshift
        velDisp (float): velocity dispersion
        velDispErr (float): velocity dispersion error (std. dev.)
        theta_E (float): Einstein radius (in radians)
        seeing_atm (float): Atmospheric seeing (in radians)
        theta_ap (float): Aperture size (in radians)

    Returns:
        float: Log-likehood function given model for velocity dispersion and the one measured.
    """
    alpha, beta, delta, gamma = theta
    model = vel(z_S, z_L, theta_E, seeing_atm, theta_ap, alpha, beta, delta, gamma)
    return -0.5 * np.sum(
        (velDisp - model) ** 2 / (velDispErr**2) + np.log(2 * np.pi * velDispErr**2)
    )


def log_prior(theta, alpha_0, eps_alpha_0, beta_0, eps_beta_0, delta_0, eps_delta_0):
    """Gaussian priors

    Args:
        theta (list): list of parameters [alpha, beta, delta, gamma]
        alpha_0 (float): expected value for alpha
        eps_alpha_0 (float): variance of alpha
        beta_0 (float): expected value for beta
        eps_beta_0 (float): variance of beta
        delta_0 (float): expected value for delta
        eps_delta_0 (float): variance of delta

    Returns:
        float: Sum of log of priors for alpha, beta, and delta.
    """
    alpha, beta, delta, gamma = theta
    n_sigma = 200
    if (
        (
            alpha_0[0] - n_sigma * eps_alpha_0[0]
            < alpha
            < alpha_0[0] + n_sigma * eps_alpha_0[0]
        )
        and (
            beta_0[0] - n_sigma * eps_beta_0[0]
            < beta
            < beta_0[0] + n_sigma * eps_beta_0[0]
        )
        and (
            delta_0[0] - n_sigma * eps_delta_0[0]
            < delta
            < delta_0[0] + n_sigma * eps_delta_0[0]
        )
    ):
        log_prior_alpha = -0.5 * np.sum(
            (alpha - alpha_0) ** 2 / eps_alpha_0**2
            + np.log(2 * np.pi * eps_alpha_0**2)
        )
        log_prior_beta = -0.5 * np.sum(
            (beta - beta_0) ** 2 / eps_beta_0**2 + np.log(2 * np.pi * eps_beta_0**2)
        )
        log_prior_delta = -0.5 * np.sum(
            (delta - delta_0) ** 2 / eps_delta_0**2
            + np.log(2 * np.pi * eps_delta_0**2)
        )
        return log_prior_alpha + log_prior_beta + log_prior_delta
    else:
        return -np.inf


def log_probability(
    theta,
    z_S,
    z_L,
    velDisp,
    velDispErr,
    theta_E,
    seeing_atm,
    theta_ap,
    alpha_0,
    eps_alpha_0,
    beta_0,
    eps_beta_0,
    delta_0,
    eps_delta_0,
):
    """Log of probability of interest

    Args:
        theta (list): list of parameters [alpha, beta, delta, gamma]
        z_S (float): source redshift
        z_L (float): lens redshift
        velDisp (float): velocity dispersion
        velDispErr (float): velocity dispersion error (std. dev.)
        theta_E (float): Einstein radius (in radians)
        seeing_atm (float): Atmospheric seeing (in radians)
        theta_ap (float): Aperture size (in radians)
        alpha_0 (float): expected value for alpha
        eps_alpha_0 (float): variance of alpha
        beta_0 (float): expected value for beta
        eps_beta_0 (float): variance of beta
        delta_0 (float): expected value for delta
        eps_delta_0 (float): variance of delta

    Returns:
        float: Eq. (27) from arXiv:0907.4992v2
    """
    lp = log_prior(
        theta, alpha_0, eps_alpha_0, beta_0, eps_beta_0, delta_0, eps_delta_0
    )
    if not np.isfinite(lp):
        return -np.inf
    else:
        return lp + log_likelihood(
            theta, z_S, z_L, velDisp, velDispErr, theta_E, seeing_atm, theta_ap
        )


# Minimizations and sampling methods


def minimization_loglikelihood(
    z_S,
    z_L,
    velDisp,
    velDispErr,
    theta_E,
    seeing_atm,
    theta_ap,
    seed=42,
    alpha_ini=2.0,
    beta_ini=0.18,
    delta_ini=2.4,
    gamma_ini=1.0,
):
    """Maximization of Likehood function

    Args:
        z_S (float): source redshift
        z_L (float): lens redshift
        velDisp (float): velocity dispersion
        velDispErr (float): velocity dispersion error (std. dev.)
        theta_E (float): Einstein radius (in radians)
        seeing_atm (float): Atmospheric seeing (in radians)
        theta_ap (float): Aperture size (in radians)
        seed (float): random seed for reproducibility purposes. Default: 42.
        alpha_ini (float, optional): Initial guess for alpha. Default: 2.0.
        beta_ini (float, optional): Initial guess for beta. Default: 0.18.
        delta_ini (float, optional): Initial guess for delta. Default: 2.4.
        gamma_ini (float, optional): Initial guess for gamma. Default: 1.0.

    Returns:
        list: list of alpha, beta, delta, and gamma obtained from minimization of likelihood function.
    """
    np.random.seed(seed)
    nll = lambda *args: -log_likelihood(*args)

    initial = np.array(
        [alpha_ini, beta_ini, delta_ini, gamma_ini]
    ) + 1e-5 * np.random.randn(4)

    soln = minimize(
        nll,
        initial,
        args=(
            z_S,
            z_L,
            velDisp,
            velDispErr,
            theta_E,
            seeing_atm,
            theta_ap,
        ),
    )  # , method='Nelder-Mead', tol=1e-10)

    alpha_ml, beta_ml, delta_ml, gamma_ml = soln.x
    return alpha_ml, beta_ml, delta_ml, gamma_ml


def minimization_logprobability(
    z_S,
    z_L,
    velDisp,
    velDispErr,
    theta_E,
    seeing_atm,
    theta_ap,
    seed=42,
    alpha_ini=2.0,
    beta_ini=0.18,
    delta_ini=2.4,
    gamma_ini=1.0,
    alpha_0_value=2.0,
    eps_alpha_0_value=0.08,
    beta_0_value=0.18,
    eps_beta_0_value=0.13,
    delta_0_value=2.4,
    eps_delta_0_value=0.11,
):
    """Maximization of Log Probability function

    Args:
        z_S (float): source redshift
        z_L (float): lens redshift
        velDisp (float): velocity dispersion
        velDispErr (float): velocity dispersion error (std. dev.)
        theta_E (float): Einstein radius (in radians)
        seeing_atm (float): Atmospheric seeing (in radians)
        theta_ap (float): Aperture size (in radians)
        seed (float): random seed for reproducibility purposes.
        alpha_ini (float, optional): Initial guess for alpha. Defaults to 2.0.
        beta_ini (float, optional): Initial guess for beta. Defaults to 0.18.
        delta_ini (float, optional): Initial guess for delta. Defaults to 2.4.
        gamma_ini (float, optional): Initial guess for gamma. Defaults to 1.0.
        alpha_0_value (float, optional): expected value for alpha. Defaults to 2.0.
        eps_alpha_0_value (float, optional): variance for alpha. Defaults to 0.08.
        beta_0_value (float, optional): expected value for beta. Defaults to 0.18.
        eps_beta_0_value (float, optional): variance for beta. Defaults to 0.13.
        delta_0_value (float, optional): expected value for delta. Defaults to 2.4.
        eps_delta_0_value (float, optional): variance for delta. Defaults to 0.11.

    Returns:
        list: list of alpha, beta, delta, and gamma obtained from minimization of log-probability function.
    """
    alpha_0 = np.repeat(alpha_0_value, len(z_S))
    eps_alpha_0 = np.repeat(eps_alpha_0_value, len(z_S))

    beta_0 = np.repeat(beta_0_value, len(z_S))
    eps_beta_0 = np.repeat(eps_beta_0_value, len(z_S))

    delta_0 = np.repeat(delta_0_value, len(z_S))
    eps_delta_0 = np.repeat(eps_delta_0_value, len(z_S))

    np.random.seed(seed)
    nll_2 = lambda *args: -log_probability(*args)
    initial = np.array(
        [alpha_ini, beta_ini, delta_ini, gamma_ini]
    ) + 1e-5 * np.random.randn(4)

    soln_2 = minimize(
        nll_2,
        initial,
        args=(
            z_S,
            z_L,
            velDisp,
            velDispErr,
            theta_E,
            seeing_atm,
            theta_ap,
            alpha_0,
            eps_alpha_0,
            beta_0,
            eps_beta_0,
            delta_0,
            eps_delta_0,
        ),
    )  # , method='Nelder-Mead', tol=1e-10)
    alpha_ml2, beta_ml2, delta_ml2, gamma_ml2 = soln_2.x

    return float(alpha_ml2), float(beta_ml2), float(delta_ml2), float(gamma_ml2)


def logprobability_sampling(
    z_S,
    z_L,
    velDisp,
    velDispErr,
    theta_E,
    seeing_atm,
    theta_ap,
    seed=42,
    alpha_ini=2.0,
    beta_ini=0.18,
    delta_ini=2.4,
    gamma_ini=1.0,
    alpha_0_value=2.0,
    eps_alpha_0_value=0.08,
    beta_0_value=0.18,
    eps_beta_0_value=0.13,
    delta_0_value=2.4,
    eps_delta_0_value=0.11,
    n_dim=4,
    n_walkers=64,
    n_burn=500,
    n_steps=10000,
    progress=True,
    processes=1,
):
    """Sampling logprobability function with emcee

    Args:
        z_S (float): source redshift
        z_L (float): lens redshift
        velDisp (float): velocity dispersion
        velDispErr (float): velocity dispersion error (std. dev.)
        theta_E (float): Einstein radius (in radians)
        seeing_atm (float): Atmospheric seeing (in radians)
        theta_ap (float): Aperture size (in radians)
        seed (float): random seed for reproducibility purposes.
        alpha_ini (float, optional): Initial guess for alpha. Defaults to 2.0.
        beta_ini (float, optional): Initial guess for beta. Defaults to 0.18.
        delta_ini (float, optional): Initial guess for delta. Defaults to 2.4.
        gamma_ini (float, optional): Initial guess for gamma. Defaults to 1.0.
        alpha_0_value (float, optional): expected value for alpha. Defaults to 2.0.
        eps_alpha_0_value (float, optional): variance for alpha. Defaults to 0.08.
        beta_0_value (float, optional): expected value for beta. Defaults to 0.18.
        eps_beta_0_value (float, optional): variance for beta. Defaults to 0.13.
        delta_0_value (float, optional): expected value for delta. Defaults to 2.4.
        eps_delta_0_value (float, optional): variance for delta. Defaults to 0.11.
        n_dim (int, optional): number of parameters in the model (r and p). Defaults to 4.
        n_walkers (int, optional): number of MCMC walkers. Defaults to 64.
        n_burn (int, optional): "burn-in" period to let chains stabilize. Defaults to 500.
        n_steps (int, optional): number of MCMC steps to take after burn-in. Defaults to 10000.
        progress (bool, optional): Show progress bar. Defaults to True.
        processes (int, optional): Number of processes in parallel. Defaults to 1.
    """
    alpha_0 = np.repeat(alpha_0_value, len(z_S))
    eps_alpha_0 = np.repeat(eps_alpha_0_value, len(z_S))

    beta_0 = np.repeat(beta_0_value, len(z_S))
    eps_beta_0 = np.repeat(eps_beta_0_value, len(z_S))

    delta_0 = np.repeat(delta_0_value, len(z_S))
    eps_delta_0 = np.repeat(eps_delta_0_value, len(z_S))

    with Pool(processes=processes) as pool:
        sampler = emcee.EnsembleSampler(
            n_walkers,
            n_dim,
            log_probability,
            args=(
                z_S,
                z_L,
                velDisp,
                velDispErr,
                theta_E,
                seeing_atm,
                theta_ap,
                alpha_0,
                eps_alpha_0,
                beta_0,
                eps_beta_0,
                delta_0,
                eps_delta_0,
            ),
            pool=pool,
        )
        np.random.seed(seed)
        # solu = np.asarray([alpha_ini, beta_ini, delta_ini, gamma_ini])
        # p0 = soln.x + 1e-5 * np.random.randn(n_walkers, n_dim)
        solu = minimization_loglikelihood(
            z_S,
            z_L,
            velDisp,
            velDispErr,
            theta_E,
            seeing_atm,
            theta_ap,
            seed,
            alpha_ini,
            beta_ini,
            delta_ini,
            gamma_ini,
        )
        p0 = solu + 1e-3 * np.random.randn(n_walkers, n_dim)

        # Run n_burn steps as a burn-in:
        print("Running burn-in ...")
        pos, prob, state = sampler.run_mcmc(p0, n_burn, progress=progress)

        # Reset the chain to remove the burn-in samples:
        sampler.reset()

        # Starting from the final position in the burn-in chain, sample for n_steps steps:
        print("Sampling ...")
        sampler.run_mcmc(pos, n_steps, rstate0=state, progress=progress)

    return sampler
