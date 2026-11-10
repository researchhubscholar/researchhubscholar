# Initial inferential analysis

Results and figures now guides CSV preparation with a downloadable synthetic example and an existing first-10-row preview. Selection settings persist as optional `workspace.analysis` in the existing private results JSON; legacy workspaces remain valid. No migration is needed beyond the existing results table.

Implemented: two-sided independent Welch t-test with mean difference and t-based 95% CI; Pearson r with two-sided t-distribution p and Fisher-transform 95% CI (n>=4); Pearson chi-square without Yates with Cramer V. Cramer V CI is not provided and is labelled explicitly. Separate native XLSX and DOCX exports carry variables, N, exclusions, method, statistic, df, p, effect, CI, assumptions and engine version.

The user explicitly selects variables and confirms independence. Missing rows are removed per selected pair and counted. Non-empty invalid quantitative values, constant/near-constant correlation inputs, unsuitable group counts and expected chi-square cells below 5 block calculation. Numeric category codes are interpreted as categories only in group/category positions. A minimum of three values per Welch group is an application guard, not a proof of suitability. Normality, linearity, outliers and repeated participants cannot be established from these checks; the UI states these limitations before confirmation. No automated significance conclusion, causal claim, multiplicity correction, paired tests, regression or nonparametric tests.

Calculations run locally in the browser, without sending observations to an AI provider. The user can explicitly save the dataset and selected analysis settings to their private project. Analysis settings reset on dataset replacement.

Validation: `python tests/generate-results-reference.py` regenerates 12 fixed synthetic cases using SciPy 1.17.0; `node tests/results.cjs` compares statistics, degrees of freedom, effects, p-values and intervals within absolute tolerance 1e-6, plus missing-row and guard cases. Reference APIs:
- https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_ind.html (`equal_var=False`)
- https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html
- https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.contingency.chi2_contingency.html (`correction=False`)

Distribution functions use pinned, unmodified jStat 1.9.6; source/license/checksum in vendor/jstat. This numerical verification does not establish appropriateness for a particular research design.
